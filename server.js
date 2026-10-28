
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET;
const ADMIN = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

if (!process.env.DATABASE_URL || !SECRET) {
  console.error('DATABASE_URL and JWT_SECRET are required');
  process.exit(1);
}

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const clean = x => typeof x === 'string' ? x.trim() : '';

const cats = [
  'መጽሐፍት',
  'ልብስ',
  'መስቀልና ጌጣጌጥ',
  'ሙዚቃ',
  'ፖስተርና ዲጂታል',
  'ሌሎች'
];

function token(u) {
  return jwt.sign(
    { id: u.id, email: u.email, role: u.role },
    SECRET,
    { expiresIn: '7d' }
  );
}

function auth(req, res, next) {
  try {
    if (!req.cookies.gm_token) throw Error('No token');
    req.user = jwt.verify(req.cookies.gm_token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'እባክዎ ይግቡ።' });
  }
}

function admin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'የአስተዳዳሪ ፈቃድ ያስፈልጋል።'
    });
  }
  next();
}

function setCookie(res, u) {
  res.cookie('gm_token', token(u), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 86400000
  });
}

async function init() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(254) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'seller',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(140) NOT NULL,
      description TEXT NOT NULL,
      category VARCHAR(40) NOT NULL,
      price NUMERIC(12,2) NOT NULL CHECK(price > 0),
      image_url TEXT,
      contact VARCHAR(80) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id),
      buyer_name VARCHAR(100) NOT NULL,
      buyer_phone VARCHAR(40) NOT NULL,
      delivery_area VARCHAR(160) NOT NULL,
      note TEXT,
      status VARCHAR(20) DEFAULT 'new',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  if (ADMIN) {
    await db.query(
      "UPDATE users SET role='admin' WHERE LOWER(email)=$1",
      [ADMIN]
    );
  }
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'GospelMarket Ethiopia' });
});

app.post('/api/register', async (req, res) => {
  try {
    const name = clean(req.body.name);
    const email = clean(req.body.email).toLowerCase();
    const pw = req.body.password;

    if (
      name.length < 2 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof pw !== 'string' ||
      pw.length < 8
    ) {
      return res.status(400).json({
        error: 'ስም፣ ትክክለኛ email እና ቢያንስ 8 ቁምፊ ያለው የይለፍ ቃል ያስገቡ።'
      });
    }

    const role = email === ADMIN && ADMIN ? 'admin' : 'seller';

    const r = await db.query(
      `INSERT INTO users(name,email,password_hash,role)
       VALUES($1,$2,$3,$4)
       RETURNING id,name,email,role`,
      [name, email, await bcrypt.hash(pw, 12), role]
    );

    setCookie(res, r.rows[0]);
    res.status(201).json({ user: r.rows[0] });
  } catch (e) {
    res.status(e.code === '23505' ? 409 : 500).json({
      error: e.code === '23505'
        ? 'ይህ email ቀድሞ ተመዝግቧል።'
        : 'ምዝገባ አልተሳካም።'
    });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const r = await db.query(
      'SELECT * FROM users WHERE email=$1',
      [clean(req.body.email).toLowerCase()]
    );

    if (
      !r.rowCount ||
      !await bcrypt.compare(
        String(req.body.password || ''),
        r.rows[0].password_hash
      )
    ) {
      return res.status(401).json({
        error: 'Email ወይም የይለፍ ቃል ትክክል አይደለም።'
      });
    }

    const u = r.rows[0];
    setCookie(res, u);

    res.json({
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role
      }
    });
  } catch {
    res.status(500).json({ error: 'መግባት አልተሳካም።' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('gm_token');
  res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/products', async (req, res) => {
  try {
    const r = await db.query(`
      SELECT p.id,p.title,p.description,p.category,p.price,
             p.image_url,p.contact,p.created_at,u.name seller_name
      FROM products p
      JOIN users u ON u.id=p.seller_id
      WHERE p.status='approved'
      ORDER BY p.created_at DESC
      LIMIT 150
    `);

    res.json({ products: r.rows });
  } catch {
    res.status(500).json({
      error: 'ምርቶችን ማምጣት አልተቻለም።'
    });
  }
});

app.get('/api/my-products', auth, async (req, res) => {
  try {
    const r = await db.query(
      'SELECT * FROM products WHERE seller_id=$1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ products: r.rows });
  } catch {
    res.status(500).json({ error: 'ምርቶችን ማምጣት አልተቻለም።' });
  }
});

app.post('/api/products', auth, async (req, res) => {
  try {
    const b = req.body;
    const title = clean(b.title);
    const description = clean(b.description);
    const category = clean(b.category);
    const price = Number(b.price);
    const image_url = clean(b.image_url);
    const contact = clean(b.contact);

    if (
      title.length < 3 ||
      description.length < 10 ||
      !cats.includes(category) ||
      !Number.isFinite(price) ||
      price <= 0 ||
      contact.length < 5 ||
      (image_url && !image_url.toLowerCase().startsWith('https://'))
    ) {
      return res.status(400).json({
        error: 'የምርት መረጃውን በትክክል ያስገቡ።'
      });
    }

    const r = await db.query(
      `INSERT INTO products
       (seller_id,title,description,category,price,image_url,contact)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        req.user.id,
        title,
        description,
        category,
        price,
        image_url || null,
        contact
      ]
    );

    res.status(201).json({
      product: r.rows[0],
      message: 'ምርቱ ለአስተዳዳሪ ማረጋገጫ ተልኳል።'
    });
  } catch {
    res.status(500).json({
      error: 'ምርቱን ማስገባት አልተቻለም።'
    });
  }
});

app.delete('/api/products/:id', auth, async (req, res) => {
  try {
    const r = await db.query(
      'DELETE FROM products WHERE id=$1 AND seller_id=$2 RETURNING id',
      [req.params.id, req.user.id]
    );

    if (!r.rowCount) {
      return res.status(404).json({ error: 'ምርቱ አልተገኘም።' });
    }

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'ምርቱን መሰረዝ አልተቻለም።' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const b = req.body;
    const phone = clean(b.buyer_phone);
    const name = clean(b.buyer_name);
    const area = clean(b.delivery_area);
    const id = Number(b.product_id);

    if (
      !Number.isInteger(id) ||
      name.length < 2 ||
      phone.length < 7 ||
      area.length < 2
    ) {
      return res.status(400).json({
        error: 'የትዕዛዝ መረጃውን ያሟሉ።'
      });
    }

    const p = await db.query(
      "SELECT id FROM products WHERE id=$1 AND status='approved'",
      [id]
    );

    if (!p.rowCount) {
      return res.status(404).json({
        error: 'ምርቱ አሁን አይገኝም።'
      });
    }

    const r = await db.query(
      `INSERT INTO orders
       (product_id,buyer_name,buyer_phone,delivery_area,note)
       VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [id, name, phone, area, clean(b.note)]
    );

    res.status(201).json({
      ok: true,
      order_id: r.rows[0].id,
      message: 'ትዕዛዝዎ ተቀብሏል። ሻጩ በስልክ ያነጋግርዎታል።'
    });
  } catch {
    res.status(500).json({ error: 'ትዕዛዙ አልተላከም።' });
  }
});

app.get('/api/admin/products', auth, admin, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT p.*,u.name seller_name,u.email seller_email
      FROM products p
      JOIN users u ON u.id=p.seller_id
      ORDER BY p.created_at DESC
    `);
    res.json({ products: r.rows });
  } catch {
    res.status(500).json({ error: 'ምርቶችን ማምጣት አልተቻለም።' });
  }
});

app.patch('/api/admin/products/:id', auth, admin, async (req, res) => {
  try {
    if (!['approved', 'rejected', 'pending'].includes(req.body.status)) {
      return res.status(400).json({
        error: 'Status ትክክል አይደለም።'
      });
    }

    const r = await db.query(
      'UPDATE products SET status=$1 WHERE id=$2 RETURNING id,status',
      [req.body.status, req.params.id]
    );

    if (!r.rowCount) {
      return res.status(404).json({ error: 'ምርቱ አልተገኘም።' });
    }

    res.json({ product: r.rows[0] });
  } catch {
    res.status(500).json({ error: 'ማረጋገጥ አልተሳካም።' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

init()
  .then(() => {
    app.listen(PORT, () => {
      console.log('GospelMarket listening on ' + PORT);
    });
  })
  .catch(err => {
    console.error('Database initialization failed:', err);
    process.exit(1);
  });
