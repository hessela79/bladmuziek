<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';

function passage_out(array $row): array
{
    return [
        'id' => $row['id'],
        'piece_id' => $row['piece_id'],
        'title' => $row['title'],
        'description' => $row['description'],
        'audio_asset_id' => $row['audio_asset_id'],
        'audio_asset' => $row['audio_storage_path'] !== null ? ['storage_path' => $row['audio_storage_path']] : null,
        'color' => $row['color'],
        'page' => (int) $row['page'],
        'x_pct' => (float) $row['x_pct'],
        'y_pct' => (float) $row['y_pct'],
        'width_pct' => (float) $row['width_pct'],
        'height_pct' => (float) $row['height_pct'],
        'sort_order' => (int) $row['sort_order'],
        'created_at' => $row['created_at'],
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$pdo = db();
$allowedColors = ['geel', 'groen', 'rood', 'blauw', 'bruin', 'goud'];

if ($method === 'GET') {
    $pieceId = $_GET['piece_id'] ?? null;
    $sql = 'SELECT p.*, a.storage_path AS audio_storage_path
            FROM passages p LEFT JOIN assets a ON a.id = p.audio_asset_id';
    $params = [];
    if ($pieceId !== null) {
        $sql .= ' WHERE p.piece_id = :piece_id';
        $params['piece_id'] = $pieceId;
    }
    $sql .= ' ORDER BY p.sort_order ASC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    respond(array_map('passage_out', $stmt->fetchAll()));
}

// Alles hieronder wijzigt data — vereist ingelogde beheerder.
require_admin();

if ($method === 'POST') {
    $input = json_input();
    $pieceId = (string) require_field($input, 'piece_id');
    $title = (string) require_field($input, 'title');
    $color = (string) ($input['color'] ?? 'goud');
    if (!in_array($color, $allowedColors, true)) {
        $color = 'goud';
    }
    $id = uuidv4();

    $stmt = $pdo->prepare(
        'INSERT INTO passages (id, piece_id, title, description, audio_asset_id, color, page, x_pct, y_pct, width_pct, height_pct, sort_order)
         VALUES (:id, :piece_id, :title, :description, :audio_asset_id, :color, :page, :x_pct, :y_pct, :width_pct, :height_pct, :sort_order)'
    );
    $stmt->execute([
        'id' => $id,
        'piece_id' => $pieceId,
        'title' => $title,
        'description' => $input['description'] ?? '',
        'audio_asset_id' => $input['audio_asset_id'] ?? null,
        'color' => $color,
        'page' => (int) ($input['page'] ?? 1),
        'x_pct' => (float) ($input['x_pct'] ?? 0),
        'y_pct' => (float) ($input['y_pct'] ?? 0),
        'width_pct' => (float) ($input['width_pct'] ?? 0),
        'height_pct' => (float) ($input['height_pct'] ?? 0),
        'sort_order' => (int) ($input['sort_order'] ?? 0),
    ]);
    respond(['ok' => true, 'id' => $id], 201);
}

if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) {
        fail('id ontbreekt.', 422);
    }
    $input = json_input();
    $title = (string) require_field($input, 'title');
    $color = (string) ($input['color'] ?? 'goud');
    if (!in_array($color, $allowedColors, true)) {
        $color = 'goud';
    }

    $stmt = $pdo->prepare(
        'UPDATE passages SET title = :title, description = :description, audio_asset_id = :audio_asset_id,
         color = :color, page = :page, x_pct = :x_pct, y_pct = :y_pct, width_pct = :width_pct,
         height_pct = :height_pct, sort_order = :sort_order
         WHERE id = :id'
    );
    $stmt->execute([
        'title' => $title,
        'description' => $input['description'] ?? '',
        'audio_asset_id' => $input['audio_asset_id'] ?? null,
        'color' => $color,
        'page' => (int) ($input['page'] ?? 1),
        'x_pct' => (float) ($input['x_pct'] ?? 0),
        'y_pct' => (float) ($input['y_pct'] ?? 0),
        'width_pct' => (float) ($input['width_pct'] ?? 0),
        'height_pct' => (float) ($input['height_pct'] ?? 0),
        'sort_order' => (int) ($input['sort_order'] ?? 0),
        'id' => $id,
    ]);
    respond(['ok' => true]);
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) {
        fail('id ontbreekt.', 422);
    }
    $stmt = $pdo->prepare('DELETE FROM passages WHERE id = :id');
    $stmt->execute(['id' => $id]);
    respond(['ok' => true]);
}

fail('Methode niet toegestaan.', 405);
