<?php
/** Minimal Gmail SMTP client using STARTTLS; no external package required. */
function autocare_smtp_read($socket): string {
    $response = '';
    while (($line = fgets($socket, 515)) !== false) {
        $response .= $line;
        if (strlen($line) < 4 || $line[3] === ' ') break;
    }
    return $response;
}
function autocare_smtp_command($socket, string $command, array $expected): string {
    if ($command !== '') fwrite($socket, $command . "\r\n");
    $response = autocare_smtp_read($socket);
    $code = (int)substr($response, 0, 3);
    if (!in_array($code, $expected, true)) throw new RuntimeException('SMTP error: ' . trim($response));
    return $response;
}
function autocare_send_completion_email(string $to, string $customerName, string $vehicle, string $garageName, int $bookingId): array {
    $cfg = require __DIR__ . '/../config/mail.php';
    foreach (['username','password','from_email'] as $key) {
        if (empty($cfg[$key])) return ['success'=>false, 'error'=>'Gmail SMTP is not configured. Add the Gmail address and App Password in backend/.env.'];
    }
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) return ['success'=>false, 'error'=>'Customer email address is invalid.'];
    $socket = @stream_socket_client('tcp://' . $cfg['host'] . ':' . $cfg['port'], $errno, $errstr, (int)$cfg['timeout'], STREAM_CLIENT_CONNECT);
    if (!$socket) return ['success'=>false, 'error'=>'Could not connect to Gmail SMTP: ' . $errstr];
    stream_set_timeout($socket, (int)$cfg['timeout']);
    try {
        autocare_smtp_command($socket, '', [220]);
        autocare_smtp_command($socket, 'EHLO autocarepro.local', [250]);
        autocare_smtp_command($socket, 'STARTTLS', [220]);
        if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) throw new RuntimeException('Could not establish TLS encryption.');
        autocare_smtp_command($socket, 'EHLO autocarepro.local', [250]);
        autocare_smtp_command($socket, 'AUTH LOGIN', [334]);
        autocare_smtp_command($socket, base64_encode($cfg['username']), [334]);
        autocare_smtp_command($socket, base64_encode($cfg['password']), [235]);
        autocare_smtp_command($socket, 'MAIL FROM:<' . $cfg['from_email'] . '>', [250]);
        autocare_smtp_command($socket, 'RCPT TO:<' . $to . '>', [250, 251]);
        autocare_smtp_command($socket, 'DATA', [354]);
        $subject = 'Your vehicle service is completed - AutoCarePro';
        $body = "Dear {$customerName},\n\nYour vehicle service has been completed successfully. Please visit {$garageName} to collect your vehicle.\n\nVehicle: {$vehicle}\nBooking ID: {$bookingId}\n\nThank you for choosing AutoCarePro!";
        $headers = [
            'Date: ' . date(DATE_RFC2822),
            'From: ' . (function_exists('mb_encode_mimeheader') ? mb_encode_mimeheader($cfg['from_name'], 'UTF-8') : $cfg['from_name']) . ' <' . $cfg['from_email'] . '>',
            'To: <' . $to . '>',
            'Subject: ' . (function_exists('mb_encode_mimeheader') ? mb_encode_mimeheader($subject, 'UTF-8') : $subject),
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
        ];
        $message = implode("\r\n", $headers) . "\r\n\r\n" . str_replace("\n", "\r\n", $body);
        $message = preg_replace('/(^|\r\n)\./', '$1..', $message);
        fwrite($socket, $message . "\r\n.\r\n");
        autocare_smtp_command($socket, '', [250]);
        autocare_smtp_command($socket, 'QUIT', [221]);
        fclose($socket);
        return ['success'=>true];
    } catch (Throwable $e) {
        fclose($socket);
        return ['success'=>false, 'error'=>$e->getMessage()];
    }
}
