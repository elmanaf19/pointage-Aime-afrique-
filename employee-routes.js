// employee-routes.js
// Enregistrement, consultation, modification, suppression des employés,
// génération de carte (QR) et statistiques d'assiduité mensuelle.
//
// Prérequis :
//   npm install multer qrcode
//
// Intégration dans server.js :
//   const employeeRouter = require('./employee-routes')(db, requireAuth, requirePermission);
//   app.use(employeeRouter);

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const QRCode = require('qrcode');

const photosDir = path.join(__dirname, 'public', 'photos');
fs.mkdirSync(photosDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, photosDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
  },
});
const upload = multer({ storage });

module.exports = function (db, requireAuth, requirePermission) {
  const router = express.Router();

  const insertEmployee = db.prepare(`
    INSERT INTO employees
      (nom, matricule, poste, telephone, photo, qr_code, date_debut_validite, date_fin_validite)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const getEmployee = db.prepare('SELECT * FROM employees WHERE id = ?');
  const listEmployees = db.prepare('SELECT * FROM employees ORDER BY nom');
  const deleteEmployeeStmt = db.prepare('DELETE FROM employees WHERE id = ?');
  const deletePointagesForEmployee = db.prepare('DELETE FROM pointages WHERE employe_id = ?');
  const countPointagesForEmployee = db.prepare('SELECT COUNT(*) AS n FROM pointages WHERE employe_id = ?');

  const updateEmployeeWithPhoto = db.prepare(`
    UPDATE employees
    SET nom = ?, matricule = ?, poste = ?, telephone = ?,
        date_debut_validite = ?, date_fin_validite = ?, photo = ?
    WHERE id = ?
  `);
  const updateEmployeeNoPhoto = db.prepare(`
    UPDATE employees
    SET nom = ?, matricule = ?, poste = ?, telephone = ?,
        date_debut_validite = ?, date_fin_validite = ?
    WHERE id = ?
  `);

  // ---------- Création ----------
  router.post(
    '/api/employees',
    requireAuth,
    requirePermission('creer_employes'),
    upload.single('photo'),
    (req, res) => {
      try {
        const { nom, matricule, poste, telephone, date_debut_validite, date_fin_validite } = req.body;

        if (!nom || !nom.trim()) {
          return res.status(400).json({ ok: false, error: 'Le nom est obligatoire' });
        }

        const qrCode = (matricule && matricule.trim()) || crypto.randomUUID();
        const photoPath = req.file ? `/photos/${req.file.filename}` : null;

        const result = insertEmployee.run(
          nom.trim(),
          matricule ? matricule.trim() : null,
          poste || null,
          telephone || null,
          photoPath,
          qrCode,
          date_debut_validite || null,
          date_fin_validite || null
        );

        res.json({ ok: true, employeeId: result.lastInsertRowid });
      } catch (err) {
        console.error('Erreur création employé :', err);
        res.status(500).json({ ok: false, error: "Erreur serveur lors de l'enregistrement" });
      }
    }
  );

  // ---------- Liste ----------
  router.get('/api/employees', requireAuth, requirePermission('voir_employes'), (req, res) => {
    res.json({ ok: true, employees: listEmployees.all() });
  });

  // ---------- Fiche d'un employé (pré-remplissage du formulaire de modification) ----------
  router.get('/api/employees/:id', requireAuth, requirePermission('voir_employes'), (req, res) => {
    const employee = getEmployee.get(req.params.id);
    if (!employee) {
      return res.status(404).json({ ok: false, error: 'Employé introuvable' });
    }
    res.json({ ok: true, employee });
  });

  // ---------- Modification ----------
  // Le qr_code n'est jamais modifié ici, même si le matricule change,
  // pour ne pas invalider une carte déjà imprimée.
  router.put(
    '/api/employees/:id',
    requireAuth,
    requirePermission('modifier_employes'),
    upload.single('photo'),
    (req, res) => {
      try {
        const id = req.params.id;
        const existing = getEmployee.get(id);
        if (!existing) {
          return res.status(404).json({ ok: false, error: 'Employé introuvable' });
        }

        const { nom, matricule, poste, telephone, date_debut_validite, date_fin_validite } = req.body;
        if (!nom || !nom.trim()) {
          return res.status(400).json({ ok: false, error: 'Le nom est obligatoire' });
        }

        if (req.file) {
          updateEmployeeWithPhoto.run(
            nom.trim(),
            matricule ? matricule.trim() : null,
            poste || null,
            telephone || null,
            date_debut_validite || null,
            date_fin_validite || null,
            `/photos/${req.file.filename}`,
            id
          );
          if (existing.photo) {
            const oldFile = path.join(__dirname, 'public', existing.photo.replace(/^\//, ''));
            fs.unlink(oldFile, () => {});
          }
        } else {
          updateEmployeeNoPhoto.run(
            nom.trim(),
            matricule ? matricule.trim() : null,
            poste || null,
            telephone || null,
            date_debut_validite || null,
            date_fin_validite || null,
            id
          );
        }

        res.json({ ok: true });
      } catch (err) {
        console.error('Erreur modification employé :', err);
        res.status(500).json({ ok: false, error: 'Erreur serveur lors de la modification' });
      }
    }
  );

  // ---------- Compteur de pointages (avertissement avant suppression) ----------
  router.get(
    '/api/employees/:id/pointage-count',
    requireAuth,
    requirePermission('supprimer_employes'),
    (req, res) => {
      const employee = getEmployee.get(req.params.id);
      if (!employee) {
        return res.status(404).json({ ok: false, error: 'Employé introuvable' });
      }
      const count = countPointagesForEmployee.get(req.params.id).n;
      res.json({ ok: true, count });
    }
  );

  // ---------- Suppression ----------
  router.delete(
    '/api/employees/:id',
    requireAuth,
    requirePermission('supprimer_employes'),
    (req, res) => {
      try {
        const id = req.params.id;
        const employee = getEmployee.get(id);
        if (!employee) {
          return res.status(404).json({ ok: false, error: 'Employé introuvable' });
        }

        const deleteAll = db.transaction(() => {
          deletePointagesForEmployee.run(id);
          deleteEmployeeStmt.run(id);
        });
        deleteAll();

        if (employee.photo) {
          const photoFile = path.join(__dirname, 'public', employee.photo.replace(/^\//, ''));
          fs.unlink(photoFile, () => {});
        }

        res.json({ ok: true });
      } catch (err) {
        console.error('Erreur suppression employé :', err);
        res.status(500).json({ ok: false, error: 'Erreur serveur lors de la suppression' });
      }
    }
  );

  // ---------- Carte (recto/verso) ----------
  router.get('/api/employees/:id/card', requireAuth, async (req, res) => {
    try {
      const employee = getEmployee.get(req.params.id);
      if (!employee) {
        return res.status(404).json({ ok: false, error: 'Employé introuvable' });
      }

      const qrDataUrl = await QRCode.toDataURL(employee.qr_code, { width: 300, margin: 1 });

      res.json({
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
      });
    } catch (err) {
      console.error('Erreur génération carte :', err);
      res.status(500).json({ ok: false, error: 'Erreur serveur lors de la génération de la carte' });
    }
  });

  // ---------- Assiduité mensuelle (calendrier vert/rouge/neutre) ----------
  // GET /api/employees/:id/attendance?month=AAAA-MM
  router.get(
    '/api/employees/:id/attendance',
    requireAuth,
    requirePermission('voir_presences'),
    (req, res) => {
      const employee = getEmployee.get(req.params.id);
      if (!employee) {
        return res.status(404).json({ ok: false, error: 'Employé introuvable' });
      }

      const month = req.query.month;
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ ok: false, error: 'Paramètre "month" invalide (format attendu : AAAA-MM)' });
      }

      const [y, m] = month.split('-').map(Number);
      const lastDayNum = new Date(y, m, 0).getDate();
      const firstDay = `${month}-01`;
      const lastDay = `${month}-${String(lastDayNum).padStart(2, '0')}`;

      const rows = db.prepare(`
        SELECT date(date_heure) AS jour, MIN(date_heure) AS premiere_entree
        FROM pointages
        WHERE employe_id = ? AND type = 'entree' AND date(date_heure) BETWEEN ? AND ?
        GROUP BY date(date_heure)
      `).all(req.params.id, firstDay, lastDay);

      const byDay = {};
      rows.forEach(r => { byDay[r.jour] = r.premiere_entree; });

      const todayStr = new Date().toISOString().slice(0, 10);
      const days = [];
      let retards = 0;

      for (let d = 1; d <= lastDayNum; d++) {
        const dateStr = `${month}-${String(d).padStart(2, '0')}`;
        const dow = new Date(y, m - 1, d).getDay(); // 0 = dimanche, 6 = samedi
        const isWeekend = (dow === 0 || dow === 6);

        let status;
        if (isWeekend) {
          status = 'weekend';
        } else if (byDay[dateStr]) {
          const heure = byDay[dateStr].slice(11, 16); // "HH:MM"
          const late = heure > '10:00';
          status = late ? 'retard' : 'present';
          if (late) retards++;
        } else if (dateStr <= todayStr) {
          status = 'absent';
        } else {
          status = 'future';
        }

        days.push({ date: dateStr, dow, status });
      }

      res.json({ ok: true, days, retards });
    }
  );

  return router;
};
