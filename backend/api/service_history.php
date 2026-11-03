<?php
require_once __DIR__ . '/../config/db.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {

    case 'GET':
        // ?vehicle_id=5 -> full service history for that vehicle
        $vehicle_id = (int) ($_GET['vehicle_id'] ?? 0);
        $stmt = $conn->prepare("SELECT * FROM service_history WHERE vehicle_id = ? ORDER BY service_date DESC");
        $stmt->bind_param("i", $vehicle_id);
        $stmt->execute();
        echo json_encode($stmt->get_result()->fetch_all(MYSQLI_ASSOC));
        break;

    case 'POST':
        // Garage staff logs a completed service
        $data = json_decode(file_get_contents("php://input"), true);
        $vehicle_id = (int) $data['vehicle_id'];
        $service_date = $data['service_date'];
        $description = $data['description'] ?? '';
        $cost = (float) ($data['cost'] ?? 0);
        $garage_id = isset($data['garage_id']) ? (int) $data['garage_id'] : null;

        $stmt = $conn->prepare("INSERT INTO service_history (vehicle_id, service_date, description, cost, garage_id) VALUES (?, ?, ?, ?, ?)");
        $stmt->bind_param("issdi", $vehicle_id, $service_date, $description, $cost, $garage_id);

        if ($stmt->execute()) {
            // Keep the vehicle's last_service_date in sync
            $conn->query("UPDATE vehicles SET last_service_date = '$service_date' WHERE id = $vehicle_id");
            echo json_encode(["success" => true, "record_id" => $stmt->insert_id]);
        } else {
            http_response_code(400);
            echo json_encode(["error" => $stmt->error]);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(["error" => "Method not allowed"]);
}
?>
