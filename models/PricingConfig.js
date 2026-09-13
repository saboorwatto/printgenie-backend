const mongoose = require('mongoose');

const priceItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: String, required: true },
  },
  { _id: false }
);

const pricingConfigSchema = new mongoose.Schema({
  materialCosts: [priceItemSchema],
  finishingCharges: [priceItemSchema],
  taxRates: [priceItemSchema],
  commissionRules: [priceItemSchema],
  quantityDiscounts: [priceItemSchema],
});

module.exports = mongoose.model('PricingConfig', pricingConfigSchema);