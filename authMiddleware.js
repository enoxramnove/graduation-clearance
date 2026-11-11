const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
    const authHeader = req.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
        return res.status(401).json({ error: 'A bearer token is required.' });
    }

    try {
        const verified = jwt.verify(match[1], process.env.JWT_SECRET);
        req.user = verified; // contains user_id, username, role_name, reg_no (if student)
        next();
    } catch {
        res.status(401).json({ error: 'Invalid or expired token.' });
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