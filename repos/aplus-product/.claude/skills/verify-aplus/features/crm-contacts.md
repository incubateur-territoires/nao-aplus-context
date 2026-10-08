# Contacts (mini-CRM)

Le CRM est un annuaire de correspondants extérieurs au service, réservé aux admins. Une fiche porte un nom, une adresse e-mail, une adresse postale, un territoire et un organisme. Depuis la fiche, un admin envoie un e-mail au contact ; les réponses du contact reviennent par un webhook Brevo entrant et s'affichent dans le même fil, dans l'ordre chronologique.

## Sub-features

- `crm-list` affiche l'annuaire des contacts, paginé et triable.
- `crm-search` filtre à la saisie sur le prénom, le nom et l'adresse e-mail, accents et casse ignorés ; l'état vit dans l'URL (`c_q`, `c_page`, `c_sort`, `c_order`) via `useUrlTableState`.
- `crm-create` crée une fiche depuis `/admin/crm/creer`.
- `crm-detail` ouvre la fiche d'un contact avec ses informations et son fil d'échanges.
- `crm-edit` modifie une fiche depuis `/admin/crm/modifier/<contactId>`.
- `crm-send` envoie un e-mail au contact et ajoute un message sortant au fil.
- `crm-inbound` enregistre une réponse du contact reçue par le webhook Brevo, en message entrant.

## How to get to it (user POV)

- Ouvrir le menu déroulant `Administration` du menu principal, puis `CRM`, ou ouvrir `/admin/crm`. Le menu n'apparaît que pour un admin.
- Choisir `Ajouter un contact` pour ouvrir `/admin/crm/creer`.
- Choisir `Voir la fiche` sur une ligne pour ouvrir `/admin/crm/<contactId>`.
- Choisir `Modifier le contact` depuis la fiche pour ouvrir `/admin/crm/modifier/<contactId>`.

## Driving it with agent-browser

Préconditions :

- Session posée sur un compte `admin` **avec 2FA active** : toutes les procédures `crm.*` sont des `adminProcedure`, et le proxy renvoie un admin sans 2FA sur `/configurer-2fa`. Sans 2FA franchie, ce parcours est inatteignable : le signaler comme précondition non remplie.
- La migration `add_contact_crm` doit être appliquée sur la base visée. Tant qu'elle ne l'est pas, les tables `Contact` et `ContactMessage` n'existent pas et chaque écran remonte une erreur Prisma. Vérifier d'abord : `aplus-verify sql "select to_regclass('\"Contact\"');"` doit renvoyer autre chose que `NULL`.
- `crm-send` envoie un **vrai e-mail** au contact, sans garde d'environnement. Lancer `aplus-verify mailrisk` et ne viser qu'une adresse puits.

- **Lister.** Lancer `agent-browser open $APLUS_BASE_URL/admin/crm` puis `agent-browser wait --load networkidle`. Le titre de niveau 1 est `Contacts`. Les colonnes sont `Nom`, `Adresse e-mail`, `Territoire`, `Organisme`, `Date de création`, `Action`. Le tri par défaut est `Nom` croissant ; seules les colonnes `Nom`, `Adresse e-mail` et `Date de création` sont triables.
- **Rechercher.** `agent-browser focus "#search-contacts input"` puis `agent-browser keyboard type "<terme>"` (`#search-contacts` seul est le wrapper DSFR, et `click`/`type` n'y posent pas le focus). Après ~300 ms, l'URL porte `c_q=<terme>` et le tableau se réduit.
- **Créer.** Choisir `Ajouter un contact`. Le titre de niveau 1 devient `Ajouter un contact`. Les champs sont `#contact-first-name` (Prénom), `#contact-last-name` (Nom), `#contact-email` (Adresse e-mail), `#contact-address` (Adresse), `#contact-area` (Territoire) et `#contact-organization` (Organisme) ; les deux selects ont une première option `Non renseigné` de valeur vide. Saisir avec `type` sur les références du `snapshot`, puis valider par `Créer le contact`. Le retour se fait sur `/admin/crm`.
- **Preuve de création.** `aplus-verify sql "select id, \"firstName\", \"lastName\", email from \"Contact\" where email = '<adresse du contact de test>';"`. La base est partagée : filtrer sur l'adresse saisie, jamais sur la dernière ligne créée.
- **Ouvrir une fiche.** Choisir `Voir la fiche`. Le titre de niveau 1 est `Prénom Nom` ; les titres de niveau 2 sont, dans l'ordre, `Informations du contact`, `Échanges` et `Envoyer un message`.
- **Modifier.** Choisir `Modifier le contact`, changer un champ, valider par `Enregistrer les modifications`. Le retour se fait sur la fiche. Vider `Adresse` doit effacer la valeur en base, pas la laisser : le formulaire envoie `null`, pas `undefined`.
- **Envoyer un e-mail.** Renseigner `#contact-email-subject` (Objet) et `#contact-email-content` (Message, zone de texte), puis `Envoyer le message` avec `aplus-verify click`. L'alerte `Le message a bien été envoyé.` apparaît (`role="status"`), le formulaire se vide et le fil gagne un message marqué `Envoyé par <Prénom Nom>`. En cas d'échec, l'alerte est `Le message n'a pas été envoyé.` (`role="alert"`).
- **Preuve de l'envoi.** Le log serveur contient `crm.sendEmail` en `200`, et `aplus-verify sql "select m.direction, m.subject, m.\"brevoMessageId\" from \"ContactMessage\" m join \"Contact\" c on c.id = m.\"contactId\" where c.email = '<adresse du contact de test>' and m.subject = '<objet saisi>';"` renvoie une ligne `OUTBOUND` portant un identifiant Brevo. Le message est enregistré avant l'envoi : une ligne sans identifiant signale un envoi dont l'identifiant n'a pas pu être stocké (voir le log `[CRM]`).
- **Réception d'une réponse.** Le webhook s'appelle en direct, sans navigateur : `curl -s -o /dev/null -w '%{http_code}' -X POST "$APLUS_BASE_URL/api/webhooks/brevo/inbound?token=$BREVO_INBOUND_WEBHOOK_TOKEN" -H 'Content-Type: application/json' -d '{"items":[{"From":{"Address":"<adresse du contact de test>"},"Subject":"Réponse","RawTextBody":"Bonjour","MessageId":"<identifiant unique>"}]}'`. Attendu : `200`. Rejouer la même commande à l'identique doit encore renvoyer `200` sans créer de seconde ligne. Un `token` erroné renvoie `401`, un corps non-JSON `400`.
- **Preuve de la réception.** `aplus-verify sql "select count(*) from \"ContactMessage\" where \"brevoMessageId\" = '<identifiant unique>';"` renvoie `1` après le premier appel comme après le rejeu.
- **Preuve UI.** Lancer `agent-browser screenshot "$PWD/.claude/skills/verify-aplus/evidence/contact-<contactId>.png"` avec le fil des échanges visible.

## Gotchas

- `crm-inbound` ne fonctionne que si le « inbound parsing » Brevo est configuré côté fournisseur et pointe vers l'URL publique de l'instance avec le bon `token`. En local, l'endpoint n'est pas joignable depuis Brevo : le chemin réel ne se vérifie pas sans tunnel, et l'appel `curl` ci-dessus ne prouve que le comportement de l'endpoint, pas l'acheminement.
- Le token du webhook voyage en **query param** et non en en-tête, parce que Brevo ne permet pas d'en-tête personnalisé. Il apparaît donc dans les logs d'accès : ne jamais le coller dans une preuve, un commit ou une description de MR.
- Sans `BREVO_INBOUND_WEBHOOK_TOKEN`, l'endpoint refuse **tout** appel. Un `401` en local signifie le plus souvent une variable absente, pas un bug.
- Le webhook répond `200` même quand aucun item n'a trouvé de contact. C'est voulu : un non-200 fait rejouer Brevo indéfiniment. Ne pas conclure d'un `200` que le message a été enregistré ; c'est le `count` en base qui le prouve.
- Un expéditeur sans fiche de contact active est ignoré silencieusement. Le CRM ne crée jamais de contact depuis un e-mail reçu.
- L'adresse `replyTo` des envois vaut `CRM_INBOUND_EMAIL` **si elle est définie**, sinon aucun `replyTo` n'est posé. Sans elle, une réponse du contact ne reviendra jamais dans le fil : le vérifier avant de conclure à un webhook cassé.
- `crm.sendEmail` porte son propre plafond (30 envois par heure et par compte), distinct de la limite globale des mutations. Un `TOO_MANY_REQUESTS` après une série d'essais est attendu, pas une régression.
- `#search-contacts` est le **wrapper** DSFR, pas l'input. Viser `#search-contacts input`, passer par `focus` puis `keyboard type`, et juger sur l'URL (`c_q`).
- La suppression est douce (`deletedAt`) et n'a aucun point d'entrée dans l'interface : `crm.deleteContact` n'est atteignable que par appel direct. Ne pas signaler son absence comme un bouton cassé.
- Les adresses e-mail sont normalisées (minuscules, espaces retirés) avant écriture et avant rapprochement. Une recherche ou un rapprochement qui échoue sur une différence de casse est un vrai défaut, pas un comportement attendu.
