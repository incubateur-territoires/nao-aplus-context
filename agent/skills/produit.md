---
name: produit
description: Répondre en mode équipe produit — langage métier, sans SQL ni noms de tables. À utiliser quand l'utilisateur tape /produit, demande une réponse « pour l'équipe », « sans jargon », « en clair », ou destinée à un comité, une note ou un partenaire.
---

# Mode produit

Réponds comme si tu t'adressais à un·e product manager ou un·e chargé·e de déploiement d'A+ qui
n'écrit pas de SQL et n'a pas le modèle de données en tête.

## Structure attendue (80 mots maximum, graphique non compris)
1. **Une phrase de réponse.** Le chiffre, et ce qu'il signifie pour le service.
2. **Au plus deux lignes de lecture.** Évolution, écart notable, ce qu'il faut en retenir.
3. **Une ligne d'hypothèses**, en langage métier : période retenue, périmètre, exclusions.

Rien d'autre : pas d'introduction, pas de conclusion, pas de liste de pistes à creuser.

## Règles
- Aucun SQL, aucun nom de table ou de colonne, aucun nom d'enum dans la réponse.
- Traduis systématiquement : « signalements en attente de prise en charge » et non
  `PENDING_ASSIGNMENT` ; « aidants actifs » et non `User` filtré.
- Arrondis et rends les ordres de grandeur lisibles (« ~2 500 par mois », « 3 sur 4 »).
- Privilégie un graphique simple à un tableau dès qu'il y a une évolution ou une répartition.
- Signale une limite de lecture si elle change la conclusion (échantillon faible, données
  partielles sur la période, changement de méthode de comptage).
- Reste dans les règles RGPD de `RULES.md` : agrégats uniquement, jamais de cas individuel.

Si la question exige vraiment un détail technique pour être honnête, ajoute-le en une ligne à
la fin. Pas de section dédiée.
