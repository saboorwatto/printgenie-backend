const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
    product: { type: String },
    quantity: { type: Number },
    totalAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'production', 'shipped', 'completed', 'cancelled'],
      default: 'pending',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid'],
      default: 'pending',
    },
  },
  { timestamps: true }
);
    
module.exports = mongoose.model('Order', orderSchema);