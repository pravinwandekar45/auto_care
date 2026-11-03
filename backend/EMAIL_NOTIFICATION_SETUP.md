# AutoCarePro – Gmail SMTP completion email

## What this does
When a garage/admin changes a booking from a non-completed status to `completed`, the API sends the vehicle owner an email with the vehicle registration, garage name and booking ID. A successful send is recorded in `bookings.completion_email_sent_at`, preventing repeat completion emails.

## 1. Enable Gmail SMTP
1. Enable Google 2-Step Verification on the Gmail account.
2. Create an App Password at https://myaccount.google.com/apppasswords.
3. Use the 16-character App Password (not your normal Gmail password).

## 2. Configure credentials locally
Set these environment variables for the PHP/Apache process:

- `AUTOCARE_SMTP_HOST=smtp.gmail.com`
- `AUTOCARE_SMTP_PORT=587`
- `AUTOCARE_SMTP_USERNAME=your-address@gmail.com`
- `AUTOCARE_SMTP_APP_PASSWORD=your-16-character-app-password`
- `AUTOCARE_MAIL_FROM=your-address@gmail.com`
- `AUTOCARE_MAIL_FROM_NAME=AutoCarePro`

`backend/.env.example` is a template only. PHP does not automatically load `.env` files. For XAMPP/Apache, set the variables in the Apache environment or your local PHP environment, then restart Apache. Do not paste real credentials into frontend files, source control, or a publicly deployed ZIP. If your hosting provider offers environment variables/secrets, configure them there.

## 3. Database
- Fresh database: import `backend/database/schema.sql` (it already includes `completion_email_sent_at`).
- Existing database: run `backend/database/migrations/2026_booking_completion_email.sql` once in phpMyAdmin.

Do not run the migration on a database created from the updated schema, because the column already exists.

## 4. Test
1. Confirm the owner account has a valid email in `users.email`.
2. Configure SMTP credentials and restart Apache.
3. Sign in as the garage and mark a test booking completed.
4. Check the owner's inbox and spam folder.
5. Check `bookings.completion_email_sent_at` for a timestamp.

The booking status is saved even if Gmail is temporarily unavailable. In that case the API response includes `email_notification.success=false` and an error message; fix SMTP settings before retrying. The current implementation sends only on the first transition into completed status.

## Notes
This project is a PHP/MySQL application. Gmail SMTP settings are independent of the deployment host, but the PHP host must permit outbound SMTP connections to `smtp.gmail.com:587`. Never share your App Password in chat or commit it to Git.
