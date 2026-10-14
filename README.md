# LiveBot — Discord Bot Client

Un client web **HTML, CSS et JavaScript**, inspiré de Discord, pour lire et envoyer des messages sous l’identité de votre propre bot. Sans backend, sans dépendance à installer pour le site, compatible avec **GitHub Pages**.

## Publier sur GitHub Pages

1. Poussez ces fichiers dans votre dépôt GitHub, sur la branche `main` ou `master`.
2. Dans **Settings → Pages → Build and deployment**, choisissez **GitHub Actions** comme source.
3. Dans **Actions**, lancez **Deploy GitHub Pages**, ou poussez un nouveau commit.
4. Le workflow teste le JavaScript et publie uniquement les cinq fichiers du site. L’adresse apparaît dans le déploiement `github-pages`.

Les chemins sont relatifs : le site fonctionne aussi sous `https://votre-compte.github.io/votre-depot/`. Vous pouvez également publier directement depuis une branche en choisissant son dossier racine dans les paramètres Pages.

## Utiliser le client

1. Créez une application et son bot dans le [Discord Developer Portal](https://discord.com/developers/applications).
2. Dans **Bot**, récupérez le **token du bot**. Les tokens de comptes utilisateurs ne sont pas pris en charge.
3. Activez **Message Content Intent** pour accéder au contenu des messages ordinaires, puis gardez la case correspondante cochée sur le formulaire. Sans cet intent, décochez-la : Discord peut retourner des contenus vides, sauf les cas autorisés par son API.
4. Invitez le bot dans votre serveur avec les permissions **View Channel**, **Read Message History** et **Send Messages**. Le bouton **+** du client ouvre aussi une invitation avec ces permissions.
5. Ouvrez le site, collez votre token, puis choisissez un serveur et un salon.

Vous pouvez essayer l’interface sans token avec **Essayer le mode démo**. Les conversations démo restent dans l’onglet et disparaissent au rechargement.

## Fonctionnalités

- Serveurs du bot et salons textuels, regroupés par catégorie.
- Historique paginé, messages reçus en direct via le Gateway, reprise de session et reconnexion.
- Envoi de messages et suppression de vos propres messages avec confirmation.
- Liens vers les pièces jointes et rendu simple des titres/descriptions d’embed.
- Recherche dans les messages chargés et liste de leurs auteurs.
- Affichage compact, interface responsive et navigation mobile.
- Gestion des erreurs de permissions, tokens et limites de requêtes Discord.

## Token et vie privée

Le token est conservé **uniquement en mémoire** dans cet onglet. Il n’est placé ni dans une URL, ni dans `localStorage`, ni dans un cookie. Il est envoyé directement à `https://discord.com/api/v10` et au Gateway `wss://gateway.discord.gg` pour authentifier votre bot. Aucun proxy, service analytique ou police distante n’est utilisé. Le champ est vidé après la tentative de connexion ; la déconnexion ferme le Gateway et oublie le token. Un rechargement exige une nouvelle connexion.

Le site reçoit nécessairement le token que vous saisissez : utilisez votre propre déploiement ou une copie du code que vous avez vérifiée. Ne publiez jamais votre token dans un commit ou un ticket. Si un token a été divulgué, régénérez-le depuis le portail Discord.

Les contenus Discord sont affichés comme du texte, sans injection HTML. Les mentions automatiques sont désactivées à l’envoi (`allowed_mentions.parse: []`).

## Limites

Le client utilise l’API officielle des **bots** : il ne transforme pas le bot en compte utilisateur. Les permissions Discord continuent de s’appliquer. Les appels vocaux, les messages privés, l’envoi de fichiers, les interactions slash et les bots nécessitant plusieurs shards ne sont pas pris en charge. La liste des participants représente les auteurs des messages chargés, pas une liste complète des membres ou leur présence.

Les requêtes sont exécutées depuis le navigateur. Si Discord, une extension ou les règles CORS empêchent un appel, le client affiche une erreur et ne transmet pas le token à un proxy pour contourner le blocage. Gardez l’onglet ouvert pour maintenir la connexion ; la mise en veille du navigateur peut interrompre le temps réel.

## Développement local

Avec Node.js 22 ou plus récent :

```sh
npm start
```

Ouvrez `http://127.0.0.1:8080`. Aucune installation npm n’est nécessaire. Utilisez un serveur HTTP plutôt que d’ouvrir directement `index.html`, car le site utilise des modules JavaScript.

```sh
npm test
```

Les tests utilisent des réponses Discord simulées et des WebSockets factices. Ils ne nécessitent aucun token et n’envoient aucun message réel. Une connexion réelle reste à vérifier avec votre bot et ses permissions.

Documentation : [API et authentification](https://docs.discord.com/developers/reference), [Gateway](https://docs.discord.com/developers/events/gateway).

## Licence

MIT. Projet indépendant, non affilié à Discord. Les noms et marques de Discord appartiennent à leurs propriétaires respectifs.
