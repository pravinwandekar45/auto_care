<?php
// Shared helpers for authenticated AutoCare Pro APIs.
if (session_status() !== PHP_SESSION_ACTIVE) session_start();
function api_json(int $status, array $data): never { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); echo json_encode($data, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES); exit; }
function api_user(): array { $u=$_SESSION['user']??[]; if(empty($u['id'])||empty($u['role'])) api_json(401,['success'=>false,'error'=>'Please sign in again.']); return $u; }
function api_role(array $roles): array { $u=api_user(); if(!in_array(strtolower((string)$u['role']),$roles,true)) api_json(403,['success'=>false,'error'=>'You do not have permission for this action.']); return $u; }
function api_garage_id(array $u): int { $role=strtolower((string)$u['role']); if($role==='garage') return (int)$u['id']; if($role==='garage_staff') { global $conn; $id=(int)$u['id']; $q=$conn->prepare('SELECT garage_id FROM garage_staff_members WHERE id=? LIMIT 1'); if(!$q) api_json(403,['success'=>false,'error'=>'Garage staff account is not linked to a garage.']); $q->bind_param('i',$id); $q->execute(); $r=$q->get_result()->fetch_assoc(); if(!$r) api_json(403,['success'=>false,'error'=>'Garage staff account is not linked to a garage.']); return (int)$r['garage_id']; } return 0; }
function api_body(): array { $v=json_decode(file_get_contents('php://input'),true); return is_array($v)?$v:[]; }
?>