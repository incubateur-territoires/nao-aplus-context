-- Convertir les rôles utilisateurs en minuscules pour compatibilité better-auth
UPDATE "User" SET role = LOWER(role);

-- Mettre à jour la valeur par défaut
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'user';
