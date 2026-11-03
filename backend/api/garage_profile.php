<?php
require_once __DIR__ . '/../config/db.php';
if (session_status() !== PHP_SESSION_ACTIVE) session_start();
header('Content-Type: application/json; charset=utf-8');
function profile_response($status, $body) { http_response_code($status); echo json_encode($body, JSON_UNESCAPED_UNICODE); exit; }
$user = $_SESSION['user'] ?? null;
if (!$user || empty($user['id'])) profile_response(401, ['success'=>false, 'error'=>'Please sign in again.']);
if (($user['role'] ?? '') !== 'garage') profile_response(403, ['success'=>false, 'error'=>'Garage account required.']);
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  $stmt = $conn->prepare('SELECT id, name, email, phone, city, garage_name FROM users WHERE id = ? AND role = \'garage\' LIMIT 1');
  $id = (int)$user['id']; $stmt->bind_param('i', $id); $stmt->execute(); $row = $stmt->get_result()->fetch_assoc(); $stmt->close();
  if (!$row) profile_response(404, ['success'=>false, 'error'=>'Garage account was not found.']);
  profile_response(200, ['success'=>true, 'profile'=>['id'=>(string)$row['id'],'name'=>$row['name'],'email'=>$row['email'],'phone'=>$row['phone'] ?? '', 'city'=>$row['city'] ?? '', 'garageName'=>$row['garage_name'] ?? '']]);
}
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $data = json_decode(file_get_contents('php://input'), true) ?: [];
  $name = trim((string)($data['name'] ?? '')); $garageName = trim((string)($data['garageName'] ?? ''));
  $phone = trim((string)($data['phone'] ?? '')); $city = trim((string)($data['city'] ?? ''));
  if ($name === '' || $garageName === '') profile_response(400, ['success'=>false,'error'=>'Owner name and workshop name are required.']);
  $id = (int)$user['id'];
  $stmt = $conn->prepare('UPDATE users SET name = ?, phone = ?, city = ?, garage_name = ? WHERE id = ? AND role = \'garage\'');
  if (!$stmt) profile_response(500, ['success'=>false,'error'=>'Could not prepare profile update.']);
  $stmt->bind_param('ssssi', $name, $phone, $city, $garageName, $id);
  if (!$stmt->execute()) profile_response(500, ['success'=>false,'error'=>'Could not save workshop profile.']);
  $stmt->close();
  $_SESSION['user']['name'] = $name; $_SESSION['user']['phone'] = $phone; $_SESSION['user']['city'] = $city; $_SESSION['user']['garageName'] = $garageName;
  profile_response(200, ['success'=>true,'message'=>'Workshop profile saved.','profile'=>['id'=>(string)$id,'name'=>$name,'email'=>$user['email'],'phone'=>$phone,'city'=>$city,'garageName'=>$garageName]]);
}
profile_response(405, ['success'=>false,'error'=>'Method not allowed.']);
?>