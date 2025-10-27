// This is the new initdb.js
const db = require('./database');

const ADMIN_NAME = 'geu';
const ADMIN_PASS = 'admin123'; // Storing as plain text

const stmt = db.prepare('INSERT OR IGNORE INTO admin (username, password) VALUES (?,?)');
stmt.run(ADMIN_NAME, ADMIN_PASS);
stmt.finalize(() => console.log('Admin user ensured.'));