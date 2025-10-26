const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database');

router.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM admin WHERE username = ?', [username], (err, row) => {
    if (err || !row || !bcrypt.compareSync(password, row.password)) {
      return res.status(401).json({ success: false });
    }
    res.json({ success: true });
  });
});

module.exports = router;