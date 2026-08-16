// permissions.js
// Liste centralisée des permissions disponibles pour les comptes "accès limité".
// Un admin a toujours TOUT, peu importe ce qui est coché ici.
//
// Ces clés sont utilisées à la fois :
//  - côté serveur, dans requirePermission('cle') sur chaque route protégée
//  - côté écran (/users.html), pour construire dynamiquement les cases à cocher

module.exports = {
  voir_employes: 'Consulter la liste des employés',
  creer_employes: 'Enregistrer de nouveaux employés',
  modifier_employes: 'Modifier les informations des employés',
  supprimer_employes: 'Supprimer des employés',

  voir_presences: 'Consulter la liste des présences (arrivées / départs)',
  exporter_rapports: 'Télécharger / exporter la liste des présences',

  scanner_pointage: 'Scanner les badges (pointage entrée / sortie)',

  envoyer_messages: 'Laisser des messages aux employés (ex : RH)',

  gerer_utilisateurs: 'Créer, modifier et supprimer des comptes utilisateurs',
};
