# Checklist avant la mise en ligne

Cochez chaque point (`[x]`) au fur et à mesure. Les points ⚖️ concernent votre juriste, les points 🛠️ peuvent nécessiter un·e développeur·se.

## 1. Informations à fournir et textes légaux

- [ ] Compléter les **30 `[À COMPLÉTER]`** des textes légaux (dossier `content/legal/`) : raison sociale, forme juridique, capital, RCS, SIRET, TVA, directeur·rice de la publication, hébergeur (nom, adresse, téléphone), médiateur, modalités de paiement et de caution, règlement intérieur, date d'entrée en vigueur.
- [ ] Renseigner les **adresses e-mail et le téléphone** affichés : `src/config/site.ts` (contact, RGPD, téléphone). Créer l'adresse dédiée aux demandes RGPD (ex. `rgpd@quai19.fr`) et vérifier qu'elle est lue.
- [ ] ⚖️ Faire **relire et valider** par un avocat, juriste ou DPO : mentions légales, politique de confidentialité, conditions de réservation, mention sous le formulaire.
- [ ] ⚖️ Trancher les **6 points `⚠️ À VÉRIFIER`** :
  1. droit de rétractation des particuliers (exception « date déterminée » de l'art. L221-28 12° du Code de la consommation ?) ;
  2. frais d'annulation face aux particuliers (réciprocité, caractère non excessif des 90 %) ;
  3. cas de retenue de la caution et procédure contradictoire ;
  4. adhésion à un **médiateur de la consommation** (obligatoire si clients particuliers) ;
  5. transferts hors Union européenne chez les prestataires ;
  6. tribunaux compétents pour les clients professionnels.
- [ ] ⚖️ Valider le choix de l'**effacement par anonymisation** (les créneaux restent, sans lien avec la personne).
- [ ] Après validation, mettre à jour la version des conditions (`termsVersion` dans `src/config/site.ts`).

## 2. Contrats et sous-traitants

- [ ] Signer le **contrat de sous-traitance (DPA, art. 28 RGPD)** avec l'hébergeur.
- [ ] Signer le DPA avec le prestataire d'e-mails (Brevo ou autre).
- [ ] Vérifier pour chacun : données dans l'UE, chiffrement au repos, sauvegardes chiffrées, notification des violations. Compléter `docs/rgpd/sous-traitants.md`.
- [ ] Si un outil de campagnes commerciales est utilisé : DPA + lien de désinscription dans chaque envoi.

## 3. Dossier RGPD

- [ ] Compléter et faire valider le **registre des traitements** (`docs/rgpd/registre-des-traitements.md`).
- [ ] Désigner la personne responsable des demandes de droits et des violations ; compléter les contacts des procédures.
- [ ] Lire avec l'équipe la [procédure des demandes de droits](rgpd/procedure-demandes-droits.md) (réponse sous **1 mois**) et la [procédure en cas de violation](rgpd/procedure-violation-donnees.md) (CNIL sous **72 h**).
- [ ] Vérifier que les **durées de conservation** des **Réglages** (3 ans / 3 ans / 12 mois par défaut) correspondent à la politique de confidentialité validée.
- [ ] Sensibiliser l'équipe : exports CSV avec parcimonie, jamais envoyés par e-mail non protégé ; prospection uniquement auprès des contacts ayant donné leur accord.

## 4. Contenu et apparence

- [ ] Saisir les **vraies salles** dans le back-office (noms, descriptions, capacités, équipements, accessibilité PMR, durées minimale et maximale, temps de ménage entre deux réservations).
- [ ] Vérifier les **horaires** de chaque salle (actuellement : mardi → dimanche, 15h → 3h, dernier début 22h ; fermé le lundi).
- [ ] Saisir les **vrais tarifs** par jour (TTC).
- [ ] Ajouter les **photos** de chaque salle, avec une description (accessibilité).
- [ ] 🛠️ Intégrer le **logo** et les **couleurs** de QUAI 19 (vérifier les contrastes).
- [ ] Bloquer les **fermetures** déjà connues (congés, jours fériés, privatisations).
- [ ] Vérifier les **Réglages** : validation des demandes par l'équipe (recommandé), délai de blocage d'une demande (7 jours), délai minimum (24 h), réservation jusqu'à 6 mois, rappel 48 h avant, barème d'annulation.
- [ ] Supprimer les **données de démonstration** : ne pas lancer `npm run db:seed` sur la base de production (ou supprimer les réservations `DEMO-…` et les clients `@example.com`).

## 5. Technique 🛠️

- [ ] Hébergement en **région UE** (ex. Clever Cloud Paris) ; base PostgreSQL avec **sauvegardes** activées.
- [ ] Variables d'environnement renseignées (voir README, section 4) ; clés générées avec `npm run secrets` et **conservées dans un gestionnaire de mots de passe**.
- [ ] `APP_URL` = adresse définitive en **https://**.
- [ ] Nom de domaine branché, **HTTPS actif**.
- [ ] Domaine d'envoi validé chez Brevo (**SPF, DKIM, DMARC**) ; envoyer une demande de test et vérifier la réception (et les indésirables).
- [ ] **Tâches automatiques** actives : la ligne `[tâches]` apparaît chaque heure dans les journaux.
- [ ] Créer le **premier administrateur** (`npm run admin:create`), activer sa double authentification ; créer les comptes de l'équipe depuis **Équipe**.
- [ ] Prévoir **au moins deux administrateurs** (en cas de perte de téléphone).
- [ ] Lancer les tests : `npm test` et `npm run test:e2e` (sur des bases de test, jamais la production).
- [ ] Faire un **test de restauration** de sauvegarde.
- [ ] Planifier les mises à jour de sécurité (`npm audit`), par exemple chaque trimestre.

## 6. Recette finale (à faire soi-même, sur téléphone et ordinateur)

- [ ] Faire une demande de réservation complète ; recevoir l'e-mail ; utiliser le lien pour modifier puis annuler.
- [ ] Recevoir la notification équipe ; confirmer une demande depuis le back-office ; vérifier l'e-mail reçu par le client.
- [ ] Vérifier qu'un créneau pris n'est plus proposé, et qu'un début après 22h est refusé.
- [ ] Bloquer une journée et vérifier qu'elle disparaît du site.
- [ ] Exporter les contacts ; exporter les données d'un client test ; l'effacer.
- [ ] Vérifier les pages légales depuis le pied de page.
- [ ] 🛠️ Accessibilité : les contrôles automatiques (WCAG 2.1 AA) sont au vert sur toutes les pages ; il est recommandé de faire en plus un **test manuel au clavier et avec un lecteur d'écran** (VoiceOver, NVDA), voire un audit RGAA si votre structure y est soumise.

## 7. Après la mise en ligne

- [ ] Traiter les demandes avant leur expiration (tableau de bord).
- [ ] Revoir ce dossier RGPD **chaque année** (et à chaque nouvel outil).
- [ ] Ajouter l'anglais quand vous le souhaitez : l'interface est en français ; une traduction demande de centraliser les textes (travail d'un·e développeur·se, estimé à 2–3 jours).
