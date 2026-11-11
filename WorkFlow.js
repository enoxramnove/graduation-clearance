const db = require('./config/db');

const NEXT_STAGE = {
    Guild: 'Library',
    Library: 'Finance',
    Finance: 'HOD',
    HOD: 'Dean',
    Dean: 'AR',
    AR: 'Completed'
};

const ROLE_STAGE = {
    Guild: 'Guild',
    Librarian: 'Library',
    Finance: 'Finance',
    HOD: 'HOD',
    Dean: 'Dean',
    AR: 'AR'
};

function requestIdFrom(params) {
    const requestId = Number(params.requestId);
    return Number.isSafeInteger(requestId) && requestId > 0 ? requestId : null;
}

async function rollback(connection, transactionOpen) {
    if (transactionOpen) await connection.rollback();
}

exports.submitRequest = async (req, res) => {
    const regNo = req.user.reg_no;
    if (!regNo) {
        return res.status(403).json({ error: 'This account is not linked to a student record.' });
    }

    try {
        await db.execute(
            "INSERT INTO clearance_requests (reg_no, current_stage, status) VALUES (?, 'Guild', 'Pending')",
            [regNo]
        );
        return res.status(201).json({ message: 'Clearance request submitted to Guild.' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'A clearance request already exists for this student.' });
        }
        console.error('Unable to submit clearance request:', error);
        return res.status(500).json({ error: 'Unable to submit the clearance request.' });
    }
};

exports.getStudentStatus = async (req, res) => {
    const regNo = req.user.reg_no;
    if (!regNo) {
        return res.status(403).json({ error: 'This account is not linked to a student record.' });
    }

    try {
        const [[request]] = await db.execute(
            `SELECT request_id, reg_no, current_stage, status, last_rejected_by, resubmitted, request_date
             FROM clearance_requests WHERE reg_no = ?`,
            [regNo]
        );

        let history = [];
        if (request) {
            [history] = await db.execute(
                `SELECT department, decision, comments, action_date
                 FROM approvals WHERE request_id = ? ORDER BY action_date, approval_id`,
                [request.request_id]
            );
        }

        const [notifications] = await db.execute(
            `SELECT notification_id, message, is_read, created_at
             FROM notifications WHERE reg_no = ? ORDER BY created_at DESC, notification_id DESC LIMIT 20`,
            [regNo]
        );

        return res.json({ request: request || null, history, notifications });
    } catch (error) {
        console.error('Unable to load student status:', error);
        return res.status(500).json({ error: 'Unable to load student clearance status.' });
    }
};

exports.getOfficerRequests = async (req, res) => {
    const stage = ROLE_STAGE[req.user.role_name];
    if (!stage) {
        return res.status(403).json({ error: 'This account is not assigned to a clearance department.' });
    }

    try {
        const [requests] = await db.execute(
            `SELECT cr.request_id, cr.reg_no, cr.current_stage, cr.status, cr.request_date,
                    cr.resubmitted, s.fullname
             FROM clearance_requests cr
             JOIN students s ON s.reg_no = cr.reg_no
             WHERE cr.current_stage = ? AND cr.status = 'Pending'
             ORDER BY cr.request_date, cr.request_id`,
            [stage]
        );
        return res.json({ stage, requests });
    } catch (error) {
        console.error('Unable to load officer queue:', error);
        return res.status(500).json({ error: 'Unable to load pending clearance requests.' });
    }
};

exports.approveRequest = async (req, res) => {
    const requestId = requestIdFrom(req.params);
    const stage = ROLE_STAGE[req.user.role_name];
    if (!requestId) return res.status(400).json({ error: 'Request ID must be a positive integer.' });

    let connection;
    let transactionOpen = false;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();
        transactionOpen = true;

        const [requests] = await connection.execute(
            'SELECT request_id, reg_no, current_stage, status FROM clearance_requests WHERE request_id = ? FOR UPDATE',
            [requestId]
        );
        if (!requests.length) {
            await rollback(connection, transactionOpen);
            transactionOpen = false;
            return res.status(404).json({ error: 'Clearance request not found.' });
        }

        const request = requests[0];
        if (request.status !== 'Pending' || request.current_stage !== stage) {
            await rollback(connection, transactionOpen);
            transactionOpen = false;
            return res.status(409).json({ error: 'This request is no longer pending at your department.' });
        }

        const nextStage = NEXT_STAGE[stage];
        if (!nextStage) {
            await rollback(connection, transactionOpen);
            transactionOpen = false;
            return res.status(409).json({ error: 'No next workflow stage is configured for this department.' });
        }

        await connection.execute(
            `INSERT INTO approvals (request_id, department, decision, comments)
             VALUES (?, ?, 'Approved', 'Cleared successfully')`,
            [requestId, stage]
        );
        await connection.execute(
            `UPDATE clearance_requests
             SET current_stage = ?, status = ?, last_rejected_by = NULL
             WHERE request_id = ?`,
            [nextStage, nextStage === 'Completed' ? 'Completed' : 'Pending', requestId]
        );
        await connection.execute(
            'INSERT INTO notifications (reg_no, message) VALUES (?, ?)',
            [request.reg_no, `Your request was approved by ${stage} and forwarded to ${nextStage}.`]
        );

        await connection.commit();
        transactionOpen = false;
        return res.json({ message: `Request approved and forwarded to ${nextStage}.` });
    } catch (error) {
        if (connection) {
            await rollback(connection, transactionOpen);
        }
        console.error('Unable to approve clearance request:', error);
        return res.status(500).json({ error: 'Unable to complete the approval.' });
    } finally {
        if (connection) connection.release();
    }
};

exports.rejectRequest = async (req, res) => {
    const requestId = requestIdFrom(req.params);
    const stage = ROLE_STAGE[req.user.role_name];
    const comments = typeof req.body?.comments === 'string' ? req.body.comments.trim() : '';
    if (!requestId) return res.status(400).json({ error: 'Request ID must be a positive integer.' });
    if (!comments) return res.status(400).json({ error: 'A rejection reason is required.' });
    if (comments.length > 2000) return res.status(400).json({ error: 'Rejection reason must be 2000 characters or fewer.' });

    let connection;
    let transactionOpen = false;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();
        transactionOpen = true;

        const [requests] = await connection.execute(
            'SELECT request_id, reg_no, current_stage, status FROM clearance_requests WHERE request_id = ? FOR UPDATE',
            [requestId]
        );
        if (!requests.length) {
            await rollback(connection, transactionOpen);
            transactionOpen = false;
            return res.status(404).json({ error: 'Clearance request not found.' });
        }

        const request = requests[0];
        if (request.status !== 'Pending' || request.current_stage !== stage) {
            await rollback(connection, transactionOpen);
            transactionOpen = false;
            return res.status(409).json({ error: 'This request is no longer pending at your department.' });
        }

        await connection.execute(
            `INSERT INTO approvals (request_id, department, decision, comments)
             VALUES (?, ?, 'Rejected', ?)`,
            [requestId, stage, comments]
        );
        await connection.execute(
            'UPDATE clearance_requests SET status = ?, last_rejected_by = ? WHERE request_id = ?',
            ['Rejected', stage, requestId]
        );
        await connection.execute(
            'INSERT INTO notifications (reg_no, message) VALUES (?, ?)',
            [request.reg_no, `Your request was rejected by ${stage}. Reason: ${comments}`]
        );

        await connection.commit();
        transactionOpen = false;
        return res.json({ message: 'Request rejected. The student has been notified.' });
    } catch (error) {
        if (connection) {
            await rollback(connection, transactionOpen);
        }
        console.error('Unable to reject clearance request:', error);
        return res.status(500).json({ error: 'Unable to complete the rejection.' });
    } finally {
        if (connection) connection.release();
    }
};

exports.resubmitRequest = async (req, res) => {
    const regNo = req.user.reg_no;
    if (!regNo) {
        return res.status(403).json({ error: 'This account is not linked to a student record.' });
    }

    let connection;
    let transactionOpen = false;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();
        transactionOpen = true;

        const [requests] = await connection.execute(
            'SELECT request_id, last_rejected_by, status FROM clearance_requests WHERE reg_no = ? FOR UPDATE',
            [regNo]
        );
        if (!requests.length) {
            await rollback(connection, transactionOpen);
            transactionOpen = false;
            return res.status(404).json({ error: 'No clearance request was found for this student.' });
        }

        const request = requests[0];
        const stage = request.last_rejected_by === 'Librarian' ? 'Library' : request.last_rejected_by;
        if (request.status !== 'Rejected' || !Object.values(ROLE_STAGE).includes(stage)) {
            await rollback(connection, transactionOpen);
            transactionOpen = false;
            return res.status(409).json({ error: 'Only a rejected request can be resubmitted.' });
        }

        await connection.execute(
            `UPDATE clearance_requests
             SET current_stage = ?, status = 'Pending', resubmitted = TRUE
             WHERE request_id = ?`,
            [stage, request.request_id]
        );
        await connection.execute(
            'INSERT INTO notifications (reg_no, message) VALUES (?, ?)',
            [regNo, `Your request was resubmitted to ${stage} for review.`]
        );

        await connection.commit();
        transactionOpen = false;
        return res.json({ message: `Request resubmitted to ${stage}.` });
    } catch (error) {
        if (connection) {
            await rollback(connection, transactionOpen);
        }
        console.error('Unable to resubmit clearance request:', error);
        return res.status(500).json({ error: 'Unable to resubmit the clearance request.' });
    } finally {
        if (connection) connection.release();
    }
};

exports.getFacultyHeadOverview = async (req, res) => {
    try {
        const [[stats]] = await db.execute(`
            SELECT COUNT(*) AS total,
                   COALESCE(SUM(status = 'Completed'), 0) AS completed,
                   COALESCE(SUM(status = 'Pending'), 0) AS pending,
                   COALESCE(SUM(status = 'Rejected'), 0) AS rejected
            FROM clearance_requests
        `);
        const [bottlenecks] = await db.execute(`
            SELECT current_stage, COUNT(*) AS pending_count
            FROM clearance_requests
            WHERE status = 'Pending'
            GROUP BY current_stage
            ORDER BY pending_count DESC, current_stage
        `);
        const [recentActivity] = await db.execute(`
            SELECT a.action_date, s.reg_no, s.fullname, a.department, a.decision, a.comments
            FROM approvals a
            JOIN clearance_requests cr ON cr.request_id = a.request_id
            JOIN students s ON s.reg_no = cr.reg_no
            ORDER BY a.action_date DESC, a.approval_id DESC
            LIMIT 25
        `);
        return res.json({ stats, bottlenecks, recentActivity });
    } catch (error) {
        console.error('Unable to load faculty-head overview:', error);
        return res.status(500).json({ error: 'Unable to load faculty-head metrics.' });
    }
};
