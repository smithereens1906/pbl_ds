const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'resumes.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS resumes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE,
            email TEXT,
            phone TEXT,
            qualification TEXT,
            skills TEXT,
            experience INTEGER,
            score INTEGER,
            status INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`);
  db.run(`CREATE TABLE IF NOT EXISTS rejected_stack (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            resume_id INTEGER
          )`);
  db.run(`CREATE TABLE IF NOT EXISTS admin (
            username TEXT PRIMARY KEY,
            password TEXT
          )`);
});

module.exports = db;