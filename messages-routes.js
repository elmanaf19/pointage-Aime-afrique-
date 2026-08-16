// messages-routes.js
// Messages destinés aux employés (ex: "Vous êtes demandé au secrétariat"),
// avec durée configurable (1 à 5 jours) et désactivation manuelle.
//
// La table est créée automatiquement au premier démarrage — aucune
// manipulation SQL manuelle n'est nécessaire.
//
// Intégration dans server.js :
//   const messagesRouter = require('./messages-routes')(db, requireAuth, requirePermission);
//   app.use(messagesRouter);
// IMPORTANT : à charger AVANT scan-handler.js dans server.js, pour que la
// table existe déjà quand scan-handler prépare ses requêtes.

const express = require('express');

module.exports = function (db, requireAuth, requirePermission) {
  const router = express.Router();

  db.exec(`
    CREATE TABLE IF NOT EXISTS employee_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employe_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      date_creation TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      date_expiration TEXT NOT NULL,
      actif INTEGER NOT NULL DEFAULT 1,
      created_by TEXT,
      FOREIGN KEY (employe_id) REFERENCES employees(id)
    )
  `);

  const getActiveMessage = db.prepare(`
    SELECT * FROM employee_messages
    WHERE employe_id = ? AND actif = 1 AND date_expiration >= datetime('now', 'localtime')
    ORDER BY date_creation DESC
    LIMIT 1
  `);
  const insertMessage = db.prepare(`
    INSERT INTO employee_messages (employe_id, message, date_expiration, created_by)
    VALUES (?, ?, datetime('now', 'localtime', '+' || ? || ' days'), ?)
  `);
  const deactivateActive = db.prepare(`
    UPDATE employee_messages SET actif = 0 WHERE employe_id = ? AND actif = 1
  `);

  // Message actif pour un employé (utilisé notamment lors du scan de badge)
  router.get('/api/employees/:id/message', requireAuth, (req, res) => {
    const msg = getActiveMessage.get(req.params.id);
    res.json({ ok: true, message: msg || null });
  });

  // Créer / remplacer le message actif d'un employé
  router.post('/api/employees/:id/message', requireAuth, requirePermission('envoyer_messages'), (req, res) => {
    try {
      const { message, dureeJours } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({ ok: false, error: 'Le message est obligatoire' });
      }
      const duree = Number(dureeJours);
      if (![1, 2, 3, 4, 5].includes(duree)) {
        return res.status(400).json({ ok: false, error: 'Durée invalide (choisir entre 1 et 5 jours)' });
      }

      // Un seul message actif à la fois par employé
      deactivateActive.run(req.params.id);

      insertMessage.run(req.params.id, message.trim(), duree, req.session.user.username);

      res.json({ ok: true });
    } catch (err) {
      console.error('Erreur création message :', err);
      res.status(500).json({ ok: false, error: 'Erreur serveur lors de la création du message' });
    }
  });

  // Désactiver manuellement le message actif ("problème réglé")
  router.delete('/api/employees/:id/message', requireAuth, requirePermission('envoyer_messages'), (req, res) => {
    deactivateActive.run(req.params.id);
    res.json({ ok: true });
  });

  return router;
};
