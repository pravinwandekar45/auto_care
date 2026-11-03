<?php
require_once __DIR__ . '/../config/db.php';
if (session_status() !== PHP_SESSION_ACTIVE) session_start();
header('Content-Type: application/json; charset=utf-8');
function staff_json($code, $data) { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
$user = $_SESSION['user'] ?? null;
if (!$user || empty($user['id'])) staff_json(401, ['success'=>false,'error'=>'Please sign in again.']);
if (($user['role'] ?? '') !== 'garage') staff_json(403, ['success'=>false,'error'=>'Only the garage account can manage its staff.']);
$garageId = (int)$user['id'];
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  $stmt = $conn->prepare('SELECT id, full_name, email, phone, designation, status, created_at FROM garage_staff_members WHERE garage_id = ? ORDER BY id ASC');
  if (!$stmt) staff_json(500,['success'=>false,'error'=>'Could not load staff members.']);
  $stmt->bind_param('i',$garageId); $stmt->execute(); $result=$stmt->get_result(); $rows=[];
  while($r=$result->fetch_assoc()) $rows[]=$r; $stmt->close(); staff_json(200,['success'=>true,'staff'=>$rows]);
}
$data=json_decode(file_get_contents('php://input'),true) ?: [];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $id=(int)($data['id'] ?? 0); $name=trim((string)($data['full_name'] ?? '')); $email=strtolower(trim((string)($data['email'] ?? ''))); $phone=trim((string)($data['phone'] ?? '')); $designation=trim((string)($data['designation'] ?? '')); $status=(string)($data['status'] ?? 'Active');
  if($name==='' || !filter_var($email,FILTER_VALIDATE_EMAIL) || $phone==='' || $designation==='') staff_json(400,['success'=>false,'error'=>'Please enter valid name, email, phone and designation.']);
  if(!in_array($status,['Active','Inactive'],true)) staff_json(400,['success'=>false,'error'=>'Invalid staff status.']);
  if($id>0){
    $stmt=$conn->prepare('UPDATE garage_staff_members SET full_name=?, email=?, phone=?, designation=?, status=? WHERE id=? AND garage_id=?');
    if(!$stmt) staff_json(500,['success'=>false,'error'=>'Could not prepare staff update.']);
    $stmt->bind_param('sssssii',$name,$email,$phone,$designation,$status,$id,$garageId);
  } else {
    $stmt=$conn->prepare('INSERT INTO garage_staff_members (garage_id, full_name, email, phone, designation, status) VALUES (?,?,?,?,?,?)');
    if(!$stmt) staff_json(500,['success'=>false,'error'=>'Could not prepare staff record.']);
    $stmt->bind_param('isssss',$garageId,$name,$email,$phone,$designation,$status);
  }
  if(!$stmt->execute()) { $err=$stmt->errno; $stmt->close(); staff_json($err===1062?409:500,['success'=>false,'error'=>$err===1062?'This email is already used for a staff member in your garage.':'Could not save staff member.']); }
  $newId=$id ?: $stmt->insert_id; $stmt->close(); staff_json(200,['success'=>true,'message'=>$id?'Staff details updated.':'Staff member added.','id'=>$newId]);
}
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
  $id=(int)($data['id'] ?? 0); if($id<1) staff_json(400,['success'=>false,'error'=>'Invalid staff member.']);
  $stmt=$conn->prepare('DELETE FROM garage_staff_members WHERE id=? AND garage_id=?'); if(!$stmt) staff_json(500,['success'=>false,'error'=>'Could not prepare delete.']);
  $stmt->bind_param('ii',$id,$garageId); $stmt->execute(); $deleted=$stmt->affected_rows; $stmt->close();
  if(!$deleted) staff_json(404,['success'=>false,'error'=>'Staff member not found.']); staff_json(200,['success'=>true,'message'=>'Staff member deleted.']);
}
staff_json(405,['success'=>false,'error'=>'Method not allowed.']);
?>