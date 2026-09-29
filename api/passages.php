<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';

function passage_out(array $row, array $rects): array
{
    return [
        'id' => $row['id'],
        'piece_id' => $row['piece_id'],
        'title' => $row['title'],
        'description' => $row['description'],
        'audio_asset_id' => $row['audio_asset_id'],
        'audio_asset' => $row['audio_storage_path'] !== null ? ['storage_path' => $row['audio_storage_path']] : null,
        'color' => $row['color'],
        'sort_order' => (int) $row['sort_order'],
        'created_at' => $row['created_at'],
        'rects' => array_map(function (array $r): array {
            return [
                'page' => (int) $r['page'],
                'x_pct' => (float) $r['x_pct'],
                'y_pct' => (float) $r['y_pct'],
                'width_pct' => (float) $r['width_pct'],
                'height_pct' => (float) $r['height_pct'],
            ];
        }, $rects),
    ];
}

// Haalt de vakken van meerdere passages in één query op, gegroepeerd per
// passage_id — voorkomt een N+1-query per passage in de lijstweergave.
function fetch_rects_by_passage(PDO $pdo, array $passageIds): array
{
    if (count($passageIds) === 0) {
        return [];
    }
    $placeholders = implode(',', array_fill(0, count($passageIds), '?'));
    $stmt = $pdo->prepare(
        "SELECT * FROM passage_rects WHERE passage_id IN ($placeholders) ORDER BY passage_id, sort_order ASC"
    );
    $stmt->execute($passageIds);
    $grouped = [];
    foreach ($stmt->fetchAll() as $rect) {
        $grouped[$rect['passage_id']][] = $rect;
    }
    return $grouped;
}

// Vervangt alle vakken van een passage door de gegeven lijst — eenvoudiger
// en met zo weinig vakken per passage snel genoeg, in plaats van individuele
// vakken te diffen.
function replace_rects(PDO $pdo, string $passageId, array $rects): void
{
    $del = $pdo->prepare('DELETE FROM passage_rects WHERE passage_id = :passage_id');
    $del->execute(['passage_id' => $passageId]);

    $stmt = $pdo->prepare(
        'INSERT INTO passage_rects (id, passage_id, page, x_pct, y_pct, width_pct, height_pct, sort_order)
         VALUES (:id, :passage_id, :page, :x_pct, :y_pct, :width_pct, :height_pct, :sort_order)'
    );
    $order = 0;
    foreach ($rects as $rect) {
        $stmt->execute([
            'id' => uuidv4(),
            'passage_id' => $passageId,
            'page' => (int) ($rect['page'] ?? 1),
            'x_pct' => (float) ($rect['x_pct'] ?? 0),
            'y_pct' => (float) ($rect['y_pct'] ?? 0),
            'width_pct' => (float) ($rect['width_pct'] ?? 0),
            'height_pct' => (float) ($rect['height_pct'] ?? 0),
            'sort_order' => $order++,
        ]);
    }
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
    $rows = $stmt->fetchAll();
    $rectsByPassage = fetch_rects_by_passage($pdo, array_column($rows, 'id'));
    respond(array_map(
        fn(array $row) => passage_out($row, $rectsByPassage[$row['id']] ?? []),
        $rows
    ));
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
    $rects = is_array($input['rects'] ?? null) ? $input['rects'] : [];
    if (count($rects) === 0) {
        fail('Minstens één vak (rechthoek) op de bladmuziek is verplicht.', 422);
    }
    $id = uuidv4();

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            'INSERT INTO passages (id, piece_id, title, description, audio_asset_id, color, sort_order)
             VALUES (:id, :piece_id, :title, :description, :audio_asset_id, :color, :sort_order)'
        );
        $stmt->execute([
            'id' => $id,
            'piece_id' => $pieceId,
            'title' => $title,
            'description' => $input['description'] ?? '',
            'audio_asset_id' => $input['audio_asset_id'] ?? null,
            'color' => $color,
            'sort_order' => (int) ($input['sort_order'] ?? 0),
        ]);
        replace_rects($pdo, $id, $rects);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
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
    $rects = is_array($input['rects'] ?? null) ? $input['rects'] : [];
    if (count($rects) === 0) {
        fail('Minstens één vak (rechthoek) op de bladmuziek is verplicht.', 422);
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            'UPDATE passages SET title = :title, description = :description, audio_asset_id = :audio_asset_id,
             color = :color, sort_order = :sort_order
             WHERE id = :id'
        );
        $stmt->execute([
            'title' => $title,
            'description' => $input['description'] ?? '',
            'audio_asset_id' => $input['audio_asset_id'] ?? null,
            'color' => $color,
            'sort_order' => (int) ($input['sort_order'] ?? 0),
            'id' => $id,
        ]);
        replace_rects($pdo, $id, $rects);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
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
