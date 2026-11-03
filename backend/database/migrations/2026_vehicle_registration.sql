-- Safe migration for vehicle registration fields. Run once against users.
USE users;

SET @has_nickname = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehicles' AND COLUMN_NAME = 'nickname');
SET @sql_nickname = IF(@has_nickname = 0, 'ALTER TABLE vehicles ADD COLUMN nickname VARCHAR(100) NOT NULL DEFAULT ''Vehicle'' AFTER owner_id', 'SELECT 1');
PREPARE stmt_nickname FROM @sql_nickname; EXECUTE stmt_nickname; DEALLOCATE PREPARE stmt_nickname;

SET @has_fuel = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehicles' AND COLUMN_NAME = 'fuel_type');
SET @sql_fuel = IF(@has_fuel = 0, 'ALTER TABLE vehicles ADD COLUMN fuel_type VARCHAR(30) NULL AFTER reg_number', 'SELECT 1');
PREPARE stmt_fuel FROM @sql_fuel; EXECUTE stmt_fuel; DEALLOCATE PREPARE stmt_fuel;

SET @has_type = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehicles' AND COLUMN_NAME = 'vehicle_type');
SET @sql_type = IF(@has_type = 0, 'ALTER TABLE vehicles ADD COLUMN vehicle_type VARCHAR(40) NULL AFTER fuel_type', 'SELECT 1');
PREPARE stmt_type FROM @sql_type; EXECUTE stmt_type; DEALLOCATE PREPARE stmt_type;

SET @has_mileage = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehicles' AND COLUMN_NAME = 'mileage');
SET @sql_mileage = IF(@has_mileage = 0, 'ALTER TABLE vehicles ADD COLUMN mileage INT UNSIGNED NOT NULL DEFAULT 0 AFTER vehicle_type', 'SELECT 1');
PREPARE stmt_mileage FROM @sql_mileage; EXECUTE stmt_mileage; DEALLOCATE PREPARE stmt_mileage;

SET @has_insurance = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehicles' AND COLUMN_NAME = 'insurance_expiry');
SET @sql_insurance = IF(@has_insurance = 0, 'ALTER TABLE vehicles ADD COLUMN insurance_expiry DATE NULL AFTER mileage', 'SELECT 1');
PREPARE stmt_insurance FROM @sql_insurance; EXECUTE stmt_insurance; DEALLOCATE PREPARE stmt_insurance;

SET @has_next = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehicles' AND COLUMN_NAME = 'next_service_date');
SET @sql_next = IF(@has_next = 0, 'ALTER TABLE vehicles ADD COLUMN next_service_date DATE NULL AFTER last_service_date', 'SELECT 1');
PREPARE stmt_next FROM @sql_next; EXECUTE stmt_next; DEALLOCATE PREPARE stmt_next;
