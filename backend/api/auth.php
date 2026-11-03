<?php
require_once __DIR__ . '/../config/db.php';
if (session_status() !== PHP_SESSION_ACTIVE) session_start();

$action = $_GET['action'] ?? '';
$data = json_decode(file_get_contents('php://input'), true) ?: [];
function auth_error($status, $message) {
    http_response_code($status);
    echo json_encode(['success' => false, 'error' => $message]);
    exit;
}
function public_user($row) {
    return [
        'id' => (string)$row['id'],
        'name' => $row['name'],
        'email' => strtolower($row['email']),
        'phone' => $row['phone'] ?? '',
        'city' => $row['city'] ?? '',
        'role' => $row['role'],
        'garageName' => $row['garage_name'] ?? '',
        'garageId' => $row['role'] === 'garage' ? (string)$row['id'] : null
    ];
}

if ($action === 'register') {
    $name = trim((string)($data['name'] ?? ''));
    $email = strtolower(trim((string)($data['email'] ?? '')));
    $password = (string)($data['password'] ?? '');
    $role = 'owner'; // Public registration is only for car owners; admin/garage are provisioned by schema.sql.
    $phone = trim((string)($data['phone'] ?? ''));
    $city = trim((string)($data['city'] ?? ''));
    $garageName = trim((string)($data['garageName'] ?? ''));
    if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 6) {
        auth_error(400, 'Enter a valid name/email and a password with at least 6 characters.');
    }
    if ($email === 'pravinwandekar9@gmail.com' || $email === 'omkaraher2004@gmail.com') auth_error(409, 'This email is reserved for the fixed portal account. Please sign in.');
    $hashed = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $conn->prepare('INSERT INTO users (name, email, password, role, phone, city, garage_name) VALUES (?, ?, ?, ?, ?, ?, ?)');
    if (!$stmt) auth_error(500, 'Could not prepare registration. Import the latest database/schema.sql first.');
    $stmt->bind_param('sssssss', $name, $email, $hashed, $role, $phone, $city, $garageName);
    if (!$stmt->execute()) {
        if ($conn->errno === 1062) auth_error(409, 'An account with this email already exists. Please sign in.');
        auth_error(500, 'Registration failed. Check the database schema and MySQL connection.');
    }
    $userId = (string)$stmt->insert_id;
    $stmt->close();
    $user = ['id' => $userId, 'name' => $name, 'email' => $email, 'phone' => $phone, 'city' => $city, 'role' => $role, 'garageName' => $garageName, 'garageId' => $role === 'garage' ? $userId : null];
    session_regenerate_id(true);
    $_SESSION['user'] = $user;
    echo json_encode(['success' => true, 'user' => $user]);
    exit;
}

if ($action === 'login') {
    $email = strtolower(trim((string)($data['email'] ?? '')));
    $password = (string)($data['password'] ?? '');
    $requestedRole = trim((string)($data['requestedRole'] ?? ''));
    if ($requestedRole !== '' && !in_array($requestedRole, ['owner', 'garage', 'admin'], true)) auth_error(400, 'Invalid portal role selected.');
    $stmt = $conn->prepare('SELECT id, name, email, password, role, phone, city, garage_name FROM users WHERE email = ? LIMIT 1');
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();
    if (!$row || !password_verify($password, $row['password'])) auth_error(401, 'Email or password is incorrect.');
    if ($requestedRole !== '' && $row['role'] !== $requestedRole) auth_error(403, 'This account is registered as ' . $row['role'] . '. Select the matching portal role to sign in.');
    $user = public_user($row);
    session_regenerate_id(true);
    $_SESSION['user'] = $user;
    echo json_encode(['success' => true, 'user' => $user]);
    exit;
}

auth_error(400, 'Unknown action. Use ?action=register or ?action=login.');
?>
