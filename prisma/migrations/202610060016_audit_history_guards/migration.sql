BEGIN;
CREATE FUNCTION guard_audit_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN
  RETURN OLD;
 END IF;
 -- Preserve the existing User ON DELETE SET NULL anonymization without allowing edits.
 IF TG_OP='UPDATE' AND OLD."actorId" IS NOT NULL AND NEW."actorId" IS NULL
    AND (to_jsonb(NEW)-'actorId')=(to_jsonb(OLD)-'actorId')
    AND NOT EXISTS(SELECT 1 FROM "User" WHERE id=OLD."actorId") THEN
  RETURN NEW;
 END IF;
 RAISE EXCEPTION 'Audit history is append-only' USING ERRCODE='23514';
END $$;
CREATE TRIGGER "AuditLog_history" BEFORE UPDATE OR DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION guard_audit_history();
CREATE INDEX "AuditLog_organization_created_id" ON "AuditLog"("organizationId","createdAt" DESC,id);
COMMIT;
