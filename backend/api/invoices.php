<?php
require_once __DIR__.'/../config/db.php'; require_once __DIR__.'/_common.php';
$method=$_SERVER['REQUEST_METHOD']??'GET'; $u=api_user(); $role=strtolower((string)$u['role']);
$base="SELECT i.id,i.booking_id,i.amount,i.pdf_path,i.generated_on,COALESCE(i.payment_status,'pending') payment_status,i.paid_at,i.payment_method,b.owner_id,b.garage_id,b.vehicle_id,b.slot_datetime,v.reg_number,v.nickname,v.make,v.model,ou.name owner_name,ou.email owner_email,gu.name garage_name FROM invoices i JOIN bookings b ON b.id=i.booking_id JOIN vehicles v ON v.id=b.vehicle_id JOIN users ou ON ou.id=b.owner_id LEFT JOIN users gu ON gu.id=b.garage_id";
if($method==='GET'){
 if($role==='owner'){$id=(int)$u['id'];$q=$conn->prepare($base.' WHERE b.owner_id=? ORDER BY i.generated_on DESC');$q->bind_param('i',$id);}
 elseif($role==='garage'||$role==='garage_staff'){$id=api_garage_id($u);$q=$conn->prepare($base.' WHERE b.garage_id=? ORDER BY i.generated_on DESC');$q->bind_param('i',$id);}
 elseif($role==='admin'){$q=$conn->prepare($base.' ORDER BY i.generated_on DESC');}
 else api_json(403,['success'=>false,'error'=>'Not authorized']);
 if(!$q||!$q->execute())api_json(500,['success'=>false,'error'=>'Could not load invoices.']); api_json(200,['success'=>true,'invoices'=>$q->get_result()->fetch_all(MYSQLI_ASSOC)]);
}
if($method==='POST'){
 $u=api_role(['garage','garage_staff','admin']); $d=api_body(); $booking=(int)($d['booking_id']??0); $amount=filter_var($d['amount']??null,FILTER_VALIDATE_FLOAT); if($booking<1||$amount===false||$amount<=0||$amount>99999999)api_json(400,['success'=>false,'error'=>'A valid booking and invoice amount are required.']);
 if($role==='admin'){$q=$conn->prepare('SELECT id FROM bookings WHERE id=? AND status="completed"');$q->bind_param('i',$booking);} else {$gid=api_garage_id($u);$q=$conn->prepare('SELECT id FROM bookings WHERE id=? AND garage_id=? AND status="completed"');$q->bind_param('ii',$booking,$gid);} $q->execute(); if(!$q->get_result()->fetch_assoc())api_json(403,['success'=>false,'error'=>'Only a completed booking assigned to your garage can be invoiced.']);
 $q=$conn->prepare('SELECT id FROM invoices WHERE booking_id=? LIMIT 1');$q->bind_param('i',$booking);$q->execute();if($q->get_result()->fetch_assoc())api_json(409,['success'=>false,'error'=>'An invoice already exists for this booking.']);
 $conn->begin_transaction(); try{$q=$conn->prepare("INSERT INTO invoices(booking_id,amount,payment_status) VALUES(?,?,'pending')");$q->bind_param('id',$booking,$amount);$q->execute();$invoiceId=(int)$q->insert_id;
 if(!empty($d['items'])&&is_array($d['items'])){ $item=$conn->prepare('INSERT INTO invoice_items(invoice_id,description,item_type,quantity,rate,line_total) VALUES(?,?,?,?,?,?)'); foreach($d['items'] as $it){$desc=trim((string)($it['description']??''));$type=trim((string)($it['type']??'Service'));$qty=max(1,(int)($it['qty']??1));$rate=max(0,(float)($it['rate']??0));$line=$qty*$rate;if($desc==='')continue;$item->bind_param('issidd',$invoiceId,$desc,$type,$qty,$rate,$line);$item->execute();}}
 $conn->commit();api_json(201,['success'=>true,'invoice'=>['id'=>$invoiceId,'booking_id'=>$booking,'amount'=>(float)$amount,'payment_status'=>'pending']]);}catch(Throwable $e){$conn->rollback();error_log('Invoice create: '.$e->getMessage());api_json(500,['success'=>false,'error'=>'Invoice could not be saved.']);}
}
api_json(405,['success'=>false,'error'=>'Method not allowed']);
?>