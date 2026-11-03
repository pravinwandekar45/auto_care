<?php
declare(strict_types=1);

function payment_json(int $status, array $payload): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload);
    exit;
}

function payment_require_owner(): int {
    if (session_status() !== PHP_SESSION_ACTIVE) session_start();
    $user = $_SESSION['user'] ?? null;
    if (!$user || empty($user['id']) || ($user['role'] ?? '') !== 'owner') {
        payment_json(401, ['error' => 'Please sign in with a vehicle-owner account.']);
    }
    return (int)$user['id'];
}

function payment_require_csrf(): void {
    $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $expected = $_SESSION['payment_csrf'] ?? '';
    if (!$expected || !$provided || !hash_equals($expected, $provided)) {
        payment_json(403, ['error' => 'Session security check failed. Refresh the page and try again.']);
    }
}
