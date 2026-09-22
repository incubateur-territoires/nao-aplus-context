# Section d'invitation (InviteSection)

Cette section permet d'inviter d'autres utilisateurs ou organismes à participer à un signalement. Le comportement et les options disponibles varient selon le rôle de l'utilisateur.

## Rôles disponibles

### Helper (Référent/Aide)

Le rôle Helper permet d'inviter des membres de l'équipe ou d'autres organismes opérateurs.

#### Options disponibles

1. **Inviter des membres de l'équipe** (`COLLEAGUES`)
   - Permet d'inviter des collègues de la même équipe que l'auteur du signalement
   - Peut être désactivée s'il n'y a pas d'autres collègues à inviter
   - Le message d'indication change : "Il n'y a pas d'autre collègue à inviter" si désactivée

2. **Ce signalement nécessite l'intervention d'autres équipes opérateur** (`ORGANIZATIONS`)
   - Permet d'inviter d'autres organismes/équipes opérateurs

#### Comportement

- **Sélection par défaut** :
  - Si aucun radio n'est désactivé et qu'aucune option n'est explicitement sélectionnée, aucun radio n'est coché par défaut
  - Si l'option "Inviter des membres de l'équipe" est désactivée (pas de collègues), elle est automatiquement sélectionnée

- **Affichage conditionnel** :
  - Le formulaire d'invitation de collègues (`InviteColleague`) s'affiche uniquement si l'option `COLLEAGUES` est explicitement sélectionnée
  - Le formulaire d'invitation d'organismes (`InviteGroups`) s'affiche uniquement si l'option `ORGANIZATIONS` est explicitement sélectionnée

- **Impact sur le statut** :
  - Le statut du signalement reste inchangé lors de l'invitation

#### Logique technique

- Charge les collègues de l'équipe du demandeur (`applicantTeamId`)
- Filtre les collègues déjà liés au signalement
- Détermine `showColleaguesToInvite` basé sur la disponibilité de collègues à inviter
- Utilise `effectiveSelectedOption` pour gérer la sélection par défaut vs sélection explicite

### Instructor (Opérateur)

Le rôle Instructor permet uniquement d'inviter d'autres organismes, avec la possibilité de marquer le signalement comme non pertinent.

#### Options disponibles

1. **"{Nom de l'équipe} n'est pas le bon interlocuteur"** (`IS_IRRELEVANT`)
   - Marque le signalement comme non pertinent (`isIrrelevant: true`)
   - Permet d'inviter d'autres organismes
   - Le nom de l'équipe actuellement assignée est affiché dynamiquement

2. **Ce signalement nécessite l'intervention d'autres équipes opérateur** (`ORGANIZATIONS`)
   - Permet d'inviter d'autres organismes sans marquer le signalement comme non pertinent

#### Comportement

- **Titre fixe** : "Inviter d'autres organismes" (pas d'invitation de collègues disponible)

- **Sélection par défaut** :
  - Aucun radio n'est coché par défaut
  - L'utilisateur doit explicitement sélectionner une option

- **Affichage conditionnel** :
  - Le formulaire d'invitation d'organismes (`InviteGroups`) s'affiche pour les deux options (`IS_IRRELEVANT` et `ORGANIZATIONS`)
  - Aucun formulaire d'invitation de collègues n'est disponible

- **Impact sur le statut** :
  - Le statut du signalement reste inchangé lors de l'invitation
  - Si `IS_IRRELEVANT` est sélectionné, une réponse de métadonnées est créée avec `isIrrelevant: true`

#### Logique technique

- Récupère l'équipe de l'instructeur depuis le signalement (`requestedTeams`)
- Trouve l'équipe correspondante parmi les équipes de l'utilisateur actuel
- Affiche le nom de cette équipe dans l'option `IS_IRREVANT`
- Ne charge pas les collègues de l'équipe

## Composants partagés

### InviteGroups

Composant utilisé par les deux rôles pour inviter des organismes :

- Permet de sélectionner une zone géographique
- Filtre les équipes disponibles selon la zone et les filtres (tags, etc.)
- Exclut les équipes déjà liées au signalement
- Permet d'ajouter un message optionnel
- Crée une réponse de métadonnées lors de l'invitation
- Si `IS_IRRELEVANT` est sélectionné, marque la réponse comme non pertinente

### Gestion de l'état

- `selectedOption` : Option explicitement sélectionnée par l'utilisateur (peut être `null`)
- `effectiveSelectedOption` : Option effective à utiliser (combine sélection explicite et valeur par défaut)
- Les formulaires d'invitation ne s'affichent que lorsque `selectedOption` correspond à l'option requise

## Conditions d'affichage

La section d'invitation n'est pas affichée si :

- Le signalement est fermé (`status === CLOSED` ou `status === COMPLETED`)

## Notes d'implémentation

### Hydration

Pour éviter les erreurs d'hydratation, le composant `InviteTypeRadioButtonsHelper` utilise :

- Un état `isMounted` pour détecter le montage côté client
- Des valeurs "sûres" par défaut pendant le SSR et le rendu initial
- Mise à jour vers les valeurs réelles après le montage

### Recherche d'équipes

La recherche d'équipes utilise :

- Filtrage par zone géographique (`areaId`)
- Exclusion des équipes déjà liées (`alreadyLinkedRequestedTeamsIds`)
- Filtres par tags et autres critères
- L'équipe du demandeur est automatiquement exclue

## Types

```typescript
enum SelectedOptionEnum {
  ORGANIZATIONS = "ORGANIZATIONS",
  COLLEAGUES = "COLLEAGUES",
  IS_IRRELEVANT = "IS_IRRELEVANT",
  HAS_STANDARD_PROCEDURE = "HAS_STANDARD_PROCEDURE",
}

type SelectedOption = SelectedOptionEnum | null;
```
