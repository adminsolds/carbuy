// Lightweight getter wrappers around globals set by setup.js
module.exports = {
  get app() { return global._testApp; },
  get sellerToken() { return global._sellerToken; },
  get buyerToken() { return global._buyerToken; },
  get testCar() { return global._testCar; },
  get testAgent() { return global._testAgent; },
};
