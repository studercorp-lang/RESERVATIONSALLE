# Site vitrine QUAI 19

Site vitrine en une seule page : accueil, les trois salles (La Mezzanine, Le Lounge, Le Club), tarifs, horaires, page « Réserver » (formulaire Tally) et pages légales. Il n'utilise **ni base de données, ni cookie, ni ressource externe**.

Les demandes de réservation passent par le formulaire Tally **https://tally.so/r/RWWrNK** (données stockées dans l'Union européenne). Vous les recevez par e-mail et les traitez à la main.

> L'application complète (calendrier, anti-double réservation, back-office, outils RGPD) reste disponible dans le reste du dépôt : voir le [README principal](../README.md).

## 1. Le site en ligne

**Adresse :** https://claude.ai/artifact/D5MxeKPVnw25nLgNHDcuX7

- **Rendre le site public** : ouvrez le lien, menu **Partager** (Share), puis choisissez l'accès par lien public. Tant que ce n'est pas fait, vous seule pouvez l'ouvrir.
- **Modifier l'e-mail et le téléphone à tout moment** : ouvrez le site connectée à votre compte Claude, cliquez sur **« Modifier mes coordonnées »** (en bas à droite, visible par vous seule), saisissez, puis **« Enregistrer sur le site »**. Tous les visiteurs voient aussitôt la nouvelle version. Laissez un champ vide pour le retirer du site.
- **Toute autre modification** (textes, photos, salles) : demandez-la à Claude dans cette conversation.

⚖️ Ce site est hébergé par Anthropic (claude.ai, États-Unis) : c'est indiqué dans les mentions légales et la politique de confidentialité du site en ligne, avec un point à faire vérifier par votre juriste (cookies du service claude.ai, transfert des données techniques hors UE). Pour un site à votre propre adresse (www.quai19.fr), utilisez la version fichiers ci-dessous.

## 2. La version fichiers (pour un hébergement à votre nom)

```
vitrine/
├── index.html         Le site complet (une seule page)
├── 404.html           Page « introuvable »
├── _headers           En-têtes de sécurité (Cloudflare Pages / Netlify)
├── assets/favicon.svg Icône de l'onglet
└── photos/            Vos photos, plus tard
```

**Modifier l'e-mail et le téléphone** : dans `index.html`, cherchez le commentaire `✏️ VOS COORDONNÉES` et modifiez la ligne juste en dessous :

```
{"email":"contact@quai19.fr","telephone":"04 78 00 00 00"}
```

Gardez les guillemets. Laissez `""` pour masquer une information. Sur GitHub : ouvrez le fichier, cliquez sur le crayon ✏️, modifiez, puis **Commit changes**.

**Mettre en ligne gratuitement** : par exemple sur [Cloudflare Pages](https://pages.cloudflare.com) → *Create a project* → *Direct Upload*. Glissez-déposez le contenu du dossier `vitrine/`, puis ajoutez votre nom de domaine dans *Custom domains*. Vérifiez que l'offre gratuite autorise un usage professionnel. Ensuite, complétez l'hébergeur dans les mentions légales (`[À COMPLÉTER — nom, adresse et téléphone de l'hébergeur]`).

> ⚠️ Le fichier `_headers` contient l'empreinte du script de `index.html`. Si ce script est modifié (pas les coordonnées ni les textes), cette empreinte doit être recalculée, sinon le site ne fonctionnera plus sur Cloudflare Pages. Demandez-le à Claude ou à un·e développeur·se.

## 3. Ce qu'il reste à faire

- [ ] Rendre le site public (menu Partager) et y saisir votre e-mail et votre téléphone.
- [ ] Vérifier que le formulaire Tally propose bien les salles **La Mezzanine, Le Lounge, Le Club**. Il doit avoir des cases « conditions de réservation » (obligatoire) et « informations commerciales » (facultative), **non pré-cochées**, et l'avertissement « pas d'informations sensibles » sur le commentaire.
- [ ] Préciser si les **700 €** de minimum de consommation sont TTC et ce qu'ils couvrent (point `⚠️ À VÉRIFIER` des conditions).
- [ ] Compléter les `[À COMPLÉTER]` des pages légales (raison sociale, SIRET, médiateur, caution…).
- [ ] Faire valider par votre juriste les pages légales et les points `⚠️ À VÉRIFIER`.
- [ ] Ajouter les photos et les descriptions des salles (en le demandant à Claude).
- [ ] Archiver le contrat de sous-traitance (DPA) de Tally.
- [ ] RGPD, une fois par an : supprimer dans Tally et dans votre messagerie les demandes de plus de 3 ans.
