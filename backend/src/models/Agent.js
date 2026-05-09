const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Agent = sequelize.define('Agent', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  code: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  company: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  avatar_url: {
    type: DataTypes.STRING(255),
    allowNull: false,
    defaultValue: '/uploads/default-agent-avatar.svg',
    field: 'avatar_url'
  },
  access_enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'access_enabled'
  },
  access_user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'access_user_id'
  },
  can_add_car: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'can_add_car'
  },
  can_edit_car: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'can_edit_car'
  },
  can_update_order_status: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'can_update_order_status'
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: 'agents',
  indexes: [
    { fields: ['code'] },
    { fields: ['is_active'] },
    { fields: ['name'] }
  ]
});

module.exports = Agent;
