const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const Shop= require('../models/Shop');
const Order= require('../models/Order');
const PricingConfig = require('../models/PricingConfig');
const PDFDocument= require('pdfkit');

// GET /api/admin/users
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// GET /api/admin/shops
router.get('/shops', requireAuth, requireAdmin, async (req, res) => {
  try {
    const shops = await Shop.find({}).populate('owner', 'name email');
    res.json(shops);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// GET /api/admin/dashboard/stats
router.get('/dashboard/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments({});
    const customers = await User.countDocuments({ role: 'customer' });

    const revenueResult = await Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    res.json({ totalOrders, customers, totalRevenue });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// GET /api/admin/reports/revenue
router.get('/reports/revenue', requireAuth, requireAdmin, async (req, res) => {
  try {
    const results = await Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          amount: { $sum: '$totalAmount' },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 30 },
    ]);

    const formatted = results.map((r) => ({ label: r._id, amount: r.amount }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// GET /api/admin/reports/export?format=csv|pdf&from=&to=
router.get('/reports/export', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { format, from, to } = req.query;

    const filter = {};
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const orders = await Order.find(filter).populate('customer', 'name email');

    if (format === 'csv') {
      const header = 'Order ID,Customer,Product,Quantity,Total Amount,Status,Payment Status,Date\n';
      const rows = orders
        .map((o) =>
          [
            o._id,
            o.customer?.name || 'N/A',
            o.product || '',
            o.quantity || 0,
            o.totalAmount || 0,
            o.status,
            o.paymentStatus,
            o.createdAt.toISOString().split('T')[0],
          ].join(',')
        )
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=report.csv');
      return res.send(header + rows);
    }

    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 40 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=report.pdf');
      doc.pipe(res);

      doc.fontSize(18).text('PrintGenie — Sales Report', { align: 'center' });
      doc.moveDown();

      orders.forEach((o) => {
        doc
          .fontSize(10)
          .text(
            `${o._id} | ${o.customer?.name || 'N/A'} | ${o.product || ''} | Qty: ${o.quantity || 0} | PKR ${o.totalAmount || 0} | ${o.status} | ${o.paymentStatus}`
          );
      });

      doc.end();
      return;
    }

    res.status(400).json({ success: false, message: 'Invalid format. Use ?format=csv or ?format=pdf' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// GET /api/admin/ai-monitoring
router.get('/ai-monitoring', requireAuth, requireAdmin, async (req, res) => {
  try {
    // TODO: once the Python AI microservice exposes a real health-check
    // endpoint, call it here instead of returning static values.
    res.json({
      status: 'operational',
      avgResponseTime: '2.1s',
      uptime30d: '99.4%',
      models: [
        { name: 'YOLOv8 — Shape Detection', status: 'Healthy', accuracy: '94.2%', avgTime: '1.8s' },
        { name: 'CNN — Material Classifier', status: 'Healthy', accuracy: '91.7%', avgTime: '2.1s' },
      ],
      recentIssues: [],
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// GET /api/admin/pricing
router.get('/pricing', requireAuth, requireAdmin, async (req, res) => {
  try {
    let config = await PricingConfig.findOne({});

    // If no config exists yet, create one with sensible defaults so the
    // frontend always has something to render on first load.
    if (!config) {
      config = await PricingConfig.create({
        materialCosts: [
          { name: 'Matte 300gsm', price: 'PKR 250 /unit' },
          { name: 'Glossy 250gsm', price: 'PKR 220 /unit' },
          { name: 'Kraft Paper', price: 'PKR 300 /unit' },
        ],
        finishingCharges: [
          { name: 'UV Coating', price: 'PKR 150' },
          { name: 'Embossing', price: 'PKR 300' },
        ],
        taxRates: [
          { name: 'Standard Sales Tax', price: '17%' },
          { name: 'Punjab Service Tax', price: '5%' },
        ],
        commissionRules: [
          { name: 'Platform Commission (Standard)', price: '10%' },
          { name: 'Platform Commission (Premium Shop)', price: '7%' },
        ],
        quantityDiscounts: [
          { name: '50+ units', price: '5% off' },
          { name: '200+ units', price: '10% off' },
          { name: '500+ units', price: '15% off' },
        ],
      });
    }

    res.json(config);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/admin/pricing
router.put('/pricing', requireAuth, requireAdmin, async (req, res) => {
  try {
    let config = await PricingConfig.findOne({});

    if (!config) {
      config = await PricingConfig.create(req.body);
    } else {
      Object.assign(config, req.body);
      await config.save();
    }

    res.json(config);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;