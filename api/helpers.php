<?php
// Gedeelde hulpfuncties voor alle API-endpoints.

header('Content-Type: application/json; charset=utf-8');

function json_input(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function respond($data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

function fail(string $message, int $status = 400): void
{
    respond(['error' => $message], $status);
}

function uuidv4(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function bool_to_int($value): int
{
    return $value ? 1 : 0;
}

function require_field(array $input, string $key)
{
    if (!array_key_exists($key, $input) || $input[$key] === null || $input[$key] === '') {
        fail("Veld \"$key\" ontbreekt.", 422);
    }
    return $input[$key];
}
