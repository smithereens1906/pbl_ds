/* --------------  database.js  -------------- */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// create uploads & tmp folders if missing
['uploads', 'tmp'].forEach(d => fs.mkdirSync(path.join(__dirname, d), { recursive: true }));

const db = new sqlite3.Database(path.join(__dirname, 'resumes.db'));

db.serialize(() => {
  /* NEW table structure with all extra columns */
  db.run(`CREATE TABLE IF NOT EXISTS resumes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    email TEXT,
    phone TEXT,
    address TEXT,
    university TEXT,
    field TEXT,
    year INTEGER,
    qualification TEXT,
    internship TEXT,
    portfolio TEXT,
    softSkills TEXT,
    skills TEXT,
    projects TEXT,
    hobbies TEXT,
    score INTEGER,
    status INTEGER DEFAULT 0,
    pdf_path TEXT,
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