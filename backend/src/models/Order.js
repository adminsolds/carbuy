const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  order_no: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true
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
  car_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'car_id',
    references: {
      model: 'cars',
      key: 'id'
    }
  },
  agent_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'agent_id',
    references: {
      model: 'agents',
      key: 'id'
    }
  },
  // Order type: purchase | auction_win | custom
  order_type: {
    type: DataTypes.ENUM('purchase', 'auction_win', 'custom'),
    defaultValue: 'purchase'
  },
  custom_order_type: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'custom_order_type'
  },
  custom_vehicle: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'custom_vehicle'
  },
  custom_vehicle_details: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'custom_vehicle_details'
  },
  images: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  // Final price agreed
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  // deposit paid
  deposit_paid: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    field: 'deposit_paid'
  },
  // Status: pending | deposit_paid | paid | processing | shipped | delivered | completed | cancelled | refunded
  status: {
    type: DataTypes.ENUM(
      'pending',
      'deposit_paid',
      'paid',
      'processing',
      'shipped',
      'delivered',
      'completed',
      'cancelled',
      'refunded'
    ),
    defaultValue: 'pending'
  },
  // Manual status flow shown as 6 editable steps in admin
  status_steps: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'status_steps'
  },
  // Buyer info snapshot
  buyer_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'buyer_name'
  },
  buyer_email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'buyer_email'
  },
  buyer_phone: {
    type: DataTypes.STRING(30),
    allowNull: true,
    field: 'buyer_phone'
  },
  // Delivery address snapshot
  delivery_address: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'delivery_address'
  },
  // Admin notes
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Timestamps for key events
  paid_at: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'paid_at'
  },
  delivered_at: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'delivered_at'
  }
}, {
  timestamps: true,
  tableName: 'orders',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['car_id'] },
    { fields: ['agent_id'] },
    { fields: ['status'] },
    { fields: ['order_no'] },
    { fields: ['order_type'] },
    { fields: ['createdAt'] }
  ]
});

module.exports = Order;
