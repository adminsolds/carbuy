const sequelize = require('../config/database');
const User = require('./User');
const Car = require('./Car');
const Bid = require('./Bid');
const AppSetting = require('./AppSetting');
const Agent = require('./Agent');
const Order = require('./Order');

// User <-> Bid
User.hasMany(Bid, { foreignKey: 'user_id', as: 'bids' });
Bid.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Car <-> Bid
Car.hasMany(Bid, { foreignKey: 'car_id', as: 'bids' });
Bid.belongsTo(Car, { foreignKey: 'car_id', as: 'car' });

// Seller <-> Car
User.hasMany(Car, { foreignKey: 'seller_id', as: 'cars' });
Car.belongsTo(User, { foreignKey: 'seller_id', as: 'seller' });

// Agent <-> Order (one agent can have many orders)
Agent.hasMany(Order, { foreignKey: 'agent_id', as: 'orders' });
Order.belongsTo(Agent, { foreignKey: 'agent_id', as: 'agent' });

// User <-> Order (one user can have many orders)
User.hasMany(Order, { foreignKey: 'user_id', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Car <-> Order (one car can be in many orders, but typically one active order)
Car.hasMany(Order, { foreignKey: 'car_id', as: 'orders' });
Order.belongsTo(Car, { foreignKey: 'car_id', as: 'car' });

module.exports = {
  sequelize,
  User,
  Car,
  Bid,
  AppSetting,
  Agent,
  Order
};