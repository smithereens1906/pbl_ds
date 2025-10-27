// In routes/admin.js
const express = require('express');
const router = express.Router();
const db = require('../database');

router.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM admin WHERE username = ?', [username], (err, adminUser) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ success: false, message: 'Server error' });
        }

        // --- FIX ---
        // Removed the extra parenthesis at the end of the line
        if (adminUser && password === adminUser.password) {
            console.log(`User ${username} logged in successfully.`);
            res.json({ success: true });
        } else {
            res.status(401).json({ success: false });
        }
    });
});

module.exports = router;