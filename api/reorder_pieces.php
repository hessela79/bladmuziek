<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Methode niet toegestaan.', 405);
}
require_admin();

$input = json_input();
$ids = $input['ids'] ?? null;
if (!is_array($ids) || count($ids) === 0) {
    fail('ids ontbreekt of is leeg.', 422);
}

$pdo = db();
$stmt = $pdo->prepare('UPDATE pieces SET sort_order = :sort_order WHERE id = :id');

$pdo->beginTransaction();
try {
    foreach ($ids as $index => $id) {
        $stmt->execute(['sort_order' => $index, 'id' => (string) $id]);
    }
    $pdo->commit();
} catch (PDOException $e) {
    $pdo->rollBack();
    fail('Volgorde opslaan mislukt: ' . $e->getMessage(), 500);
}

respond(['ok' => true]);
