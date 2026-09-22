# ADR-007 — Système de design de l'État (DSFR)

**Date** : 2024  
**Statut** : Accepté

## Contexte

Administration+ est un service numérique de l'État soumis aux exigences du [Système de Design de l'État (DSFR)](https://www.systeme-de-design.gouv.fr/). Le respect du DSFR est une obligation réglementaire pour les services publics numériques et garantit cohérence, accessibilité (RGAA) et reconnaissance par les usagers.

## Décision

Utilisation de **`@codegouvfr/react-dsfr`** comme bibliothèque de composants principale, complétée par **Tailwind CSS** pour les ajustements de mise en page.

## Justification

- **Conformité DSFR** : `react-dsfr` est le binding React officiel du DSFR, maintenu par la DINUM/beta.gouv.fr. Il implémente les composants (boutons, formulaires, alertes, tableaux, navigation) avec les tokens de design corrects.
- **Accessibilité incluse** : les composants DSFR intègrent les attributs ARIA, la navigation clavier et les contrastes conformes RGAA 4.1.
- **Cohérence avec l'écosystème beta.gouv.fr** : les autres services de l'incubateur utilisent le même système, facilitant les revues de code et les contributions externes.
- **Tailwind CSS** : utilisé uniquement pour les espacements, la mise en page (flex/grid) et les ajustements qui ne sont pas couverts par les classes utilitaires DSFR. Ne remplace pas les composants DSFR.

## Conséquences

- L'initialisation DSFR est effectuée dans `src/dsfr-bootstrap/` (import des CSS, configuration du thème).
- Les imports de composants doivent provenir de `@codegouvfr/react-dsfr`, pas de MUI ou d'autres bibliothèques UI pour les éléments couverts par le DSFR.
- MUI est présent dans le projet pour des composants complexes non couverts par le DSFR (ex. data grids). Son usage doit rester limité et stylisé avec les tokens DSFR.
- `optimizePackageImports: ["@codegouvfr/react-dsfr"]` est activé dans `next.config.mjs` pour réduire la taille des bundles.
