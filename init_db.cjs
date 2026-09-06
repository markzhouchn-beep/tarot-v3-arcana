const Database = require("/var/www/tarot-app-v3/server/node_modules/better-sqlite3");
const fs = require("fs");
const db = new Database("/var/www/tarot-app-v3/server/data/tarot_v3.db");
db.exec(fs.readFileSync("/var/www/tarot-app-v3/scripts/schema.sql", "utf8"));
console.log("schema OK");
db.exec(fs.readFileSync("/var/www/tarot-app-v3/scripts/migrate_phase5_6.sql", "utf8"));
console.log("phase5_6 OK");
db.close();
console.log("DB init complete");
