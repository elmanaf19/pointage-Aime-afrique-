// scan-handler.js
// À brancher sur ton serveur Express existant (aimes-pointage).
//
// Intégration :
//   const scanHandler = require('./scan-handler')(db);
//   app.post('/api/scan', requireAuth, scanHandler);
//
// `db` = ton instance better-sqlite3 déjà ouverte sur aimes-pointage.db
//
// IMPORTANT : à charger APRÈS messages-routes.js dans server.js, pour que
// la table employee_messages existe déjà quand ce fichier prépare sa requête.

const QRCode = require('qrcode');

module.exports = function scanHandler(db) {
  const findEmployee = db.prepare(
    'SELECT * FROM employees WHERE qr_code = ? OR id = ?'
  );

  const lastPointageToday = db.prepare(`
    SELECT * FROM pointages
    WHERE employe_id = ?
      AND date(date_heure) = date('now', 'localtime')
    ORDER BY date_heure DESC
    LIMIT 1
  `);

  const insertPointage = db.prepare(`
    INSERT INTO pointages (employe_id, type, date_heure)
    VALUES (?, ?, datetime('now', 'localtime'))
  `);

  const getActiveMessage = db.prepare(`
    SELECT message, date_expiration FROM employee_messages
    WHERE employe_id = ? AND actif = 1 AND date_expiration >= datetime('now', 'localtime')
    ORDER BY date_creation DESC
    LIMIT 1
  `);

  return async function handleScan(req, res) {
    try {
      const { code } = req.body;

      if (!code || !code.trim()) {
        return res.status(400).json({ ok: false, error: 'Code vide' });
      }

      const cleanCode = code.trim();

      const employee = findEmployee.get(cleanCode, cleanCode);
      if (!employee) {
        return res.status(404).json({ ok: false, error: 'Employé introuvable' });
      }

      const today = new Date().toISOString().slice(0, 10);
      if (employee.date_debut_validite && today < employee.date_debut_validite) {
        return res.status(403).json({ ok: false, error: 'Carte pas encore valide' });
      }
      if (employee.date_fin_validite && today > employee.date_fin_validite) {
        return res.status(403).json({ ok: false, error: 'Carte expirée' });
      }

      const last = lastPointageToday.get(employee.id);
      const nextType = (!last || last.type === 'sortie') ? 'entree' : 'sortie';

      insertPointage.run(employee.id, nextType);

      // QR code + infos complètes pour afficher la carte recto/verso à l'écran de scan
      const qrDataUrl = await QRCode.toDataURL(employee.qr_code, { width: 300, margin: 1 });
      const activeMessage = getActiveMessage.get(employee.id);

      return res.json({
        ok: true,
        employee: {
          id: employee.id,
          nom: employee.nom,
          matricule: employee.matricule,
          poste: employee.poste,
          telephone: employee.telephone,
          photo: employee.photo,
          date_debut_validite: employee.date_debut_validite,
          date_fin_validite: employee.date_fin_validite,
        },
        qrDataUrl,
        type: nextType,
        heure: new Date().toLocaleTimeString('fr-FR'),
        message: activeMessage || null,
      });
    } catch (err) {
      console.error('Erreur scan :', err);
      return res.status(500).json({ ok: false, error: 'Erreur serveur lors du scan' });
    }
  };
};
