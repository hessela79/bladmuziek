<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';

function piece_out(array $row): array
{
    return [
        'id' => $row['id'],
        'title' => $row['title'],
        'composer' => $row['composer'],
        'genre' => $row['genre'],
        'voices' => $row['voices'] === '' || $row['voices'] === null ? [] : explode(',', $row['voices']),
        'solo' => (bool) $row['solo'],
        'visible' => (bool) $row['visible'],
        'pdf_asset_id' => $row['pdf_asset_id'],
        'sort_order' => (int) $row['sort_order'],
        'created_at' => $row['created_at'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$pdo = db();

if ($method === 'GET') {
    $id = $_GET['id'] ?? null;

    if ($id !== null) {
        $stmt = $pdo->prepare(
            'SELECT p.*, a.storage_path AS pdf_storage_path
             FROM pieces p LEFT JOIN assets a ON a.id = p.pdf_asset_id
             WHERE p.id = :id'
        );
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            fail('Stuk niet gevonden.', 404);
        }
        $piece = piece_out($row);
        $piece['pdf_asset'] = $row['pdf_storage_path'] !== null ? ['storage_path' => $row['pdf_storage_path']] : null;
        respond($piece);
    }

    $where = '';
    if (($_GET['visible_only'] ?? '') === '1') {
        $where = 'WHERE visible = 1';
    }
    $rows = $pdo->query("SELECT * FROM pieces $where ORDER BY sort_order ASC")->fetchAll();
    respond(array_map('piece_out', $rows));
}

// Alles hieronder wijzigt data — vereist ingelogde beheerder.
require_admin();

if ($method === 'POST') {
    $input = json_input();
    $id = (string) require_field($input, 'id');
    $title = (string) require_field($input, 'title');
    $voices = is_array($input['voices'] ?? null) ? $input['voices'] : [];

    $stmt = $pdo->prepare(
        'INSERT INTO pieces (id, title, composer, genre, voices, solo, visible, pdf_asset_id, sort_order)
         VALUES (:id, :title, :composer, :genre, :voices, :solo, :visible, :pdf_asset_id, :sort_order)'
    );
    try {
        $stmt->execute([
            'id' => $id,
            'title' => $title,
            'composer' => $input['composer'] ?? null,
            'genre' => $input['genre'] ?? null,
            'voices' => implode(',', $voices),
            'solo' => bool_to_int($input['solo'] ?? false),
            'visible' => bool_to_int($input['visible'] ?? true),
            'pdf_asset_id' => $input['pdf_asset_id'] ?? null,
            'sort_order' => (int) ($input['sort_order'] ?? 0),
        ]);
    } catch (PDOException $e) {
        fail('Kon stuk niet opslaan: ' . $e->getMessage(), 400);
    }
    respond(['ok' => true, 'id' => $id], 201);
}

if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) {
        fail('id ontbreekt.', 422);
    }
    $input = json_input();

    // Alleen de velden bijwerken die daadwerkelijk meegestuurd zijn, zodat
    // een klein tussentijds wijzigingetje (bijv. alleen "visible" bij het
    // aan/uitvinken van zichtbaarheid, of alleen "sort_order" bij het
    // verslepen) niet de rest van de rij hoeft mee te sturen.
    $fields = [];
    $params = ['id' => $id];

    if (array_key_exists('title', $input)) {
        $title = trim((string) $input['title']);
        if ($title === '') {
            fail('Titel mag niet leeg zijn.', 422);
        }
        $fields[] = 'title = :title';
        $params['title'] = $title;
    }
    if (array_key_exists('composer', $input)) {
        $fields[] = 'composer = :composer';
        $params['composer'] = $input['composer'];
    }
    if (array_key_exists('genre', $input)) {
        $fields[] = 'genre = :genre';
        $params['genre'] = $input['genre'];
    }
    if (array_key_exists('voices', $input)) {
        $fields[] = 'voices = :voices';
        $params['voices'] = implode(',', is_array($input['voices']) ? $input['voices'] : []);
    }
    if (array_key_exists('solo', $input)) {
        $fields[] = 'solo = :solo';
        $params['solo'] = bool_to_int($input['solo']);
    }
    if (array_key_exists('visible', $input)) {
        $fields[] = 'visible = :visible';
        $params['visible'] = bool_to_int($input['visible']);
    }
    if (array_key_exists('pdf_asset_id', $input)) {
        $fields[] = 'pdf_asset_id = :pdf_asset_id';
        $params['pdf_asset_id'] = $input['pdf_asset_id'];
    }
    if (array_key_exists('sort_order', $input)) {
        $fields[] = 'sort_order = :sort_order';
        $params['sort_order'] = (int) $input['sort_order'];
    }

    if (empty($fields)) {
        fail('Niets om op te slaan.', 422);
    }

    $stmt = $pdo->prepare('UPDATE pieces SET ' . implode(', ', $fields) . ' WHERE id = :id');
    $stmt->execute($params);

    respond(['ok' => true]);
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) {
        fail('id ontbreekt.', 422);
    }
    $stmt = $pdo->prepare('DELETE FROM pieces WHERE id = :id');
    $stmt->execute(['id' => $id]);
    respond(['ok' => true]);
}

fail('Methode niet toegestaan.', 405);
