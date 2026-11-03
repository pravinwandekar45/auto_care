
<?php

// Read Gmail SMTP settings from backend/.env
$envFile = dirname(__DIR__) . '/.env';

if (is_file($envFile) && is_readable($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

    foreach ($lines as $line) {
        $line = trim($line);

        if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) {
            continue;
        }

        [$name, $value] = explode('=', $line, 2);

        $name = trim($name);
        $value = trim($value);

        if (
            strlen($value) >= 2 &&
            (($value[0] === '"' && substr($value, -1) === '"') ||
             ($value[0] === "'" && substr($value, -1) === "'"))
        ) {
            $value = substr($value, 1, -1);
        }

        if ($name !== '' && getenv($name) === false) {
            putenv($name . '=' . $value);
            $_ENV[$name] = $value;
        }
    }
}

return [
    'host' => getenv('AUTOCARE_SMTP_HOST') ?: 'smtp.gmail.com',
    'port' => (int)(getenv('AUTOCARE_SMTP_PORT') ?: 587),
    'username' => trim((string)(getenv('AUTOCARE_SMTP_USERNAME') ?: '')),
    'password' => preg_replace('/\s+/', '', (string)(getenv('AUTOCARE_SMTP_APP_PASSWORD') ?: '')),
    'from_email' => trim((string)(getenv('AUTOCARE_MAIL_FROM') ?: (getenv('AUTOCARE_SMTP_USERNAME') ?: ''))),
    'from_name' => getenv('AUTOCARE_MAIL_FROM_NAME') ?: 'AutoCarePro',
    'encryption' => 'tls',
    'timeout' => 20,
];
