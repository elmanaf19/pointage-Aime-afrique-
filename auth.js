// auth.js
// Connexion (login), déconnexion, et contrôle des permissions.
//
// Prérequis :
//   npm install express-session bcrypt
//
// Intégration dans server.js :
//
//   const session = require('express-session');
//   app.use(session({
//     secret: 'change-moi-en-une-longue-phrase-aleatoire',
//     resave: false,
//     saveUninitialized: false,
//     cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8h
//   }));
//
//   const { router: authRouter, requireAuth, requirePermission } = require('./auth')(db);
//   app.use(authRouter);
//
//   // Exemple de route protégée, réservée à ceux qui ont la permission "enregistrer_employes" :
//   app.post('/api/employees', requireAuth, requirePermission('enregistrer_employes'), (req, res) => { ... });
//
//   // Exemple de route réservée strictement à l'admin :
//   app.post('/api/users', requireAuth, requirePermission('gerer_utilisateurs'), (req, res) => { ... });

const express = require('express');
const bcrypt = require('bcrypt');

module.exports = function (db) {
  const router = express.Router();

  const findUser = db.prepare('SELECT * FROM users WHERE username = ?');

  router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = findUser.get(username);

    if (!user) {
      return res.status(401).json({ ok: false, error: 'Identifiants invalides' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ ok: false, error: 'Identifiants invalides' });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      permissions: JSON.parse(user.permissions || '[]'),
    };

    res.json({ ok: true, user: req.session.user });
  });

  router.post('/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  router.get('/api/me', (req, res) => {
    if (!req.session.user) return res.status(401).json({ ok: false });
    res.json({ ok: true, user: req.session.user });
  });

  function requireAuth(req, res, next) {
    if (!req.session.user) {
      return res.status(401).json({ ok: false, error: 'Non connecté' });
    }
    next();
  }

  function requirePermission(key) {
    return (req, res, next) => {
      const user = req.session.user;
      if (!user) return res.status(401).json({ ok: false, error: 'Non connecté' });
      if (user.role === 'admin' || user.permissions.includes(key)) {
        return next();
      }
      return res.status(403).json({ ok: false, error: 'Accès refusé' });
    };
  }

  return { router, requireAuth, requirePermission };
};
