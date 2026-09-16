<?php
require_once __DIR__ . '/auth.php';

respond(['loggedIn' => is_logged_in()]);
