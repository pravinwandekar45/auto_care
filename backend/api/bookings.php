<?php
require_once __DIR__.'/../config/db.php'; require_once __DIR__.'/_common.php';
$method=$_SERVER['REQUEST_METHOD']??'GET'; $u=api_user(); $role=strtolower((string)$u['role']);
if($method==='GET'){
 $sql="SELECT b.id,b.vehicle_id,b.owner_id,b.garage_id,b.slot_datetime,b.status,b.service_id,b.service_name,b.workflow_stage,b.notes,b.created_at,v.reg_number,v.nickname,v.make,v.model,ou.name AS owner_name,ou.email AS owner_email,ou.phone AS owner_phone,gu.name AS garage_name FROM bookings b JOIN vehicles v ON v.id=b.vehicle_id JOIN users ou ON ou.id=b.owner_id LEFT JOIN users gu ON gu.id=b.garage_id";
 if($role==='owner'){ $sql.=' WHERE b.owner_id=?'; $q=$conn->prepare($sql.' ORDER BY b.slot_datetime DESC'); $id=(int)$u['id']; $q->bind_param('i',$id); }
 elseif($role==='garage'||$role==='garage_staff'){ $gid=api_garage_id($u); $q=$conn->prepare($sql.' WHERE b.garage_id=? ORDER BY b.slot_datetime ASC'); $q->bind_param('i',$gid); }
 elseif($role==='admin'){ $q=$conn->prepare($sql.' ORDER BY b.slot_datetime DESC'); }
 else api_json(403,['success'=>false,'error'=>'Not authorized']);
 if(!$q||!$q->execute()) api_json(500,['success'=>false,'error'=>'Could not load bookings.']); api_json(200,['success'=>true,'bookings'=>$q->get_result()->fetch_all(MYSQLI_ASSOC)]);
}
if($method==='POST'){
 $u=api_role(['owner']); $d=api_body(); $vehicle=(int)($d['vehicle_id']??0); $garage=(int)($d['garage_id']??0); $dt=trim((string)($d['slot_datetime']??'')); $notes=trim((string)($d['notes']??'')); $serviceId=isset($d['service_id'])?(int)$d['service_id']:null; $serviceName=trim((string)($d['service_name']??'General Service')); if($serviceName==='') $serviceName='General Service';
 $date=DateTime::createFromFormat('Y-m-d H:i:s',$dt) ?: DateTime::createFromFormat('Y-m-d\TH:i',$dt);
 if($vehicle<1||$garage<1||!$date||$date<new DateTime('now')) api_json(400,['success'=>false,'error'=>'Select a valid vehicle, garage and future service date/time.']); $dt=$date->format('Y-m-d H:i:s');
 $owner=(int)$u['id']; $q=$conn->prepare('SELECT id FROM vehicles WHERE id=? AND owner_id=?'); $q->bind_param('ii',$vehicle,$owner); $q->execute(); if(!$q->get_result()->fetch_assoc()) api_json(403,['success'=>false,'error'=>'Selected vehicle does not belong to your account.']);
 $q=$conn->prepare("SELECT id FROM users WHERE id=? AND role='garage'"); $q->bind_param('i',$garage); $q->execute(); if(!$q->get_result()->fetch_assoc()) api_json(400,['success'=>false,'error'=>'Selected garage was not found.']);
 $q=$conn->prepare("SELECT id FROM bookings WHERE garage_id=? AND slot_datetime=? AND status<>'cancelled' LIMIT 1"); $q->bind_param('is',$garage,$dt); $q->execute(); if($q->get_result()->fetch_assoc()) api_json(409,['success'=>false,'error'=>'That garage slot is already booked.']);
 $q=$conn->prepare("INSERT INTO bookings(vehicle_id,owner_id,garage_id,service_id,service_name,slot_datetime,status,notes) VALUES(?,?,?,?,?,?,'pending',?)"); $q->bind_param('iiiisss',$vehicle,$owner,$garage,$serviceId,$serviceName,$dt,$notes); if(!$q->execute()) api_json(500,['success'=>false,'error'=>'Booking could not be saved.']);
 api_json(201,['success'=>true,'booking'=>['id'=>(int)$q->insert_id,'vehicle_id'=>$vehicle,'owner_id'=>$owner,'garage_id'=>$garage,'service_id'=>$serviceId,'service_name'=>$serviceName,'slot_datetime'=>$dt,'status'=>'pending','notes'=>$notes]]);
}
if($method==='PUT'||$method==='DELETE'){
 $id=(int)($_GET['id']??0); if($id<1) api_json(400,['success'=>false,'error'=>'Invalid booking ID.']); $d=api_body(); $status=$method==='DELETE'?'cancelled':strtolower(str_replace(' ','_',trim((string)($d['status']??'')))); if(!in_array($status,['pending','confirmed','vehicle_received','in_progress','completed','cancelled'],true)) api_json(400,['success'=>false,'error'=>'Invalid booking status.']); $stage=trim((string)($d['workflow_stage']??''));
 $completionMail=null;
 if($status==='completed' && in_array($role,['garage','garage_staff','admin'],true)) {
  $lookup=$conn->prepare("SELECT b.status,b.completion_email_sent_at,ou.email AS owner_email,ou.name AS owner_name,v.reg_number,v.make,v.model,COALESCE(gu.garage_name,gu.name,'your garage') AS garage_name FROM bookings b JOIN users ou ON ou.id=b.owner_id JOIN vehicles v ON v.id=b.vehicle_id LEFT JOIN users gu ON gu.id=b.garage_id WHERE b.id=?");
  $lookup->bind_param('i',$id); $lookup->execute(); $completionMail=$lookup->get_result()->fetch_assoc();
  if(!$completionMail) api_json(404,['success'=>false,'error'=>'Booking not found.']);
  if($role==='garage'||$role==='garage_staff') { $gid=api_garage_id($u); $check=$conn->prepare('SELECT id FROM bookings WHERE id=? AND garage_id=?'); $check->bind_param('ii',$id,$gid); $check->execute(); if(!$check->get_result()->fetch_assoc()) api_json(403,['success'=>false,'error'=>'Not authorized to update this booking.']); }
 }
 if($role==='garage'||$role==='garage_staff'){ $gid=api_garage_id($u); $q=$conn->prepare('UPDATE bookings SET status=?,workflow_stage=? WHERE id=? AND garage_id=?'); $q->bind_param('ssii',$status,$stage,$id,$gid); }
 elseif($role==='admin'){ $q=$conn->prepare('UPDATE bookings SET status=?,workflow_stage=? WHERE id=?'); $q->bind_param('ssi',$status,$stage,$id); }
 elseif($role==='owner'&&$status==='cancelled'){ $uid=(int)$u['id']; $q=$conn->prepare("UPDATE bookings SET status='cancelled',workflow_stage='Cancelled' WHERE id=? AND owner_id=? AND status IN ('pending','confirmed')"); $q->bind_param('ii',$id,$uid); }
 else api_json(403,['success'=>false,'error'=>'Not authorized to update this booking.']);
 $q->execute(); if($q->affected_rows<1) api_json(404,['success'=>false,'error'=>'Booking not found or no change was made.']); if($status==='completed'){$q=$conn->prepare('UPDATE vehicles v JOIN bookings b ON b.vehicle_id=v.id SET v.last_service_date=CURDATE() WHERE b.id=?');$q->bind_param('i',$id);$q->execute();}
 $mailResult=null;
 if($status==='completed' && $completionMail && $completionMail['status']!=='completed' && empty($completionMail['completion_email_sent_at'])) {
  require_once __DIR__.'/../lib/gmail_smtp.php';
  $vehicle=trim(($completionMail['make']??'').' '.($completionMail['model']??'').' '.($completionMail['reg_number']??''));
  $mailResult=autocare_send_completion_email((string)$completionMail['owner_email'],(string)$completionMail['owner_name'],$vehicle,(string)$completionMail['garage_name'],$id);
  if($mailResult['success']) { $sent=$conn->prepare('UPDATE bookings SET completion_email_sent_at=NOW() WHERE id=?'); $sent->bind_param('i',$id); $sent->execute(); }
 }
 api_json(200,['success'=>true,'email_notification'=>$mailResult]);
}
api_json(405,['success'=>false,'error'=>'Method not allowed']);
?>