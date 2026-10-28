# Registre des activités de traitement

*Article 30 du RGPD — modèle inspiré du registre simplifié de la CNIL. Version du [À COMPLÉTER — date].*

## Responsable du traitement

| | |
|---|---|
| Organisme | [À COMPLÉTER — raison sociale] (QUAI 19) |
| Adresse | 19 quai Saint-Antoine, 69002 Lyon |
| Représentant légal | [À COMPLÉTER] |
| Contact RGPD | [À COMPLÉTER — ex. rgpd@quai19.fr] |
| Délégué à la protection des données (DPO) | [À COMPLÉTER — ou « non désigné » : la désignation n'est pas obligatoire pour cette activité, ⚠️ à confirmer] |

---

## Fiche 1 — Gestion des demandes de réservation de salles

| Rubrique | Contenu |
|---|---|
| **Date de création / mise à jour** | [À COMPLÉTER] |
| **Finalité principale** | Recevoir et traiter les demandes de réservation de salles, établir les devis, gérer les réservations (confirmation, modification, annulation, rappel). |
| **Sous-finalités** | Prévention des doubles réservations ; suivi des réservations par l'équipe ; statistiques internes d'occupation (données anonymisées à terme). |
| **Base légale** | Mesures précontractuelles et exécution du contrat (art. 6.1.b RGPD). |
| **Personnes concernées** | Clients et prospects (particuliers et représentants de professionnels) ayant fait une demande de réservation. |
| **Catégories de données** | Identité : nom, prénom ; coordonnées : e-mail, téléphone ; vie professionnelle (facultatif) : société ; données de la demande : salle, date, horaires, nombre de personnes, commentaire facultatif ; preuve d'acceptation des conditions (date, version) ; note interne de l'équipe. |
| **Données sensibles** | Aucune. Le formulaire avertit de ne pas en indiquer dans le commentaire. |
| **Source des données** | La personne elle-même (formulaire du site, téléphone, sur place). |
| **Destinataires internes** | Membres habilités de l'équipe QUAI 19 (rôles administrateur et gestionnaire), comptes nominatifs avec double authentification. |
| **Sous-traitants** | Hébergeur (site et base de données) ; prestataire d'envoi d'e-mails. Voir [sous-traitants.md](sous-traitants.md). |
| **Transferts hors UE** | Aucun prévu. [⚠️ À VÉRIFIER dans les contrats des sous-traitants.] |
| **Durées de conservation** | 3 ans après la date de la dernière réservation, puis anonymisation automatique (réglable dans le back-office). Texte libre (commentaire, note interne) supprimé à la même échéance. Les pièces comptables (factures, hors application) : 10 ans. |
| **Mesures de sécurité** | Voir [mesures-de-securite.md](mesures-de-securite.md). |

---

## Fiche 2 — Prospection commerciale

| Rubrique | Contenu |
|---|---|
| **Date de création / mise à jour** | [À COMPLÉTER] |
| **Finalité** | Envoyer des informations commerciales (offres, événements) aux personnes qui l'ont accepté. |
| **Base légale** | Consentement (art. 6.1.a RGPD), recueilli par une case dédiée, facultative et non pré-cochée ; retirable à tout moment. |
| **Personnes concernées** | Clients et prospects ayant coché la case « J'accepte de recevoir des informations commerciales ». |
| **Catégories de données** | Nom, prénom, e-mail, téléphone, société ; historique du consentement (date, version du texte, origine, retrait). |
| **Destinataires** | Équipe QUAI 19 ; outil d'envoi des campagnes : [À COMPLÉTER — ex. Brevo]. |
| **Transferts hors UE** | Aucun prévu. [⚠️ À VÉRIFIER] |
| **Durée de conservation** | 3 ans après le dernier contact avec la personne (recommandation CNIL) ou jusqu'au retrait du consentement ; le consentement expiré est retiré automatiquement. |
| **Mesures de sécurité** | Identiques à la fiche 1. Export « prospection » limité aux personnes ayant consenti. Lien de désinscription dans chaque envoi [À COMPLÉTER — à configurer dans l'outil de campagne]. |

---

## Fiche 3 — Gestion des accès de l'équipe et sécurité de l'application

| Rubrique | Contenu |
|---|---|
| **Finalité** | Authentifier les membres de l'équipe, tracer les accès aux données personnelles (journal d'audit), protéger le service contre les abus. |
| **Base légale** | Intérêt légitime (art. 6.1.f) à sécuriser le service ; obligation de sécurité (art. 32). |
| **Personnes concernées** | Membres de l'équipe ; visiteurs du site (pour la limitation des abus). |
| **Catégories de données** | Équipe : nom, e-mail professionnel, rôle, mot de passe haché, secret de double authentification chiffré, dates de connexion, actions réalisées (journal d'audit). Visiteurs : empreinte non réversible de l'adresse IP, conservée au plus 24 h, pour limiter le nombre de requêtes. |
| **Destinataires** | Administrateurs de l'application ; hébergeur. |
| **Durées de conservation** | Journal d'audit : 12 mois. Sessions : 12 h maximum. Compteurs anti-abus : 24 h. Comptes de l'équipe : durée de la collaboration (désactivation au départ). |
