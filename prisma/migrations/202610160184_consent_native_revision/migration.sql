BEGIN;
ALTER TABLE "Customer" ADD COLUMN "consentRevision" INTEGER NOT NULL DEFAULT 0 CHECK ("consentRevision">=0);
-- Existing grants have no proven native revision; keep their historical facts
-- but require fresh consent before any future dispatch.
ALTER TABLE "ConsentEvent" ADD COLUMN "customerRevision" INTEGER NOT NULL DEFAULT -1 CHECK ("customerRevision">=-1);
CREATE FUNCTION pos_customer_consent_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD."consentRevision"=2147483647 THEN RAISE EXCEPTION 'CONSENT_CUSTOMER_REVISION_EXHAUSTED' USING ERRCODE='23514';END IF;
 -- Every card update invalidates grants, even with an unchanged timestamp or
 -- an explicitly supplied revision. Application clocks cannot bypass this.
 NEW."consentRevision":=OLD."consentRevision"+1;
 RETURN NEW;
END $$;
CREATE TRIGGER customer_consent_revision BEFORE UPDATE ON "Customer" FOR EACH ROW EXECUTE FUNCTION pos_customer_consent_revision();
DO $$ DECLARE definition TEXT; needle TEXT:='NEW."customerVersion" IS DISTINCT FROM customer."updatedAt"'; BEGIN
 definition:=pg_get_functiondef('pos_customer_consent_guard()'::regprocedure);
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'UNKNOWN_CONSENT_GUARD';END IF;
 definition:=replace(definition,needle,needle||' OR NEW."customerRevision"<>customer."consentRevision"');
 EXECUTE definition;
END $$;
COMMIT;
