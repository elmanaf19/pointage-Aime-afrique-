
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');

const [, , username, password] = process.argv;

if (!username || !password) {
  console.log('Usage : node create-admin.js <nom_utilisateur> <mot_de_passe>');
  process.exit(1);
}

const db = new Database('aimes-pointage.db'); // adapte le chemin si besoin

const hash = bcrypt.hashSync(password, 10);

db.prepare(`
  INSERT INTO users (username, password_hash, role, permissions)
  VALUES (?, ?, 'admin', '[]')
`).run(username, hash);

console.log(`Compte admin "${username}" créé avec succès.`);
