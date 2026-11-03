<?php
require_once __DIR__ . '/../config/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// --- Run this action via a daily cron job (or Windows Task Scheduler) to auto-create reminders ---
// Example cron: php /path/to/backend/api/reminders.php action=generate  (run once per day)
if ($action === 'generate') {
    // Find vehicles whose next service is due within 7 days and don't already have an unsent reminder
    $sql = "SELECT v.id AS vehicle_id, v.owner_id,
                   DATE_ADD(v.last_service_date, INTERVAL v.service_interval_days DAY) AS due_date
            FROM vehicles v
            WHERE v.last_service_date IS NOT NULL
              AND DATE_ADD(v.last_service_date, INTERVAL v.service_interval_days DAY) <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
              AND NOT EXISTS (
                  SELECT 1 FROM reminders r WHERE r.vehicle_id = v.id AND r.sent = 0
              )";
    $result = $conn->query($sql);
    $created = 0;
    while ($row = $result->fetch_assoc()) {
        $stmt = $conn->prepare("INSERT INTO reminders (vehicle_id, due_date, channel) VALUES (?, ?, 'email')");
        $stmt->bind_param("is", $row['vehicle_id'], $row['due_date']);
        $stmt->execute();
        $created++;
        // TODO: call your Email/SMS API here to actually notify the owner, e.g.:
        // send_email($ownerEmail, "Service due soon", "Your vehicle service is due on {$row['due_date']}");
    }
    echo json_encode(["success" => true, "reminders_created" => $created]);
    exit;
}

if ($method === 'GET') {
    // ?owner_id=1 -> reminders for that owner's vehicles
    $owner_id = (int) ($_GET['owner_id'] ?? 0);
    $stmt = $conn->prepare("SELECT r.*, v.reg_number, v.make, v.model FROM reminders r
        JOIN vehicles v ON r.vehicle_id = v.id
        WHERE v.owner_id = ? ORDER BY r.due_date ASC");
    $stmt->bind_param("i", $owner_id);
    $stmt->execute();
    echo json_encode($stmt->get_result()->fetch_all(MYSQLI_ASSOC));
    exit;
}

if ($method === 'PUT') {
    // Mark a reminder as sent: PUT reminders.php?id=3
    $id = (int) ($_GET['id'] ?? 0);
    $stmt = $conn->prepare("UPDATE reminders SET sent = 1 WHERE id = ?");
    $stmt->bind_param("i", $id);
    echo json_encode(["success" => $stmt->execute()]);
    exit;
}

http_response_code(405);
echo json_encode(["error" => "Method not allowed"]);
?>
