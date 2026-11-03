-- Run once in phpMyAdmin after selecting the users database.
-- Garage staff records belong to one authenticated garage account.
CREATE TABLE IF NOT EXISTS garage_staff_members (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  garage_id INT NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  designation VARCHAR(60) NOT NULL,
  status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_garage_staff_email (garage_id, email),
  KEY idx_garage_staff_garage (garage_id),
  CONSTRAINT fk_garage_staff_owner FOREIGN KEY (garage_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
