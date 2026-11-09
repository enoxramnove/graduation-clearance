const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',         // Change to your MySQL username
    password: 'password', // Change to your MySQL password
    database: 'graduation_clearance_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;
