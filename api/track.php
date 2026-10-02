<?php
// Eigen, minimale bezoekregistratie (zie README/DEPLOYMENT.md): hits +
// geschatte unieke bezoekers, per stuk en per dag. Anoniem — alleen een
// willekeurig apparaat-ID dat de browser zelf in localStorage bewaart,
// geen naam/e-mail/IP.
//
// Let op de omgekeerde rechtenverdeling t.o.v. de rest van de API: hier
// is SCHRIJVEN (een bezoek loggen) juist bewust publiek, want dat doen
// gewone sitebezoekers — LEZEN (de statistieken) vereist een ingelogde
// beheerder.
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';

$ALLOWED_PATHS = ['index', 'viewer'];

$method = $_SERVER['REQUEST_METHOD'];
$pdo = db();

if ($method === 'POST') {
    $input = json_input();
    $path = (string) ($input['path'] ?? '');
    if (!in_array($path, $ALLOWED_PATHS, true)) {
        fail('Ongeldig pad.', 422);
    }
    $visitorId = (string) require_field($input, 'visitor_id');
    $pieceId = $input['piece_id'] ?? null;

    $stmt = $pdo->prepare(
        'INSERT INTO page_views (id, path, piece_id, visitor_id) VALUES (:id, :path, :piece_id, :visitor_id)'
    );
    try {
        $stmt->execute([
            'id' => uuidv4(),
            'path' => $path,
            'piece_id' => $pieceId,
            'visitor_id' => $visitorId,
        ]);
    } catch (PDOException $e) {
        // Bijv. een piece_id dat niet (meer) bestaat — een bezoek dat niet
        // gelogd kon worden mag de pagina van de bezoeker niet verstoren.
        respond(['ok' => false]);
    }
    respond(['ok' => true], 201);
}

if ($method === 'GET') {
    require_admin();
    $stmt = $pdo->query('SELECT path, piece_id, visitor_id, created_at FROM page_views ORDER BY created_at ASC');
    respond($stmt->fetchAll());
}

fail('Methode niet toegestaan.', 405);
