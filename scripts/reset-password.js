const bcrypt = require('bcrypt');
const db = require('../config/db');
const readHidden = require('./read-hidden');

async function main() {
    const username = process.argv[2]?.trim();
    if (!username) {
        throw new Error('Provide the account username, e.g. npm run reset-password -- "@guild.must"');
    }

    const password = await readHidden('New password (input hidden): ');
    if (!password) {
        throw new Error('Password cannot be empty.');
    }
    if (Buffer.byteLength(password, 'utf8') > 72) {
        throw new Error('Bcrypt passwords must be no more than 72 bytes.');
    }

    const hash = await bcrypt.hash(password, 12);
    const [result] = await db.execute(
        'UPDATE users SET password = ? WHERE username = ?',
        [hash, username]
    );

    if (result.affectedRows !== 1) {
        throw new Error(`Expected one account named "${username}", found ${result.affectedRows}.`);
    }

    console.log(`Password reset successfully for "${username}".`);
}

main()
    .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    })
    .finally(() => db.end());
