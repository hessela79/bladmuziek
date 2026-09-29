// Eén plek voor het productiedomein, gedeeld door js/apiClient.js (welke
// backend te gebruiken) en js/devGate.js (of de testomgeving-popup moet
// verschijnen). Gewone (niet-module) <script>, zodat devGate.js dit
// synchroon en vóór alle andere scripts kan lezen.
window.NOTENMAP_PRODUCTION_HOSTS = ["hjk.hartvolmuziek.nl"];
