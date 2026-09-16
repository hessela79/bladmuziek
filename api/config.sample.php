<?php
// Kopieer dit bestand naar config.php (in dezelfde map) en vul je eigen
// gegevens in. config.php staat in .gitignore en komt dus NOOIT in git
// terecht — dat is bewust, want hierin staan echte wachtwoorden.

return [
    'db' => [
        'host' => 'localhost',
        'name' => 'jouw_database_naam',
        'user' => 'jouw_database_gebruiker',
        'pass' => 'jouw_database_wachtwoord',
    ],

    // Wachtwoord-hash voor het beheerscherm (admin.html). Genereer 'm met
    // onderstaand commando (vul je eigen wachtwoord in) en plak de uitkomst
    // hieronder:
    //
    //   php -r "echo password_hash('jouw-wachtwoord', PASSWORD_DEFAULT), PHP_EOL;"
    //
    'admin_password_hash' => '$2y$10$vul.hier.de.uitkomst.van.bovenstaand.commando.in............',
];
