-- Run once in phpMyAdmin against the AutoCarePro `users` database.
ALTER TABLE bookings
  ADD COLUMN completion_email_sent_at DATETIME NULL AFTER workflow_stage;
