-- Convertir le champ role de enum UserRole vers String sans perte de données

-- 1. Ajouter une colonne temporaire de type TEXT
ALTER TABLE "User" ADD COLUMN "role_new" TEXT;

-- 2. Copier les valeurs en les convertissant en string
UPDATE "User" SET "role_new" = "role"::TEXT;

-- 3. Supprimer l'ancienne colonne
ALTER TABLE "User" DROP COLUMN "role";

-- 4. Renommer la nouvelle colonne
ALTER TABLE "User" RENAME COLUMN "role_new" TO "role";

-- 5. Ajouter la valeur par défaut
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';

-- 6. Rendre la colonne NOT NULL
ALTER TABLE "User" ALTER COLUMN "role" SET NOT NULL;

-- 7. Supprimer l'enum (si plus utilisé)
DROP TYPE IF EXISTS "UserRole";
