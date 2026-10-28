# Mesures de sécurité mises en œuvre

*À joindre au registre des traitements (article 32 du RGPD). Résumé non technique, puis détail.*

## Minimisation

- Seules les données nécessaires sont demandées : nom, prénom, e-mail, téléphone (+ société et commentaire facultatifs). Aucune donnée bancaire.
- Pas de compte client : le client gère sa réservation avec un lien personnel.
- Avertissement « pas de données sensibles » sur le champ commentaire (limité à 1 000 caractères).

## Accès de l'équipe

- Comptes **nominatifs**, deux rôles (administrateur, gestionnaire) ; outils RGPD, réglages et équipe réservés aux administrateurs.
- Mots de passe de 12 caractères minimum, **hachés avec argon2id** ; mot de passe provisoire à changer à la première connexion.
- **Double authentification obligatoire** (code à 6 chiffres) ; secret chiffré en base (AES-256-GCM).
- Verrouillage du compte 15 minutes après 5 échecs ; limitation des tentatives par connexion.
- Sessions en base de données, révocables, cookie sécurisé (`HttpOnly`, `Secure`, `SameSite=Lax`) ; déconnexion après 30 minutes d'inactivité et 12 heures au maximum.
- **Journal d'audit** : consultations de fiches, modifications, exports, effacements, connexions (sans recopier les données).

## Application

- HTTPS obligatoire (HSTS) ; en-têtes de sécurité : politique de sécurité du contenu stricte avec jeton par requête, interdiction d'affichage dans un cadre, `nosniff`, politique de référent, permissions désactivées.
- Protection contre l'injection SQL (requêtes paramétrées), le XSS (échappement systématique, aucune ressource tierce), le CSRF (vérification d'origine des actions, cookies `SameSite`), l'injection de formules dans les exports CSV.
- Toutes les validations sont refaites côté serveur.
- Anti-spam respectueux de la vie privée : champ piège invisible + limitation du nombre de requêtes (empreinte non réversible de l'adresse IP, conservée 24 h). Aucun captcha tiers.
- Liens de gestion client : jeton aléatoire de 256 bits, seule son empreinte est stockée, durée de validité limitée (30 jours après la réservation), désactivé à l'effacement.
- **Aucune donnée personnelle dans les adresses (URL)** : les recherches du back-office sont chiffrées ; les journaux applicatifs ne contiennent que des identifiants techniques.
- Aucune ressource chargée depuis un service tiers (polices, scripts, images) ; aucun cookie publicitaire ou de mesure d'audience.
- Fichiers envoyés (photos) : type vérifié d'après le contenu réel, taille limitée.

## Données et hébergement

- Hébergement et base de données dans l'Union européenne [À COMPLÉTER — prestataire, région].
- Chiffrement des données au repos et des sauvegardes : fourni par l'hébergeur [⚠️ À VÉRIFIER dans son offre].
- Sauvegardes automatiques de la base [À COMPLÉTER — fréquence, durée de rétention] ; test de restauration annuel.
- Durées de conservation appliquées automatiquement chaque heure (anonymisation, purge).
- Les clés secrètes sont stockées dans la configuration de l'hébergeur, jamais dans le code.

## Organisation

- [À COMPLÉTER] Sensibilisation de l'équipe : ne pas exporter les contacts sans besoin, ne pas envoyer d'export par e-mail non chiffré, verrouiller son poste, signaler tout incident.
- [À COMPLÉTER] Départ d'un membre de l'équipe : désactivation du compte le jour même.
- Mises à jour de sécurité des composants logiciels : [À COMPLÉTER — ex. trimestrielles, par le prestataire technique].
