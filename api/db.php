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
            // Zonder dit hangt NOW()/CURRENT_TIMESTAMP af van de tijdzone
            // die op de server toevallig is ingesteld (niet gegarandeerd
            // UTC) — en DATETIME-kolommen bewaren zelf geen tijdzone. De
            // frontend (zie utc_iso() hieronder en toDate() in js/*.js)
            // gaat ervan uit dat elke *_at-waarde UTC is, dus dat moet
            // hier afgedwongen worden.
            $pdo->exec("SET time_zone = '+00:00'");
        } catch (PDOException $e) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['error' => 'Kon geen verbinding maken met de database.']);
            exit;
        }
    }
    return $pdo;
}

// Een DATETIME-waarde (bijv. "2026-10-30 11:20:36") komt zonder tijdzone
// terug uit MariaDB. Dankzij SET time_zone hierboven is die waarde altijd
// UTC — maar dat moet expliciet meegegeven worden, anders interpreteert de
// browser 'm (new Date("...") zonder "Z") als lokale tijd. Bij een
// server/bezoeker in een andere tijdzone kan dat ertoe leiden dat een net
// gewijzigde passage lijkt op "eerder dan je laatste bezoek", waardoor een
// "Bijgewerkt"-label ten onrechte wegblijft.
function utc_iso(?string $datetime): ?string
{
    if ($datetime === null) {
        return null;
    }
    return str_replace(' ', 'T', $datetime) . 'Z';
}

function config(): array
{
    static $config = null;
    if ($config === null) {
        $config = require __DIR__ . '/config.php';
    }
    return $config;
}
