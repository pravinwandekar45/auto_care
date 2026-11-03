-- Vehicle Service & Maintenance Scheduling Portal
-- Fresh database setup: import this file in phpMyAdmin or run it in MySQL.

CREATE DATABASE IF NOT EXISTS users CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE users;

CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('owner','garage','garage_staff','admin') DEFAULT 'owner',
  phone VARCHAR(20),
  city VARCHAR(120) NULL,
  garage_name VARCHAR(150) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vehicles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  owner_id INT NOT NULL,
  nickname VARCHAR(100) NOT NULL,
  make VARCHAR(50),
  model VARCHAR(50),
  year INT,
  reg_number VARCHAR(20) UNIQUE NOT NULL,
  fuel_type VARCHAR(30) NULL,
  vehicle_type VARCHAR(40) NULL,
  mileage INT UNSIGNED NOT NULL DEFAULT 0,
  insurance_expiry DATE NULL,
  last_service_date DATE NULL,
  next_service_date DATE NULL,
  service_interval_days INT DEFAULT 180,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE service_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  vehicle_id INT NOT NULL,
  service_date DATE NOT NULL,
  description TEXT,
  cost DECIMAL(10,2) DEFAULT 0,
  garage_id INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
  FOREIGN KEY (garage_id) REFERENCES users(id)
);

CREATE TABLE bookings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  vehicle_id INT NOT NULL,
  owner_id INT NOT NULL,
  garage_id INT,
  service_id INT NULL,
  service_name VARCHAR(150) NOT NULL DEFAULT 'General Service',
  slot_datetime DATETIME NOT NULL,
  status ENUM('pending','confirmed','vehicle_received','in_progress','completed','cancelled') DEFAULT 'pending',
  workflow_stage VARCHAR(60) NULL,
  completion_email_sent_at DATETIME NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id),
  FOREIGN KEY (garage_id) REFERENCES users(id)
);

CREATE TABLE invoices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  booking_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  pdf_path VARCHAR(255),
  generated_on DATETIME DEFAULT CURRENT_TIMESTAMP,
  payment_status ENUM('pending','paid') NOT NULL DEFAULT 'pending',
  paid_at DATETIME NULL,
  payment_method VARCHAR(30) NULL,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

CREATE TABLE reminders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  vehicle_id INT NOT NULL,
  due_date DATE NOT NULL,
  sent TINYINT DEFAULT 0,
  channel ENUM('email','sms') DEFAULT 'email',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);


-- Razorpay payment transaction records
CREATE TABLE payment_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  gateway_order_id VARCHAR(100) NOT NULL,
  gateway_payment_id VARCHAR(100) NULL,
  amount_paise INT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  status ENUM('created','paid','failed') NOT NULL DEFAULT 'created',
  payment_method VARCHAR(30) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_gateway_order_id (gateway_order_id),
  UNIQUE KEY uq_gateway_payment_id (gateway_payment_id),
  KEY idx_payment_invoice (invoice_id),
  CONSTRAINT fk_payment_invoice FOREIGN KEY (invoice_id)
    REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- Persistent application state used by the existing dashboard modules.
-- The UI reads/writes through backend/api/portal_data.php so records survive logout,
-- browser refreshes, and signing in from another browser on the same server.
CREATE TABLE IF NOT EXISTS portal_state (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  state_json LONGTEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_portal_state_id CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- Required fixed portal accounts only. No demo owners, vehicles, bookings, invoices, or payments.
-- Both accounts use password: 12345678 (stored as a password hash).
INSERT INTO users (name, email, password, role, phone, city, garage_name)
VALUES
  ('Pravin Wandekar', 'pravinwandekar9@gmail.com', '$2y$12$CLuz9pDXFIaND9NIUnJzme/eivreYwYNHTZsFVBRACPdRJDqZiWxa', 'admin', NULL, NULL, NULL),
  ('Omkar Aher', 'omkaraher2004@gmail.com', '$2y$12$CLuz9pDXFIaND9NIUnJzme/eivreYwYNHTZsFVBRACPdRJDqZiWxa', 'garage', NULL, NULL, 'AutoCare Garage');
