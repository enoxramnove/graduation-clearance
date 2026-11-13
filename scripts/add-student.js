const readline = require('node:readline/promises');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const readHidden = require('./read-hidden');

async function main() {
    const prompts = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try {
        const regNo = (await prompts.question('Student registration number: ')).trim();
        const fullname = (await prompts.question('Student full name: ')).trim();
        if (!regNo || regNo.length > 20) {
            throw new Error('Registration number must be between 1 and 20 characters.');
        }
        if (!fullname || fullname.length > 100) {
            throw new Error('Full name must be between 1 and 100 characters.');
        }

        const [faculties] = await db.execute(
            'SELECT faculty_id, faculty_name FROM faculties ORDER BY faculty_name'
        );
        if (faculties.length === 0) {
            throw new Error('No faculties were found. Run database/schema.sql first.');
        }
        console.log('Available faculties:');
        for (const faculty of faculties) {
            console.log(`${faculty.faculty_id}: ${faculty.faculty_name}`);
        }
        const facultyId = Number((await prompts.question('Faculty ID: ')).trim());
        const faculty = faculties.find((entry) => entry.faculty_id === facultyId);
        if (!faculty) {
            throw new Error('Choose a faculty ID from the list.');
        }
        prompts.close();

        const password = await readHidden('Student password (input hidden): ');
        if (!password) {
            throw new Error('Password cannot be empty.');
        }
        if (Buffer.byteLength(password, 'utf8') > 72) {
            throw new Error('Bcrypt passwords must be no more than 72 bytes.');
        }

        const hash = await bcrypt.hash(password, 12);
        const connection = await db.getConnection();
        let transactionStarted = false;
        try {
            await connection.beginTransaction();
            transactionStarted = true;
            const [[role]] = await connection.execute(
                'SELECT role_id FROM roles WHERE role_name = ?',
                ['Student']
            );
            if (!role) {
                throw new Error('Student role was not found. Run database/schema.sql first.');
            }

            const [userResult] = await connection.execute(
                'INSERT INTO users (username, password, role_id) VALUES (?, ?, ?)',
                [regNo, hash, role.role_id]
            );
            await connection.execute(
                'INSERT INTO students (reg_no, fullname, user_id, faculty_id) VALUES (?, ?, ?, ?)',
                [regNo, fullname, userResult.insertId, faculty.faculty_id]
            );
            await connection.commit();
            transactionStarted = false;
            console.log(`Student "${regNo}" was created. Their username is the registration number.`);
        } catch (error) {
            if (transactionStarted) {
                await connection.rollback();
            }
            if (error.code === 'ER_DUP_ENTRY') {
                throw new Error(`A user or student record already uses registration number "${regNo}".`);
            }
            throw error;
        } finally {
            connection.release();
        }
    } finally {
        prompts.close();
    }
}

main()
    .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    })
    .finally(() => db.end());
