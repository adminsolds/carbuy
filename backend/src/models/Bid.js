const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Bid = sequelize.define('Bid', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  car_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'car_id',
    references: {
      model: 'cars',
      key: 'id'
    }
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  // Whether this bid is the winning bid (set when auction ends)
  is_winning: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_winning'
  },
  // Bid status: pending, outbid, won, lost
  status: {
    type: DataTypes.ENUM('pending', 'outbid', 'won', 'lost'),
    defaultValue: 'pending'
  }
}, {
  timestamps: true,
  tableName: 'bids',
  indexes: [
    { fields: ['car_id'] },
    { fields: ['user_id'] },
    { fields: ['status'] },
    { fields: ['is_winning'] },
    // Composite index for finding highest bid per car efficiently
    { fields: ['car_id', 'amount'] }
  ]
});

module.exports = Bid;