# AIMES-AFRIQUE SOS DOCTEUR TV — Prérequis et installation complète

Ce document récapitule tout ce qu'il faut avoir en place pour que la
plateforme fonctionne, du strict minimum jusqu'à l'accès réseau pour
la secrétaire et le vigile. À garder de côté pour toute réinstallation
future ou installation sur un autre ordinateur.


## 1. Logiciels à installer sur l'ordinateur serveur

| Logiciel | Pourquoi | Où le télécharger |
|---|---|---|
| **Node.js** (version 18 ou plus récente) | Fait tourner le serveur (server.js) | https://nodejs.org (choisir la version "LTS") |
| **DB Browser for SQLite** | Pour créer/inspecter la base de données | https://sqlitebrowser.org/dl/ |

npm (le gestionnaire de paquets) est installé automatiquement avec Node.js — pas besoin de l'installer séparément.

**Vérifier que Node.js est bien installé**, dans une invite de commandes :
```
node -v
npm -v
```
Chaque commande doit afficher un numéro de version (ex: v20.11.0). Si "n'est pas reconnu en tant que commande", réinstalle Node.js et redémarre l'ordinateur.


## 2. Structure complète du projet

Tous les fichiers doivent se trouver dans **un seul et même dossier** (ex: `C:\Users\HP\Downloads\aimeafrique-SOS`) :

```
aimeafrique-SOS/
├── aimes-pointage.db          (la base de données)
├── server.js
├── start-server.bat
├── auth.js
├── permissions.js
├── employee-routes.js
├── dashboard-routes.js
├── users-routes.js
├── messages-routes.js
├── scan-handler.js
├── create-admin.js
├── node_modules/              (créé automatiquement par npm install)
├── package.json               (créé automatiquement par npm init)
└── public/
    ├── login.html
    ├── dashboard.html
    ├── employees.html
    ├── register-employee.html
    ├── edit-employee.html
    ├── attendance.html
    ├── logs.html
    ├── scan.html
    ├── card.html
    ├── users.html
    ├── photos/                (créé automatiquement au premier upload)
    └── img/
        ├── logo-aimes.png
        └── logo-sos.png
```

⚠️ **Piège fréquent : les extensions de fichiers cachées.** Windows masque les extensions par défaut. Si un fichier a été enregistré depuis un éditeur de texte simple, il peut s'appeler en réalité `auth.js.txt` tout en s'affichant comme `auth.js`. Pour vérifier : Explorateur Windows → onglet "Affichage" → cocher "Extensions de noms de fichiers". Si un fichier `.js` a un `.txt` caché derrière, renomme-le pour retirer le `.txt`.


## 3. Dépendances npm (bibliothèques utilisées par le code)

Dans le dossier du projet, une seule fois :
```
npm init -y
npm install express express-session bcrypt better-sqlite3 multer qrcode
```

Détail de ce que fait chaque paquet :
- **express** : le serveur web lui-même
- **express-session** : garde les utilisateurs connectés (cookies de session)
- **bcrypt** : chiffre les mots de passe (jamais stockés en clair)
- **better-sqlite3** : lit/écrit dans la base de données aimes-pointage.db
- **multer** : gère l'upload des photos d'employés
- **qrcode** : génère les QR codes des cartes employé

Si un module manque, l'erreur ressemble à `Error: Cannot find module 'xxx'` — relance `npm install` avec le nom du module manquant.


## 4. Base de données — création des tables

La base `aimes-pointage.db` doit contenir exactement 3 tables : `employees`, `pointages`, `users` (la table `employee_messages` de la messagerie RH se crée toute seule au premier démarrage du serveur, aucune action requise pour celle-là).

Si la base est vide ou si le serveur affiche une erreur `no such table`, ouvre `aimes-pointage.db` dans **DB Browser for SQLite**, onglet **"Exécuter SQL"**, colle et exécute ceci :

```sql
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  matricule TEXT,
  poste TEXT,
  telephone TEXT,
  photo TEXT,
  qr_code TEXT UNIQUE,
  date_debut_validite TEXT,
  date_fin_validite TEXT,
  date_creation TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS pointages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employe_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('entree', 'sortie')),
  date_heure TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (employe_id) REFERENCES employees(id)
);

CREATE INDEX IF NOT EXISTS idx_pointages_employe_date ON pointages (employe_id, date_heure);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'limite')),
  permissions TEXT NOT NULL DEFAULT '[]',
  date_creation TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
```

Puis **Fichier → Écrire les modifications** (obligatoire, sinon rien n'est sauvegardé).


## 5. Créer le premier compte administrateur

Dans le dossier du projet :
```
node create-admin.js admin "TonMotDePasse123!"
```
(remplace `admin` et le mot de passe par ce que tu veux — garde les guillemets si le mot de passe contient des caractères spéciaux)


## 6. Démarrer le serveur

**Méthode recommandée** : double-clique sur `start-server.bat`. Il :
- démarre le serveur
- affiche l'adresse à utiliser depuis cet ordinateur ET depuis un autre appareil sur le même Wi-Fi
- redémarre automatiquement le serveur s'il plante

**Méthode manuelle** (pour déboguer une erreur précise) :
```
node server.js
```

**Démarrage automatique au lancement de Windows** (facultatif) :
1. Windows + R → taper `shell:startup` → Entrée
2. Clic droit dans ce dossier → Nouveau → Raccourci → sélectionner `start-server.bat`
3. Le serveur démarre désormais tout seul à chaque ouverture de session Windows

Pour un fonctionnement 24h/24 même sans session ouverte, utiliser plutôt le **Planificateur de tâches Windows** avec un déclencheur "Au démarrage de l'ordinateur" et l'option "Exécuter que l'utilisateur soit connecté ou non".


## 7. Accès à la plateforme

- **Depuis l'ordinateur serveur** : http://localhost:3000/login.html
- **Depuis un autre appareil sur le même Wi-Fi** (téléphone, tablette, autre PC) : `http://ADRESSE-IP-DU-SERVEUR:3000/login.html`
  (⚠️ ne pas oublier `:3000` — sans le port, ça ne fonctionne pas)
  L'adresse IP exacte s'affiche automatiquement dans la fenêtre au démarrage via `start-server.bat`, ou peut être trouvée manuellement avec `ipconfig` (ligne "Adresse IPv4").

**Pour que d'autres appareils puissent se connecter**, il faut aussi :
1. Autoriser Node.js dans le pare-feu Windows : Panneau de configuration → Système et sécurité → Pare-feu Windows Defender → "Autoriser une application à traverser le pare-feu" → cocher Node.js pour les réseaux **Privé**
2. Idéalement, réserver une adresse IP fixe pour le PC serveur dans les paramètres du routeur, pour que l'adresse ne change pas à chaque redémarrage


## 8. Comptes utilisateurs et permissions

Depuis "Gérer les utilisateurs" (réservé aux admins), chaque compte à accès limité peut cocher indépendamment :

- Consulter la liste des employés
- Enregistrer de nouveaux employés
- Modifier les informations des employés
- Supprimer des employés
- Consulter la liste des présences
- Télécharger / exporter la liste des présences
- Scanner les badges (pointage entrée/sortie)
- Laisser des messages aux employés (RH)
- Créer, modifier et supprimer des comptes utilisateurs

Un compte **admin** a toujours accès à tout, sans avoir besoin de cocher quoi que ce soit.

Exemples de configuration typique :
- **Secrétaire** : Consulter + Enregistrer + Modifier les employés, Consulter + Télécharger les présences, Laisser des messages
- **Vigile** : Scanner les badges (uniquement)


## 9. Résolution des erreurs les plus courantes

| Message d'erreur | Cause probable | Solution |
|---|---|---|
| `Cannot find module './xxx'` | Fichier absent du dossier, ou mal nommé (extension cachée) | Vérifier avec `dir xxx*` dans le terminal, et l'affichage des extensions dans l'Explorateur |
| `Cannot GET /xxx.html` | Le fichier html n'est pas dans le dossier `public` | Vérifier son emplacement exact |
| `no such table: xxx` | La base de données ouverte n'a pas les bonnes tables (base vide ou mauvais fichier) | Revoir la section 4 ci-dessus |
| `'node' n'est pas reconnu...` | Node.js n'est pas installé, ou pas dans le PATH | Réinstaller Node.js, redémarrer l'ordinateur |
| Page inaccessible depuis un téléphone | Port `:3000` oublié dans l'URL, appareils pas sur le même Wi-Fi, ou pare-feu qui bloque | Revoir la section 7 |
| `Erreur de connexion au serveur` dans le navigateur | Le serveur a planté ou renvoyé une erreur non-JSON | Regarder le terminal où tourne `node server.js` pour voir le vrai message d'erreur |


## 10. Checklist avant la mise en service

- [ ] Node.js installé et vérifié (`node -v`)
- [ ] Tous les fichiers du projet présents dans un seul dossier (voir structure section 2)
- [ ] `npm install` exécuté sans erreur
- [ ] Les 3 tables (employees, pointages, users) existent dans aimes-pointage.db
- [ ] Compte admin créé avec `create-admin.js`
- [ ] `start-server.bat` démarre sans erreur et affiche les 2 adresses
- [ ] Connexion réussie sur http://localhost:3000/login.html
- [ ] Un employé test enregistré, sa carte s'affiche correctement
- [ ] Un scan test (arrivée + départ) fonctionne, avec son et carte affichée
- [ ] Accès testé depuis un téléphone sur le même Wi-Fi (avec `:3000`)
- [ ] Comptes secrétaire / vigile créés avec les bonnes permissions
- [ ] Pare-feu Windows configuré pour autoriser Node.js sur réseaux privés
