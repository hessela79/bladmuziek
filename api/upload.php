<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Methode niet toegestaan.', 405);
}
require_admin();

$type = $_POST['type'] ?? '';
$storagePath = $_POST['storage_path'] ?? '';
if (!in_array($type, ['pdf', 'audio'], true)) {
    fail('Ongeldig type.', 422);
}
if ($storagePath === '') {
    fail('storage_path ontbreekt.', 422);
}
if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    fail('Geen (geldig) bestand ontvangen.', 422);
}

// storage_path saneren: geen ".." of absolute paden toestaan, elk segment
// normaliseren zodat het bestand altijd binnen de eigen uploads-map blijft.
$segments = array_filter(explode('/', $storagePath), fn($s) => $s !== '' && $s !== '.' && $s !== '..');
$safePath = implode('/', array_map(function ($segment) {
    return preg_replace('/[^A-Za-z0-9_.\-]/', '_', $segment);
}, $segments));
if ($safePath === '') {
    fail('Ongeldig bestandspad.', 422);
}

$folder = $type === 'pdf' ? 'pdfs' : 'audio';
$allowedExt = $type === 'pdf'
    ? ['pdf']
    : ['mp3', 'mp4', 'm4a', 'wav', 'ogg'];
$ext = strtolower(pathinfo($safePath, PATHINFO_EXTENSION));
if (!in_array($ext, $allowedExt, true)) {
    fail('Bestandstype niet toegestaan.', 422);
}

$uploadsRoot = __DIR__ . '/../uploads/' . $folder;
$fullPath = $uploadsRoot . '/' . $safePath;
$fullDir = dirname($fullPath);
if (!is_dir($fullDir) && !mkdir($fullDir, 0755, true) && !is_dir($fullDir)) {
    fail('Kon map niet aanmaken op de server.', 500);
}

if (!move_uploaded_file($_FILES['file']['tmp_name'], $fullPath)) {
    fail('Opslaan van het bestand is mislukt.', 500);
}

$pdo = db();
$id = uuidv4();
$stmt = $pdo->prepare(
    'INSERT INTO assets (id, type, filename, storage_path, mime_type, size_bytes)
     VALUES (:id, :type, :filename, :storage_path, :mime_type, :size_bytes)'
);
$stmt->execute([
    'id' => $id,
    'type' => $type,
    'filename' => $_FILES['file']['name'],
    'storage_path' => $safePath,
    'mime_type' => $_FILES['file']['type'] ?: null,
    'size_bytes' => $_FILES['file']['size'],
]);

$row = $pdo->query("SELECT * FROM assets WHERE id = " . $pdo->quote($id))->fetch();
respond([
    'id' => $row['id'],
    'type' => $row['type'],
    'filename' => $row['filename'],
    'storage_path' => $row['storage_path'],
    'mime_type' => $row['mime_type'],
    'size_bytes' => (int) $row['size_bytes'],
    'created_at' => $row['created_at'],
], 201);
