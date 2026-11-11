const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const path = require('path');
const db = require('./config/db');
const authController = require('./authController');
const workflowController = require('./WorkFlow');
const { verifyToken, verifyRole } = require('./authMiddleware');

const app = express();
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
    : false;
app.use(express.json({ limit: '16kb' }));
app.use(helmet());
app.use(cors({ origin: allowedOrigins }));

const pages = {
    '/': 'login.html',
    '/login.html': 'login.html',
    '/student-dashboard.html': 'student-dashboard.html',
    '/officer-dashboard.html': 'officer-dashboard.html',
    '/faculty-head-dashboard.html': 'FacultyAdmin.html',
    '/FacultyAdmin.html': 'FacultyAdmin.html'
};

app.get(Object.keys(pages), (req, res) => {
    if (!Object.hasOwn(pages, req.path)) return res.sendStatus(404);
    res.sendFile(path.join(__dirname, pages[req.path]));
});
app.get('/css/style.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'style.css'));
});
app.get('/ham.png', (_req, res) => {
    res.sendFile(path.join(__dirname, 'ham.png'));
});
app.use('/js', express.static(path.join(__dirname, 'js'), { fallthrough: false }));

// Authentication Routes
app.post('/api/auth/login', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false
}), authController.login);

// Student Routes
app.get('/api/student/status', verifyToken, verifyRole(['Student']), workflowController.getStudentStatus);
app.post('/api/requests/submit', verifyToken, verifyRole(['Student']), workflowController.submitRequest);
app.post('/api/requests/resubmit', verifyToken, verifyRole(['Student']), workflowController.resubmitRequest);

// Department Officer Action Routes (Includes Guild now)
const officerRoles = ['Guild', 'Librarian', 'Finance', 'HOD', 'Dean', 'AR'];
app.get('/api/officer/requests', verifyToken, verifyRole(officerRoles), workflowController.getOfficerRequests);
app.post('/api/requests/:requestId/approve', verifyToken, verifyRole(officerRoles), workflowController.approveRequest);
app.post('/api/requests/:requestId/reject', verifyToken, verifyRole(officerRoles), workflowController.rejectRequest);

// Faculty Head Oversight Route
app.get('/api/faculty-head/overview', verifyToken, verifyRole(['FacultyHead']), workflowController.getFacultyHeadOverview);

const PORT = process.env.PORT || 3000;

async function startServer() {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        console.error('JWT_SECRET is required and must contain at least 32 characters. Configure it in .env.');
        process.exitCode = 1;
        return;
    }

    try {
        await db.query('SELECT 1');
    } catch (err) {
        console.error(
            `Unable to connect to MySQL (${err.code || 'DB_CONNECTION_ERROR'}). ` +
            'Check DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME in this PowerShell session.'
        );
        process.exitCode = 1;
        return;
    }

    app.listen(PORT, () => {
        console.log(`Graduation Clearance Server running on port ${PORT} 🚀`);
    });
}

if (require.main === module) startServer();

module.exports = { app, startServer };
