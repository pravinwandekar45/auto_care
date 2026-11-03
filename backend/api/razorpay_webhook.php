<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/db.php';
$cfg = require __DIR__ . '/../config/payment.php';
if (!is_file(__DIR__ . '/../payment/vendor/autoload.php') || !$cfg['webhook_secret'] || !$cfg['key_id'] || !$cfg['key_secret']) { http_response_code(500); exit('Webhook is not configured'); }
require_once __DIR__ . '/../payment/vendor/autoload.php';
$api = new Razorpay\Api\Api($cfg['key_id'], $cfg['key_secret']);
$raw = file_get_contents('php://input');
$sig = $_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] ?? '';
try {
  if ($sig === '') throw new RuntimeException('Missing webhook signature');
  $api->utility->verifyWebhookSignature($raw, $sig, $cfg['webhook_secret']);
  $event = json_decode($raw, true);
  if (!is_array($event)) throw new RuntimeException('Invalid event body');
  if (($event['event'] ?? '') !== 'payment.captured') { http_response_code(200); exit('Ignored'); }
  $p = $event['payload']['payment']['entity'] ?? [];
  $orderId = (string)($p['order_id'] ?? ''); $paymentId = (string)($p['id'] ?? '');
  $amount = (int)($p['amount'] ?? 0); $currency = (string)($p['currency'] ?? ''); $method = (string)($p['method'] ?? 'unknown');
  if (!$orderId || !$paymentId || $amount < 1 || $currency !== 'INR' || ($p['status'] ?? '') !== 'captured') throw new RuntimeException('Invalid captured payment');
  $conn->begin_transaction();
  $stmt = $conn->prepare('SELECT id,invoice_id,amount_paise,status FROM payment_transactions WHERE gateway_order_id=? FOR UPDATE');
  $stmt->bind_param('s',$orderId); $stmt->execute(); $tx=$stmt->get_result()->fetch_assoc();
  if (!$tx || (int)$tx['amount_paise'] !== $amount) throw new RuntimeException('Unknown order or amount mismatch');
  if ($tx['status'] !== 'paid') {
    $stmt=$conn->prepare("UPDATE payment_transactions SET status='paid',gateway_payment_id=?,payment_method=? WHERE id=? AND status='created'");
    $stmt->bind_param('ssi',$paymentId,$method,$tx['id']); $stmt->execute();
    if ($stmt->affected_rows !== 1) throw new RuntimeException('Concurrent payment update');
    $stmt=$conn->prepare("UPDATE invoices SET payment_status='paid',paid_at=NOW(),payment_method=? WHERE id=?");
    $stmt->bind_param('si',$method,$tx['invoice_id']); $stmt->execute();
  }
  $conn->commit(); http_response_code(200); echo 'OK';
} catch (Throwable $e) {
  try {$conn->rollback();} catch (Throwable $ignored) {}
  error_log('AutoCare Razorpay webhook: '.$e->getMessage()); http_response_code(400); echo 'Webhook processing failed';
}
