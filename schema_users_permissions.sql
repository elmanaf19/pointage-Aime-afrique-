-- Migration : comptes utilisateurs (admin / accès limité) + validité des cartes
-- À exécuter sur la base SQLite existante (aimes-pointage)

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'limite')),
  -- Liste des permissions au format JSON, ex: ["voir_presences","enregistrer_employes"]
  -- Ignoré si role = 'admin' (l'admin a tout, toujours)
  permissions TEXT NOT NULL DEFAULT '[]',
  date_creation TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Champs à ajouter à la table employees existante (si pas déjà présents)
ALTER TABLE employees ADD COLUMN matricule TEXT;
ALTER TABLE employees ADD COLUMN poste TEXT;
ALTER TABLE employees ADD COLUMN telephone TEXT;
ALTER TABLE employees ADD COLUMN date_debut_validite TEXT;
ALTER TABLE employees ADD COLUMN date_fin_validite TEXT;
ALTER TABLE employees ADD COLUMN date_creation TEXT DEFAULT (datetime('now', 'localtime'));

-- Note SQLite : si une colonne existe déjà, la commande ALTER TABLE correspondante
-- renverra une erreur "duplicate column name" — dans ce cas, ignore juste cette ligne
-- et exécute les autres une par une.
