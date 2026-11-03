<?php
require_once __DIR__ . '/../config/db.php';
if (session_status() !== PHP_SESSION_ACTIVE) session_start();
header('Content-Type: application/json; charset=utf-8');

function vehicle_response($status, $payload) {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$user = $_SESSION['user'] ?? null;
if (!$user || empty($user['id'])) vehicle_response(401, ['success' => false, 'error' => 'Please sign in first.']);
$role = strtolower((string)($user['role'] ?? ''));
$userId = (int)$user['id'];
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function normalize_vehicle_row($row) {
    return [
        'id' => (string)$row['id'],
        'ownerId' => (string)$row['owner_id'],
        'ownerEmail' => strtolower((string)($row['owner_email'] ?? '')),
        'ownerName' => (string)($row['owner_name'] ?? ''),
        'name' => (string)($row['nickname'] ?? ''),
        'regNumber' => (string)$row['reg_number'],
        'brand' => (string)($row['make'] ?? ''),
        'model' => (string)($row['model'] ?? ''),
        'year' => (int)($row['year'] ?? 0),
        'fuel' => (string)($row['fuel_type'] ?? ''),
        'type' => (string)($row['vehicle_type'] ?? ''),
        'mileage' => (int)($row['mileage'] ?? 0),
        'insuranceExpiry' => (string)($row['insurance_expiry'] ?? ''),
        'lastServiceDate' => (string)($row['last_service_date'] ?? ''),
        'nextServiceDate' => (string)($row['next_service_date'] ?? ''),
        'serviceStatus' => 'Active', 'statusColor' => 'success',
        'imageIcon' => (($row['vehicle_type'] ?? '') === 'Sedan' ? 'fa-car' : ((($row['fuel_type'] ?? '') === 'Electric') ? 'fa-bolt' : 'fa-car-side'))
    ];
}

if ($method === 'GET') {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    $sql = "SELECT v.*, u.email AS owner_email, u.name AS owner_name FROM vehicles v JOIN users u ON u.id = v.owner_id";
    if ($role === 'owner') {
        if ($id > 0) {
            $stmt = $conn->prepare($sql . ' WHERE v.id = ? AND v.owner_id = ?');
            $stmt->bind_param('ii', $id, $userId);
        } else {
            $stmt = $conn->prepare($sql . ' WHERE v.owner_id = ? ORDER BY v.created_at DESC');
            $stmt->bind_param('i', $userId);
        }
        $stmt->execute();
        $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    } elseif (in_array($role, ['admin', 'garage', 'garage_staff'], true)) {
        if ($id > 0) {
            $stmt = $conn->prepare($sql . ' WHERE v.id = ?');
            $stmt->bind_param('i', $id);
            $stmt->execute();
            $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        } else {
            $result = $conn->query($sql . ' ORDER BY v.created_at DESC');
            $rows = $result->fetch_all(MYSQLI_ASSOC);
        }
    } else {
        vehicle_response(403, ['success' => false, 'error' => 'You are not allowed to view vehicles.']);
    }
    $vehicles = array_map('normalize_vehicle_row', $rows);
    vehicle_response(200, ['success' => true, 'vehicles' => $vehicles]);
}

if ($method === 'POST') {
    if ($role !== 'owner') vehicle_response(403, ['success' => false, 'error' => 'Only a car owner can register a vehicle.']);
    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data)) vehicle_response(400, ['success' => false, 'error' => 'Invalid request data.']);
    $nickname = trim((string)($data['name'] ?? ''));
    $make = trim((string)($data['brand'] ?? ''));
    $model = trim((string)($data['model'] ?? ''));
    $year = (int)($data['year'] ?? 0);
    $regNumber = strtoupper(trim((string)($data['regNumber'] ?? '')));
    $fuel = trim((string)($data['fuel'] ?? ''));
    $type = trim((string)($data['type'] ?? ''));
    $mileage = max(0, (int)($data['mileage'] ?? 0));
    $insurance = trim((string)($data['insuranceExpiry'] ?? '')) ?: null;
    $lastService = trim((string)($data['lastServiceDate'] ?? '')) ?: null;
    $nextService = trim((string)($data['nextServiceDate'] ?? '')) ?: null;

    if ($nickname === '' || $make === '' || $model === '' || $year < 1900 || $year > ((int)date('Y') + 1) || $regNumber === '' || $fuel === '' || $type === '') {
        vehicle_response(400, ['success' => false, 'error' => 'Please fill all required vehicle fields with valid values.']);
    }

    $stmt = $conn->prepare('INSERT INTO vehicles (owner_id, nickname, make, model, year, reg_number, fuel_type, vehicle_type, mileage, insurance_expiry, last_service_date, next_service_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    if (!$stmt) vehicle_response(500, ['success' => false, 'error' => 'Vehicle table is missing new columns. Import backend/database/migrations/2026_vehicle_registration.sql.']);
    $stmt->bind_param('isssisssisss', $userId, $nickname, $make, $model, $year, $regNumber, $fuel, $type, $mileage, $insurance, $lastService, $nextService);
    if (!$stmt->execute()) {
        if ($conn->errno === 1062) vehicle_response(409, ['success' => false, 'error' => 'This registration number is already registered.']);
        vehicle_response(500, ['success' => false, 'error' => 'Could not save vehicle to database. Please check the database schema.']);
    }
    $newId = $stmt->insert_id;
    $stmt->close();
    $fetch = $conn->prepare("SELECT v.*, u.email AS owner_email, u.name AS owner_name FROM vehicles v JOIN users u ON u.id = v.owner_id WHERE v.id = ? AND v.owner_id = ?");
    $fetch->bind_param('ii', $newId, $userId);
    $fetch->execute();
    $row = $fetch->get_result()->fetch_assoc();
    vehicle_response(201, ['success' => true, 'vehicle' => normalize_vehicle_row($row)]);
}

if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id < 1) vehicle_response(400, ['success' => false, 'error' => 'A valid vehicle ID is required.']);
    if ($role === 'owner') {
        $stmt = $conn->prepare('DELETE FROM vehicles WHERE id = ? AND owner_id = ?');
        $stmt->bind_param('ii', $id, $userId);
    } elseif (in_array($role, ['admin', 'garage', 'garage_staff'], true)) {
        $stmt = $conn->prepare('DELETE FROM vehicles WHERE id = ?');
        $stmt->bind_param('i', $id);
    } else vehicle_response(403, ['success' => false, 'error' => 'You are not allowed to delete vehicles.']);
    $stmt->execute();
    if ($stmt->affected_rows < 1) vehicle_response(404, ['success' => false, 'error' => 'Vehicle not found or access denied.']);
    vehicle_response(200, ['success' => true]);
}

vehicle_response(405, ['success' => false, 'error' => 'Method not allowed.']);
?>
