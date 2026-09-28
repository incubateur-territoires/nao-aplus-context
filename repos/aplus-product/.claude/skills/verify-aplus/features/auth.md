# Authentification et accès

Un utilisateur se connecte par e-mail et mot de passe, puis les gardes de l'application décident où il atterrit : configuration de la 2FA pour un admin, complétion du profil s'il manque un nom, page demandée sinon. Un utilisateur sans mot de passe passe par la réinitialisation.

## Sub-features

- `auth-login` connecte un compte valide et pose une session de 7 jours.
- `auth-login-reject` refuse un mot de passe invalide sans révéler si le compte existe.
- `auth-return-to` ramène sur la page initialement demandée après connexion.
- `auth-2fa-admin` force un compte `admin` sans 2FA vers la configuration.
- `auth-profile-guard` force un compte sans prénom ou nom vers la complétion de profil.
- `auth-forgot` envoie un lien de réinitialisation depuis une adresse connue.
- `auth-logout` détruit la session et reverrouille les pages privées.

## How to get to it (user POV)

- Ouvrir `/connexion` depuis le lien `Se connecter` de l'en-tête.
- Suivre un lien d'e-mail vers une page privée : la redirection dépose sur `/connexion?returnTo=…`.
- Choisir `Mot de passe oublié ?` sur la page de connexion, ou ouvrir `/mot-de-passe-oublie`.
- Choisir `Se déconnecter` dans l'en-tête d'une page privée.

## Driving it with agent-browser

Préconditions :

- `aplus-verify doctor` répond `health OK`.
- Un compte au profil complet obtenu par `aplus-verify users user`.
- Le mot de passe partagé de dev est la valeur de `NEXT_PUBLIC_DEV_PASSWORD` dans le `.env` (jamais écrite dans un fichier suivi — dépôt public).

- **Connexion nominale.** Purger la session, ouvrir le formulaire, saisir, faire défiler jusqu'au bouton et cliquer. Lancer `aplus-verify login --ui <email>`, qui enchaîne `cookies clear`, `open /connexion`, `type` sur les références `Adresse e-mail` et `Mot de passe`, `scrollintoview` puis `click` sur `Se connecter`. La commande affiche `✓ connecté par le formulaire : <email> (URL "/tous-les-signalements")`, et échoue explicitement si aucun `POST /api/auth/sign-in/email` n'atteint le serveur ou si la session n'est pas posée.
- **Contrôle serveur.** Confirmer que la soumission vient bien du formulaire : `grep 'sign-in/email' /tmp/aplus-verify/dev-server.log | tail -1` montre un `200`, et le compteur d'occurrences a augmenté d'exactement un.
- **Cookie de session.** Vérifier la forme du cookie posé. Lancer `curl -s -D - -o /dev/null -X POST http://localhost:3000/api/auth/sign-in/email -H 'Content-Type: application/json' -d '{"email":"<email>","password":"<NEXT_PUBLIC_DEV_PASSWORD du .env>"}' | grep -i set-cookie`. L'en-tête porte `better-auth.session_token` avec `Max-Age=604800`, `HttpOnly`, `SameSite=Lax`, sans `Secure` en local.
- **Session utilisable.** Poser la session dans le navigateur puis ouvrir une page privée. Lancer `aplus-verify login <email>` puis `agent-browser open http://localhost:3000/tous-les-signalements`. Le titre de niveau 1 est `Tous les signalements` et l'en-tête affiche un lien `… - Accéder à mon profil` et un bouton `Se déconnecter`.
- **Refus.** Rejouer la connexion avec un mot de passe faux. Lancer `aplus-verify curl -o /dev/null -w '%{http_code}' -X POST http://localhost:3000/api/auth/sign-in/email -H 'Content-Type: application/json' -d '{"email":"<email>","password":"mauvais"}'`. La réponse est `401` avec le code `INVALID_EMAIL_OR_PASSWORD`, identique pour un compte inexistant.
- **Frein par compte.** Au-delà de 10 tentatives en 5 minutes sur un même e-mail (réussies ou non), `/api/auth/sign-in/email` répond `429` `TooManyAttempts`. En local le compteur vit en mémoire : relancer le serveur pour le réarmer. Éviter de rejouer plus de 10 fois la connexion du même compte dans un test.
- **Sign-up fermé.** `POST /api/auth/sign-up/email` sans en-tête `x-invitation-token` valide répond `403` `SignUpDisabled` — la création de compte passe uniquement par `user.completeRegistration` (lien d'invitation).
- **Retour à la page demandée.** Sans session, ouvrir une page privée. Lancer `agent-browser cookies clear` puis `agent-browser open http://localhost:3000/tous-les-signalements`. L'URL devient `/connexion?returnTo=%2Ftous-les-signalements`.
- **Garde de profil.** S'authentifier avec un compte dont `firstName` ou `lastName` est vide, obtenu par `aplus-verify sql "select email from \"User\" where (\"firstName\" is null or \"firstName\" = '') and \"deletedAt\" is null limit 1;"`. Après `aplus-verify login <email>` et ouverture de `/tous-les-signalements`, l'URL devient `/profil-incomplet`.
- **Garde 2FA admin.** S'authentifier avec un compte `admin` obtenu par `aplus-verify users admin`, puis ouvrir `/tous-les-signalements`. L'URL devient `/configurer-2fa` tant que la 2FA n'est pas activée.
- **Déconnexion.** Choisir `Se déconnecter`. Récupérer sa référence dans le `snapshot`, faire `agent-browser scrollintoview "@$REF"` puis `agent-browser click "@$REF"`, et rouvrir `/tous-les-signalements`. L'URL retombe sur `/connexion`.
- **Preuve.** Capturer l'état connecté. Lancer `agent-browser snapshot -i` et `agent-browser screenshot "$PWD/.claude/skills/verify-aplus/evidence/auth-connecte.png"` (chemin absolu obligatoire). Les deux artefacts montrent le nom du compte dans l'en-tête.

## Gotchas

- **Le bouton `Se connecter` est à `y=1063`, hors d'un viewport de 577 px.** Sans `scrollintoview`, le clic tombe dans le vide : `agent-browser` répond `✓ Done`, aucune requête ne part, aucun message de validation n'apparaît, et rien ne distingue ce cas d'un formulaire cassé. C'est la panne de pilotage la plus probable sur cette page.
- **Ouvrir `/connexion` avec une session active redirige** vers la page privée. Purger les cookies et confirmer `location.pathname` avant de conclure quoi que ce soit sur le formulaire.
- `agent-browser fill` n'alimente pas l'état React : le champ paraît rempli sans l'être. Utiliser `type` sur une référence de `snapshot`.
- Saisir avant la fin de l'hydratation perd les frappes silencieusement. Attendre `networkidle` puis ≈ 2 s.
- La page de connexion affiche en permanence un bandeau sur la fin de la connexion par lien magique. Ce n'est pas un message d'erreur : ne pas le lire comme le résultat d'une soumission.
- Redis n'est pas configuré en local : better-auth garde les sessions en mémoire et un redémarrage du serveur les invalide toutes.
- `auth-forgot` déclenche un **envoi réel via Brevo**, même en local : le store renvoie `status: sent` avec un `messageId`. Sans conséquence en pratique — toutes les adresses de `User` sont des puits sauf celles du mainteneur (`aplus-verify mailrisk` le confirme à l'instant t). Lire le résultat par `debug.getEmails`, et attendre quelques secondes : l'envoi est différé par `after()`, sinon le store paraît vide.
- Le mot de passe `test1234` conservé dans les mémoires d'agent ne fonctionne plus sur `doironcharles@gmail.com`.
