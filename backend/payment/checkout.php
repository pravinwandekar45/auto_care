<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/db.php';
header('Content-Type: text/html; charset=utf-8');
require_once __DIR__ . '/common.php';
$ownerId = payment_require_owner();
$invoiceId = filter_input(INPUT_GET, 'invoice_id', FILTER_VALIDATE_INT);
if (!$invoiceId || $invoiceId < 1) { http_response_code(400); exit('Invalid invoice ID.'); }
$stmt = $conn->prepare("SELECT i.id,i.amount,i.payment_status,b.id AS booking_id FROM invoices i JOIN bookings b ON b.id=i.booking_id WHERE i.id=? AND b.owner_id=? LIMIT 1");
$stmt->bind_param('ii', $invoiceId, $ownerId); $stmt->execute();
$invoice = $stmt->get_result()->fetch_assoc();
if (!$invoice) { http_response_code(404); exit('Invoice not found for this account.'); }
if (empty($_SESSION['payment_csrf'])) $_SESSION['payment_csrf'] = bin2hex(random_bytes(32));
$csrf = $_SESSION['payment_csrf'];
$amount = number_format((float)$invoice['amount'], 2);
$paid = ($invoice['payment_status'] ?? 'pending') === 'paid';
?>
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AutoCare Secure Payment</title><style>body{font:16px system-ui;background:#f3f6fb;margin:0;color:#172033}.card{max-width:520px;margin:7vh auto;background:#fff;border-radius:18px;padding:28px;box-shadow:0 12px 40px #14213d14}h1{margin-top:0;font-size:25px}.muted{color:#657086}.amount{font-size:34px;font-weight:750;color:#155eef;margin:18px 0}.btn{background:#155eef;color:white;border:0;border-radius:10px;padding:13px 18px;font-size:16px;font-weight:700;width:100%;cursor:pointer}.btn:disabled{opacity:.6;cursor:wait}.notice{padding:12px;border-radius:10px;background:#eff6ff;margin-top:14px;white-space:pre-wrap}.back{display:inline-block;margin-top:18px;color:#155eef}.qr-wrap{margin:22px 0;padding:18px;border:1px solid #dbe4f0;border-radius:14px;text-align:center}.qr-wrap canvas,.qr-wrap img{display:block;margin:12px auto;max-width:220px}.qr-caption{font-size:13px;color:#657086}</style></head><body><main class="card">
<h1>AutoCare Secure Payment</h1><p class="muted">Invoice #<?= (int)$invoice['id'] ?> · Booking #<?= (int)$invoice['booking_id'] ?></p>
<div class="amount">₹<?= htmlspecialchars($amount, ENT_QUOTES, 'UTF-8') ?></div>
<p>Choose from the payment methods enabled for this Razorpay account, such as UPI (including QR scan when offered), credit/debit cards, net banking and wallets.</p>
<?php if ($paid): ?><div class="notice">This invoice is already marked as paid.</div><?php else: ?><button id="pay" class="btn">Pay securely with Razorpay</button><section class="qr-wrap"><strong>Open this secure checkout on another device</strong><div id="invoice-qr" aria-label="QR code for this invoice checkout"></div><div class="qr-caption">This is a checkout-link QR, not a payment QR. Scan it to open this invoice checkout on another device; complete the payment using the UPI QR option inside Razorpay when it is offered.</div></section><?php endif; ?>
<div id="status" class="notice" role="status" aria-live="polite"><?= $paid ? 'Payment confirmed.' : 'Your invoice will be marked paid only after server-side verification.' ?></div>
<a class="back" href="invoices.php">← Back to invoices</a>
</main>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js" referrerpolicy="no-referrer"></script>
<script>
const invoiceId = <?= (int)$invoiceId ?>;
const csrf = <?= json_encode($csrf) ?>;
const payButton = document.getElementById('pay');
const qrTarget = document.getElementById('invoice-qr');
if (qrTarget && window.QRCode) { new QRCode(qrTarget, {text: window.location.href, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M}); }
const statusBox = document.getElementById('status');
if (payButton) payButton.addEventListener('click', async () => {
  payButton.disabled = true; statusBox.textContent = 'Creating secure payment order…';
  try {
    const res = await fetch('../api/payments.php?action=create_order', {method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({invoice_id:invoiceId})});
    const order = await res.json(); if (!res.ok) throw new Error(order.error || 'Could not create order');
    const checkout = new Razorpay({key:order.key_id,amount:order.amount,currency:order.currency,name:order.merchant_name,description:'AutoCare invoice #'+invoiceId,order_id:order.order_id,method:{upi:true,card:true,netbanking:true,wallet:true},theme:{color:'#155eef'},handler:async response=>{
      statusBox.textContent='Verifying payment with the server…';
      try {
        const verify = await fetch('../api/payments.php?action=verify',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({invoice_id:invoiceId,razorpay_payment_id:response.razorpay_payment_id,razorpay_order_id:response.razorpay_order_id,razorpay_signature:response.razorpay_signature})});
        const result = await verify.json(); if (!verify.ok) throw new Error(result.error || 'Verification is pending');
        statusBox.textContent='Payment successful. Invoice #'+invoiceId+' is marked paid.';
        payButton.textContent='Payment complete';
      } catch(err) { statusBox.textContent=err.message+'\nDo not pay again immediately. Refresh invoice status or contact support.'; payButton.disabled=false; }
    },modal:{ondismiss:()=>{payButton.disabled=false;statusBox.textContent='Checkout closed. If you completed payment, refresh/check status before retrying.';}}});
    checkout.on('payment.failed',()=>{payButton.disabled=false;statusBox.textContent='Payment failed. Check your transaction status before trying again.';});
    checkout.open();
  } catch(err) { payButton.disabled=false; statusBox.textContent=err.message; }
});
</script></body></html>
