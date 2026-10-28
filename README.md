# QUAI 19 — Application de réservation de salles

Application web qui permet à vos clients de **demander la réservation d'une salle** (sur téléphone comme sur ordinateur) et à votre équipe de **traiter ces demandes, envoyer les devis et gérer les salles** depuis un espace sécurisé.

> 📌 Ce guide est écrit pour une personne qui n'est pas développeuse. Les commandes à taper sont dans des blocs gris : copiez-les telles quelles.

---

## Sommaire

1. [Ce que fait l'application](#1-ce-que-fait-lapplication)
2. [Ce dont vous avez besoin](#2-ce-dont-vous-avez-besoin)
3. [Lancer l'application sur votre ordinateur](#3-lancer-lapplication-sur-votre-ordinateur)
4. [Mettre l'application en ligne (pas à pas)](#4-mettre-lapplication-en-ligne-pas-à-pas)
5. [Créer le premier compte administrateur](#5-créer-le-premier-compte-administrateur)
6. [Modifier les textes légaux](#6-modifier-les-textes-légaux)
7. [Personnaliser le logo, les couleurs et les informations](#7-personnaliser-le-logo-les-couleurs-et-les-informations)
8. [Utiliser le back-office au quotidien](#8-utiliser-le-back-office-au-quotidien)
9. [Tests automatiques](#9-tests-automatiques)
10. [Sauvegardes, mises à jour et dépannage](#10-sauvegardes-mises-à-jour-et-dépannage)
11. [Organisation du code (pour un·e développeur·se)](#11-organisation-du-code-pour-une-développeurse)

Documents associés :

- 📋 [Checklist avant la mise en ligne](docs/CHECKLIST-MISE-EN-LIGNE.md) — **à lire en premier**
- 🔒 [Dossier RGPD](docs/rgpd/) : registre des traitements, sous-traitants, procédures

---

## 1. Ce que fait l'application

**Côté clients** (sans création de compte) :

- recherche d'une salle libre selon la date, les horaires (de 15h à 3h du matin, début au plus tard à 22h) et le nombre de personnes ;
- fiche de chaque salle : photos, capacité, équipements, tarifs indicatifs selon le jour, planning des disponibilités ;
- demande de réservation en 3 étapes (choisir → coordonnées → confirmation) ;
- e-mail de confirmation avec un **lien personnel** pour consulter, modifier ou annuler la demande ;
- e-mail de rappel avant la réservation.

**Côté équipe** (`/admin`, connexion avec double authentification) :

- tableau de bord des demandes à traiter ;
- confirmer, refuser, annuler, déplacer une réservation ; saisir une réservation reçue par téléphone ;
- calendrier de la semaine, toutes salles ;
- liste et export des **contacts** clients ;
- gestion des salles : horaires, **blocage de créneaux ou de journées**, tarifs par jour, photos ;
- réglages (validation automatique ou non, délais, barème d'annulation, durées de conservation) ;
- outils RGPD : export, correction, effacement des données d'une personne, journal d'audit.

**Garanties techniques** : aucune double réservation possible (contrôlée par la base de données elle-même), heure d'été/hiver gérée, données hébergées dans l'Union européenne, aucun cookie publicitaire, aucun service Google.

---

## 2. Ce dont vous avez besoin

| Quoi | Pourquoi | Coût indicatif |
|---|---|---|
| Un compte **GitHub** (déjà fait : dépôt `RESERVATIONSALLE`) | Conserver le code | Gratuit |
| Un compte **Clever Cloud** (hébergeur français) | Faire tourner le site et la base de données | ~20 à 40 €/mois |
| Un compte **Brevo** (envoi d'e-mails, société française) | Envoyer les confirmations et rappels | Gratuit jusqu'à 300 e-mails/jour |
| Un **nom de domaine** (ex. `reservation.quai19.fr`) | L'adresse du site | Celui de QUAI 19 |

D'autres hébergeurs européens conviennent (Scaleway, OVHcloud…) : l'application est standard (Node.js + PostgreSQL).

---

## 3. Lancer l'application sur votre ordinateur

Utile pour essayer, ou pour un·e développeur·se qui reprend le projet.

### 3.1 Installer les outils (une seule fois)

1. **Node.js** version 20 ou plus : téléchargez la version « LTS » sur [nodejs.org](https://nodejs.org/fr) et installez-la.
2. **PostgreSQL** (la base de données) : le plus simple est [Postgres.app](https://postgresapp.com/fr/) sur Mac, ou l'installateur de [postgresql.org](https://www.postgresql.org/download/) sur Windows. Notez le mot de passe choisi.
3. **Git** : [git-scm.com](https://git-scm.com/downloads).

### 3.2 Récupérer le projet

Ouvrez le Terminal (Mac) ou PowerShell (Windows) :

```bash
git clone https://github.com/studercorp-lang/RESERVATIONSALLE.git
cd RESERVATIONSALLE
npm install
```

### 3.3 Configurer

1. Créez une base de données vide nommée `quai19` dans PostgreSQL.
2. Copiez le fichier modèle de configuration :
   ```bash
   cp .env.example .env
   ```
3. Ouvrez le fichier `.env` avec un éditeur de texte et remplissez :
   - `DATABASE_URL` avec l'adresse de votre base (ex. `postgresql://postgres:VOTREMOTDEPASSE@localhost:5432/quai19?schema=public`) ;
   - les trois clés secrètes, générées par :
     ```bash
     npm run secrets
     ```
   - laissez `SMTP_HOST` vide : en local, les e-mails ne partent pas, ils sont enregistrés dans le dossier `.outbox/` pour que vous puissiez les relire.

### 3.4 Préparer la base et lancer

```bash
npm run db:deploy      # crée les tables
npm run db:seed        # ajoute les 3 salles et des réservations de démonstration (fictives)
npm run admin:create -- --email vous@exemple.fr --nom "Votre Nom"
npm run dev            # lance le site
```

Ouvrez [http://localhost:3000](http://localhost:3000) (site client) et [http://localhost:3000/admin](http://localhost:3000/admin) (espace équipe).

---

## 4. Mettre l'application en ligne (pas à pas)

Exemple avec **Clever Cloud** (Paris). Prévoyez environ une heure la première fois. Si un écran a changé de nom, l'idée reste la même.

> ℹ️ Vérifiez au passage la documentation officielle de Clever Cloud sur [les tâches planifiées](https://www.clever.cloud/developers/doc/administrate/cron/) et [les « hooks » de déploiement](https://developers.clever-cloud.com/doc/develop/build-hooks) : les noms de variables ci-dessous suivent cette documentation, mais les services évoluent.

### Étape 1 — Créer la base de données

1. Sur [console.clever-cloud.com](https://console.clever-cloud.com), cliquez **Créer → un add-on → PostgreSQL**.
2. Choisissez la région **Paris**, et un plan adapté (une petite offre suffit pour démarrer ; vérifiez qu'elle inclut des **sauvegardes**).
3. Une fois créée, ouvrez l'add-on, onglet **Informations** : copiez l'adresse de connexion (`POSTGRESQL_ADDON_URI`, elle commence par `postgresql://`).

### Étape 2 — Créer l'application

1. **Créer → une application → Node.js**, depuis le dépôt GitHub `RESERVATIONSALLE` (autorisez Clever Cloud à accéder à GitHub si demandé).
2. Région **Paris**, **une seule instance** (taille XS ou S).
3. À l'étape « add-ons », **liez** la base PostgreSQL créée à l'étape 1.

### Étape 3 — Renseigner la configuration

Dans l'application, onglet **Variables d'environnement**, mode expert, collez (en remplaçant les valeurs) :

```
DATABASE_URL=<l'adresse POSTGRESQL_ADDON_URI copiée à l'étape 1>
APP_URL=https://reservation.quai19.fr
AUTH_SECRET=<généré par npm run secrets>
ENCRYPTION_KEY=<généré par npm run secrets>
CRON_SECRET=<généré par npm run secrets>
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=<identifiant SMTP Brevo>
SMTP_PASSWORD=<clé SMTP Brevo>
EMAIL_FROM=QUAI 19 <reservation@quai19.fr>
EMAIL_TEAM=equipe@quai19.fr
CC_POST_BUILD_HOOK=npm run build
CC_PRE_RUN_HOOK=npm run db:deploy
```

- `CC_POST_BUILD_HOOK` compile le site après l'installation ;
- `CC_PRE_RUN_HOOK` met à jour la structure de la base avant chaque démarrage (sans effacer les données) ;
- pas besoin de bandeau cookies : le site n'utilise que le cookie de connexion de l'équipe.

> 🔐 Les clés secrètes ne doivent **jamais** être envoyées par e-mail ni enregistrées dans GitHub. Conservez-les dans un gestionnaire de mots de passe. Ne changez plus `ENCRYPTION_KEY` une fois le site en ligne.

### Étape 4 — Configurer l'envoi des e-mails (Brevo)

1. Créez un compte sur [brevo.com](https://www.brevo.com/fr/).
2. **Expéditeurs, domaines → Domaines** : ajoutez `quai19.fr` et suivez les instructions pour ajouter les enregistrements **SPF, DKIM et DMARC** chez votre gestionnaire de nom de domaine (sans cela, les e-mails risquent d'arriver en indésirables).
3. **SMTP et API → SMTP** : générez une clé SMTP ; reportez l'identifiant et la clé dans `SMTP_USER` / `SMTP_PASSWORD`.
4. Signez l'accord de traitement des données (DPA) proposé par Brevo.

### Étape 5 — Déployer

Cliquez **Redémarrer** (ou poussez une modification sur GitHub : Clever Cloud redéploie automatiquement). Suivez les journaux : le déploiement prend quelques minutes. L'application est alors visible sur l'adresse fournie par Clever Cloud (`app-xxxx.cleverapps.io`).

### Étape 6 — Brancher votre nom de domaine

1. Onglet **Noms de domaine** : ajoutez `reservation.quai19.fr`.
2. Chez votre gestionnaire de domaine, créez l'enregistrement **CNAME** indiqué par Clever Cloud.
3. Le certificat HTTPS est fourni automatiquement. Vérifiez que `APP_URL` correspond bien à cette adresse (les liens des e-mails l'utilisent).

### Étape 7 — Tâches automatiques (rappels, expiration, RGPD)

Rien à faire : le fichier `clevercloud/cron.json` lance `npm run jobs` **toutes les heures** (à la minute 7). Ces tâches :

- libèrent les créneaux des demandes non traitées dans le délai ;
- envoient le rappel avant chaque réservation confirmée ;
- marquent les réservations passées comme terminées ;
- appliquent les **durées de conservation** (anonymisation automatique, purge du journal).

Pour vérifier : dans les journaux de l'application, une ligne `[tâches] … {"expiredRequests":0, …}` apparaît chaque heure.

*Autre hébergeur ?* Programmez toutes les heures, au choix, la commande `npm run jobs`, ou un appel `POST https://votre-site/api/taches` avec l'en-tête `Authorization: Bearer <CRON_SECRET>`.

### Étape 8 — Premier compte administrateur

Voir la section suivante.

---

## 5. Créer le premier compte administrateur

**Une seule fois**, pour le tout premier compte. Les comptes suivants se créent depuis le back-office (menu **Équipe**).

Sur Clever Cloud, installez l'outil en ligne de commande ([instructions](https://www.clever.cloud/developers/doc/cli/)), puis :

```bash
clever login
clever ssh                     # ouvre une console sur le serveur, choisissez l'application
cd $APP_HOME
npm run admin:create -- --email prenom@quai19.fr --nom "Prénom Nom"
```

Un **mot de passe provisoire** s'affiche (une seule fois). Ensuite :

1. allez sur `https://reservation.quai19.fr/admin` et connectez-vous avec ce mot de passe ;
2. installez sur votre téléphone une application d'authentification (Google Authenticator, Microsoft Authenticator, 2FAS…) et **scannez le QR code** ;
3. saisissez le code à 6 chiffres, puis **choisissez votre mot de passe** (12 caractères minimum ; une phrase de passe est idéale).

En cas de perte du téléphone : un autre administrateur peut **réinitialiser la double authentification** dans **Équipe**.

---

## 6. Modifier les textes légaux

Les textes sont des fichiers simples, au format Markdown, dans le dossier **`content/legal/`** :

| Fichier | Page |
|---|---|
| `mentions-legales.md` | `/mentions-legales` |
| `confidentialite.md` | `/confidentialite` |
| `conditions-reservation.md` | `/conditions-reservation` |
| `mention-formulaire.md` | petit texte sous le formulaire de réservation |

**Comment les modifier sans outil technique** : sur [github.com](https://github.com/studercorp-lang/RESERVATIONSALLE/tree/main/content/legal), ouvrez le fichier, cliquez sur le crayon ✏️, modifiez, puis **Commit changes**. Le site se met à jour automatiquement en quelques minutes.

Règles de rédaction :

- `# Titre` = titre, `## Sous-titre`, `**gras**`, `- ` en début de ligne = liste, `[texte](adresse)` = lien ;
- remplacez tous les **`[À COMPLÉTER]`** et faites trancher les **`[⚠️ À VÉRIFIER]`** par votre juriste ;
- ne touchez pas aux éléments **`{{entre_accolades}}`** : ils sont remplacés automatiquement par les valeurs des **Réglages** (barème d'annulation, durées de conservation, délais), pour que les textes restent toujours exacts ;
- **après toute modification des conditions de réservation**, changez la version `termsVersion` dans `src/config/site.ts` (ex. `cgr-2027-01`) : chaque client accepte une version précise, enregistrée comme preuve.

> ⚠️ Ces textes sont des **modèles**. Ils doivent être relus et validés par un professionnel du droit avant la mise en ligne.

---

## 7. Personnaliser le logo, les couleurs et les informations

- **Coordonnées affichées** (e-mails de contact et RGPD, téléphone) : `src/config/site.ts`.
- **Couleurs** : en haut de `src/app/globals.css` (`--color-brand`, etc.). Gardez des contrastes suffisants (accessibilité) : demandez à un·e développeur·se de vérifier avec `npm run test:e2e`, ou testez sur [webaim.org/resources/contrastchecker](https://webaim.org/resources/contrastchecker/).
- **Logo** : placez le fichier dans `public/` (ex. `public/logo.svg`) et remplacez le nom « QUAI 19 » dans `src/app/(public)/layout.tsx` (un commentaire indique l'endroit).
- **Photos des salles** : directement dans le back-office, **Salles et horaires → Modifier → Photos** (JPEG, PNG ou WebP, 3 Mo max., avec une courte description pour les personnes malvoyantes).
- **Salles, horaires, tarifs, blocages** : tout se fait dans le back-office, sans toucher au code.

---

## 8. Utiliser le back-office au quotidien

| Je veux… | Où |
|---|---|
| Voir les nouvelles demandes | **Tableau de bord** (les plus anciennes d'abord, avec leur date d'expiration) |
| Confirmer / refuser une demande | Ouvrir la réservation → **Confirmer** ou **Refuser** (message personnel facultatif) |
| Noter « devis envoyé », « caution reçue » | Fiche réservation → **Note interne** (jamais visible du client) |
| Enregistrer une réservation prise par téléphone | **+ Saisir une réservation** |
| Changer de salle ou d'horaire | Fiche réservation → **Modifier le créneau** |
| Fermer une salle un jour donné | **Salles et horaires** → la salle → **Bloquer des créneaux** |
| Fermer tout l'établissement (congés) | **Salles et horaires** → bas de page |
| Modifier les horaires d'ouverture | **Salles et horaires** → la salle → **Horaires d'ouverture** |
| Récupérer les contacts | **Contacts** → **Exporter (CSV)** (pour une campagne : cochez « Accord pour la prospection uniquement ») |
| Répondre à une demande RGPD | **Données personnelles** (administrateurs) — voir [la procédure](docs/rgpd/procedure-demandes-droits.md) |
| Ajouter un collègue | **Équipe** (administrateurs) |

Rôles : **Administrateur** (tout) et **Gestionnaire** (réservations, salles, calendrier, contacts).

---

## 9. Tests automatiques

Pour un·e développeur·se, avant chaque mise à jour :

```bash
npm test            # 150+ tests : règles de réservation, sécurité, RGPD (base DATABASE_URL_TEST)
npm run test:e2e    # parcours complets dans un vrai navigateur (base DATABASE_URL_E2E)
npm run lint        # qualité du code
```

Les bases de test sont **vidées** à chaque lancement : ne mettez jamais l'adresse de la vraie base dans `DATABASE_URL_TEST` ou `DATABASE_URL_E2E` (le script des tests de bout en bout refuse d'ailleurs toute base dont le nom ne contient pas `e2e`).

---

## 10. Sauvegardes, mises à jour et dépannage

**Sauvegardes** : la base PostgreSQL de Clever Cloud est sauvegardée automatiquement (vérifiez la fréquence et la durée de rétention de votre offre, et que les sauvegardes sont chiffrées). Les photos des salles sont stockées **dans la base** : elles sont donc sauvegardées avec elle. Faites un **test de restauration** une fois par an.

**Mises à jour** : toute modification poussée sur la branche `main` de GitHub est redéployée automatiquement. Les mises à jour de sécurité des bibliothèques (`npm audit`) sont à faire par un·e développeur·se, idéalement tous les trimestres.

**Dépannage** :

| Problème | Piste |
|---|---|
| Les e-mails n'arrivent pas | Vérifier `SMTP_*`, le domaine validé chez Brevo (SPF/DKIM), les courriers indésirables |
| Les liens des e-mails pointent vers une mauvaise adresse | Vérifier `APP_URL` |
| « Compte temporairement verrouillé » | Attendre 15 minutes (5 erreurs de mot de passe) |
| Téléphone perdu (double authentification) | Un autre administrateur : **Équipe → Réinitialiser la 2FA** |
| Les rappels ne partent pas | Vérifier dans les journaux la ligne `[tâches]` toutes les heures |
| Une salle n'apparaît plus | Vérifier qu'elle est « active » et qu'elle a des horaires |

---

## 11. Organisation du code (pour un·e développeur·se)

Next.js 15 (App Router) + TypeScript, PostgreSQL via Prisma, Tailwind CSS, Zod, Vitest, Playwright.

```
content/legal/          Textes légaux (Markdown, modifiables)
prisma/                 Schéma, migrations (dont la contrainte anti-double réservation), données de démo
src/app/(public)/       Site client : accueil, recherche, salles, réservation, lien de gestion, pages légales
src/app/admin/          Back-office (connexion, 2FA, espace équipe)
src/app/api/taches/     Déclenchement des tâches automatiques (protégé par CRON_SECRET)
src/lib/availability/   Moteur de disponibilité (règles, horaires après minuit, tarifs)
src/lib/booking/        Demandes, modification/annulation, barème d'annulation
src/lib/admin/          Actions de l'équipe (réservations, salles, équipe, export)
src/lib/gdpr/           Droits des personnes (export, rectification, effacement)
src/lib/jobs/           Tâches automatiques (rappels, expiration, conservation)
src/lib/auth/           Mots de passe (argon2id), double authentification, sessions
src/middleware.ts       En-têtes de sécurité (CSP avec nonce) et protection de /admin
tests/                  Tests unitaires, d'intégration et de bout en bout
docs/                   RGPD et checklist de mise en ligne
```

Points d'architecture :

- **Anti-double réservation** : contrainte d'exclusion PostgreSQL (`btree_gist`) sur `tstzrange(startsAt, blockedUntil)` par salle, pour les statuts actifs ; `blockedUntil` = fin + temps tampon.
- **Dates** : stockées en UTC (`timestamptz`), règles évaluées à l'heure de Paris ; une plage d'ouverture peut se terminer le lendemain (`closeMin` > 1440).
- **Aucune donnée personnelle** dans les URL (recherches chiffrées), ni dans les journaux applicatifs.
- **Choix d'authentification** : sessions en base (révocables) plutôt qu'Auth.js, pour une double authentification TOTP obligatoire simple et robuste.
