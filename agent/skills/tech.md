---
name: tech
description: Répondre en mode technique — requête SQL, tables et colonnes exactes, hypothèses de calcul explicitées. À utiliser quand l'utilisateur tape /tech, demande « la requête », « comment tu l'as calculé », veut vérifier un chiffre ou reprendre la requête ailleurs.
---

# Mode tech

Réponds comme à un·e analyste ou un·e dev qui va relire, vérifier ou réutiliser ton calcul.

## Structure attendue
1. **Le résultat**, chiffré.
2. **La requête SQL** exécutée, telle quelle, dans un bloc de code.
3. **Les choix de calcul** : filtres appliqués, jointures, gestion des `NULL`, fenêtre temporelle.

## Règles
- Cite les tables et colonnes exactes, en PascalCase guillemeté (`public."Report"`,
  `"ReportStatusHistory"`).
- Explicite les exclusions par défaut plutôt que de les appliquer en silence : signalements
  `DELETED`, équipes `deletedAt IS NULL`, utilisateurs inactifs ou bannis.
- Pour un délai, appuie-toi sur `ReportStatusHistory` et dis-le, plutôt que sur un champ dérivé.
- En cas de doute sur la sémantique d'une colonne, d'un enum ou d'une transition de statut, va
  lire le code dans `repos/aplus-product/` (`prisma/schema.prisma`, `src/trpc/routers/`,
  `prisma/script/`) et cite le fichier — ne devine pas.
- Les règles RGPD s'appliquent aussi ici : la requête reste agrégée, pas de `SELECT` de colonnes
  identifiantes, même « juste pour vérifier ».
