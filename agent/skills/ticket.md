---
name: ticket
description: Créer un ticket dans le backlog Notion d'Administration+. À utiliser dès que l'utilisateur dit « crée un ticket », « ajoute un ticket », « mets ça dans le backlog », « ouvre un bug », « fais une tâche pour ça », ou demande de transformer un constat en élément de backlog.
---

# Créer un ticket dans le backlog A+

## La base est fixée — ne la cherche pas

Tous les tickets vont dans **« Backlog (app react) »** :

- data source : `collection://1ff744bf-03dd-81ba-b104-000b8c246fa6`
- page : https://app.notion.com/p/1ff744bf03dd81af9ccfd5880aa6cbe9
- emplacement : `Startups / Administration + / Delivery / 🚢 Backlog : Administration+ v1.5 (DSFR - React)`

N'utilise pas la recherche Notion pour trouver où créer le ticket : c'est toujours cette base.
Si l'identifiant ci-dessus échoue, dis-le plutôt que d'en chercher un autre — la base a pu être
déplacée et il faut mettre cette skill à jour.

## Choisir le Type — les trois définitions de l'équipe

- **🚨 Bug** — un problème réellement identifié, **reproductible**, dont le comportement diffère
  de celui attendu ou décrit dans la documentation produit. Si tu ne sais pas le reproduire,
  ce n'est pas encore un bug.
- **🔄 Tâche** — technique ou opérationnelle, nécessite l'intervention d'un développeur.
- **🌱 User story** — une amélioration fonctionnelle, à spécifier proprement : utilisateur
  concerné, valeur apportée, parcours attendu, modalités de test.

Dans le doute entre Bug et Tâche, prends **Tâche** : un faux bug fait perdre du temps en
tentatives de reproduction.

## Propriétés à remplir

| Propriété | Règle |
|---|---|
| `Nom` | Titre court et factuel, qui décrit le symptôme, pas la solution supposée. |
| `Type` | `🚨 Bug`, `🔄 Tâche` ou `🌱 User story` — voir ci-dessus. |
| `État` | Toujours **`Pas commencé`** à la création. |
| ` Description` | Le corps du ticket. **Attention : le nom de cette propriété commence par une espace.** |
| `Détails du bug` | Pour un bug seulement : étapes de reproduction, comportement observé, comportement attendu. |
| `Utilisateur` | Qui est touché : `Aidant`, `Opérateur`, `Responsable d'équipe`, `Admin`, `Superviseur`, `Citoyen`, `Aidant travailleur social`, `Tous les visiteurs`. Plusieurs valeurs possibles. |
| `Initiative` | Seulement si le rattachement est évident, parmi les cinq existantes (dont « Améliorer les statistiques des opérateurs »). Sinon laisse vide. |
| `Auteur du ticket` | La personne qui demande, si son nom correspond à une option (`Charles LP`, `Manon`, `Raph`, `Ana`, `Emeline`, `Charles d'O`). Sinon laisse vide. |
| `Priorité` | **Laisse vide** sauf si la personne la donne. Ce n'est pas à toi d'arbitrer. |

Ne touche pas à `Nb retours restant` (formule), ni à `Feedbacks`, `Suivi auto`, `Lien maquette`,
`Fichiers et médias`.

## Contenu de la description

Écris en français, et dans cet ordre :

1. **Le constat**, en une ou deux phrases.
2. **L'origine** : si le ticket vient d'une analyse que tu viens de faire, donne le chiffre et la
   période, et la requête SQL en bloc de code.
3. **La piste**, si tu en as une : le fichier repéré dans `repos/aplus-product/`, formulé comme
   une hypothèse — « la cause semble être », jamais « le bug est ».
4. **Une dernière ligne** : « Ticket rédigé par Alix à partir d'une analyse des données. »
   Le ticket apparaîtra sous l'identité de la personne connectée, il faut donc le dire.

## Règles

- **Aucune donnée personnelle de citoyen** dans le ticket : ni nom, ni identifiant de
  signalement rattaché à une personne, ni extrait d'échange. Des agrégats, uniquement.
- **Un ticket par problème.** Si la conversation en a soulevé trois, propose-les et crée ceux
  que la personne confirme.
- **Si la demande tient en une ligne sans contexte**, pose une seule question avant de créer :
  ce qui a été observé, et sur quel écran ou quel parcours.
- **Vérifie d'abord les doublons** : cherche dans la base un ticket au titre proche. S'il en
  existe un, propose de commenter l'existant plutôt que d'en créer un second.
- **Après création**, donne le lien du ticket et rien d'autre. Pas de récapitulatif.

## Ce qui ne va pas dans cette base

Le backlog ne reçoit que du produit. Deux cas à réorienter au lieu de créer un ticket :
- un **feedback utilisateur** brut → il va dans « Suivi des retours utilisateurs » ;
- une **idée ou une tâche d'organisation d'équipe** → elle va dans la page opérationnelle.

Dans ces deux cas, dis-le et demande confirmation avant de créer quoi que ce soit.
