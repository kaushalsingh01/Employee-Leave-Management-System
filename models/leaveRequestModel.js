const pool = require("../config/db");

const createLeaveRequest = async ({ user_id, leave_type_id, start_date, end_date, reason }) => {
    const query = `
        INSERT INTO leave_requests (user_id, leave_type_id, start_date, end_date, reason)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `;
    const values = [user_id, leave_type_id, start_date, end_date, reason];
    const result = await pool.query(query, values);
    return result.rows[0];
};

const getPendingForManager = async (managerId) => {
    const query = `
        SELECT lr.*, u.name as employee_name
        FROM leave_requests lr
        JOIN users u ON lr.user_id = u.id
        WHERE u.manager_id = $1 AND lr.status = 'pending'
        ORDER BY lr.submitted_at DESC
    `;
    const values = [managerId];
    const result = await pool.query(query, values);
    return result.rows;
};

const getByUser = async (userId) => {
    const query = `
        SELECT lr.*, lt.name as leave_type
        FROM leave_requests lr
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        WHERE lr.user_id = $1
        ORDER BY lr.submitted_at DESC
    `;
    const values = [userId];
    const result = await pool.query(query, values);
    return result.rows;
};

const updateStatus = async (id, status, reviewed_by, manager_comments = null) => {
    const query = `
        UPDATE leave_requests
        SET status = $1, reviewed_by = $2, manager_comments = $3, reviewed_at = NOW()
        WHERE id = $4
        RETURNING *
    `;
    const values = [status, reviewed_by, manager_comments, id];
    const result = await pool.query(query, values);
    return result.rows[0];
};

const findById = async (id) => {
    const query = 'SELECT * FROM leave_requests WHERE id = $1';
    const values = [id];
    const result = await pool.query(query, values);
    return result.rows[0];
};

const findApprovedBetween = async (startDate, endDate) => {
    const query = `
        SELECT lr.*, u.name AS employee_name, lt.name AS leave_type
        FROM leave_requests lr
        JOIN users u ON lr.user_id = u.id
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        WHERE lr.status = 'approved'
          AND lr.start_date <= $1
          AND lr.end_date >= $2
    `;
    const values = [endDate, startDate];
    const result = await pool.query(query, values);
    return result.rows;
};

module.exports = {
    createLeaveRequest,
    getPendingForManager,
    getByUser,
    updateStatus,
    findById,
    findApprovedBetween
};