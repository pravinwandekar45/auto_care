<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/db.php';
header('Content-Type: text/html; charset=utf-8');
if (session_status() !== PHP_SESSION_ACTIVE) session_start();
$error = '';
if (empty($_SESSION['payment_login_csrf'])) $_SESSION['payment_login_csrf'] = bin2hex(random_bytes(32));
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $token = $_POST['csrf'] ?? '';
    if (!$token || !hash_equals($_SESSION['payment_login_csrf'], $token)) {
        $error = 'Session expired. Refresh and try again.';
    } else {
        $email = trim((string)($_POST['email'] ?? ''));
        $password = (string)($_POST['password'] ?? '');
        $stmt = $conn->prepare('SELECT id,name,email,password,role FROM users WHERE email=? LIMIT 1');
        $stmt->bind_param('s', $email); $stmt->execute();
        $user = $stmt->get_result()->fetch_assoc();
        if ($user && ($user['role'] ?? '') === 'owner' && password_verify($password, $user['password'])) {
            session_regenerate_id(true);
            $_SESSION['user'] = ['id'=>(int)$user['id'], 'name'=>$user['name'], 'email'=>$user['email'], 'role'=>$user['role']];
            unset($_SESSION['payment_login_csrf']);
            header('Location: invoices.php'); exit;
        }
        $error = 'Invalid owner email or password.';
    }
}
?>
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AutoCare Payment Login</title><style>body{font:16px system-ui;background:#f3f6fb;color:#172033;margin:0}.card{max-width:420px;margin:9vh auto;background:white;padding:28px;border-radius:16px;box-shadow:0 12px 40px #14213d14}label{display:block;margin:14px 0 6px}input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:8px}.btn{width:100%;padding:12px;background:#155eef;color:white;border:0;border-radius:8px;margin-top:18px;font-weight:bold}.err{color:#b42318;background:#fef3f2;padding:10px;border-radius:8px}</style></head><body><main class="card"><h1>AutoCare Owner Login</h1><p>Sign in with an owner account stored in the AutoCare MySQL database to access real invoices and payments.</p><?php if($error): ?><p class="err"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></p><?php endif; ?><form method="post"><input type="hidden" name="csrf" value="<?= htmlspecialchars($_SESSION['payment_login_csrf'], ENT_QUOTES, 'UTF-8') ?>"><label for="email">Email</label><input id="email" type="email" name="email" required autocomplete="username"><label for="password">Password</label><input id="password" type="password" name="password" required autocomplete="current-password"><button class="btn" type="submit">Sign in</button></form></main></body></html>
