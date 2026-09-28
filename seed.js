require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Shop = require('./models/Shop');
const Order = require('./models/Order');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB for seeding...');

  const hashedPassword = await bcrypt.hash('password123', 10);

  // --- Users ---
  const sampleUsers = [
    { name: 'Ali Khan', email: 'ali.khan@example.com', password: hashedPassword, phone: '0301-1234567', role: 'customer', status: 'Active' },
    { name: 'Sara Ahmed', email: 'sara.ahmed@example.com', password: hashedPassword, phone: '0322-9876543', role: 'customer', status: 'Active' },
    { name: 'Hassan Raza', email: 'hassan.raza@example.com', password: hashedPassword, phone: '0333-1112233', role: 'shopOwner', status: 'Active' },
    { name: 'Zainab Malik', email: 'zainab.malik@example.com', password: hashedPassword, phone: '0345-4445566', role: 'customer', status: 'Inactive' },
    { name: 'Bilal Ahmed', email: 'bilal.ahmed@example.com', password: hashedPassword, phone: '0312-7778899', role: 'shopOwner', status: 'Active' },
  ];

  let insertedUsers = [];
  for (const u of sampleUsers) {
    const existing = await User.findOne({ email: u.email });
    if (!existing) {
      const created = await User.create(u);
      insertedUsers.push(created);
    } else {
      insertedUsers.push(existing);
    }
  }
  console.log(`Users ready: ${insertedUsers.length}`);

  // --- Shops ---
  const sampleShops = [
    { name: 'Print Palace', location: 'Lahore, Punjab', rating: 4.8, status: 'Active', owner: insertedUsers[2]._id },
    { name: 'ColorMax Printers', location: 'Karachi, Sindh', rating: 4.3, status: 'Active', owner: insertedUsers[4]._id },
    { name: 'Quality Prints', location: 'Multan, Punjab', rating: 4.5, status: 'Pending' },
    { name: 'Creative Studio', location: 'Faisalabad, Punjab', rating: 4.2, status: 'Pending' },
  ];

  let insertedShops = [];
  for (const s of sampleShops) {
    const existing = await Shop.findOne({ name: s.name });
    if (!existing) {
      const created = await Shop.create(s);
      insertedShops.push(created);
    } else {
      insertedShops.push(existing);
    }
  }
  console.log(`Shops ready: ${insertedShops.length}`);

  // --- Orders (spread across the last 25 days, for the revenue chart) ---
  const products = ['Business Cards', 'A3 Posters', 'Flyers A5', 'Brochures', 'Banners', 'Stickers'];
  const statuses = ['pending', 'production', 'shipped', 'completed'];
  const orderCustomers = insertedUsers.filter((u) => u.role === 'customer');

  const existingOrderCount = await Order.countDocuments({});
  if (existingOrderCount === 0) {
    const ordersToCreate = [];
    for (let i = 0; i < 30; i++) {
      const daysAgo = Math.floor(Math.random() * 25);
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - daysAgo);

      ordersToCreate.push({
        customer: orderCustomers[Math.floor(Math.random() * orderCustomers.length)]._id,
        shop: insertedShops[Math.floor(Math.random() * 2)]._id, // only the 2 Active shops
        product: products[Math.floor(Math.random() * products.length)],
        quantity: Math.floor(Math.random() * 400) + 20,
        totalAmount: Math.floor(Math.random() * 4000) + 500,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        paymentStatus: Math.random() > 0.2 ? 'paid' : 'pending',
        createdAt,
      });
    }
    await Order.insertMany(ordersToCreate);
    console.log(`Orders created: ${ordersToCreate.length}`);
  } else {
    console.log(`Orders already exist (${existingOrderCount}), skipping order seeding`);
  }

  console.log('Seeding complete!');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});