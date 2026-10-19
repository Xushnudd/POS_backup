CREATE FUNCTION job_export_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='INSERT' THEN IF NOT EXISTS(SELECT 1 FROM "BackgroundJob" WHERE id=NEW."jobId" AND "organizationId"=NEW."organizationId" AND type='catalog_export' AND state='running') THEN RAISE EXCEPTION 'Export requires scoped running catalogue job';END IF;RETURN NEW;END IF;
 IF TG_OP='DELETE' THEN IF EXISTS(SELECT 1 FROM "BackgroundJob" j JOIN "Organization" o ON o.id=j."organizationId" WHERE j.id=OLD."jobId") THEN RAISE EXCEPTION 'Export history immutable';END IF;RETURN OLD;END IF;
 IF NEW."jobId"<>OLD."jobId" OR NEW."organizationId"<>OLD."organizationId" OR NEW.filename<>OLD.filename OR NEW.mime<>OLD.mime OR NEW.size<>OLD.size OR NEW.sha256<>OLD.sha256 OR NEW."rowCount"<>OLD."rowCount" OR NEW."asOf"<>OLD."asOf" OR NEW."expiresAt"<>OLD."expiresAt" OR NOT(OLD."expiresAt"<=clock_timestamp() AND NEW.data IS NULL) THEN RAISE EXCEPTION 'Export immutable until expiry erasure';END IF;RETURN NEW;
END $$;
CREATE TRIGGER job_export_guard BEFORE INSERT OR UPDATE OR DELETE ON "JobExport" FOR EACH ROW EXECUTE FUNCTION job_export_guard();
