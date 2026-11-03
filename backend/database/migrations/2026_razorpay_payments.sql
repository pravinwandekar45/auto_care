-- Run this migration against the users database (only if upgrading an older schema; fresh installs already include these fields).
-- Existing invoices.amount is the authoritative amount for payment.
ALTER TABLE invoices
  ADD COLUMN payment_status ENUM('pending','paid') NOT NULL DEFAULT 'pending',
  ADD COLUMN paid_at DATETIME NULL,
  ADD COLUMN payment_method VARCHAR(30) NULL;

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
  UNIQUE KEY uq_gateway_order_id (gateway_order_id),
  UNIQUE KEY uq_gateway_payment_id (gateway_payment_id),
  KEY idx_payment_invoice (invoice_id),
  CONSTRAINT fk_payment_invoice FOREIGN KEY (invoice_id)
    REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
