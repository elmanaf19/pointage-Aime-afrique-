// dashboard-routes.js
// Statistiques du tableau de bord + consultation et export des présences.

const express = require('express');

module.exports = function (db, requireAuth, requirePermission) {
  const router = express.Router();

  const countEmployees = db.prepare('SELECT COUNT(*) AS n FROM employees');

  const countTodayByType = db.prepare(`
    SELECT type, COUNT(*) AS n
    FROM pointages
    WHERE date(date_heure) = date('now', 'localtime')
    GROUP BY type
  `);

  const presentNow = db.prepare(`
    SELECT COUNT(*) AS n FROM (
      SELECT employe_id, type,
        ROW_NUMBER() OVER (PARTITION BY employe_id ORDER BY date_heure DESC) AS rn
      FROM pointages
      WHERE date(date_heure) = date('now', 'localtime')
    )
    WHERE rn = 1 AND type = 'entree'
  `);

  function buildLogsQuery(query) {
    const { date, from, to, q, type } = query;

    let sql = `
      SELECT p.id, p.type, p.date_heure,
             e.id AS employee_id, e.nom, e.matricule, e.poste, e.photo
      FROM pointages p
      JOIN employees e ON e.id = p.employe_id
      WHERE 1=1
    `;
    const params = [];

    if (date) {
      sql += ' AND date(p.date_heure) = ?';
      params.push(date);
    } else if (from && to) {
      sql += ' AND date(p.date_heure) BETWEEN ? AND ?';
      params.push(from, to);
    }

    if (type === 'entree' || type === 'sortie') {
      sql += ' AND p.type = ?';
      params.push(type);
    }

    if (q && q.trim()) {
      sql += ' AND (e.nom LIKE ? OR e.matricule LIKE ?)';
      params.push(`%${q.trim()}%`, `%${q.trim()}%`);
    }

    sql += ' ORDER BY p.date_heure DESC';
    return { sql, params };
  }

  router.get('/api/dashboard/stats', requireAuth, requirePermission('voir_presences'), (req, res) => {
    const totalEmployees = countEmployees.get().n;
    const todayRows = countTodayByType.all();
    const arrivals = (todayRows.find(r => r.type === 'entree') || {}).n || 0;
    const departures = (todayRows.find(r => r.type === 'sortie') || {}).n || 0;
    const present = presentNow.get().n;

    res.json({ ok: true, stats: { totalEmployees, arrivals, departures, present } });
  });

  router.get('/api/logs', requireAuth, requirePermission('voir_presences'), (req, res) => {
    const { sql, params } = buildLogsQuery(req.query);
    const rows = db.prepare(sql + ' LIMIT 500').all(...params);
    res.json({ ok: true, logs: rows });
  });

  router.get('/api/logs/export', requireAuth, requirePermission('exporter_rapports'), (req, res) => {
    try {
      const { sql, params } = buildLogsQuery(req.query);
      const rows = db.prepare(sql).all(...params);

      const escCsv = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;

      const header = ['Nom', 'Matricule', 'Poste', 'Type', 'Date', 'Heure'];
      const lines = [header.map(escCsv).join(';')];

      rows.forEach(r => {
        const d = new Date(r.date_heure.replace(' ', 'T'));
        const dateStr = isNaN(d) ? r.date_heure : d.toLocaleDateString('fr-FR');
        const heureStr = isNaN(d) ? '' : d.toLocaleTimeString('fr-FR');
        const typeStr = r.type === 'entree' ? 'Arrivée' : 'Départ';
        lines.push([r.nom, r.matricule, r.poste, typeStr, dateStr, heureStr].map(escCsv).join(';'));
      });

      const csv = '\uFEFF' + lines.join('\r\n');
      const today = new Date().toISOString().slice(0, 10);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="presences_${today}.csv"`);
      res.send(csv);
    } catch (err) {
      console.error('Erreur export CSV :', err);
      res.status(500).json({ ok: false, error: "Erreur lors de la génération de l'export" });
    }
  });

  return router;
};
