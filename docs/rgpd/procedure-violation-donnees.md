# Procédure en cas de violation de données personnelles

Une **violation de données** est un incident de sécurité qui entraîne, de manière accidentelle ou illicite, la **destruction, la perte, l'altération, la divulgation ou l'accès non autorisé** à des données personnelles.

Exemples : export CSV des contacts envoyé à la mauvaise personne ; ordinateur ou téléphone d'un membre de l'équipe volé avec une session ouverte ; compte de l'équipe piraté ; fuite chez l'hébergeur ou le prestataire d'e-mails ; base de données effacée sans sauvegarde.

## Les délais à retenir

| Quand | Quoi |
|---|---|
| **Immédiatement** | Contenir l'incident, prévenir le ou la responsable |
| **Sous 72 heures** après en avoir eu connaissance | **Notifier la CNIL**, sauf si la violation n'entraîne **aucun risque** pour les personnes |
| **Dans les meilleurs délais** | **Informer les personnes concernées** si le risque est **élevé** |
| **Toujours** | Inscrire l'incident dans le **registre des violations** (même sans notification) |

## 1. Contenir (dans l'heure)

Selon la situation, dans le back-office ou chez l'hébergeur :

- **Compte de l'équipe compromis** : **Équipe** → *Désactiver* le compte (déconnexion immédiate), *Nouveau mot de passe*, *Réinitialiser la 2FA*.
- **Toutes les sessions à fermer** : désactiver puis réactiver chaque compte dans **Équipe** (chaque désactivation déconnecte immédiatement), ou demander à un·e développeur·se de vider la table `admin_sessions`.
- **Clé de chiffrement exposée** (`ENCRYPTION_KEY`) : la remplacer, puis réinitialiser la double authentification de tous les comptes.
- **Fichier envoyé par erreur** : demander au destinataire de le supprimer et de le confirmer par écrit.
- **Incident chez un sous-traitant** : obtenir ses informations (nature, données, mesures prises).

Conservez les preuves : **Journal d'audit** du back-office (qui a consulté ou exporté quoi), journaux de l'hébergeur.

## 2. Évaluer le risque (dans les 24 h)

Questions à se poser :

- Quelles données ? (nom, e-mail, téléphone : risque modéré ; secrets de connexion : risque élevé)
- Combien de personnes ?
- Les données étaient-elles chiffrées ou inexploitables ?
- Conséquences possibles : hameçonnage (phishing), usurpation d'identité, démarchage ?

Grille simple :

- **Aucun risque** (ex. données chiffrées et clé non compromise, fichier récupéré avant ouverture) → registre interne uniquement.
- **Risque** → notification à la CNIL sous 72 h.
- **Risque élevé** (ex. coordonnées de nombreux clients publiées) → CNIL **et** information des personnes.

En cas de doute, **notifiez** : une notification peut être complétée ensuite.

## 3. Notifier la CNIL (sous 72 h)

Sur le téléservice : [notifications.cnil.fr](https://notifications.cnil.fr/notifications/index). Préparez : nature de la violation, catégories et nombre approximatif de personnes et de données, conséquences probables, mesures prises ou envisagées, contact.

## 4. Informer les personnes (si risque élevé)

Message clair et simple : ce qui s'est passé, les données concernées, les conséquences possibles, ce que nous avons fait, ce qu'elles peuvent faire (ex. se méfier des e-mails frauduleux), le contact [À COMPLÉTER — rgpd@quai19.fr].

## 5. Registre des violations (obligatoire, même sans notification)

| Date de l'incident | Date de découverte | Description | Données et nombre de personnes | Risque évalué | Mesures prises | CNIL notifiée (date) | Personnes informées (date) |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

## Contacts utiles

| Qui | Contact |
|---|---|
| Responsable interne de la procédure | [À COMPLÉTER] |
| Développeur·se / prestataire technique | [À COMPLÉTER] |
| Hébergeur (support) | [À COMPLÉTER] |
| Prestataire e-mails (support) | [À COMPLÉTER] |
| Juriste / DPO | [À COMPLÉTER] |
