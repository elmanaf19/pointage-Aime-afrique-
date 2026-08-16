const express = require('express');
const session = require('express-session');
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'aimes-pointage.db'));

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'change-moi-en-une-longue-phrase-aleatoire-unique',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8h
}));

const { router: authRouter, requireAuth, requirePermission } = require('./auth')(db);
app.use(authRouter);

const employeeRouter = require('./employee-routes')(db, requireAuth, requirePermission);
app.use(employeeRouter);

const dashboardRouter = require('./dashboard-routes')(db, requireAuth, requirePermission);
app.use(dashboardRouter);

const usersRouter = require('./users-routes')(db, requireAuth, requirePermission);
app.use(usersRouter);

// IMPORTANT : messages-routes doit être chargé AVANT scan-handler,
// car il crée la table employee_messages utilisée par scan-handler.
const messagesRouter = require('./messages-routes')(db, requireAuth, requirePermission);
app.use(messagesRouter);

const scanHandler = require('./scan-handler')(db);
app.post('/api/scan', requireAuth, requirePermission('scanner_pointage'), scanHandler);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
