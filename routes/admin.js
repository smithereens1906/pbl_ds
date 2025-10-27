// In routes/admin.js

const express = require('express');
const router = express.Router();
const db = require('../database'); // Note the '../' to go up one directory
const bcrypt = require('bcryptjs');

// This route will handle POST requests to /admin/login
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    // 1. Find the user by username
    db.get('SELECT * FROM admin WHERE username = ?', [username], (err, adminUser) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Server error');
        }
        if (!adminUser) {
            // User not found
            return res.status(401).send('Invalid credentials');
        }

        // 2. User found, now compare the password
        const passwordIsValid = bcrypt.compareSync(password, adminUser.password);

        if (!passwordIsValid) {
            // Password did not match
            return res.status(401).send('Invalid credentials');
        }

        // 3. Password is valid! 
        // TODO: Create a session here
        console.log(`User ${username} logged in successfully.`);
        res.send('Login successful!'); 
        // Later, you'll redirect: res.redirect('/admin/dashboard');
    });
});

// Add other admin routes here (e.g., dashboard, logout)
// router.get('/dashboard', ...);

// Don't forget to export the router!
module.exports = router;