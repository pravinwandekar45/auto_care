-- Run this migration against the existing users database if you do NOT want to drop it.
USE users;
ALTER TABLE users MODIFY role ENUM('owner','garage','garage_staff','admin') DEFAULT 'owner';

SET @has_city = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'city');
SET @sql_city = IF(@has_city = 0, 'ALTER TABLE users ADD COLUMN city VARCHAR(120) NULL AFTER phone', 'SELECT 1');
PREPARE stmt_city FROM @sql_city; EXECUTE stmt_city; DEALLOCATE PREPARE stmt_city;

SET @has_garage_name = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'garage_name');
SET @sql_garage_name = IF(@has_garage_name = 0, 'ALTER TABLE users ADD COLUMN garage_name VARCHAR(150) NULL AFTER city', 'SELECT 1');
PREPARE stmt_garage_name FROM @sql_garage_name; EXECUTE stmt_garage_name; DEALLOCATE PREPARE stmt_garage_name;

CREATE TABLE IF NOT EXISTS portal_state (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  state_json LONGTEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
