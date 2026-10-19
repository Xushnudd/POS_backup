BEGIN;
ALTER TABLE "Operation" ADD COLUMN "actorId" TEXT;
-- Earlier operations can only be assigned when the original audit gives evidence.
UPDATE "Operation" o SET "actorId"=u.id FROM "User" u WHERE o.result->>'cashierId'=u.id;
UPDATE "Operation" o SET "actorId"=(SELECT a."actorId" FROM "AuditLog" a WHERE a."organizationId"=o."organizationId" AND a."entityId"=o.result->>'id' ORDER BY a."createdAt" ASC LIMIT 1) WHERE o."actorId" IS NULL;
COMMIT;
