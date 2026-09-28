const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    location: { type: String },
    rating: { type: Number, default: 0 },
      status: {
      type: String,
      enum: ['Pending', 'Active', 'Rejected'],
      default: 'Pending',
    },  imageUrl: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Shop', shopSchema);