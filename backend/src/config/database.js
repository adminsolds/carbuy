const { Sequelize } = require('sequelize');
require('dotenv').config();

// Use SQLite for easier setup (no MySQL installation required)
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false
});

module.exports = sequelize;