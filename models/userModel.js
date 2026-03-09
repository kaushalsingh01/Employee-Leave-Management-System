const pool = require("../config/db")
const leaveBalanceModel = require("../models/leaveBalanceModel")

const findByEmail = async (email) => {
    const query = 'SELECT * FROM users WHERE email = $1';
    const values = [email];
    const result = await pool.query(query, values);
    return result.rows[0];
};

const findById = async (id) => {
    const query = 'SELECT id, name, email, role, manager_id FROM users WHERE id = $1';
    const values = [id];
    const result = await pool.query(query, values);
    return result.rows[0];
};

const createUser = async ({ name, email, password, role, manager_id }) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Insert user
        const userQuery = `
            INSERT INTO users (name, email, password, role, manager_id, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING id, name, email, role, manager_id, created_at
        `;
        const userResult = await client.query(userQuery, [name, email, password, role, manager_id || null]);
        const newUser = userResult.rows[0];

        // Initialize leave balances for the new user (using the same transaction)
        await leaveBalanceModel.initializeForUser(newUser.id, client);

        await client.query('COMMIT');
        return newUser;

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

const updateUser = async (id, fields) => {
    if (Object.keys(fields).length === 0) {
        return findById(id);
    }

    const allowedColumns = ['name', 'email', 'password', 'role', 'manager_id'];

    const filteredFields = Object.keys(fields)
        .filter(key => allowedColumns.includes(key))
        .reduce((obj, key) => {
            obj[key] = fields[key];
            return obj;
        }, {});

    if (Object.keys(filteredFields).length === 0) {
        return findById(id);
    }

    const keys = Object.keys(filteredFields);
    const setClause = keys.map((key, index) => `${key} = $${index + 2}`).join(', ');
    const values = [id, ...Object.values(filteredFields)];

    const query = `UPDATE users SET ${setClause} WHERE id = $1 RETURNING id, name, email, role, manager_id`;
    const result = await pool.query(query, values);
    return result.rows[0];
};

const deleteUser = async (id) => {
    const query = 'DELETE FROM users WHERE id = $1';
    const values = [id];
    const result = await pool.query(query, values);
    return result.rowCount;
}
const findEmployeesByManager = async (manager_id) => {
    const query = 'SELECT id, name, email FROM users WHERE manager_id = $1';
    const values = [manager_id];
    const result = await pool.query(query, values);
    return result.rows;
};

const getUserWithBalances = async (userId) => {
    const query = `
        SELECT u.id, u.name, u.email, u.role, u.manager_id,
               json_agg(json_build_object(
                   'leave_type', lt.name,
                   'balance', lb.balance,
                   'leave_type_id', lt.id
               )) as leave_balances
        FROM users u
        LEFT JOIN leave_balances lb ON u.id = lb.user_id
        LEFT JOIN leave_types lt ON lb.leave_type_id = lt.id
        WHERE u.id = $1
        GROUP BY u.id
    `;
    const result = await pool.query(query, [userId]);
    return result.rows[0];
};


module.exports = {
    findByEmail,
    findById,
    createUser,
    deleteUser,
    updateUser,
    findEmployeesByManager,
    getUserWithBalances
};