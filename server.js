const express = require('express');
const cors = require('cors');
const authController = require('./controllers/authController');
const workflowController = require('./controllers/workflowController');
const { verifyToken, verifyRole } = require('./middleware/authMiddleware');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public')); // Serve frontend HTML/CSS/JS

// Authentication Routes
app.post('/api/auth/login', authController.login);

// Student Routes
app.post('/api/requests/submit', verifyToken, verifyRole(['Student']), workflowController.submitRequest);
app.post('/api/requests/resubmit', verifyToken, verifyRole(['Student']), workflowController.resubmitRequest);

// Department Officer Action Routes (Librarian, Finance, HOD, Dean, AR)
const officerRoles = ['Librarian', 'Finance', 'HOD', 'Dean', 'AR'];
app.post('/api/requests/:requestId/approve', verifyToken, verifyRole(officerRoles), workflowController.approveRequest);
app.post('/api/requests/:requestId/reject', verifyToken, verifyRole(officerRoles), workflowController.rejectRequest);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(Graduation Clearance Server running on port ${PORT} 🚀);
});