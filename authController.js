const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./config/db');

exports.login = async (req, res) => {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
        const [users] = await db.execute(`
            SELECT u.user_id, u.username, u.password, r.role_name, s.reg_no
            FROM users u 
            JOIN roles r ON u.role_id = r.role_id 
            LEFT JOIN students s ON u.user_id = s.user_id 
            WHERE u.username = ?
        `, [username]);

        const user = users[0];
        const isMatch = user ? await bcrypt.compare(password, user.password) : false;
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        const tokenPayload = {
            user_id: user.user_id,
            username: user.username,
            role_name: user.role_name,
            reg_no: user.reg_no || null
        };

        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '8h' });
        const redirectUrl = user.role_name === 'Student'
            ? '/student-dashboard.html'
            : user.role_name === 'FacultyHead'
                ? '/faculty-head-dashboard.html'
                : '/officer-dashboard.html';

        res.json({
            message: 'Login successful',
            token,
            role: user.role_name,
            redirectUrl
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during login' });
    }
};