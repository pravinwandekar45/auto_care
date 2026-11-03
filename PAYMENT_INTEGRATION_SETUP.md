# AutoCare Razorpay payment integration (PHP + MySQL + XAMPP)

This module uses the existing AutoCare `invoices` table as the payable source and `bookings.owner_id` to enforce invoice ownership. It does not trust an amount supplied by the browser.

## Files added/updated
- `backend/config/payment.php`: reads Razorpay credentials from environment variables; removed fake demo secrets.
- `backend/payment/checkout.php`: authenticated checkout UI for a real database invoice.
- `backend/payment/common.php`: owner-session and CSRF helpers.
- `backend/api/payments.php`: server-side order creation, signature verification, captured-payment lookup, and status lookup.
- `backend/api/razorpay_webhook.php`: signature-verified `payment.captured` webhook.
- `database/migrations/2026_razorpay_payments.sql`: payment status and transaction table migration.

## 1. Run migration
1. Back up your database.
2. For a fresh install, import `database/schema.sql` into phpMyAdmin; it creates `users` and already includes the payment tables/columns.
3. Run `database/migrations/2026_razorpay_payments.sql` only when upgrading an older database that does not yet have the payment fields.
4. The migration assumes `invoices.id`, `invoices.booking_id`, `invoices.amount`, `bookings.id`, and `bookings.owner_id` exist. If `booking_id` already has a unique index, remove the duplicate `ADD UNIQUE KEY` line before running.

## 2. Install the official PHP SDK
In Command Prompt:
```bat
cd C:\xampp\htdocs\old\web_project1\backend
composer require razorpay/razorpay
```
Adjust the path to wherever you extracted the project under `htdocs`.

## 3. Configure keys
Create Razorpay test keys in the Razorpay Dashboard. Set these environment variables for the PHP/Apache process:
- `RAZORPAY_KEY_ID` (test key ID, starts with `rzp_test_`)
- `RAZORPAY_KEY_SECRET` (test secret)
- `RAZORPAY_WEBHOOK_SECRET` (a secret you choose in the Razorpay webhook settings)

Do not paste secrets into JavaScript or commit them to a public repository. Restart Apache after setting environment variables. On Windows/XAMPP, one option for local testing is to set them in Apache's `httpd.conf` using `SetEnv RAZORPAY_KEY_ID "..."` and corresponding lines for the other variables; protect this file and never use live secrets in a public repository.

## 4. Login/session requirement
The existing static HTML login is a browser-only demo and does NOT create the PHP session required by payment endpoints. Your real login must POST to `backend/api/auth.php?action=login`, and the PHP session cookie must be retained. The backend login endpoint currently stores the signed-in user in `$_SESSION['user']`; payment endpoints require `role=owner` and `id` in that session. A real database user, vehicle, booking, and invoice must exist. Do not test payment with the sample localStorage invoice IDs (such as `INV-1024`); database invoice IDs are numeric.

## 5. Sign in and pay a real invoice
On the Owner > Invoices page, Pay Now opens a payment-method summary (UPI/QR, cards, net banking and wallets), then continues to the secure Razorpay checkout. Razorpay shows the methods enabled for the merchant account; its UPI QR option is shown by the provider when available. The separate QR on the AutoCare checkout page only opens the checkout URL on another device; it is not itself a payment QR. Payment is verified server-side before the invoice is marked Paid. 
The payment module includes a database-backed owner login and invoice list because the supplied static HTML login/invoice pages use demo-only browser storage. Open `http://localhost/old/web_project1/backend/payment/login.php`, sign in with an owner account stored in the `users` table, then choose Pay now on a real invoice. Direct checkout URL format: `http://localhost/old/web_project1/backend/payment/checkout.php?invoice_id=1`. Replace the path/ID as needed. The account password must be stored with PHP `password_hash()` (the normal auth API does this).

## 6. Webhook setup
For public HTTPS development/staging, configure a Razorpay webhook URL:
`https://YOUR-DOMAIN/old/web_project1/backend/api/razorpay_webhook.php`
Subscribe to `payment.captured`, and set the same webhook secret in `RAZORPAY_WEBHOOK_SECRET`. A local `localhost` endpoint cannot receive provider webhooks directly without a secure public tunnel. Checkout verification also queries Razorpay's API, so the webhook is a recovery path for the customer closing the page.

## 7. Test and go live
- Use Razorpay Test Mode first and provider-issued test payment details.
- Confirm `payment_transactions.status='paid'` and `invoices.payment_status='paid'` only after captured-payment verification.
- Test wrong signatures, wrong invoice ownership, duplicate callbacks, pending/failed payment, and page refresh.
- Enable UPI, cards, and net banking in the Razorpay merchant account; methods depend on provider approval/account configuration.
- Before production, fix the existing demo login and data flow, enforce HTTPS, review DB credentials and CORS, add rate limits and event-idempotency logging, and complete provider onboarding. Do not use real money until tested.

## Existing project caveat
The supplied `database/schema.sql` had a `users1` table name while its foreign keys and PHP APIs use `users`; this package fixes the fresh-install schema to use `users`. If your existing database already has tables, do not recreate them—inspect them and apply only the needed migration.

The supplied frontend currently stores demo bookings/invoices in browser-side data. This integration intentionally does not pretend those localStorage records are database invoices. The Pay Now flow must be connected to real API-backed invoice rows after the PHP login is wired to the UI.
