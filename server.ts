import express from "express";
import path from "path";
import cors from "cors";
import bodyParser from "body-parser";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

// Database Initialization
const dbPath = process.env.DB_PATH || "database.db";
const db = new Database(dbPath, { verbose: console.log });

// Create Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT CHECK(role IN ('admin', 'cashier'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    price REAL,
    quantity INTEGER,
    min_quantity INTEGER,
    image TEXT
  );

  CREATE TABLE IF NOT EXISTS wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    number TEXT UNIQUE,
    monthly_withdraw_limit REAL,
    monthly_deposit_limit REAL,
    daily_withdraw_limit REAL,
    daily_deposit_limit REAL,
    monthly_withdraw_limit_rem REAL,
    monthly_deposit_limit_rem REAL,
    daily_withdraw_limit_rem REAL,
    daily_deposit_limit_rem REAL,
    balance REAL DEFAULT 0,
    last_daily_reset TEXT,
    last_monthly_reset TEXT
  );

  CREATE TABLE IF NOT EXISTS wallet_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_id INTEGER,
    type TEXT CHECK(type IN ('withdraw', 'deposit')),
    amount REAL,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(wallet_id) REFERENCES wallets(id)
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT,
    amount REAL,
    date DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS debts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_name TEXT,
    amount_in REAL DEFAULT 0,
    amount_out REAL DEFAULT 0,
    date DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    quantity INTEGER,
    total_price REAL,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    FOREIGN KEY(product_id) REFERENCES products(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS starting_treasury (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL,
    date DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS treasury_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cash_200 INTEGER DEFAULT 0,
    cash_100 INTEGER DEFAULT 0,
    cash_50 INTEGER DEFAULT 0,
    cash_20 INTEGER DEFAULT 0,
    cash_10 INTEGER DEFAULT 0,
    cash_5 INTEGER DEFAULT 0,
    fawry REAL DEFAULT 0,
    neopay REAL DEFAULT 0,
    superpay REAL DEFAULT 0,
    new_machine1 REAL DEFAULT 0,
    new_machine2 REAL DEFAULT 0,
    date DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration for existing databases
try {
  db.prepare("SELECT monthly_limit_rem FROM wallets LIMIT 1").get();
} catch (e) {
  try {
    db.exec("ALTER TABLE wallets ADD COLUMN monthly_limit_rem REAL;");
    db.exec("ALTER TABLE wallets ADD COLUMN daily_limit_rem REAL;");
    db.exec("UPDATE wallets SET monthly_limit_rem = monthly_limit, daily_limit_rem = daily_limit;");
  } catch (err) {
    console.log("Migration skipped or already applied");
  }
}

try {
  db.prepare("SELECT daily_withdraw_limit FROM wallets LIMIT 1").get();
} catch (e) {
  try {
    db.exec(`
      ALTER TABLE wallets ADD COLUMN daily_withdraw_limit REAL;
      ALTER TABLE wallets ADD COLUMN daily_deposit_limit REAL;
      ALTER TABLE wallets ADD COLUMN monthly_withdraw_limit REAL;
      ALTER TABLE wallets ADD COLUMN monthly_deposit_limit REAL;
      ALTER TABLE wallets ADD COLUMN daily_withdraw_limit_rem REAL;
      ALTER TABLE wallets ADD COLUMN daily_deposit_limit_rem REAL;
      ALTER TABLE wallets ADD COLUMN monthly_withdraw_limit_rem REAL;
      ALTER TABLE wallets ADD COLUMN monthly_deposit_limit_rem REAL;
    `);
    db.exec(`
      UPDATE wallets 
      SET daily_withdraw_limit = COALESCE(daily_limit, 60000),
          daily_deposit_limit = COALESCE(daily_limit, 60000),
          monthly_withdraw_limit = COALESCE(monthly_limit, 200000),
          monthly_deposit_limit = COALESCE(monthly_limit, 200000),
          daily_withdraw_limit_rem = COALESCE(daily_limit_rem, COALESCE(daily_limit, 60000)),
          daily_deposit_limit_rem = COALESCE(daily_limit_rem, COALESCE(daily_limit, 60000)),
          monthly_withdraw_limit_rem = COALESCE(monthly_limit_rem, COALESCE(monthly_limit, 200000)),
          monthly_deposit_limit_rem = COALESCE(monthly_limit_rem, COALESCE(monthly_limit, 200000));
    `);
  } catch (err) {
    console.log("Wallets limits split migration failed or skipped:", err);
  }
}

try {
  db.prepare("SELECT last_daily_reset FROM wallets LIMIT 1").get();
} catch (e) {
  try {
    db.exec("ALTER TABLE wallets ADD COLUMN last_daily_reset TEXT;");
    db.exec("ALTER TABLE wallets ADD COLUMN last_monthly_reset TEXT;");
  } catch (err) {
    console.log("Wallets reset migration skipped or already applied");
  }
}

try {
  db.prepare("SELECT fawry FROM treasury_log LIMIT 1").get();
} catch (e) {
  try {
    db.exec("ALTER TABLE treasury_log ADD COLUMN fawry REAL DEFAULT 0;");
    db.exec("ALTER TABLE treasury_log ADD COLUMN neopay REAL DEFAULT 0;");
    db.exec("ALTER TABLE treasury_log ADD COLUMN superpay REAL DEFAULT 0;");
    db.exec("ALTER TABLE treasury_log ADD COLUMN new_machine1 REAL DEFAULT 0;");
    db.exec("ALTER TABLE treasury_log ADD COLUMN new_machine2 REAL DEFAULT 0;");
  } catch (err) {
    console.log("Treasury migration skipped or already applied");
  }
}

// Create debt_transactions table if it doesn't already exist
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS debt_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debt_id INTEGER,
      type TEXT,
      amount REAL,
      date DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  // Seed from existing debts if history table was just created and is empty
  const txCount: any = db.prepare("SELECT COUNT(*) as cnt FROM debt_transactions").get();
  if (txCount && txCount.cnt === 0) {
    db.exec(`
      INSERT INTO debt_transactions (debt_id, type, amount, date)
      SELECT id, 'out', amount_out, date FROM debts WHERE amount_out > 0;
    `);
    db.exec(`
      INSERT INTO debt_transactions (debt_id, type, amount, date)
      SELECT id, 'in', amount_in, date FROM debts WHERE amount_in > 0;
    `);
  }
} catch (err) {
  console.log("Debt transactions migration failed:", err);
}

// Seed Admin User if not exists
const adminExists = db.prepare("SELECT * FROM users WHERE username = 'admin'").get();
if (!adminExists) {
  const hashedPassword = bcrypt.hashSync("password", 10);
  db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run("admin", hashedPassword, "admin");
}

app.use(cors());
app.use(bodyParser.json());

function resetWalletsIfNeeded() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;
  const monthStr = `${year}-${month}`;

  // Update daily limit remaining for wallets that haven't been reset today
  db.prepare(`
    UPDATE wallets 
    SET daily_withdraw_limit_rem = daily_withdraw_limit, 
        daily_deposit_limit_rem = daily_deposit_limit,
        last_daily_reset = ? 
    WHERE last_daily_reset IS NULL OR last_daily_reset != ?
  `).run(todayStr, todayStr);

  // Update monthly limit remaining for wallets that haven't been reset this month
  db.prepare(`
    UPDATE wallets 
    SET monthly_withdraw_limit_rem = monthly_withdraw_limit, 
        monthly_deposit_limit_rem = monthly_deposit_limit,
        last_monthly_reset = ? 
    WHERE last_monthly_reset IS NULL OR last_monthly_reset != ?
  `).run(monthStr, monthStr);
}

// Automatically reset limits on any API request
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    try {
      resetWalletsIfNeeded();
    } catch (e) {
      console.error("Error resetting wallet limits:", e);
    }
  }
  next();
});

// User Management
app.get("/api/users", (req, res) => {
  const users = db.prepare("SELECT id, username, role FROM users").all();
  res.json(users);
});

app.post("/api/users", (req, res) => {
  const { username, password, role } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);
  try {
    const result = db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run(username, hashedPassword, role);
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: "Username already exists" });
  }
});

app.delete("/api/users/:id", (req, res) => {
  db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// API Routes
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user: any = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (user && bcrypt.compareSync(password, user.password)) {
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

// Products CRUD
app.get("/api/products", (req, res) => {
  const products = db.prepare("SELECT * FROM products").all();
  res.json(products);
});

app.post("/api/sales", (req, res) => {
  const { product_id, quantity, total_price, user_id } = req.body;
  
  const transaction = db.transaction(() => {
    // Check quantity
    const product: any = db.prepare("SELECT quantity FROM products WHERE id = ?").get(product_id);
    if (!product || product.quantity < quantity) {
      throw new Error("الكمية غير كافية");
    }

    // Update product quantity
    db.prepare("UPDATE products SET quantity = quantity - ? WHERE id = ?").run(quantity, product_id);

    // Log sale
    db.prepare("INSERT INTO sales (product_id, quantity, total_price, user_id) VALUES (?, ?, ?, ?)")
      .run(product_id, quantity, total_price, user_id);
  });

  try {
    transaction();
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/sales/daily", (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const filter = date + "%";
  const sales = db.prepare(`
    SELECT s.*, p.name as product_name, p.price as product_price 
    FROM sales s 
    JOIN products p ON s.product_id = p.id 
    WHERE s.date LIKE ? 
    ORDER BY s.date DESC
  `).all(filter);
  res.json(sales);
});

app.post("/api/products", (req, res) => {
  const { name, price, quantity, min_quantity, image } = req.body;
  const result = db.prepare("INSERT INTO products (name, price, quantity, min_quantity, image) VALUES (?, ?, ?, ?, ?)")
    .run(name, price, quantity, min_quantity, image);
  res.json({ id: result.lastInsertRowid });
});

app.put("/api/products/:id", (req, res) => {
  const { name, price, quantity, min_quantity, image } = req.body;
  db.prepare("UPDATE products SET name = ?, price = ?, quantity = ?, min_quantity = ?, image = ? WHERE id = ?")
    .run(name, price, quantity, min_quantity, image, req.params.id);
  res.json({ success: true });
});

app.delete("/api/products/:id", (req, res) => {
  const { id } = req.params;
  try {
    // Delete associated sales first or just delete the product
    // If we want to keep sales history, we might want to just set product_id to null or something
    // But usually in these simple apps, we just delete the product.
    // However, if there are sales, it might fail if foreign keys are on.
    db.prepare("DELETE FROM sales WHERE product_id = ?").run(id);
    db.prepare("DELETE FROM products WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// Sales CRUD
app.delete("/api/sales/:id", (req, res) => {
  const { id } = req.params;
  const transaction = db.transaction(() => {
    const sale: any = db.prepare("SELECT * FROM sales WHERE id = ?").get(id);
    if (!sale) throw new Error("Sale not found");

    // Restore product quantity
    db.prepare("UPDATE products SET quantity = quantity + ? WHERE id = ?").run(sale.quantity, sale.product_id);

    // Delete sale
    db.prepare("DELETE FROM sales WHERE id = ?").run(id);
  });

  try {
    transaction();
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/sales/:id", (req, res) => {
  const { id } = req.params;
  const { quantity, total_price } = req.body;

  const transaction = db.transaction(() => {
    const oldSale: any = db.prepare("SELECT * FROM sales WHERE id = ?").get(id);
    if (!oldSale) throw new Error("Sale not found");

    // Adjust product quantity
    const diff = quantity - oldSale.quantity;
    const product: any = db.prepare("SELECT quantity FROM products WHERE id = ?").get(oldSale.product_id);
    if (product.quantity < diff) {
      throw new Error("الكمية غير كافية");
    }

    db.prepare("UPDATE products SET quantity = quantity - ? WHERE id = ?").run(diff, oldSale.product_id);

    // Update sale
    db.prepare("UPDATE sales SET quantity = ?, total_price = ? WHERE id = ?").run(quantity, total_price, id);
  });

  try {
    transaction();
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Wallets CRUD
app.delete("/api/wallets/:id", (req, res) => {
  const { id } = req.params;
  try {
    db.prepare("DELETE FROM wallet_transactions WHERE wallet_id = ?").run(id);
    db.prepare("DELETE FROM wallets WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/wallets", (req, res) => {
  const wallets = db.prepare("SELECT * FROM wallets").all();
  res.json(wallets);
});

app.put("/api/wallets/:id", (req, res) => {
  const { 
    name, number, balance,
    daily_withdraw_limit, daily_deposit_limit,
    monthly_withdraw_limit, monthly_deposit_limit,
    daily_withdraw_limit_rem, daily_deposit_limit_rem,
    monthly_withdraw_limit_rem, monthly_deposit_limit_rem 
  } = req.body;
  const { id } = req.params;
  try {
    db.prepare(`
      UPDATE wallets 
      SET name = ?, number = ?, balance = ?, 
          daily_withdraw_limit = ?, daily_deposit_limit = ?, 
          monthly_withdraw_limit = ?, monthly_deposit_limit = ?, 
          daily_withdraw_limit_rem = ?, daily_deposit_limit_rem = ?, 
          monthly_withdraw_limit_rem = ?, monthly_deposit_limit_rem = ?
      WHERE id = ?
    `).run(
      name, number, balance,
      daily_withdraw_limit, daily_deposit_limit,
      monthly_withdraw_limit, monthly_deposit_limit,
      daily_withdraw_limit_rem, daily_deposit_limit_rem,
      monthly_withdraw_limit_rem, monthly_deposit_limit_rem,
      id
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/wallets/:id/transactions", (req, res) => {
  const transactions = db.prepare("SELECT * FROM wallet_transactions WHERE wallet_id = ? ORDER BY date DESC").all(req.params.id);
  res.json(transactions);
});

app.post("/api/wallets", (req, res) => {
  const { name, number, monthly_withdraw_limit, monthly_deposit_limit, daily_withdraw_limit, daily_deposit_limit, balance } = req.body;
  
  const existing = db.prepare("SELECT id FROM wallets WHERE number = ?").get(number);
  if (existing) {
    return res.status(400).json({ error: "Wallet number already exists" });
  }

  try {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    const monthStr = `${year}-${month}`;

    const result = db.prepare(`
      INSERT INTO wallets (
        name, number, balance, last_daily_reset, last_monthly_reset,
        daily_withdraw_limit, daily_deposit_limit,
        monthly_withdraw_limit, monthly_deposit_limit,
        daily_withdraw_limit_rem, daily_deposit_limit_rem,
        monthly_withdraw_limit_rem, monthly_deposit_limit_rem
      ) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name, number, balance || 0, todayStr, monthStr,
      daily_withdraw_limit ?? 60000, daily_deposit_limit ?? 60000,
      monthly_withdraw_limit ?? 200000, monthly_deposit_limit ?? 200000,
      daily_withdraw_limit ?? 60000, daily_deposit_limit ?? 60000,
      monthly_withdraw_limit ?? 200000, monthly_deposit_limit ?? 200000
    );
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/wallets/:id/transaction", (req, res) => {
  const { type, amount } = req.body;
  const walletId = req.params.id;
  
  const wallet: any = db.prepare("SELECT * FROM wallets WHERE id = ?").get(walletId);
  if (!wallet) {
    return res.status(404).json({ error: "Wallet not found" });
  }

  if (type === 'withdraw') {
    if (amount > wallet.daily_withdraw_limit_rem) {
      return res.status(400).json({ error: "المبلغ يتجاوز الحد اليومي للسحب المتبقي" });
    }
    if (amount > wallet.monthly_withdraw_limit_rem) {
      return res.status(400).json({ error: "المبلغ يتجاوز الحد الشهري للسحب المتبقي" });
    }
  } else {
    if (amount > wallet.balance) {
      return res.status(400).json({ error: "المبلغ المراد إيداعه أكبر من رصيد المحفظة" });
    }
    if (amount > wallet.daily_deposit_limit_rem) {
      return res.status(400).json({ error: "المبلغ يتجاوز الحد اليومي للإيداع المتبقي" });
    }
    if (amount > wallet.monthly_deposit_limit_rem) {
      return res.status(400).json({ error: "المبلغ يتجاوز الحد الشهري للإيداع المتبقي" });
    }
  }

  const transaction = db.transaction(() => {
    db.prepare("INSERT INTO wallet_transactions (wallet_id, type, amount) VALUES (?, ?, ?)")
      .run(walletId, type, amount);
    
    if (type === 'withdraw') {
      db.prepare(`
        UPDATE wallets 
        SET balance = balance + ?, 
            monthly_withdraw_limit_rem = monthly_withdraw_limit_rem - ?, 
            daily_withdraw_limit_rem = daily_withdraw_limit_rem - ? 
        WHERE id = ?
      `).run(amount, amount, amount, walletId);
    } else {
      db.prepare(`
        UPDATE wallets 
        SET balance = balance - ?, 
            monthly_deposit_limit_rem = monthly_deposit_limit_rem - ?, 
            daily_deposit_limit_rem = daily_deposit_limit_rem - ? 
        WHERE id = ?
      `).run(amount, amount, amount, walletId);
    }
  });
  
  try {
    transaction();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Database error" });
  }
});

// Debts CRUD
app.get("/api/debts", (req, res) => {
  const debts = db.prepare("SELECT * FROM debts").all();
  res.json(debts);
});

app.post("/api/debts", (req, res) => {
  const { person_name, amount_in, amount_out } = req.body;
  const transaction = db.transaction(() => {
    const result = db.prepare("INSERT INTO debts (person_name, amount_in, amount_out) VALUES (?, ?, ?)")
      .run(person_name, amount_in || 0, amount_out || 0);
    const debtId = result.lastInsertRowid;
    
    if (amount_out > 0) {
      db.prepare("INSERT INTO debt_transactions (debt_id, type, amount) VALUES (?, 'out', ?)")
        .run(debtId, amount_out);
    }
    if (amount_in > 0) {
      db.prepare("INSERT INTO debt_transactions (debt_id, type, amount) VALUES (?, 'in', ?)")
        .run(debtId, amount_in);
    }
    return debtId;
  });
  
  try {
    const id = transaction();
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

app.delete("/api/debts/:id", (req, res) => {
  const id = req.params.id;
  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM debt_transactions WHERE debt_id = ?").run(id);
    db.prepare("DELETE FROM debts WHERE id = ?").run(id);
  });
  try {
    transaction();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

app.put("/api/debts/:id", (req, res) => {
  const { amount_in, amount_out } = req.body;
  const id = req.params.id;
  
  const transaction = db.transaction(() => {
    const oldDebt: any = db.prepare("SELECT * FROM debts WHERE id = ?").get(id);
    if (!oldDebt) throw new Error("Debt record not found");

    db.prepare("UPDATE debts SET amount_in = ?, amount_out = ?, date = CURRENT_TIMESTAMP WHERE id = ?")
      .run(amount_in || 0, amount_out || 0, id);
    
    const diff_out = (amount_out || 0) - (oldDebt.amount_out || 0);
    const diff_in = (amount_in || 0) - (oldDebt.amount_in || 0);

    if (diff_out > 0) {
      db.prepare("INSERT INTO debt_transactions (debt_id, type, amount) VALUES (?, 'out', ?)")
        .run(id, diff_out);
    } else if (diff_out < 0) {
      db.prepare("INSERT INTO debt_transactions (debt_id, type, amount) VALUES (?, 'in', ?)")
        .run(id, Math.abs(diff_out));
    }

    if (diff_in > 0) {
      db.prepare("INSERT INTO debt_transactions (debt_id, type, amount) VALUES (?, 'in', ?)")
        .run(id, diff_in);
    } else if (diff_in < 0) {
      db.prepare("INSERT INTO debt_transactions (debt_id, type, amount) VALUES (?, 'out', ?)")
        .run(id, Math.abs(diff_in));
    }
  });

  try {
    transaction();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Database error" });
  }
});

app.get("/api/debts/:id/transactions", (req, res) => {
  const id = req.params.id;
  try {
    const data = db.prepare("SELECT * FROM debt_transactions WHERE debt_id = ? ORDER BY date DESC").all(id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// Expenses CRUD
app.get("/api/expenses", (req, res) => {
  const expenses = db.prepare("SELECT * FROM expenses").all();
  res.json(expenses);
});

app.post("/api/expenses", (req, res) => {
  const { description, amount } = req.body;
  const result = db.prepare("INSERT INTO expenses (description, amount) VALUES (?, ?)").run(description, amount);
  res.json({ id: result.lastInsertRowid });
});

app.delete("/api/expenses/:id", (req, res) => {
  db.prepare("DELETE FROM expenses WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// Treasury Log
app.get("/api/treasury", (req, res) => {
  const logs = db.prepare("SELECT * FROM treasury_log ORDER BY date DESC").all();
  res.json(logs);
});

app.get("/api/treasury/latest", (req, res) => {
  const log = db.prepare("SELECT * FROM treasury_log ORDER BY date DESC LIMIT 1").get();
  res.json(log || {});
});

app.post("/api/treasury", (req, res) => {
  const { cash_200, cash_100, cash_50, cash_20, cash_10, cash_5, fawry, neopay, superpay, new_machine1, new_machine2 } = req.body;
  const result = db.prepare(`
    INSERT INTO treasury_log 
    (cash_200, cash_100, cash_50, cash_20, cash_10, cash_5, fawry, neopay, superpay, new_machine1, new_machine2) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(cash_200, cash_100, cash_50, cash_20, cash_10, cash_5, fawry, neopay, superpay, new_machine1, new_machine2);
  res.json({ id: result.lastInsertRowid });
});

app.put("/api/treasury/:id", (req, res) => {
  const { cash_200, cash_100, cash_50, cash_20, cash_10, cash_5, fawry, neopay, superpay, new_machine1, new_machine2 } = req.body;
  db.prepare(`
    UPDATE treasury_log 
    SET cash_200 = ?, cash_100 = ?, cash_50 = ?, cash_20 = ?, cash_10 = ?, cash_5 = ?, 
        fawry = ?, neopay = ?, superpay = ?, new_machine1 = ?, new_machine2 = ? 
    WHERE id = ?
  `).run(cash_200, cash_100, cash_50, cash_20, cash_10, cash_5, fawry, neopay, superpay, new_machine1, new_machine2, req.params.id);
  res.json({ success: true });
});

app.delete("/api/treasury/:id", (req, res) => {
  db.prepare("DELETE FROM treasury_log WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// Starting Treasury CRUD
app.get("/api/starting-treasury", (req, res) => {
  const startDate = req.query.startDate || req.query.date || new Date().toISOString().split('T')[0];
  const endDate = req.query.endDate || req.query.date || startDate;
  const data = db.prepare("SELECT * FROM starting_treasury WHERE date(date) >= date(?) AND date(date) <= date(?) ORDER BY date DESC").all(startDate, endDate);
  res.json(data);
});

app.post("/api/starting-treasury", (req, res) => {
  const { amount, date } = req.body;
  const result = db.prepare("INSERT INTO starting_treasury (amount, date) VALUES (?, ?)").run(amount, date || new Date().toISOString());
  res.json({ id: result.lastInsertRowid });
});

app.put("/api/starting-treasury/:id", (req, res) => {
  const { amount } = req.body;
  db.prepare("UPDATE starting_treasury SET amount = ? WHERE id = ?").run(amount, req.params.id);
  res.json({ success: true });
});

app.delete("/api/starting-treasury/:id", (req, res) => {
  db.prepare("DELETE FROM starting_treasury WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// Reports
app.delete("/api/wallets/transactions/:id", (req, res) => {
  const transactionId = req.params.id;
  
  const txData: any = db.prepare("SELECT * FROM wallet_transactions WHERE id = ?").get(transactionId);
  if (!txData) return res.status(404).json({ error: "Transaction not found" });

  const transaction = db.transaction(() => {
    // Reverse the effect on wallet balance and limits
    if (txData.type === 'withdraw') {
      db.prepare(`
        UPDATE wallets 
        SET balance = balance - ?, 
            daily_withdraw_limit_rem = daily_withdraw_limit_rem + ?, 
            monthly_withdraw_limit_rem = monthly_withdraw_limit_rem + ?
        WHERE id = ?
      `).run(txData.amount, txData.amount, txData.amount, txData.wallet_id);
    } else {
      db.prepare(`
        UPDATE wallets 
        SET balance = balance + ?, 
            daily_deposit_limit_rem = daily_deposit_limit_rem + ?, 
            monthly_deposit_limit_rem = monthly_deposit_limit_rem + ?
        WHERE id = ?
      `).run(txData.amount, txData.amount, txData.amount, txData.wallet_id);
    }
    
    db.prepare("DELETE FROM wallet_transactions WHERE id = ?").run(transactionId);
  });

  try {
    transaction();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

app.put("/api/wallets/transactions/:id", (req, res) => {
  const transactionId = req.params.id;
  const { amount } = req.body;
  
  const txData: any = db.prepare("SELECT * FROM wallet_transactions WHERE id = ?").get(transactionId);
  if (!txData) return res.status(404).json({ error: "Transaction not found" });

  const wallet: any = db.prepare("SELECT * FROM wallets WHERE id = ?").get(txData.wallet_id);
  if (!wallet) return res.status(404).json({ error: "Wallet not found" });

  // Validate limits and balance after reversing the old amount
  if (txData.type === 'withdraw') {
    const temp_daily = wallet.daily_withdraw_limit_rem + txData.amount;
    const temp_monthly = wallet.monthly_withdraw_limit_rem + txData.amount;
    if (amount > temp_daily) {
      return res.status(400).json({ error: "المبلغ يتجاوز الحد اليومي للسحب المتبقي" });
    }
    if (amount > temp_monthly) {
      return res.status(400).json({ error: "المبلغ يتجاوز الحد الشهري للسحب المتبقي" });
    }
  } else {
    const temp_balance = wallet.balance + txData.amount;
    if (amount > temp_balance) {
      return res.status(400).json({ error: "المبلغ المراد إيداعه أكبر من رصيد المحفظة" });
    }
    const temp_daily = wallet.daily_deposit_limit_rem + txData.amount;
    const temp_monthly = wallet.monthly_deposit_limit_rem + txData.amount;
    if (amount > temp_daily) {
      return res.status(400).json({ error: "المبلغ يتجاوز الحد اليومي للإيداع المتبقي" });
    }
    if (amount > temp_monthly) {
      return res.status(400).json({ error: "المبلغ يتجاوز الحد الشهري للإيداع المتبقي" });
    }
  }

  const transaction = db.transaction(() => {
    // 1. Reverse old amount
    if (txData.type === 'withdraw') {
      db.prepare(`
        UPDATE wallets 
        SET balance = balance - ?, 
            daily_withdraw_limit_rem = daily_withdraw_limit_rem + ?, 
            monthly_withdraw_limit_rem = monthly_withdraw_limit_rem + ?
        WHERE id = ?
      `).run(txData.amount, txData.amount, txData.amount, txData.wallet_id);
    } else {
      db.prepare(`
        UPDATE wallets 
        SET balance = balance + ?, 
            daily_deposit_limit_rem = daily_deposit_limit_rem + ?, 
            monthly_deposit_limit_rem = monthly_deposit_limit_rem + ?
        WHERE id = ?
      `).run(txData.amount, txData.amount, txData.amount, txData.wallet_id);
    }

    // 2. Apply new amount
    if (txData.type === 'withdraw') {
      db.prepare(`
        UPDATE wallets 
        SET balance = balance + ?, 
            daily_withdraw_limit_rem = daily_withdraw_limit_rem - ?, 
            monthly_withdraw_limit_rem = monthly_withdraw_limit_rem - ?
        WHERE id = ?
      `).run(amount, amount, amount, txData.wallet_id);
    } else {
      db.prepare(`
        UPDATE wallets 
        SET balance = balance - ?, 
            daily_deposit_limit_rem = daily_deposit_limit_rem - ?, 
            monthly_deposit_limit_rem = monthly_deposit_limit_rem - ?
        WHERE id = ?
      `).run(amount, amount, amount, txData.wallet_id);
    }
    
    db.prepare("UPDATE wallet_transactions SET amount = ? WHERE id = ?").run(amount, transactionId);
  });

  try {
    transaction();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Database error" });
  }
});

app.put("/api/users/:id/password", (req, res) => {
  const { password } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);
  db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, req.params.id);
  res.json({ success: true });
});

app.get("/api/reports/summary", (req, res) => {
  const startDate = req.query.startDate || req.query.date || new Date().toISOString().split('T')[0];
  const endDate = req.query.endDate || req.query.date || startDate;

  const sales = db.prepare("SELECT SUM(total_price) as total FROM sales WHERE date(date) >= date(?) AND date(date) <= date(?)").get(startDate, endDate);
  const expenses = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE date(date) >= date(?) AND date(date) <= date(?)").get(startDate, endDate);
  const debts = db.prepare("SELECT SUM(amount_out - amount_in) as total FROM debts WHERE date(date) <= date(?)").get(endDate);
  
  // Latest treasury log at or before the endDate of the range
  const treasury = db.prepare("SELECT * FROM treasury_log WHERE date(date) <= date(?) ORDER BY date DESC LIMIT 1").get(endDate) || {};
  
  // Total wallets balance (current)
  const wallets = db.prepare("SELECT SUM(balance) as total FROM wallets").get();

  // Starting treasury in the range
  const startingTreasury = db.prepare("SELECT SUM(amount) as total FROM starting_treasury WHERE date(date) >= date(?) AND date(date) <= date(?)").get(startDate, endDate);

  const total_cash = ((treasury.cash_200 || 0) * 200) + ((treasury.cash_100 || 0) * 100) + ((treasury.cash_50 || 0) * 50) + 
                     ((treasury.cash_20 || 0) * 20) + ((treasury.cash_10 || 0) * 10) + ((treasury.cash_5 || 0) * 5);
  
  const total_machines = (treasury.fawry || 0) + (treasury.neopay || 0) + (treasury.superpay || 0) + 
                         (treasury.new_machine1 || 0) + (treasury.new_machine2 || 0);

  const total_treasury = (total_cash || 0) + (wallets.total || 0) + (total_machines || 0) + (debts.total || 0);
  const starting_amount = startingTreasury.total || 0;
  const net_profit = total_treasury - starting_amount;

  res.json({
    sales: sales.total || 0,
    expenses: expenses.total || 0,
    debts: debts.total || 0,
    total_cash: total_cash || 0,
    total_wallets: wallets.total || 0,
    total_machines: total_machines || 0,
    total_treasury: total_treasury,
    starting_treasury: starting_amount,
    net_profit: net_profit,
    treasury: treasury
  });
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
