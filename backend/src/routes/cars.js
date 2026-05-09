const express = require('express');
const router = express.Router();
const { Car, Bid, User } = require('../models');
const { Op } = require('sequelize');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const agentPermission = require('../middleware/agentPermission');
const { getAuctionEnabled } = require('../services/settingsService');

// Helpers
const isTruthy = (val) => ['1', 'true', 'yes', 'on'].includes(String(val || '').toLowerCase());

const resolveScope = (query = {}, auctionEnabled = false) => {
  const entry = String(query.entry || 'sale').toLowerCase();
  const isAuctionEntry = auctionEnabled && entry === 'auction';
  return { entry, auctionEnabled, isAuctionEntry };
};

// GET /api/cars — List cars with filtering, search, pagination
router.get('/', async (req, res) => {
  try {
    const {
      brand,
      search,
      status,
      min_price,
      max_price,
      min_year,
      max_year,
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const auctionEnabled = await getAuctionEnabled();
    const { entry, isAuctionEntry } = resolveScope(req.query, auctionEnabled);
    const includeAuction = isTruthy(req.query.includeAuction);

    const where = { is_deleted: false };

    // Brand filter
    if (brand) where.brand = brand;

    // Keyword search across brand and model
    if (search) {
      where[Op.or] = [
        { brand: { [Op.like]: `%${search}%` } },
        { model: { [Op.like]: `%${search}%` } }
      ];
    }

    // Price range filter
    if (min_price !== undefined || max_price !== undefined) {
      where.price = {};
      if (min_price !== undefined) where.price[Op.gte] = Number(min_price);
      if (max_price !== undefined) where.price[Op.lte] = Number(max_price);
    }

    // Year range filter
    if (min_year !== undefined || max_year !== undefined) {
      where.year = {};
      if (min_year !== undefined) where.year[Op.gte] = Number(min_year);
      if (max_year !== undefined) where.year[Op.lte] = Number(max_year);
    }

    // Status scope logic
    if (includeAuction) {
      // includeAuction explicitly requests all cars (used for dropdowns); apply status filter only if specified
      if (status && status !== 'all') where.status = status;
      // else: no status filter, show all (available + auction + sold)
    } else if (entry === 'auction') {
      if (!auctionEnabled) {
        // No auction vehicles when disabled — return empty result
        return res.json({ cars: [], total: 0, limit: parseInt(limit), offset: parseInt(offset), auctionEnabled });
      }
      where.status = 'auction';
    } else if (status) {
      if (status !== 'all') {
        if (!auctionEnabled && status === 'available') {
          // When auction is disabled, treat auction stock as direct-sale stock on frontend.
          where.status = { [Op.in]: ['available', 'auction'] };
        } else {
          where.status = status;
        }
      }
    } else {
      // Default sale scope:
      // - auction enabled: available + sold
      // - auction disabled: include auction stock in sale listings to avoid hidden inventory
      where.status = auctionEnabled
        ? { [Op.in]: ['available', 'sold'] }
        : { [Op.in]: ['available', 'sold', 'auction'] };
    }

    // Sort
    const allowedSortFields = ['createdAt', 'updatedAt', 'price', 'year', 'mileage', 'brand', 'model'];
    const resolvedSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const resolvedSortOrder = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const { count, rows: cars } = await Car.findAndCountAll({
      where,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      order: [[resolvedSortBy, resolvedSortOrder]],
      include: [
        {
          model: User,
          as: 'seller',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    // Attach computed fields (highest bid) for auction cars
    const carIds = cars.filter(c => c.status === 'auction').map(c => c.id);
    const highestBids = {};
    if (carIds.length > 0) {
      const bids = await Bid.findAll({
        where: { car_id: { [Op.in]: carIds } },
        attributes: ['car_id', 'amount'],
        group: ['car_id'],
        raw: true
      });
      bids.forEach(b => { highestBids[b.car_id] = Number(b.amount); });
    }

    const normalizeAuctionToSale = !auctionEnabled && entry !== 'auction' && !includeAuction;
    const carsWithComputed = cars.map((car) => {
      const payload = {
        ...car.toJSON(),
        highest_bid: highestBids[car.id] || null
      };

      if (normalizeAuctionToSale && payload.status === 'auction') {
        payload.status = 'available';
        payload.auction_end_time = null;
        payload.starting_bid = null;
      }

      return payload;
    });

    res.json({
      cars: carsWithComputed,
      total: count,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      sortBy: resolvedSortBy,
      sortOrder: resolvedSortOrder,
      auctionEnabled
    });
  } catch (error) {
    console.error('Get cars error:', error);
    res.status(500).json({ error: 'Failed to fetch cars.' });
  }
});

// GET /api/cars/brands — Distinct brand list
router.get('/brands', async (req, res) => {
  try {
    const auctionEnabled = await getAuctionEnabled();
    const { entry, isAuctionEntry } = resolveScope(req.query, auctionEnabled);

    const where = { is_deleted: false };

    if (entry === 'auction' && !auctionEnabled) {
      where.status = { [Op.eq]: '__none__' };
    } else if (isAuctionEntry) {
      where.status = 'auction';
    } else {
      where.status = auctionEnabled
        ? { [Op.in]: ['available', 'sold'] }
        : { [Op.in]: ['available', 'sold', 'auction'] };
    }

    const brands = await Car.findAll({
      attributes: ['brand'],
      where,
      group: ['brand'],
      order: [['brand', 'ASC']]
    });

    res.json({ brands: brands.map(b => b.brand) });
  } catch (error) {
    console.error('Get brands error:', error);
    res.status(500).json({ error: 'Failed to fetch brands.' });
  }
});

// GET /api/cars/:id — Single car with bids and computed highest bid
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const auctionEnabled = await getAuctionEnabled();
    const includeAuction = isTruthy(req.query.includeAuction);

    const car = await Car.findByPk(id, {
      include: [
        { model: User, as: 'seller', attributes: ['id', 'name', 'email', 'phone'] }
      ]
    });

    if (!car || car.is_deleted) {
      return res.status(404).json({ error: 'Car not found.' });
    }

    // Get highest bid
    const highestBid = await Bid.findOne({
      where: { car_id: id },
      order: [['amount', 'DESC']]
    });

    // Get bid count
    const bidCount = await Bid.count({ where: { car_id: id } });

    // Determine auction view
    const entry = String(req.query.entry || '').toLowerCase();
    const isAuctionEntry = auctionEnabled && entry === 'auction';
    const auctionView = includeAuction || (isAuctionEntry && car.status === 'auction');

    res.json({
      car,
      highestBid: highestBid ? highestBid.amount : null,
      bidCount,
      auctionEnabled,
      auctionView
    });
  } catch (error) {
    console.error('Get car error:', error);
    res.status(500).json({ error: 'Failed to fetch car details.' });
  }
});

// POST /api/cars — Create car (seller/agent)
router.post('/', auth, authorize('seller', 'agent'), agentPermission('add_car'), async (req, res) => {
  try {
    const {
      brand, model, year, mileage, color, price, description, images,
      status, transmission, fuel_type, engine_cc, chassis_no,
      registration_expiry, owners_count, road_tax_expire,
      auction_end_time, starting_bid, repaired
    } = req.body;

    if (!brand || !model || !year || mileage === undefined || price === undefined) {
      return res.status(400).json({ error: 'brand, model, year, mileage and price are required.' });
    }

    const normalizedStatus = ['available', 'auction', 'sold'].includes(status) ? status : 'available';

    // Auto-generate chassis number if not provided
    const chassis = chassis_no || `SGAT-${String(Date.now()).slice(-8)}`;

    const car = await Car.create({
      brand,
      model,
      year: Number(year),
      mileage: Number(mileage),
      color: color || null,
      price: Number(price),
      description: description || null,
      images: Array.isArray(images) ? images : [],
      status: normalizedStatus,
      transmission: transmission || null,
      fuel_type: fuel_type || null,
      engine_cc: engine_cc ? Number(engine_cc) : null,
      chassis_no: chassis,
      registration_expiry: registration_expiry || null,
      owners_count: owners_count !== undefined ? Number(owners_count) : null,
      road_tax_expire: road_tax_expire || null,
      auction_end_time: normalizedStatus === 'auction' ? auction_end_time || null : null,
      starting_bid: normalizedStatus === 'auction' ? Number(starting_bid || 0) : null,
      seller_id: req.user.id,
      repaired: ['yes', 'no'].includes(repaired) ? repaired : 'no'
    });

    res.status(201).json({ message: 'Car created successfully.', car });
  } catch (error) {
    console.error('Create car error:', error);
    res.status(500).json({ error: 'Failed to create car.' });
  }
});

// PUT /api/cars/:id — Update car (seller/agent)
router.put('/:id', auth, authorize('seller', 'agent'), agentPermission('edit_car'), async (req, res) => {
  try {
    const { id } = req.params;
    const car = await Car.findByPk(id);

    if (!car || car.is_deleted) {
      return res.status(404).json({ error: 'Car not found.' });
    }

    const {
      brand, model, year, mileage, color, price, description, images,
      status, transmission, fuel_type, engine_cc, chassis_no,
      registration_expiry, owners_count, road_tax_expire,
      auction_end_time, starting_bid, repaired
    } = req.body;

    const nextStatus = ['available', 'auction', 'sold'].includes(status) ? status : car.status;

    await car.update({
      brand: brand ?? car.brand,
      model: model ?? car.model,
      year: year !== undefined ? Number(year) : car.year,
      mileage: mileage !== undefined ? Number(mileage) : car.mileage,
      color: color ?? car.color,
      price: price !== undefined ? Number(price) : car.price,
      description: description ?? car.description,
      images: Array.isArray(images) ? images : car.images,
      status: nextStatus,
      transmission: transmission ?? car.transmission,
      fuel_type: fuel_type ?? car.fuel_type,
      engine_cc: engine_cc !== undefined ? (engine_cc ? Number(engine_cc) : null) : car.engine_cc,
      chassis_no: chassis_no ?? car.chassis_no,
      registration_expiry: registration_expiry ?? car.registration_expiry,
      owners_count: owners_count !== undefined ? Number(owners_count) : car.owners_count,
      road_tax_expire: road_tax_expire ?? car.road_tax_expire,
      auction_end_time: nextStatus === 'auction' ? (auction_end_time !== undefined ? auction_end_time : car.auction_end_time) : null,
      starting_bid: nextStatus === 'auction'
        ? (starting_bid !== undefined ? Number(starting_bid) : car.starting_bid)
        : null,
      repaired: repaired !== undefined ? (['yes', 'no'].includes(repaired) ? repaired : car.repaired) : car.repaired
    });

    res.json({ message: 'Car updated successfully.', car });
  } catch (error) {
    console.error('Update car error:', error);
    res.status(500).json({ error: 'Failed to update car.' });
  }
});

// DELETE /api/cars/:id — Soft delete car (seller only)
router.delete('/:id', auth, authorize('seller'), async (req, res) => {
  try {
    const { id } = req.params;
    const car = await Car.findByPk(id);

    if (!car || car.is_deleted) {
      return res.status(404).json({ error: 'Car not found.' });
    }

    // Soft delete — preserve bids for history
    await car.update({ is_deleted: true });

    res.json({ message: 'Car deleted successfully.' });
  } catch (error) {
    console.error('Delete car error:', error);
    res.status(500).json({ error: 'Failed to delete car.' });
  }
});

module.exports = router;
