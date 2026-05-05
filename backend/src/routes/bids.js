const express = require('express');
const router = express.Router();
const { Bid, User, Car } = require('../models');
const { Op } = require('sequelize');
const auth = require('../middleware/auth');
const { getAuctionEnabled } = require('../services/settingsService');

// POST /api/bids — Place a bid (authenticated)
router.post('/', auth, async (req, res) => {
  try {
    const { car_id, amount } = req.body;
    const user_id = req.user.id;

    if (!car_id || !amount) {
      return res.status(400).json({ error: 'Car ID and amount are required.' });
    }

    const auctionEnabled = await getAuctionEnabled();
    if (!auctionEnabled) {
      return res.status(403).json({ error: 'Auction is currently disabled.' });
    }

    const car = await Car.findByPk(car_id);
    if (!car || car.is_deleted) {
      return res.status(404).json({ error: 'Car not found.' });
    }
    if (car.status !== 'auction') {
      return res.status(400).json({ error: 'This vehicle is not in auction mode.' });
    }
    if (car.auction_end_time && new Date(car.auction_end_time) < new Date()) {
      return res.status(400).json({ error: 'Auction has ended.' });
    }

    // Get current highest bid for this car
    const currentHighest = await Bid.findOne({
      where: { car_id },
      order: [['amount', 'DESC']]
    });

    const minBid = currentHighest
      ? parseFloat(currentHighest.amount) + 100
      : parseFloat(car.starting_bid || 0);

    if (parseFloat(amount) < minBid) {
      return res.status(400).json({
        error: `Bid must be at least RM ${minBid.toLocaleString()}.`
      });
    }

    // Mark previous bids of this user for this car as 'outbid'
    await Bid.update(
      { status: 'outbid' },
      { where: { car_id, user_id, status: 'pending' } }
    );

    const bid = await Bid.create({
      car_id,
      user_id,
      amount,
      status: 'pending'
    });

    res.status(201).json({
      message: 'Bid placed successfully.',
      bid: {
        id: bid.id,
        car_id: bid.car_id,
        amount: bid.amount,
        createdAt: bid.createdAt
      }
    });
  } catch (error) {
    console.error('Place bid error:', error);
    res.status(500).json({ error: 'Failed to place bid.' });
  }
});

// GET /api/bids/car/:carId — Bids for a specific car
router.get('/car/:carId', async (req, res) => {
  try {
    const { carId } = req.params;

    const bids = await Bid.findAll({
      where: { car_id: carId },
      include: [
        { model: User, as: 'user', attributes: ['name'] }
      ],
      order: [['amount', 'DESC']]
    });

    res.json({ bids });
  } catch (error) {
    console.error('Get bids error:', error);
    res.status(500).json({ error: 'Failed to fetch bids.' });
  }
});

// GET /api/bids/me — Current user's bid history with status
router.get('/me', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all bids by this user, with car info
    const userBids = await Bid.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Car,
          as: 'car',
          attributes: ['id', 'brand', 'model', 'status', 'auction_end_time', 'starting_bid']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Group by car and compute status
    const carIds = [...new Set(userBids.map(b => b.car_id))];
    const highestByCar = {};

    await Promise.all(
      carIds.map(async (carId) => {
        const highest = await Bid.findOne({
          where: { car_id: carId },
          order: [['amount', 'DESC']]
        });
        highestByCar[carId] = highest ? Number(highest.amount) : 0;
      })
    );

    const result = userBids.map(bid => {
      const carHighest = highestByCar[bid.car_id] || 0;
      const ownAmount = Number(bid.amount);
      const auctionEnded = bid.car?.auction_end_time
        ? new Date(bid.car.auction_end_time).getTime() < Date.now()
        : false;

      let status = 'pending';
      if (auctionEnded) {
        status = ownAmount >= carHighest ? 'won' : 'lost';
      } else {
        status = ownAmount >= carHighest ? 'winning' : 'outbid';
      }

      return {
        id: bid.id,
        carId: bid.car_id,
        carName: `${bid.car?.brand || ''} ${bid.car?.model || ''}`.trim(),
        carStatus: bid.car?.status || 'unknown',
        auction_end_time: bid.car?.auction_end_time || null,
        bidAmount: ownAmount,
        createdAt: bid.createdAt,
        status
      };
    });

    res.json({ bids: result });
  } catch (error) {
    console.error('Get my bids error:', error);
    res.status(500).json({ error: 'Failed to fetch your bids.' });
  }
});

module.exports = router;