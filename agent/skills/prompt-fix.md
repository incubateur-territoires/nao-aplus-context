---
name: prompt-fix
description: Rédiger un prompt prêt à coller dans un agent de code (Claude Code, Cursor) pour corriger un bug ou une anomalie repérée dans la conversation. À utiliser quand l'utilisateur tape /prompt-fix, demande « donne-moi le prompt », « comment je fais corriger ça », « passe ça à un dev », ou veut transformer un constat en ticket actionnable.
---

# Prompt de correction

Transforme ce qui vient d'être observé dans la conversation en **un seul bloc de texte copiable**,
destiné à un agent de code qui travaille sur le dépôt A+ (`administration-plus`) et qui, lui, n'a
aucun accès à la base de données.

## Périmètre

Le correctif porte sur **l'application Administration+** — le code dans `repos/aplus-product/`.
Il ne porte **jamais** sur tes propres fichiers de contexte (`RULES.md`, `agent/`,
`nao_config.yaml`, `docs/`) : ceux-là se corrigent directement dans le dépôt de contexte, pas
par un prompt destiné à un agent de code. Si la demande concerne ton contexte, dis-le et
n'utilise pas cette skill.

## S'il n'y a rien à traiter

Cette skill transforme **un constat déjà établi dans la conversation**. Si rien n'a été observé
— parce qu'elle est appelée en début d'échange, par exemple — ne devine pas le sujet et ne
propose pas une liste de bugs possibles. Pose une seule question ouverte, du type : « Quel
comportement as-tu constaté ? Décris-le, ou pose-moi la question analytique qui t'a mis la puce
à l'oreille. » Puis arrête-toi.

## Avant d'écrire

1. **Va lire le code** dans `repos/aplus-product/` pour localiser la cause probable. Cite des
   fichiers et des fonctions qui existent. Si tu ne trouves pas, dis-le dans le prompt plutôt
   que d'inventer un chemin plausible.
2. **Vérifie que l'anomalie n'est pas une erreur de lecture** de ta part : mauvaise période,
   `DELETED` non exclus, jointure qui duplique des lignes. Un faux positif envoyé à un dev coûte
   plus cher qu'une minute de vérification.

## Structure du prompt produit

Sors un bloc de code unique, en français, contenant dans cet ordre :

1. **Le constat**, chiffré et daté. « Depuis le 3 septembre, 12 % des signalements passent en
   clôturé sans transition par en cours. »
2. **La preuve** : la requête SQL qui l'établit, telle qu'exécutée, avec son résultat résumé.
3. **La piste** : le ou les fichiers concernés dans le dépôt, avec ce que tu y as lu et pourquoi
   ça pourrait expliquer le constat.
4. **Le comportement attendu**, en une phrase.
5. **Ce qui reste incertain** : ce que tu n'as pas pu vérifier depuis la donnée seule.
6. **Comment vérifier la correction** : le test à écrire, ou la requête à relancer après le fix.

## Règles

- **Pas de données personnelles dans le prompt.** Le constat est un agrégat ; jamais un
  identifiant de signalement lié à un citoyen, jamais un nom, jamais le contenu d'un échange.
  Si un exemple concret est indispensable, donne un identifiant technique seul, sans contexte.
- **Formule des hypothèses, pas des certitudes.** Tu lis un instantané du code qui peut avoir
  plusieurs jours de retard sur `main`. Écris « la cause semble être », pas « le bug est ».
- **Ne propose pas le patch.** Ton rôle s'arrête au diagnostic ; l'agent de code a le dépôt
  complet, les tests et la CI, il est mieux placé que toi pour écrire la correction.
- Un seul bloc, copiable d'un geste. Pas de commentaire avant ou après, sauf pour signaler un
  doute sérieux sur la validité du constat.
