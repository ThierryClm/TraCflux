# Poste de développement du mainteneur

Ce document complète la section [Commandes](README.md#commandes) du README. Il décrit des commandes et des réglages propres au poste Windows du mainteneur : un contributeur n'en a pas besoin pour travailler sur le code.

## Commandes propres au poste

| Commande | Effet |
|---|---|
| `npm run serve` | Sous Windows, lance le serveur d'aperçu hors du terminal (via WMI), pour qu'il survive à sa fermeture ; voir [Dépannage](#dépannage) |
| `npm run clean` | Windows uniquement : supprime `dist/` et arrête **tous** les processus `node.exe` de la machine |
| `npm run preview:deploy` | Construit et publie la branche en cours sur une adresse de prévisualisation Surge ; refuse de s'exécuter sur `master` ou `main`. Demande les identifiants Surge du mainteneur (`SURGE_LOGIN`, `SURGE_TOKEN`) dans l'environnement, jamais en ligne de commande |

Les quelques fichiers `.vbs` à la racine sont des lanceurs Windows personnels — un double-clic enchaîne `npm run build` puis `npm run preview`. Ils ne sont nécessaires ni à l'usage de l'application, ni pour développer.

## Dépannage

Le symptôme à connaître en développement : **l'application semble ignorer vos modifications**. La PWA installée sur `localhost:4173` sert son cache tant qu'un serveur ne lui présente pas un nouveau build, et elle le fait sans rien signaler.

**Utilisez `npm run serve` plutôt que `npm run preview`.** Il reconstruit `dist/`, démarre le serveur s'il ne tourne pas, puis télécharge `/index.html` depuis ce serveur et le compare au fichier qui vient d'être produit. Il ne dit « c'est prêt » qu'après cette vérification, et sort en erreur sinon — serveur arrêté, ou processus résiduel occupant le port sans rien servir. Un `npm run preview` ne vérifie rien et vous laisse devant une page muette.

Rechargez ensuite la fenêtre par **Ctrl+R**, puis cliquez sur **« Recharger »** quand le bandeau apparaît. Laisser la fenêtre ouverte ne suffit pas : c'est le rechargement qui déclenche la recherche de nouvelle version. En cas de doute, la date de build figure dans le rapport de diagnostic — c'est le seul contrôle fiable.

Si le cache reste malgré tout figé (thème ou contenu d'une fenêtre détachée qui ne bouge plus) :

1. Fermer toutes les fenêtres du navigateur ouvertes sur `localhost:4173`
2. `edge://settings/cookies/detail?site=localhost%3A4173` → **Supprimer** — vide le service worker et le cache pour ce seul site
3. `npm run serve`

`npm run clean` reste disponible, mais son `taskkill` arrête **tous** les processus `node.exe` de la machine, pas seulement ceux du projet : à éviter si un autre travail tourne en parallèle.

Deux malentendus courants, que la configuration actuelle écarte. Les processus `node.exe` ne s'accumulent plus après plusieurs aperçus : `strictPort` fait échouer franchement un second serveur au lieu de le replier silencieusement sur le port suivant. Et le bandeau « Nouvelle version disponible » à chaque rebuild n'est pas un défaut, c'est le mécanisme lui-même — chaque build produit un nouveau service worker. Pour l'utilisateur final (PWA hébergée ou installée depuis une release), ce bandeau n'apparaît qu'après un vrai déploiement.
