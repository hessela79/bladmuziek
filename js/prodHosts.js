// Eén plek voor het productiedomein, gebruikt door js/apiClient.js om de
// juiste backend te kiezen (PHP + MariaDB op productie, Supabase overal
// elders). Gewone (niet-module) <script>, zodat dit synchroon en vóór
// alle andere scripts gelezen kan worden.
window.NOTENMAP_PRODUCTION_HOSTS = ["hjk.hartvolmuziek.nl"];
