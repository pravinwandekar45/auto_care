<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../payment/common.php';

$ownerId = payment_require_owner();
$cfg = require __DIR__ . '/../config/payment.php';
$action = $_GET['action'] ?? '';

if (!is_file(__DIR__ . '/../payment/vendor/autoload.php')) {
    payment_json(500, ['error' => 'Razorpay SDK missing. Run Composer install in the backend folder.']);
}
require_once __DIR__ . '/../payment/vendor/autoload.php';
$api = new Razorpay\Api\Api($cfg['key_id'], $cfg['key_secret']);

if ($action === 'create_order') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') payment_json(405, ['error' => 'POST required']);
    payment_require_csrf();
    $body = json_decode(file_get_contents('php://input'), true) ?: [];
    $invoiceId = filter_var($body['invoice_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$invoiceId || $invoiceId < 1) payment_json(400, ['error' => 'Invalid invoice ID']);
    if (!$cfg['key_id'] || !$cfg['key_secret']) payment_json(500, ['error' => 'Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the PHP/Apache environment.']);

    try {
        $stmt = $conn->prepare("SELECT i.id, i.amount, i.payment_status FROM invoices i JOIN bookings b ON b.id=i.booking_id WHERE i.id=? AND b.owner_id=? LIMIT 1");
        $stmt->bind_param('ii', $invoiceId, $ownerId);
        $stmt->execute();
        $invoice = $stmt->get_result()->fetch_assoc();
        if (!$invoice) payment_json(404, ['error' => 'Invoice not found for this account']);
        if (($invoice['payment_status'] ?? 'pending') === 'paid') payment_json(409, ['error' => 'This invoice is already paid']);

        $amountPaise = (int) round(((float)$invoice['amount']) * 100);
        if ($amountPaise < 100) payment_json(400, ['error' => 'Invoice amount must be at least ₹1.00']);

        $order = $api->order->create([
            'receipt' => 'invoice_' . $invoiceId . '_' . bin2hex(random_bytes(4)),
            'amount' => $amountPaise,
            'currency' => $cfg['currency'],
            'notes' => ['invoice_id' => (string)$invoiceId, 'owner_id' => (string)$ownerId],
        ]);
        $orderId = (string)$order['id'];
        $status = 'created';
        $currency = $cfg['currency'];
        $stmt = $conn->prepare('INSERT INTO payment_transactions (invoice_id,gateway_order_id,amount_paise,currency,status) VALUES (?,?,?,?,?)');
        $stmt->bind_param('isiss', $invoiceId, $orderId, $amountPaise, $currency, $status);
        $stmt->execute();

        payment_json(200, ['key_id' => $cfg['key_id'], 'order_id' => $orderId, 'amount' => $amountPaise, 'currency' => $currency, 'merchant_name' => $cfg['merchant_name']]);
    } catch (Throwable $e) {
        error_log('AutoCare create_order: ' . $e->getMessage());
        payment_json(500, ['error' => 'Could not create payment order. Check server logs and Razorpay test keys.']);
    }
}

if ($action === 'verify') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') payment_json(405, ['error' => 'POST required']);
    payment_require_csrf();
    $body = json_decode(file_get_contents('php://input'), true) ?: [];
    $invoiceId = filter_var($body['invoice_id'] ?? null, FILTER_VALIDATE_INT);
    $paymentId = $body['razorpay_payment_id'] ?? '';
    $orderId = $body['razorpay_order_id'] ?? '';
    $signature = $body['razorpay_signature'] ?? '';
    if (!$invoiceId || !is_string($paymentId) || !preg_match('/^pay_[A-Za-z0-9]+$/', $paymentId) || !is_string($orderId) || !preg_match('/^order_[A-Za-z0-9]+$/', $orderId) || !is_string($signature) || !preg_match('/^[a-f0-9]{64}$/i', $signature)) {
        payment_json(400, ['error' => 'Invalid payment response']);
    }

    try {
        $stmt = $conn->prepare("SELECT t.id,t.invoice_id,t.gateway_order_id,t.amount_paise,t.status FROM payment_transactions t JOIN invoices i ON i.id=t.invoice_id JOIN bookings b ON b.id=i.booking_id WHERE t.invoice_id=? AND t.gateway_order_id=? AND b.owner_id=? LIMIT 1");
        $stmt->bind_param('isi', $invoiceId, $orderId, $ownerId);
        $stmt->execute();
        $tx = $stmt->get_result()->fetch_assoc();
        if (!$tx) payment_json(404, ['error' => 'Payment order not found']);
        if ($tx['status'] === 'paid') payment_json(200, ['status' => 'paid']);

        $api->utility->verifyPaymentSignature([
            'razorpay_order_id' => $tx['gateway_order_id'],
            'razorpay_payment_id' => $paymentId,
            'razorpay_signature' => $signature,
        ]);
        $payment = $api->payment->fetch($paymentId);
        if ((string)$payment['order_id'] !== $tx['gateway_order_id'] || (int)$payment['amount'] !== (int)$tx['amount_paise'] || (string)$payment['currency'] !== 'INR') {
            payment_json(409, ['error' => 'Payment details do not match this invoice']);
        }
        if ((string)$payment['status'] !== 'captured') {
            payment_json(409, ['error' => 'Payment is not captured yet. Do not retry until status is checked.']);
        }

        $method = (string)($payment['method'] ?? 'unknown');
        $conn->begin_transaction();
        $stmt = $conn->prepare("SELECT status FROM payment_transactions WHERE id=? FOR UPDATE");
        $stmt->bind_param('i', $tx['id']); $stmt->execute();
        $current = $stmt->get_result()->fetch_assoc();
        if ($current['status'] !== 'paid') {
            $stmt = $conn->prepare("UPDATE payment_transactions SET status='paid',gateway_payment_id=?,payment_method=? WHERE id=? AND status='created'");
            $stmt->bind_param('ssi', $paymentId, $method, $tx['id']); $stmt->execute();
            if ($stmt->affected_rows !== 1) throw new RuntimeException('Payment transaction was concurrently updated');
            $stmt = $conn->prepare("UPDATE invoices SET payment_status='paid',paid_at=NOW(),payment_method=? WHERE id=?");
            $stmt->bind_param('si', $method, $invoiceId); $stmt->execute();
        }
        $conn->commit();
        payment_json(200, ['status' => 'paid']);
    } catch (Razorpay\Api\Errors\SignatureVerificationError $e) {
        payment_json(400, ['error' => 'Payment signature verification failed']);
    } catch (Throwable $e) {
        try { $conn->rollback(); } catch (Throwable $ignored) {}
        error_log('AutoCare payment verify: ' . $e->getMessage());
        payment_json(500, ['error' => 'Could not verify payment. Check status before trying again.']);
    }
}

if ($action === 'status') {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') payment_json(405, ['error' => 'GET required']);
    $invoiceId = filter_input(INPUT_GET, 'invoice_id', FILTER_VALIDATE_INT);
    if (!$invoiceId) payment_json(400, ['error' => 'Invalid invoice ID']);
    $stmt = $conn->prepare("SELECT i.payment_status FROM invoices i JOIN bookings b ON b.id=i.booking_id WHERE i.id=? AND b.owner_id=? LIMIT 1");
    $stmt->bind_param('ii', $invoiceId, $ownerId); $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row) payment_json(404, ['error' => 'Invoice not found']);
    payment_json(200, ['status' => $row['payment_status'] ?? 'pending']);
}

payment_json(400, ['error' => 'Unknown payment action']);
