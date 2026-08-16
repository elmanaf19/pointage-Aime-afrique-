// users-routes.js
// Gestion complète des comptes utilisateurs (admin / accès limité) :
// création, consultation, modification (rôle, permissions, mot de passe), suppression.
//
// Intégration dans server.js :
//   const usersRouter = require('./users-routes')(db, requireAuth, requirePermission);
//   app.use(usersRouter);

const express = require('express');
const bcrypt = require('bcrypt');
const permissionsList = require('./permissions');

module.exports = function (db, requireAuth, requirePermission) {
  const router = express.Router();

  const listUsers = db.prepare(
    'SELECT id, username, role, permissions, date_creation FROM users ORDER BY username'
  );
  const getUserById = db.prepare(
    'SELECT id, username, role, permissions, date_creation FROM users WHERE id = ?'
  );
  const findByUsername = db.prepare('SELECT id FROM users WHERE username = ?');
  const insertUser = db.prepare(`
    INSERT INTO users (username, password_hash, role, permissions)
    VALUES (?, ?, ?, ?)
  `);
  const updateUserRolePerms = db.prepare('UPDATE users SET role = ?, permissions = ? WHERE id = ?');
  const updateUsername = db.prepare('UPDATE users SET username = ? WHERE id = ?');
  const updateUserPassword = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
  const deleteUserStmt = db.prepare('DELETE FROM users WHERE id = ?');
  const countAdmins = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin'`);

  function sanitizePermissions(role, permissions) {
    if (role === 'admin') return [];
    const validKeys = Object.keys(permissionsList);
    return Array.isArray(permissions) ? permissions.filter(p => validKeys.includes(p)) : [];
  }

  // Catalogue des permissions (pour construire les cases à cocher côté écran)
  router.get('/api/permissions', requireAuth, requirePermission('gerer_utilisateurs'), (req, res) => {
    res.json({ ok: true, permissions: permissionsList });
  });

  // Liste des comptes
  router.get('/api/users', requireAuth, requirePermission('gerer_utilisateurs'), (req, res) => {
    const rows = listUsers.all().map(u => ({ ...u, permissions: JSON.parse(u.permissions || '[]') }));
    res.json({ ok: true, users: rows });
  });

  // Fiche d'un compte (pré-remplissage du formulaire de modification)
  router.get('/api/users/:id', requireAuth, requirePermission('gerer_utilisateurs'), (req, res) => {
    const u = getUserById.get(req.params.id);
    if (!u) return res.status(404).json({ ok: false, error: 'Utilisateur introuvable' });
    res.json({ ok: true, user: { ...u, permissions: JSON.parse(u.permissions || '[]') } });
  });

  // Création
  router.post('/api/users', requireAuth, requirePermission('gerer_utilisateurs'), async (req, res) => {
    try {
      const { username, password, role, permissions } = req.body;

      if (!username || !username.trim()) {
        return res.status(400).json({ ok: false, error: "Le nom d'utilisateur est obligatoire" });
      }
      if (!password || password.length < 6) {
        return res.status(400).json({ ok: false, error: 'Le mot de passe doit contenir au moins 6 caractères' });
      }
      if (role !== 'admin' && role !== 'limite') {
        return res.status(400).json({ ok: false, error: 'Rôle invalide' });
      }
      if (findByUsername.get(username.trim())) {
        return res.status(409).json({ ok: false, error: "Ce nom d'utilisateur existe déjà" });
      }

      const hash = await bcrypt.hash(password, 10);
      const perms = sanitizePermissions(role, permissions);

      const result = insertUser.run(username.trim(), hash, role, JSON.stringify(perms));
      res.json({ ok: true, id: result.lastInsertRowid });
    } catch (err) {
      console.error('Erreur création utilisateur :', err);
      res.status(500).json({ ok: false, error: 'Erreur serveur lors de la création du compte' });
    }
  });

  // Modification (rôle, permissions, nom d'utilisateur, et mot de passe si fourni)
  router.put('/api/users/:id', requireAuth, requirePermission('gerer_utilisateurs'), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = getUserById.get(id);
      if (!existing) {
        return res.status(404).json({ ok: false, error: 'Utilisateur introuvable' });
      }

      const { username, password, role, permissions } = req.body;

      if (role !== 'admin' && role !== 'limite') {
        return res.status(400).json({ ok: false, error: 'Rôle invalide' });
      }
      if (existing.role === 'admin' && role !== 'admin' && countAdmins.get().n <= 1) {
        return res.status(400).json({ ok: false, error: 'Impossible de rétrograder le dernier compte admin' });
      }

      if (username && username.trim() && username.trim() !== existing.username) {
        if (findByUsername.get(username.trim())) {
          return res.status(409).json({ ok: false, error: "Ce nom d'utilisateur existe déjà" });
        }
        updateUsername.run(username.trim(), id);
      }

      const perms = sanitizePermissions(role, permissions);
      updateUserRolePerms.run(role, JSON.stringify(perms), id);

      if (password && password.trim()) {
        if (password.length < 6) {
          return res.status(400).json({ ok: false, error: 'Le mot de passe doit contenir au moins 6 caractères' });
        }
        const hash = await bcrypt.hash(password, 10);
        updateUserPassword.run(hash, id);
      }

      res.json({ ok: true });
    } catch (err) {
      console.error('Erreur modification utilisateur :', err);
      res.status(500).json({ ok: false, error: 'Erreur serveur lors de la modification' });
    }
  });

  // Suppression
  router.delete('/api/users/:id', requireAuth, requirePermission('gerer_utilisateurs'), (req, res) => {
    const id = Number(req.params.id);
    const target = getUserById.get(id);

    if (!target) {
      return res.status(404).json({ ok: false, error: 'Utilisateur introuvable' });
    }
    if (req.session.user.id === id) {
      return res.status(400).json({ ok: false, error: 'Impossible de supprimer votre propre compte' });
    }
    if (target.role === 'admin' && countAdmins.get().n <= 1) {
      return res.status(400).json({ ok: false, error: 'Impossible de supprimer le dernier compte admin' });
    }

    deleteUserStmt.run(id);
    res.json({ ok: true });
  });

  return router;
};
