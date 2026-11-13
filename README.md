# MUST Graduation Clearance

Graduation clearance workflow using Node.js, Express, MySQL, and browser-native
JavaScript. User login passwords are stored as bcrypt hashes; database
credentials are loaded from a local `.env` file.

## Requirements

- Node.js 20 or newer
- MySQL 8 or newer

## First-time setup (Windows PowerShell)

Run commands from this project directory:

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env` and set your MySQL host, port, username, and password. Replace
`JWT_SECRET` with a random value of at least 32 characters. Keep `.env` private;
it is excluded from Git.
Generate a secret with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

In MySQL Workbench, connect to the same MySQL server and run
`database/schema.sql`. It creates the database, roles, faculties, and workflow
tables. It is safe to run again; it does not delete existing users or requests.

The schema deliberately does not create user accounts or sample passwords. Add
your university accounts to `users` with bcrypt-hashed passwords and the
appropriate role. For student accounts, also add the matching `students` row
and faculty reference. An account's username is the exact value stored in
`users.username` (for example `@guild.must` or a student registration number).

Start the application:

```powershell
npm start
```

Open <http://localhost:3000>. The server verifies its JWT configuration and
MySQL connection before it starts listening.

## Reset an existing account's password

In an interactive PowerShell window, run:

```powershell
npm run reset-password -- "@guild.must"
```

Replace the username with the exact account to update. Enter the new password
at the masked prompt; it is hashed with bcrypt before being saved.

## Add a student account

Run this in an interactive PowerShell window:

```powershell
npm run add-student
```

Enter the student's registration number, full name, and a faculty ID from the
displayed list, then enter their password at the masked prompt. The command
creates both the student login and its student record in a database transaction.
The registration number is also the student's login username. You do not need
to generate or enter a password hash yourself; the command hashes the password
with bcrypt before saving it. The student can sign in and submit a clearance
request from the dashboard.

## Application routes

- `/login.html` — login
- `/student-dashboard.html` — student progress, rejection feedback, and resubmission
- `/officer-dashboard.html` — department queue and approval/rejection actions
- `/faculty-head-dashboard.html` — system statistics and activity audit

The workflow is Student → Guild → Library → Finance → HOD → Dean → AR →
Completed. Librarian accounts handle the Library stage. Rejected requests may
only be resubmitted to the stage that rejected them.
