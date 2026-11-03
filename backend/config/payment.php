<?php
declare(strict_types=1);

// Keep credentials on the PHP server. Never place the Key Secret in frontend JavaScript.
return [
    'key_id' => getenv('RAZORPAY_KEY_ID') ?: '',
    'key_secret' => getenv('RAZORPAY_KEY_SECRET') ?: '',
    'webhook_secret' => getenv('RAZORPAY_WEBHOOK_SECRET') ?: '',
    'currency' => 'INR',
    'merchant_name' => 'AutoCare Pro Workshop',
];
