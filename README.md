# Project (XAMPP)

## Folder layout
- `frontend/` — current vehicle portal UI
- `backend/api/` — PHP API endpoints
- `backend/config/db.php` — database connection configuration
- `backend/database/` — SQL schema and migrations
- `legacy/frontend/` — original AngularJS frontend, retained separately

## Run with XAMPP
1. Copy the `project` folder into XAMPP's `htdocs` directory.
2. Start **Apache** and **MySQL** in the XAMPP Control Panel.
3. Import `backend/database/schema.sql` into phpMyAdmin and configure `backend/config/db.php` for your local database credentials.
4. Open the pages through Apache (not by opening the HTML files directly):
   - Login: http://localhost/project/frontend/login.html
   - Register: http://localhost/project/frontend/register.html
   - Forgot password: http://localhost/project/frontend/forgot-password.html
   - API endpoint example: http://localhost/project/backend/api/auth.php
5. Owner pages are under `http://localhost/project/frontend/owner/`, Garage pages under `http://localhost/project/frontend/garage/`, and Admin pages under `http://localhost/project/frontend/admin/`.

The PHP API may require a query parameter or request body to return a useful response; opening `auth.php` directly is only a URL/path check.


## Clean single-garage / multi-owner setup
- The clean schema creates an empty portal dataset and only two required fixed accounts (no demo owners, vehicles, bookings, invoices, or payments).
- Database name: `users` (must match `backend/config/db.php`). If you have an older database, back it up first; do not drop it without confirming you no longer need its data.
- Car owners register individually from `frontend/register.html`; public registration only creates owner accounts.
- To start completely clean, create/import into a fresh `users` database using `backend/database/schema.sql`. This is safer than deleting rows from an existing database.
- Set `$db_pass` in `backend/config/db.php` to the actual local MySQL password on your machine. The archive retains the existing project configuration; verify it before running.


## Vehicle registration persistence (important)

Newly registered owner vehicles are saved to the MySQL `vehicles` table, and the owner ID is taken from the authenticated PHP session (not from browser-submitted data). Owners can only list/delete their own vehicles; Garage/Admin can view the registered vehicle list according to their role.

- For a **brand-new clean database**, import `backend/database/schema.sql`. It creates the tables and fixed Admin/Garage accounts with no sample vehicles, bookings, invoices or payments.
- For an **existing `users` database**, take a backup first. If the `vehicles` table already exists, import `backend/database/migrations/2026_vehicle_registration.sql` to add the missing vehicle fields without deleting records. If the `vehicles` table does not exist, create the missing tables from the schema carefully rather than dropping the database; avoid re-running the fixed-account INSERT if those emails already exist.
- Open the website through XAMPP, for example `http://localhost/project/frontend/login.html`. Do not open HTML files directly from the filesystem; PHP session cookies and API calls require Apache.
- In `backend/config/db.php`, confirm the MySQL username/password match the local XAMPP setup.

After adding a vehicle, verify it in phpMyAdmin with:



## Booking service package and garage action fix

For an existing database, run `backend/database/migration_booking_service_workflow.sql` once in phpMyAdmin/MySQL before using the updated application. For a fresh database, import the updated `backend/database/schema.sql`. The migration adds the selected service package fields and workflow stage, and permits the garage booking statuses used by the UI.
