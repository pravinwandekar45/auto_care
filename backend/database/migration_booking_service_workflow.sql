-- AutoCarePro booking service package and workflow fix
-- Run once on an existing database. If a column already exists, skip that ADD COLUMN.
ALTER TABLE bookings
  ADD COLUMN service_id INT NULL AFTER garage_id,
  ADD COLUMN service_name VARCHAR(150) NOT NULL DEFAULT 'General Service' AFTER service_id,
  ADD COLUMN workflow_stage VARCHAR(60) NULL AFTER status,
  MODIFY COLUMN status ENUM('pending','confirmed','vehicle_received','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending';
