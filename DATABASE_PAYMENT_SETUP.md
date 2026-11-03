# AutoCare Pro – Database integration update

## What changed
- Booking API now creates and reads numeric `bookings.id` records using the authenticated PHP session.
- Owner booking creation validates vehicle ownership, garage existence, future date/time, and slot conflicts.
- Garage/admin booking status updates are checked against the assigned garage; the UI's intermediate workflow statuses are mapped to the existing database enum.
- Invoice API now reads invoices through booking/owner/garage joins and creates invoices only for completed bookings assigned to the garage (or admin).
- Invoice creation prevents duplicate invoices per booking and returns the numeric `invoices.id`.
- Invoice line items are stored in the new `invoice_items` table.
- Owner and garage dashboard data functions now request bookings/invoices from their APIs instead of generating `BK-` / `INV-` records in portal state.
- Razorpay webhook autoload path corrected to the SDK bundled under `backend/payment/vendor`.
- Database CORS no longer emits wildcard origins with cookie credentials.

## XAMPP setup
1. Back up your existing `users` database before applying changes.
2. Start Apache and MySQL.
3. In phpMyAdmin, select the existing `users` database and import `backend/database/migrations/2026_autocare_booking_invoice_payment.sql`.
4. Confirm `backend/config/db.php` matches your local MySQL host, username, password and database.
5. Keep the project under `xampp/htdocs` and open it through `http://localhost/...` so PHP session cookies are same-origin.
6. Configure `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and (for webhooks) `RAZORPAY_WEBHOOK_SECRET` in the PHP/Apache environment. Use Razorpay Test Mode keys. Never put the secret in JavaScript.
7. Configure a Razorpay webhook for `payment.captured` pointing to `backend/api/razorpay_webhook.php`.

## Workflow checks
- Owner: create a future booking for a vehicle belonging to the signed-in account; the returned booking number must be numeric.
- Garage: confirm/receive/start/complete that booking. Existing SQL enum stores `confirmed` for the intermediate stages and `completed` for completion.
- Garage: create an invoice for the completed booking. The returned invoice number must be numeric and payment status must be `pending`.
- Owner: open the invoice checkout and complete a Razorpay Test Mode payment. Server verification or a signed `payment.captured` webhook updates invoice and transaction status.
- Confirm owner sees only own records, garage sees only assigned records, and admin sees all.

## Important testing limitation
The archive was syntax-checked for the changed PHP and JavaScript files, but it could not be run against your local MySQL database, actual PHP session configuration, browser UI, or Razorpay account from this environment. Test with a database backup and Razorpay Test Mode before production. Existing tables and business data are not dropped or reset by the supplied migration.
