# Site vitrine QUAI 19 (version HTML, hébergement gratuit)

Ce dossier `vitrine/` contient un **site vitrine en HTML pur** : accueil, salles et tarifs, page « Réserver », pages légales. Il fonctionne **sans serveur, sans base de données, sans JavaScript et sans cookie** : il peut donc être hébergé gratuitement.

Les demandes de réservation passent par un **formulaire Tally** (service belge, données stockées dans l'Union européenne). Vous recevez chaque demande **par e-mail**, et vous la traitez à la main : vérification de la disponibilité, devis, confirmation.

> L'application complète (calendrier, anti-double réservation, back-office, outils RGPD) reste disponible dans le reste du dépôt. Vous pourrez y passer plus tard sans rien perdre : voir le [README principal](../README.md).

## Ce que la vitrine fait, et ne fait pas

| ✅ La vitrine | ❌ À faire à la main |
|---|---|
| Présente les salles, photos, équipements, tarifs, horaires | Vérifier qu'un créneau est libre avant de répondre |
| Collecte les demandes (formulaire Tally) et vous les envoie par e-mail | Tenir votre planning (agenda partagé, tableur…) |
| Affiche les conditions de réservation, la politique de confidentialité, les mentions légales | Envoyer devis, confirmations, rappels |
| Ne dépose aucun cookie et ne charge aucune ressource externe | Supprimer les anciennes demandes (RGPD, voir plus bas) |

---

## 1. Les fichiers

```
vitrine/
├── index.html                  Accueil
├── salles.html                 Les 3 salles, équipements, tarifs
├── reserver.html               Explications + bouton vers le formulaire Tally
├── mentions-legales.html       ⚖️ à compléter et faire valider
├── confidentialite.html        ⚖️ à compléter et faire valider
├── conditions-reservation.html ⚖️ à compléter et faire valider
├── 404.html                    Page « introuvable »
├── _headers                    En-têtes de sécurité (Cloudflare Pages / Netlify)
├── assets/style.css            Couleurs et mise en page
├── assets/favicon.svg          Icône de l'onglet
└── photos/                     Vos photos (voir photos/LISEZMOI.txt)
```

## 2. Modifier le contenu

Un fichier `.html` est un fichier texte. Pour le modifier :

- **Le plus simple** : sur [github.com](https://github.com/studercorp-lang/RESERVATIONSALLE/tree/main/vitrine), ouvrez le fichier, cliquez sur le crayon ✏️, modifiez, puis **Commit changes** ;
- **ou sur votre ordinateur** : avec le Bloc-notes (Windows) ou TextEdit (Mac, menu *Format → Convertir au format texte*), puis double-cliquez sur le fichier pour voir le résultat dans votre navigateur.

Modifiez seulement le texte **entre** les balises (`<p>texte</p>`). Les commentaires `<!-- … -->` ne s'affichent pas : ils vous indiquent quoi faire.

### À remplacer partout (fonction « Rechercher / Remplacer », dans tous les fichiers)

| Texte d'exemple | Remplacer par |
|---|---|
| `contact@exemple.fr` | votre adresse de contact |
| `rgpd@exemple.fr` | l'adresse dédiée aux demandes RGPD |
| `+33 4 00 00 00 00` et `+33400000000` | votre téléphone (affiché, puis sans espaces pour le lien d'appel) |
| `https://tally.so/r/VOTRE-FORMULAIRE` | le lien de votre formulaire Tally (étape 3) |
| `[À COMPLÉTER …]` (30 occurrences) | les informations demandées |
| `[⚠️ À VÉRIFIER …]` (7 occurrences) | à trancher avec votre juriste, puis supprimer la mention |

### Salles, tarifs et horaires

Dans `index.html` et `salles.html`, les salles, équipements et prix sont des **exemples** : remplacez-les par les vraies informations. Les horaires (mardi au dimanche, 15h à 3h, dernier début 22h) apparaissent dans `index.html`, `salles.html`, `reserver.html` et `conditions-reservation.html`.

### Photos, logo, couleurs

- **Photos** : voir `photos/LISEZMOI.txt`. Chaque photo doit avoir une description (`alt="…"`) pour les personnes malvoyantes.
- **Logo** : déposez-le dans `assets/` et suivez le commentaire 🖼️ en haut de chaque page.
- **Couleurs** : en haut de `assets/style.css`.

## 3. Créer le formulaire Tally

1. Créez un compte gratuit sur [tally.so](https://tally.so). En créant un compte professionnel, vous acceptez son **contrat de sous-traitance** (DPA) : téléchargez-le et archivez-le.
2. Créez un formulaire « Demande de réservation — QUAI 19 » avec **uniquement** ces champs (principe de minimisation du RGPD) :

| Champ | Type | Obligatoire |
|---|---|---|
| Nom | Texte court | Oui |
| Prénom | Texte court | Oui |
| Adresse e-mail | E-mail | Oui |
| Téléphone | Téléphone (indicatif +33 par défaut) | Oui |
| Société ou organisation | Texte court | Non |
| Salle souhaitée | Choix unique : La Verrière / Le Salon Saône / L'Atelier / Pas de préférence | Oui |
| Date souhaitée | Date (pas de date passée) | Oui |
| Heure de début | Liste : 15:00, 15:30 … 22:00 | Oui |
| Heure de fin | Liste : 16:00 … 23:30, 00:00, 00:30 … 03:00 (préciser « le lendemain » après minuit) | Oui |
| Nombre de personnes | Nombre (minimum 1) | Oui |
| Commentaire ou besoins particuliers | Texte long, avec l'aide « Merci de ne pas indiquer d'informations sensibles (santé, etc.) » | Non |
| ☐ J'accepte les conditions de réservation (lien vers votre page `conditions-reservation.html`) | Case à cocher, **non pré-cochée** | Oui |
| ☐ J'accepte de recevoir des informations commerciales de QUAI 19 | Case à cocher **séparée, non pré-cochée** | **Non** |

3. En bas du formulaire, ajoutez ce texte (bloc de texte) :
   > Les informations recueillies sont traitées par QUAI 19 pour répondre à votre demande et vous adresser un devis. Elles sont conservées 3 ans après votre dernière réservation. Vous pouvez exercer vos droits à tout moment en écrivant à [votre adresse RGPD]. En savoir plus : [lien vers confidentialite.html].
4. Ajoutez un message de fin : « Merci ! Votre demande ne vaut pas réservation : nous revenons vers vous sous [délai] avec un devis. »
5. **Paramètres → Notifications** : activez l'e-mail à l'équipe pour chaque nouvelle réponse. Si votre formule le permet, activez aussi l'accusé de réception au client.
6. **Paramètres** : activez la protection anti-spam proposée. Si vous souhaitez éviter les cookies de Tally, vérifiez les options de confidentialité disponibles.
7. Publiez le formulaire, copiez son lien (`https://tally.so/r/…`) et collez-le dans `reserver.html`, à la place de `https://tally.so/r/VOTRE-FORMULAIRE`.

> Avant de choisir, vérifiez les conditions actuelles de Tally (limites de l'offre gratuite, liste de ses sous-traitants, transferts hors UE). Une alternative européenne fonctionnant avec un formulaire HTML est Form.taxi, mais son offre gratuite est limitée à environ 40 demandes par mois.

## 4. Mettre le site en ligne gratuitement

Le site entier pèse moins de 100 Ko (hors photos). **Vérifiez toujours que l'offre gratuite autorise un usage professionnel** : certaines l'interdisent, comme l'offre « Hobby » de Vercel.

### Option simple : Cloudflare Pages (glisser-déposer)

1. Créez un compte gratuit sur [pages.cloudflare.com](https://pages.cloudflare.com).
2. **Create a project → Direct Upload** (ou « Importer des fichiers »), nommez le projet `quai19`.
3. Glissez-déposez **le contenu du dossier `vitrine/`** (pas le dossier parent). Les fichiers `README-VITRINE.md` et `photos/LISEZMOI.txt` ne servent qu'à vous : vous pouvez les retirer avant l'envoi.
4. Le site est en ligne sur `quai19.pages.dev`. Le fichier `_headers` active automatiquement les en-têtes de sécurité.
5. **Custom domains** : ajoutez `www.quai19.fr` et suivez les instructions DNS. Le HTTPS est automatique.
6. Pour une mise à jour, refaites un glisser-déposer. Vous pouvez aussi relier le projet au dépôt GitHub, avec `vitrine` comme dossier de sortie : chaque modification sur GitHub sera alors publiée automatiquement.

⚖️ Cloudflare est une société américaine. Le site ne collecte aucune donnée personnelle (le formulaire est chez Tally), mais Cloudflare traite les adresses IP des visiteurs. Mentionnez-le dans les mentions légales et dans la politique de confidentialité, et vérifiez son contrat de sous-traitance et les garanties de transfert.

### Option européenne : alwaysdata (Paris)

[alwaysdata](https://www.alwaysdata.com/fr/) propose une offre gratuite (100 Mo selon les sources). Vérifiez la limite actuelle et l'usage commercial dans leurs conditions. Il suffit d'envoyer le contenu de `vitrine/` dans le dossier `www`, par le gestionnaire de fichiers ou en SFTP. Le fichier `_headers` n'y est pas pris en compte ; c'est sans conséquence grave, puisque le site n'a ni script ni formulaire.

## 5. RGPD : ce qui change avec la vitrine

Les obligations restent les mêmes, mais elles se gèrent **à la main** :

- **Sous-traitants** : Tally (formulaire), votre messagerie (e-mails reçus), l'hébergeur du site. Archivez leurs contrats (DPA) et mettez à jour `docs/rgpd/sous-traitants.md`.
- **Registre des traitements** (`docs/rgpd/registre-des-traitements.md`) : remplacez la mention « application » par « formulaire Tally + messagerie ». Les finalités, données et durées restent les mêmes.
- **Durées de conservation** : rien n'est automatique. **Au moins une fois par an**, supprimez dans Tally **et** dans votre messagerie les demandes de plus de 3 ans. Supprimez aussi les contacts de prospection sans échange depuis 3 ans.
- **Prospection** : n'envoyez d'informations commerciales qu'aux personnes ayant coché la case. Tally conserve la preuve, dans la réponse au formulaire.
- **Demandes de droits** (accès, effacement…) : retrouvez la personne dans Tally et dans votre messagerie, exportez ses réponses ou supprimez-les, et répondez **sous 1 mois**. La procédure de `docs/rgpd/procedure-demandes-droits.md` s'applique, sans la partie « back-office ».
- **Violation de données** : `docs/rgpd/procedure-violation-donnees.md` s'applique. Protégez particulièrement les comptes Tally et de messagerie (mot de passe robuste et double authentification).
- **Cookies** : le site n'en dépose aucun, donc **pas de bandeau**. N'ajoutez pas d'outil de statistiques sans vérifier qu'il est exempté de consentement.

## 6. Checklist de mise en ligne de la vitrine

- [ ] Remplacer les adresses e-mail, le téléphone et le lien Tally (section 2).
- [ ] Remplacer les salles, tarifs et photos d'exemple par les vrais.
- [ ] Compléter les 30 `[À COMPLÉTER]` ; faire trancher les 7 `[⚠️ À VÉRIFIER]` et valider les 3 pages légales par votre juriste (droit de rétractation, frais d'annulation face aux particuliers, médiateur de la consommation…).
- [ ] Créer le formulaire Tally (section 3), puis faire une demande de test et vérifier la réception de l'e-mail.
- [ ] Archiver les contrats de sous-traitance (Tally, hébergeur, messagerie).
- [ ] Publier (section 4) et brancher le nom de domaine en HTTPS.
- [ ] Vérifier sur téléphone : navigation, lien vers le formulaire, pages légales dans le pied de page.
- [ ] Noter dans votre agenda la purge annuelle des anciennes demandes (RGPD).
