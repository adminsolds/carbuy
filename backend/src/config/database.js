const { Sequelize } = require('sequelize');
require('dotenv').config();

// Use SQLite for easier setup (no MySQL installation required)
const isTestEnv = process.env.NODE_ENV === 'test';
const sqliteStorage = isTestEnv ? './database.test.sqlite' : './database.sqlite';

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: sqliteStorage,
  logging: false
});

module.exports = sequelize;
