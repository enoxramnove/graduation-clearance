const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const JWT_SECRET = 'your_super_secret_key_here';

exports.login = async (req, res) => {
    const { username, password } = req.body;
    try {
        const [users] = await db.execute(`
            SELECT u.*, r.role_name, s.reg_no 
            FROM users u 
            JOIN roles r ON u.role_id = r.role_id 
            LEFT JOIN students s ON u.user_id = s.user_id 
            WHERE u.username = ?
        `, [username]);

        if (users.length === 0) return res.status(404).json({ error: 'User not found' });

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

        const tokenPayload = {
            user_id: user.user_id,
            username: user.username,
            role_name: user.role_name,
            reg_no: user.reg_no || null
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });

        res.json({
            message: 'Login successful',
            token,
            role: user.role_name,
            redirectUrl: `/${user.role_name.toLowerCase()}-dashboard.html`
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during login' });
    }
};