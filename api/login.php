<?php
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Methode niet toegestaan.', 405);
}

$input = json_input();
$password = (string) ($input['password'] ?? '');
$hash = config()['admin_password_hash'];

if ($password === '' || !password_verify($password, $hash)) {
    fail('Onjuist wachtwoord.', 401);
}

start_session_safe();
$_SESSION['is_admin'] = true;
session_regenerate_id(true);

respond(['ok' => true]);
