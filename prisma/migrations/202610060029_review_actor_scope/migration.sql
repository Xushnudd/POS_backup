BEGIN;
CREATE FUNCTION pos_review_actor_scope() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
 IF TG_TABLE_NAME='SyncReview' THEN
  IF NOT EXISTS(SELECT 1 FROM "OrganizationUser" WHERE "organizationId"=NEW."organizationId" AND "userId"=NEW."actorId") THEN RAISE EXCEPTION 'review actor tenant mismatch'; END IF;
 END IF;
 IF NEW."resolvedBy" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "OrganizationUser" WHERE "organizationId"=NEW."organizationId" AND "userId"=NEW."resolvedBy") THEN RAISE EXCEPTION 'resolution actor tenant mismatch'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER "SyncReview_actor_scope" BEFORE INSERT OR UPDATE ON "SyncReview" FOR EACH ROW EXECUTE FUNCTION pos_review_actor_scope();
CREATE TRIGGER "Incident_actor_scope" BEFORE INSERT OR UPDATE ON "Incident" FOR EACH ROW EXECUTE FUNCTION pos_review_actor_scope();
COMMIT;
