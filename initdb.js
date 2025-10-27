const db = require('./database');
const bcrypt = require('bcryptjs');

const ADMIN_NAME = 'geu';
const ADMIN_PASS = 'admin123';

const stmt = db.prepare('INSERT OR IGNORE INTO admin (username, password) VALUES (?,?)');
stmt.run(ADMIN_NAME, ADMIN_PASS);
stmt.finalize(() => console.log('Admin user ensured.'));