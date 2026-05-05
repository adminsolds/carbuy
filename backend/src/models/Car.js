const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Car = sequelize.define('Car', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  brand: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  model: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  mileage: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  color: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  images: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  auction_end_time: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'auction_end_time'
  },
  starting_bid: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    field: 'starting_bid'
  },
  status: {
    type: DataTypes.ENUM('available', 'sold', 'auction'),
    defaultValue: 'available'
  },
  // New fields to support richer car data
  transmission: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  fuel_type: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'fuel_type'
  },
  engine_cc: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'engine_cc'
  },
  chassis_no: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'chassis_no'
  },
  registration_expiry: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'registration_expiry'
  },
  owners_count: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'owners_count'
  },
  road_tax_expire: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'road_tax_expire'
  },
  // Seller reference
  seller_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'seller_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  // Soft delete support
  is_deleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_deleted'
  },
  // Repair history
  repaired: {
    type: DataTypes.ENUM('yes', 'no'),
    allowNull: true,
    defaultValue: 'no',
    field: 'repaired'
  }
}, {
  timestamps: true,
  tableName: 'cars',
  indexes: [
    { fields: ['brand'] },
    { fields: ['status'] },
    { fields: ['year'] },
    { fields: ['price'] },
    { fields: ['seller_id'] },
    { fields: ['is_deleted'] },
    { fields: ['auction_end_time'] }
  ]
});

module.exports = Car;