<?php

$envFile = __DIR__ . '/.env';

echo "ENV File Exists: ";
var_dump(file_exists($envFile));

echo "<br>ENV File Readable: ";
var_dump(is_readable($envFile));

echo "<br>ENV File Size: ";
echo file_exists($envFile) ? filesize($envFile) : "NOT FOUND";

echo "<br><br>";

$config = require __DIR__ . '/config/mail.php';

foreach ([
    'username',
    'password',
    'from_email'
] as $key) {
    echo $key . ": ";
    echo !empty($config[$key]) ? "LOADED" : "MISSING";
    echo "<br>";
}
?>