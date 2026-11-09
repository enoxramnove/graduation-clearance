const jwt = require('jsonwebtoken');
const JWT_SECRET = 'your_super_secret_key_here'; // Use environment variables in production

exports.verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Access denied. No token provided.' });

    const token = authHeader.split(' ')[1];
    try {
        const verified = jwt.verify(token, JWT_SECRET);
        req.user = verified; // contains user_id, username, role_name, reg_no (if student)
        next();
    } catch (err) {
        res.status(403).json({ error: 'Invalid or expired token.' });
    }
};

exports.verifyRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!allowedRoles.includes(req.user.role_name)) {
            return res.status(403).json({ error: 'Unauthorized access for this role.' });
        }
        next();
    };
};