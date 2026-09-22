-- La CAF ne demande plus le NIR : seul l'identifiant CAF reste collecté.
-- Le script d'import ne fait que `connect`, il faut donc détacher ici le
-- lien existant. Le NIR reste requis par CARSAT, CNAM, CNAV, CPAM, CRAM, MSA.
DELETE FROM "_OrganizationToTeamSpecificField"
WHERE "A" IN (SELECT "id" FROM "Organization" WHERE "shortName" = 'CAF')
  AND "B" IN (SELECT "id" FROM "TeamSpecificField" WHERE "name" = 'nir');
