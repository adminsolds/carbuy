const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: { isEmail: true }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  role: {
    type: DataTypes.ENUM('buyer', 'seller', 'agent'),
    defaultValue: 'buyer'
  },
  avatar_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'avatar_url'
  },
  email_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'email_verified'
  },
  email_verification_code: {
    type: DataTypes.STRING(10),
    allowNull: true,
    field: 'email_verification_code'
  },
  email_verification_expires: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'email_verification_expires'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  // Extended profile fields from frontend Signup form
  ic_passport: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'ic_passport'
  },
  gender: {
    type: DataTypes.ENUM('Male', 'Female', 'Other'),
    allowNull: true
  },
  company_name: {
    type: DataTypes.STRING(200),
    allowNull: true,
    field: 'company_name'
  },
  company_phone: {
    type: DataTypes.STRING(30),
    allowNull: true,
    field: 'company_phone'
  },
  tin_number: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'tin_number'
  },
  address_street: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'address_street'
  },
  address_zip: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'address_zip'
  },
  address_city: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'address_city'
  },
  address_state: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'address_state'
  },
  address_country: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'address_country'
  },
  reset_token: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'reset_token'
  },
  reset_token_expires: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'reset_token_expires'
  }
}, {
  timestamps: true,
  tableName: 'users',
  indexes: [
    { fields: ['email'] },
    { fields: ['role'] },
    { fields: ['is_active'] }
  ]
});

module.exports = User;
