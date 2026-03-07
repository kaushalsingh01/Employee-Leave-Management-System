const pool = require("../config/db")


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

const createUser = async({name, email, password ,role, manager_id}) => {
    const query = `
    INSERT INTO users(name, email, password, role, manager_id)
    VALUES($1, $2, $3, $4, $5)
        RETURNING id, name, email, role, manager_id
    `;
    const values  = [name, email, password, role, manager_id || null];
    const result = await pool.query(query, values);
    return result.rows[0];
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


module.exports = {
    findByEmail,
    findById,
    createUser,
    deleteUser,
    updateUser,
    findEmployeesByManager
};