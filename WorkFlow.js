const db = require('../config/db');

// Sequence map for state forwarding
const STAGE_SEQUENCE = {
    'Library': 'Finance',
    'Finance': 'HOD',
    'HOD': 'Dean',
    'Dean': 'AR',
    'AR': 'Completed'
};

// Student Submits Initial Request
exports.submitRequest = async (req, res) => {
    const { reg_no } = req.user;
    if (!reg_no) return res.status(400).json({ error: 'Only students can submit clearance requests.' });

    try {
        // Check if request already exists
        const [existing] = await db.execute('SELECT * FROM clearance_requests WHERE reg_no = ?', [reg_no]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Clearance request already exists for this registration number.' });
        }

        await db.execute(`
            INSERT INTO clearance_requests (reg_no, current_stage, status) 
            VALUES (?, 'Library', 'Pending')
        `, [reg_no]);

        res.status(201).json({ message: 'Clearance request submitted successfully to Library.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to submit clearance request.' });
    }
};

// Officer Approves Request
exports.approveRequest = async (req, res) => {
    const { requestId } = req.params;
    const officerRole = req.user.role_name; // e.g., 'Librarian', 'Finance', etc.

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Get current request state
        const [requests] = await connection.execute('SELECT * FROM clearance_requests WHERE request_id = ?', [requestId]);
        if (requests.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Request not found.' });
        }

        const reqData = requests[0];

        // Validate authority
        if (reqData.current_stage !== officerRole) {
            await connection.rollback();
            return res.status(403).json({ error: `Unauthorized. Request is currently at ${reqData.current_stage}, not your department.` });
        }

        // Record approval history
        await connection.execute(`
            INSERT INTO approvals (request_id, department, decision, comments) 
            VALUES (?, ?, 'Approved', 'Cleared successfully')
        `, [requestId, officerRole]);

        // Advance Stage
        const nextStage = STAGE_SEQUENCE[officerRole];
        const newStatus = nextStage === 'Completed' ? 'Completed' : 'Pending';

        await connection.execute(`
            UPDATE clearance_requests 
            SET current_stage = ?, status = ?, last_rejected_by = NULL 
            WHERE request_id = ?
        `, [nextStage, newStatus, requestId]);

        // Notify Student
        await connection.execute(`
            INSERT INTO notifications (reg_no, message) 
            VALUES (?, ?)
        `, [reqData.reg_no, `Your clearance request has been approved by ${officerRole}. Current Stage: ${nextStage}`]);

        await connection.commit();
        res.json({ message: `Request successfully cleared by ${officerRole} and forwarded to ${nextStage}.` });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: 'Database transaction failed during approval.' });
    } finally {
        connection.release();
    }
};

// Officer Rejects Request
exports.rejectRequest = async (req, res) => {
    const { requestId } = req.params;
    const { comments } = req.body;
    const officerRole = req.user.role_name;

    if (!comments) return res.status(400).json({ error: 'Rejection reason (comments) is required.' });

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [requests] = await connection.execute('SELECT * FROM clearance_requests WHERE request_id = ?', [requestId]);
        if (requests.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Request not found.' });
        }

        const reqData = requests[0];

        if (reqData.current_stage !== officerRole) {
            await connection.rollback();
            return res.status(403).json({ error: 'Unauthorized stage access.' });
        }

        // Record rejection history
        await connection.execute(`
            INSERT INTO approvals (request_id, department, decision, comments) 
            VALUES (?, ?, 'Rejected', ?)
        `, [requestId, officerRole, comments]);

        // Update request state to stopped/rejected
        await connection.execute(`
            UPDATE clearance_requests 
            SET status = 'Rejected', last_rejected_by = ? 
            WHERE request_id = ?
        `, [officerRole, requestId]);

        // Notify student with the specific reason
        await connection.execute(`
            INSERT INTO notifications (reg_no, message) 
            VALUES (?, ?)
        `, [reqData.reg_no, `REJECTED by ${officerRole}. Reason: ${comments}`]);

        await connection.commit();
        res.json({ message: `Request rejected. Student notified.` });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: 'Database transaction failed during rejection.' });
    } finally {
        connection.release();
    }
};

// Student Resubmits Request after Fixing Issue
exports.resubmitRequest = async (req, res) => {
    const { reg_no } = req.user;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [requests] = await connection.execute('SELECT * FROM clearance_requests WHERE reg_no = ?', [reg_no]);
        if (requests.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Clearance request not found.' });
        }

        const reqData = requests[0];

        if (reqData.status !== 'Rejected') {
            await connection.rollback();
            return res.status(400).json({ error: 'Can only resubmit requests that have been rejected.' });
        }

        const targetDepartment = reqData.last_rejected_by; // Returns ONLY to rejecting dept

        await connection.execute(`
            UPDATE clearance_requests 
            SET current_stage = ?, status = 'Pending', resubmitted = TRUE 
            WHERE request_id = ?
        `, [targetDepartment, reqData.request_id]);

        await connection.execute(`
            INSERT INTO notifications (reg_no, message) 
            VALUES (?, ?)
        `, [reg_no, `Your request has been resubmitted and sent back to ${targetDepartment} for review.`]);

        await connection.commit();
        res.json({ message: `Request successfully resubmitted to ${targetDepartment}.` });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: 'Failed to resubmit request.' });
    } finally {
        connection.release();
    }
};
