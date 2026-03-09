const pool = require('../config/db');

// Get balances for a user
const getByUser = async (userId) => {
    const query = `
        SELECT lb.*, lt.name as leave_type, lt.description
        FROM leave_balances lb
        JOIN leave_types lt ON lb.leave_type_id = lt.id
        WHERE lb.user_id = $1
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
};

// Get specific balance for a user and leave type
const getByUserAndType = async (userId, leaveTypeId) => {
    const query = `
        SELECT * FROM leave_balances 
        WHERE user_id = $1 AND leave_type_id = $2
    `;
    const result = await pool.query(query, [userId, leaveTypeId]);
    return result.rows[0];
};

// Initialize default balances for a new user
const initializeForUser = async (userId, transactionClient = null) => {
    // Default leave balances (in days)
    const defaultBalances = {
        'Vacation': 20,
        'Sick Leave': 12,
        'Casual Leave': 10,
        'Earned Leave': 15
    };

    // Get all leave types
    const leaveTypesQuery = 'SELECT id, name FROM leave_types';
    const leaveTypes = await pool.query(leaveTypesQuery);

    // Insert balance for each leave type
    for (const leaveType of leaveTypes.rows) {
        const balanceAmount = defaultBalances[leaveType.name] || 0;

        const insertQuery = `
            INSERT INTO leave_balances (user_id, leave_type_id, balance, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (user_id, leave_type_id) 
            DO UPDATE SET balance = EXCLUDED.balance, updated_at = NOW()
        `;

        if (transactionClient) {
            // If using transaction
            await transactionClient.query(insertQuery, [userId, leaveType.id, balanceAmount]);
        } else {
            await pool.query(insertQuery, [userId, leaveType.id, balanceAmount]);
        }
    }
};

// Update balance (e.g., subtract days after approval)
const deductBalance = async (userId, leaveTypeId, days, transactionClient = null) => {
    const query = `
        UPDATE leave_balances
        SET balance = balance - $1, updated_at = NOW()
        WHERE user_id = $2 AND leave_type_id = $3
        RETURNING *
    `;

    if (transactionClient) {
        return await transactionClient.query(query, [days, userId, leaveTypeId]);
    } else {
        const result = await pool.query(query, [days, userId, leaveTypeId]);
        return result.rows[0];
    }
};

// Add balance (e.g., when leave is cancelled or annual credit)
const addBalance = async (userId, leaveTypeId, days, transactionClient = null) => {
    const query = `
        UPDATE leave_balances
        SET balance = balance + $1, updated_at = NOW()
        WHERE user_id = $2 AND leave_type_id = $3
        RETURNING *
    `;

    if (transactionClient) {
        return await transactionClient.query(query, [days, userId, leaveTypeId]);
    } else {
        const result = await pool.query(query, [days, userId, leaveTypeId]);
        return result.rows[0];
    }
};

// Check if user has sufficient balance
const hasSufficientBalance = async (userId, leaveTypeId, requestedDays) => {
    const balance = await getByUserAndType(userId, leaveTypeId);
    return balance && balance.balance >= requestedDays;
};

module.exports = {
    getByUser,
    getByUserAndType,
    initializeForUser,
    deductBalance,
    addBalance,
    hasSufficientBalance
};