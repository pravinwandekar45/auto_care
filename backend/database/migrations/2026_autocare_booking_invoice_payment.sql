-- AutoCare Pro: safe additive migration. Run against database `users` in phpMyAdmin.
USE users;
-- Add invoice payment columns only if an older installation is missing them.
SET @has_payment_status = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='invoices' AND COLUMN_NAME='payment_status');
SET @sql_payment_status = IF(@has_payment_status=0, "ALTER TABLE invoices ADD COLUMN payment_status ENUM('pending','paid') NOT NULL DEFAULT 'pending'", 'SELECT 1');
PREPARE acp_stmt FROM @sql_payment_status; EXECUTE acp_stmt; DEALLOCATE PREPARE acp_stmt;
SET @has_paid_at = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='invoices' AND COLUMN_NAME='paid_at');
SET @sql_paid_at = IF(@has_paid_at=0, 'ALTER TABLE invoices ADD COLUMN paid_at DATETIME NULL', 'SELECT 1');
PREPARE acp_stmt FROM @sql_paid_at; EXECUTE acp_stmt; DEALLOCATE PREPARE acp_stmt;
SET @has_payment_method = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='invoices' AND COLUMN_NAME='payment_method');
SET @sql_payment_method = IF(@has_payment_method=0, 'ALTER TABLE invoices ADD COLUMN payment_method VARCHAR(30) NULL', 'SELECT 1');
PREPARE acp_stmt FROM @sql_payment_method; EXECUTE acp_stmt; DEALLOCATE PREPARE acp_stmt;
CREATE TABLE IF NOT EXISTS invoice_items (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 invoice_id INT NOT NULL,
 description VARCHAR(255) NOT NULL,
 item_type VARCHAR(40) NULL,
 quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
 rate DECIMAL(10,2) NOT NULL DEFAULT 0,
 line_total DECIMAL(10,2) NOT NULL DEFAULT 0,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_invoice_items_invoice(invoice_id),
 CONSTRAINT fk_invoice_items_invoice FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS payment_transactions (
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
 UNIQUE KEY uq_gateway_order_id(gateway_order_id),
 UNIQUE KEY uq_gateway_payment_id(gateway_payment_id),
 KEY idx_payment_invoice(invoice_id),
 CONSTRAINT fk_payment_invoice FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
