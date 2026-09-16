<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';

function asset_out(array $row): array
{
    return [
        'id' => $row['id'],
        'type' => $row['type'],
        'filename' => $row['filename'],
        'storage_path' => $row['storage_path'],
        'mime_type' => $row['mime_type'],
        'size_bytes' => $row['size_bytes'] !== null ? (int) $row['size_bytes'] : null,
        'created_at' => $row['created_at'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$pdo = db();

if ($method === 'GET') {
    $rows = $pdo->query('SELECT * FROM assets ORDER BY filename ASC')->fetchAll();
    respond(array_map('asset_out', $rows));
}

// Alles hieronder wijzigt data — vereist ingelogde beheerder.
require_admin();

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) {
        fail('id ontbreekt.', 422);
    }
    $stmt = $pdo->prepare('SELECT * FROM assets WHERE id = :id');
    $stmt->execute(['id' => $id]);
    $asset = $stmt->fetch();
    if (!$asset) {
        fail('Bestand niet gevonden.', 404);
    }

    $folder = $asset['type'] === 'pdf' ? 'pdfs' : 'audio';
    $filePath = realpath(__DIR__ . '/../uploads/' . $folder) . '/' . $asset['storage_path'];
    $uploadsRoot = realpath(__DIR__ . '/../uploads/' . $folder);
    // Alleen verwijderen als het pad daadwerkelijk binnen de uploads-map valt.
    if ($uploadsRoot !== false && str_starts_with(realpath(dirname($filePath)) ?: '', $uploadsRoot) && file_exists($filePath)) {
        @unlink($filePath);
    }

    $del = $pdo->prepare('DELETE FROM assets WHERE id = :id');
    $del->execute(['id' => $id]);
    respond(['ok' => true]);
}

fail('Methode niet toegestaan.', 405);
