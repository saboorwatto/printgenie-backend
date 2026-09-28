const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const User = require('../models/User');
const Shop = require('../models/Shop');
const Order = require('../models/Order');
const PricingConfig = require('../models/PricingConfig');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Helper: start date for a daily/weekly/monthly period
function getStartDate(period) {
  const now = new Date();
  if (period === 'daily') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (period === 'weekly') {
    const d = new Date(now);
    d.setDate(now.getDate() - 7);
    return d;
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/* ---------------------------- USERS ---------------------------- */

// GET /api/admin/users
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}).select('-password -resetCode -resetCodeExpires');
    res.json(users);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/admin/users/:id/deactivate  (toggles Active/Inactive)
router.put('/users/:id/deactivate', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.status = user.status === 'Active' ? 'Inactive' : 'Active';
    await user.save();

    res.json({ success: true, status: user.status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/admin/users/:id/promote
router.put('/users/:id/promote', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.role = 'admin';
    await user.save();

    res.json({ success: true, role: user.role });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Don't allow an admin to delete their own account this way
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ---------------------------- SHOPS ---------------------------- */

// GET /api/admin/shops
router.get('/shops', requireAuth, requireAdmin, async (req, res) => {
  try {
    const shops = await Shop.find({}).populate('owner', 'name email');
    res.json(shops);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/admin/shops/:id/approve
router.put('/shops/:id/approve', requireAuth, requireAdmin, async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

    shop.status = 'Active';
    await shop.save();

    res.json({ success: true, status: shop.status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/admin/shops/:id/reject
router.put('/shops/:id/reject', requireAuth, requireAdmin, async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

    shop.status = 'Rejected';
    await shop.save();

    res.json({ success: true, status: shop.status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ---------------------------- DASHBOARD ---------------------------- */

// GET /api/admin/dashboard/stats?period=daily|weekly|monthly
router.get('/dashboard/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const period = req.query.period || 'monthly';
    const startDate = getStartDate(period);
    const dateFilter = { createdAt: { $gte: startDate } };

    const totalOrders = await Order.countDocuments(dateFilter);
    const customers = await User.countDocuments({ role: 'customer', createdAt: { $gte: startDate } });
    const pendingShops = await Shop.countDocuments({ status: 'Pending' });

    const revenueResult = await Order.aggregate([
      { $match: { paymentStatus: 'paid', ...dateFilter } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    res.json({ totalOrders, customers, totalRevenue, pendingShops, period });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ---------------------------- PRICING ---------------------------- */

// GET /api/admin/pricing
router.get('/pricing', requireAuth, requireAdmin, async (req, res) => {
  try {
    let config = await PricingConfig.findOne({});

    // If no config exists yet, create one with sensible defaults
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

/* ---------------------------- REPORTS ---------------------------- */

// GET /api/admin/reports/revenue?period=daily|weekly|monthly
router.get('/reports/revenue', requireAuth, requireAdmin, async (req, res) => {
  try {
    const period = req.query.period || 'monthly';
    const startDate = getStartDate(period);

    const results = await Order.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: startDate } } },
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

// GET /api/admin/reports/summary?period=daily|weekly|monthly
router.get('/reports/summary', requireAuth, requireAdmin, async (req, res) => {
  try {
    const period = req.query.period || 'monthly';
    const now = new Date();
    const startDate = getStartDate(period);
    let prevStartDate;

    if (period === 'daily') {
      prevStartDate = new Date(startDate);
      prevStartDate.setDate(startDate.getDate() - 1);
    } else if (period === 'weekly') {
      prevStartDate = new Date(startDate);
      prevStartDate.setDate(startDate.getDate() - 7);
    } else {
      prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    }

    const currentTotal = await Order.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: startDate } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    const prevTotal = await Order.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: prevStartDate, $lt: startDate } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);

    const current = currentTotal[0]?.total || 0;
    const previous = prevTotal[0]?.total || 0;
    const percentChange = previous === 0 ? 0 : Math.round(((current - previous) / previous) * 100);

    const topProducts = await Order.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: '$product', orders: { $sum: 1 } } },
      { $sort: { orders: -1 } },
      { $limit: 5 },
    ]);

    res.json({
      salesTotal: current,
      percentChange,
      topProducts: topProducts.map((p) => ({ name: p._id || 'Unknown', orders: p.orders })),
    });
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

module.exports = router;