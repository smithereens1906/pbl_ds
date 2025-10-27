// This is the new auth.js
const express = require('express');
const router = express.Router();
const db = require('../database');
// We no longer need bcrypt

router.post('/admin/login', (req, res) => {
  const { username, password } = req.body;

  db.get('SELECT * FROM admin WHERE username = ?', [username], (err, row) => {
    if (err || !row) {
      // Handle server error or user not found
      return res.status(401).json({ success: false });
    }

    // This is the corrected plain text comparison
    if (password === row.password) {
      // Passwords match
      res.json({ success: true });
    } else {
      // Password mismatch
      return res.status(401).json({ success: false });
    }
  });
});

module.exports = router;