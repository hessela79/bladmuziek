<?php
// Eén gedeelde PDO-verbinding per request.

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $configPath = __DIR__ . '/config.php';
        if (!file_exists($configPath)) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['error' => 'api/config.php ontbreekt. Kopieer config.sample.php naar config.php en vul je gegevens in.']);
            exit;
        }
        $config = require $configPath;
        $db = $config['db'];
        $dsn = "mysql:host={$db['host']};dbname={$db['name']};charset=utf8mb4";
        try {
            $pdo = new PDO($dsn, $db['user'], $db['pass'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['error' => 'Kon geen verbinding maken met de database.']);
            exit;
        }
    }
    return $pdo;
}

function config(): array
{
    static $config = null;
    if ($config === null) {
        $config = require __DIR__ . '/config.php';
    }
    return $config;
}
