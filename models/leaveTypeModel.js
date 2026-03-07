const pool = require("../config/db");

const findAll = async () => {
    const query = 'SELECT * FROM leave_types';
    const result = await pool.query(query);
    return result.rows;
};

const findById = async (id) => {
    const query = 'SELECT * FROM leave_types WHERE id = $1';
    const values = [id];
    const result = await pool.query(query, values);
    return result.rows[0];
};

const createLeaveType = async ({name, description}) => {
    const query = `
        INSERT INTO leave_types (name, description)
        VALUES ($1, $2)
        RETURNING *
    `;
    const values = [name, description];
    const result = await pool.query(query, values);
    return result.rows[0];
};

const updateLeaveType = async (id, fields) => {
    if (Object.keys(fields).length === 0) {
        return findById(id);
    }

    const allowedColumns = ['name', 'description'];

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

    const query = `UPDATE leave_types SET ${setClause} WHERE id = $1 RETURNING id, name, description`;
    const result = await pool.query(query, values);
    return result.rows[0];

};

const deleteLeaveType = async (id) => {
    const query = 'DELETE FROM leave_types WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [id]);
    return result.rowCount;
};

module.exports = {
    findAll,
    findById,
    createLeaveType,
    updateLeaveType,
    deleteLeaveType
};