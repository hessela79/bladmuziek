<?php
// Sessie-gebaseerde login voor het beheerscherm. Lezen (GET) is voor
// iedereen open; schrijven (POST/PUT/DELETE/upload) vereist een geldige
// sessie — zie require_admin().

require_once __DIR__ . '/helpers.php';

function start_session_safe(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_set_cookie_params([
            'lifetime' => 60 * 60 * 24 * 30,
            'path' => '/',
            'samesite' => 'Lax',
        ]);
        session_start();
    }
}

function is_logged_in(): bool
{
    start_session_safe();
    return !empty($_SESSION['is_admin']);
}

function require_admin(): void
{
    if (!is_logged_in()) {
        fail('Niet ingelogd.', 401);
    }
}
