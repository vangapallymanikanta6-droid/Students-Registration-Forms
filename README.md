# BusinessLabs Student Registration

## MySQL setup

1. Install and start MySQL Server. MySQL Workbench is a client and does not provide the database server by itself.
2. Copy `.env.example` to `.env` and set the MySQL username and password for your local server.
3. Install dependencies with `npm install`.
4. Start the app with `npm start`. On startup the backend creates the configured database and `users` table if they do not exist, and seeds the admin account if it is missing.
5. Open `http://localhost:8000`.

Alternatively, run `businesslabs_schema.sql` in MySQL Workbench to create the database and table before starting the app.

The database defaults to `businesslabs` on `127.0.0.1:3306`. The seeded demo admin credentials default to `admin@businesslabs.com` / `admin123`; override them in `.env` before the first start if needed.

## Student login accounts

The configured MySQL database currently contains these student accounts:

- `anadam@gmail.com` password:anand
- `manideep@gmail.com` password:manideep

Each account uses the password chosen when that student registered (or their subsequently changed password). Passwords are intentionally not listed in this README.

Uploaded PDF files are saved under `uploads/` using randomized unique names. The database stores the generated filename and the original display name.

## Data flow

1. The browser submits registration, login, profile updates, and admin CRUD requests to `/api/*`.
2. Express validates request fields and uploaded PDFs, then reads or writes user rows through the MySQL connection pool.
3. PDF bytes are stored in `uploads/`; the database stores file metadata. The API returns links under `/uploads/`.
4. The browser renders the API results on the student and admin dashboards.

The previous SQLite database is not migrated to MySQL. New MySQL tables start with the seeded admin account; students must register again unless their data is imported separately.
