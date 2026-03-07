const pool = require("../config/db");

const getByUser = async (userId) => {
    const query = `
        SELECT lb.*, lt.name as leave_type
        FROM leave_balances lb
        JOIN leave_types lt ON lb.leave_type_id = lt.id
        WHERE lb.user_id = $1
    `;
    const values = [userId];
    const result = await pool.query(query, values);
    return result.rows;
};

const deductBalance = async (userId, leaveTypeId, days) => {
    const query = `
        UPDATE leave_balances
        SET balance = balance - $1, updated_at = NOW()
        WHERE user_id = $2 AND leave_type_id = $3 AND balance >= $1
        RETURNING * 
    `;
    const values = [days, userId, leaveTypeId];
    const result = await pool.query(query, values);
    return result.rows[0];
};

const addBalance = async (userId, leaveTypeId, days) => {
    const query = `
        UPDATE leave_balances
        SET balance = balance + $1, updated_at = NOW()
        WHERE user_id = $2 AND leave_type_id = $3
        RETURNING *
    `;
    const values = [days, userId, leaveTypeId];
    const result = await pool.query(query, values);
    return result.rows[0];
};

const initializeForUser = async (userId) => {
    const query = `
        INSERT INTO leave_balances (user_id, leave_type_id, balance)
        SELECT $1, id, 20.0 FROM leave_types WHERE name = 'Vacation'
        UNION ALL
        SELECT $1, id, 10.0 FROM leave_types WHERE name = 'Sick Leave'
    `;
    await pool.query(query, [userId]);
};

module.exports = {
    getByUser,
    deductBalance,
    addBalance,
    initializeForUser
};