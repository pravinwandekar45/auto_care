<?php
require_once __DIR__ . '/../config/db.php';
if (session_status() !== PHP_SESSION_ACTIVE) session_start();

function json_response($status, $payload) {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if (empty($_SESSION['user']['id'])) {
    json_response(401, ['success' => false, 'error' => 'Please sign in to use the portal.']);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'GET' || (isset($_GET['action']) && $_GET['action'] === 'load')) {
    $result = $conn->query('SELECT state_json, updated_at FROM portal_state WHERE id = 1');
    if (!$result) json_response(500, ['success' => false, 'error' => 'Could not read saved portal data.']);
    $row = $result->fetch_assoc();
    if (!$row) json_response(200, ['success' => true, 'state' => null]);
    $state = json_decode($row['state_json'], true);
    if (!is_array($state)) json_response(500, ['success' => false, 'error' => 'Saved portal data is invalid.']);
    json_response(200, ['success' => true, 'state' => $state, 'updated_at' => $row['updated_at']]);
}

if ($method === 'POST' || $method === 'PUT') {
    $payload = json_decode(file_get_contents('php://input'), true);
    $state = $payload['state'] ?? null;
    if (!is_array($state)) json_response(400, ['success' => false, 'error' => 'A valid state object is required.']);
    // Session identity is never persisted inside shared portal state.
    unset($state['currentUser'], $state['currentGarageId']);
    $json = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) json_response(400, ['success' => false, 'error' => 'Could not encode portal data.']);
    $stmt = $conn->prepare('INSERT INTO portal_state (id, state_json) VALUES (1, ?) ON DUPLICATE KEY UPDATE state_json = VALUES(state_json)');
    if (!$stmt) json_response(500, ['success' => false, 'error' => 'Could not prepare portal data save.']);
    $stmt->bind_param('s', $json);
    if (!$stmt->execute()) json_response(500, ['success' => false, 'error' => 'Could not save portal data.']);
    $stmt->close();
    json_response(200, ['success' => true, 'message' => 'Portal data saved.']);
}

json_response(405, ['success' => false, 'error' => 'Unsupported request method.']);
?>
