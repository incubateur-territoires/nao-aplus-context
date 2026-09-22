# ADR-005 — Scaleway Object Storage avec chiffrement SSE-C

**Date** : 2024  
**Statut** : Accepté

## Contexte

Les signalements contiennent des pièces jointes (documents d'identité, avis d'imposition, courriers administratifs) qui sont des données personnelles sensibles. Le stockage doit être souverain (hébergement France), chiffré au repos, et accessible uniquement aux utilisateurs autorisés.

## Décision

Stockage des fichiers sur **Scaleway Object Storage** (fr-par, API S3-compatible) avec **chiffrement SSE-C AES256** (Server-Side Encryption with Customer-provided key).

## Justification

- **Souveraineté** : Scaleway est un hébergeur français, cohérent avec le reste de l'infrastructure (Scalingo). Les données ne quittent pas la France.
- **SSE-C** : la clé de chiffrement est fournie par l'application à chaque requête (`SCALEWAY_SSE_ENCRYPTION_KEY`). Scaleway ne stocke jamais la clé — même un accès direct au bucket sans la clé ne permet pas de lire les fichiers.
- **Pas d'exposition directe** : les fichiers ne sont jamais accessibles par URL publique. Tout téléchargement passe par `/api/files/[id]` qui vérifie les droits via la session tRPC.
- **Validation double** : magic bytes côté serveur (`file-type`) + Content-Type déclaré. Empêche l'upload de fichiers exécutables masqués en PDF/image.
- **SDK AWS S3** : `@aws-sdk/client-s3` v3, compatible avec l'API Scaleway, maintenu activement.

## Conséquences

- La clé `SCALEWAY_SSE_ENCRYPTION_KEY` (AES256, base64) et son digest MD5 (`SCALEWAY_SSE_KEY_DIGEST`) sont des secrets critiques. Leur rotation nécessite une procédure de re-chiffrement des fichiers existants (non automatique).
- Taille maximale : 10 Mo par fichier, 10 fichiers par requête.
- Types acceptés : PDF, images (JPEG/PNG/GIF/WebP/BMP/TIFF), documents Office (.doc/.docx/.xls/.xlsx/.ppt/.pptx), ODF, texte/CSV.
- Une vérification HEAD post-upload (2 retries) confirme la présence effective du fichier avant d'enregistrer la référence en base.
