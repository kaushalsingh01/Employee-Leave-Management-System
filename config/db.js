const { release } = require('os');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DB,
    password: String(process.env.POSTGRES_PASSWORD),
    port: process.env.POSTGRES_PORT,
    ssl: false
});

pool.connect((err, client, release) => {
    if(err) {
        return console.log("Error acquiring client", err.stack);
    }
    console.log('Connected to PostgreSQL');
    release();
});

module.exports = pool;
