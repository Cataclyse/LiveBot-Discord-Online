# LiveBot — Discord Bot Client

Un client web **HTML, CSS et JavaScript**, inspiré de Discord, pour lire et envoyer des messages sous l’identité de votre propre bot. Interface statique compatible avec **GitHub Pages**. Un relais JavaScript est fourni pour les connexions bloquées depuis le navigateur : automatique avec `npm start`, ou à déployer sur votre Cloudflare Worker pour GitHub Pages.

## Publier sur GitHub Pages

1. Poussez ces fichiers dans votre dépôt GitHub, sur la branche `main` ou `master`.
2. Dans **Settings → Pages → Build and deployment**, choisissez **GitHub Actions** comme source.
3. Dans **Actions**, lancez **Deploy GitHub Pages**, ou poussez un nouveau commit.
4. Le workflow teste le JavaScript et publie uniquement les fichiers du site, dont `config.js`. L’adresse apparaît dans le déploiement `github-pages`.

Les chemins sont relatifs : le site fonctionne aussi sous `https://votre-compte.github.io/votre-depot/`. Vous pouvez également publier directement depuis une branche en choisissant son dossier racine dans les paramètres Pages.

## Utiliser le client

1. Créez une application et son bot dans le [Discord Developer Portal](https://discord.com/developers/applications).
2. Dans **Bot**, récupérez le **token du bot**. Les tokens de comptes utilisateurs ne sont pas pris en charge.
3. Activez **Message Content Intent** pour accéder au contenu des messages ordinaires, puis gardez la case correspondante cochée sur le formulaire. Sans cet intent, décochez-la : Discord peut retourner des contenus vides, sauf les cas autorisés par son API.
4. Invitez le bot dans votre serveur avec les permissions **View Channel**, **Read Message History** et **Send Messages**. Le bouton **+** du client ouvre aussi une invitation avec ces permissions.
5. Ouvrez le site, collez votre token, puis choisissez un serveur et un salon.

Vous pouvez essayer l’interface sans token avec **Essayer le mode démo**. Les conversations démo restent dans l’onglet et disparaissent au rechargement.

## Connexion bloquée sur GitHub Pages : déployer le relais

GitHub Pages héberge les fichiers statiques ; il n’exécute pas le serveur API. Si le navigateur refuse les appels directs à Discord, le relais doit être hébergé séparément. Le fichier `relay/worker.js` est prêt pour un Cloudflare Worker :

1. Dans votre compte Cloudflare, créez un Worker JavaScript, puis remplacez son code par le contenu de `relay/worker.js` et déployez-le.
2. Dans les paramètres du Worker, ajoutez la variable texte **ALLOWED_ORIGINS** avec l’origine exacte de votre site : par exemple `https://cataclyse.github.io`, **sans** `/LiveBot-Discord-Online/`. Pour un Pages privé, utilisez son origine réelle `https://….pages.github.io`. Plusieurs origines peuvent être séparées par des virgules. N’utilisez pas `*`.
3. Copiez l’URL du Worker, par exemple `https://livebot-relay.votre-compte.workers.dev`.
4. Sur le formulaire LiveBot, ouvrez **Connexion avancée**, collez cette URL, puis confirmez que vous autorisez ce relais à transmettre votre token à Discord.
5. Facultatif : renseignez `relayURL` dans `config.js` avec cette URL, puis poussez le changement pour préremplir le relais chez tous les visiteurs. La confirmation reste nécessaire pour chaque connexion. **Ne mettez jamais un token dans config.js.**

Wrangler est inclus dans les dépendances de développement. Pour déployer depuis le terminal, à la racine du dépôt :

```sh
npm install
npm run relay:login
npm run relay:check
npm run relay:deploy
```

`relay/wrangler.toml` configure le Worker `livebot-relay` et son domaine personnalisé `livebot.cataclyse.xyz`. La zone `cataclyse.xyz` doit être présente dans le compte Cloudflare connecté. `ALLOWED_ORIGINS` doit correspondre à l’origine réelle du site GitHub Pages ; ajoutez les origines locales séparées par des virgules si vous voulez aussi utiliser ce Worker depuis un serveur local. `config.js` préremplit ce domaine et le client l’autorise dans sa politique de connexion.

Si le domaine est actuellement associé à un autre projet Cloudflare, le déploiement peut signaler un conflit : retirez son association à ce projet avant de le rattacher au relais. Le site HTML reste hébergé sur GitHub Pages. Ouvrir directement la racine du relais affiche un petit objet JSON identifiant le service ; cela n’affiche pas l’interface et ne télécharge pas un raccourci Windows. Le workflow GitHub Pages ne déploie pas le Worker.

Le relais accepte uniquement les routes Discord nécessaires au client, transmet les limites de requêtes et les erreurs, désactive le cache et les mentions automatiques, et ne journalise ni ne stocke les tokens dans son code. L’administrateur du relais peut toutefois modifier son code et accéder aux requêtes : utilisez votre propre Worker ou un opérateur auquel vous faites confiance. Aucun relais public n’est configuré par défaut.

Les origines CORS limitent l’accès depuis un navigateur ; elles ne constituent pas une authentification du relais. Pour une utilisation publique importante, configurez aussi des limites de trafic sur votre hébergement. Le code reste sous licence MIT.

### Diagnostiquer une connexion

Cliquez sur **Tester la connexion · sans token** dans le formulaire. Le test ne transmet aucun token : une réponse HTTP 401 est attendue et confirme que l’API est accessible. Si le test réussit mais que la connexion du bot échoue, vérifiez le token et les éventuelles extensions filtrant les requêtes authentifiées. Les tokens contenant des guillemets, des caractères masqués ou invisibles sont rejetés avant tout appel. Après une mise à jour de GitHub Pages, rechargez avec **Ctrl + F5** pour utiliser les nouveaux fichiers.

Références : [GitHub Pages est un hébergement statique](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [Cloudflare : relais CORS](https://developers.cloudflare.com/workers/examples/cors-header-proxy/).

## Fonctionnalités

- Serveurs du bot et salons textuels, regroupés par catégorie.
- Historique paginé, messages reçus en direct via le Gateway, reprise de session et reconnexion.
- Envoi de messages et suppression de vos propres messages avec confirmation.
- Gras, italique, souligné, barré, combinaisons de styles, spoilers, citations, listes, titres et texte secondaire.
- Code inline et blocs de code avec coloration syntaxique et bouton de copie.
- Images et GIF des pièces jointes et des aperçus, agrandissement au clic et spoilers d’images.
- Vidéos et fichiers audio en lecture native, liens de téléchargement pour les autres fichiers.
- Embeds avec auteur, titre, description formatée, champs, miniature, image et pied de page.
- Barre de formatage et raccourcis Ctrl/Cmd+B, I et U dans le champ de message.
- Profils cliquables : nom, avatar/bannière disponibles, date de création, surnom et rôles dans le serveur.
- Ouverture de DM depuis un profil, historique, envoi et réception en direct ; les conversations connues restent accessibles via Accueil pendant la session.
- Menu contextuel des messages : réponse sans mention automatique, copie, modification de vos messages et suppression selon les permissions du bot.
- Menu contextuel des salons : copie, actualisation, création, modification du nom/sujet et suppression avec confirmation.
- Événements système, stickers, sondages en lecture seule, messages transférés et texte/médias des composants Discord.
- Recherche dans les messages chargés et liste de leurs auteurs.
- Affichage compact, interface responsive et navigation mobile.
- Gestion des erreurs de permissions, tokens et limites de requêtes Discord.

## Token et vie privée

Le token est conservé **uniquement en mémoire** dans cet onglet. Il n’est placé ni dans une URL, ni dans `localStorage`, ni dans un cookie. En mode direct, les appels vont à `https://discord.com/api/v10`. Avec un relais choisi, le token passe aussi par ce relais. Avec `npm start`, le relais fonctionne sur votre PC. Le Gateway `wss://gateway.discord.gg` est toujours joint directement. Le champ est vidé après la tentative de connexion ; la déconnexion ferme le Gateway et oublie le token. Un rechargement exige une nouvelle connexion. Aucun service analytique ou police distante n’est utilisé.

Le site reçoit nécessairement le token que vous saisissez : utilisez votre propre déploiement ou une copie du code que vous avez vérifiée. Ne publiez jamais votre token dans un commit ou un ticket. Si un token a été divulgué, régénérez-le depuis le portail Discord.

Le contenu est rendu avec une copie locale de markdown-it, avec le HTML brut désactivé et les liens validés. La coloration du code utilise highlight.js, également fourni localement. Les mentions automatiques sont désactivées à l’envoi (`allowed_mentions.parse: []`). Les images peuvent venir du CDN Discord ou des URL HTTPS contenues dans les embeds ; elles sont chargées sans référent. Les URL signées des pièces jointes sont conservées et peuvent expirer suivant les règles de Discord.

## Limites

Le client utilise l’API officielle des **bots** : il ne transforme pas le bot en compte utilisateur. Les permissions Discord continuent de s’appliquer. Les appels vocaux, l’envoi de fichiers, les interactions slash et les bots nécessitant plusieurs shards ne sont pas pris en charge. La liste des participants représente les auteurs des messages chargés, pas une liste complète des membres ou leur présence. L’API des bots ne fournit pas le profil complet d’un compte utilisateur, notamment sa bio et ses activités privées. Les DM peuvent être refusés par Discord selon les réglages et l’accès du destinataire ; aucun message n’est envoyé automatiquement en ouvrant un DM. Les conversations sont mémorisées uniquement pour la session en cours.

Le bot peut supprimer ses messages. La suppression de messages d’autres membres nécessite **Manage Messages** ; créer, modifier et supprimer des salons nécessite **Manage Channels**. Les menus tiennent compte des rôles et des overwrites du salon, et Discord contrôle les permissions pour chaque opération. La suppression d’un salon ou d’un message demande une confirmation.

Un message vide n’est pas nécessairement un refus d’accès : événements système, stickers, sondages et composants sont rendus séparément. Quand l’API n’envoie réellement aucun contenu, le bouton **Pourquoi ?** décrit l’activation de **Message Content Intent** dans le portail et la reconnexion nécessaire. Le client ne peut pas reconstruire un contenu retenu par Discord. Les stickers Lottie sont indiqués par un lien vers leur fichier ; les stickers PNG/APNG/GIF sont affichés.

Si Discord, une extension ou les règles CORS empêchent un appel direct, configurez votre relais comme expliqué plus haut. Il n’y a pas de bascule automatique vers un relais externe. Un relais API ne résout pas un blocage du WebSocket Gateway : vérifiez aussi les règles réseau, extensions et VPN si le temps réel échoue. Gardez l’onglet ouvert pour maintenir la connexion ; la mise en veille du navigateur peut interrompre le temps réel.

## Développement local

Avec Node.js 22 ou plus récent :

```sh
npm start
```

Ouvrez `http://127.0.0.1:8080`. Aucune installation npm n’est nécessaire. Ce serveur est détecté automatiquement et relaie les appels API vers Discord depuis votre PC. Il écoute uniquement en local et refuse les appels provenant d’une autre origine. Les autres serveurs de prévisualisation n’incluent pas ce relais. Redémarrez `npm start` après une mise à jour de son code. N’ouvrez pas directement `index.html`, car le site utilise des modules JavaScript.

```sh
npm test
```

Les tests utilisent des réponses Discord simulées et des WebSockets factices. Ils ne nécessitent aucun token et n’envoient aucun message réel. Une connexion réelle reste à vérifier avec votre bot et ses permissions.

Documentation : [API et authentification](https://docs.discord.com/developers/reference), [Gateway](https://docs.discord.com/developers/events/gateway).

## Licence

MIT pour le code du projet. Projet indépendant, non affilié à Discord. Les assets officiels et polices Discord restent la propriété de Discord ; ils ne sont pas couverts par la licence MIT du projet. Leurs URL sources sont documentées dans `assets/discord/sources.json`, depuis le login officiel et la [page de marque Discord](https://discord.com/branding). Les licences des bibliothèques intégrées sont conservées dans `assets/vendor/`.

Le module Markdown distribué est déjà inclus dans le dépôt. Pour le régénérer après une mise à jour de ses bibliothèques : `npm install`, puis `npm run vendor:build`. Le site reste constitué de fichiers HTML, CSS et JavaScript et ne charge aucun script de bibliothèque depuis un CDN.
