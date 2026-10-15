BEGIN;
CREATE TABLE "ConsentEvent" (
 id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 "customerId" TEXT NOT NULL REFERENCES "Customer"(id), revision INTEGER NOT NULL,
 purpose TEXT NOT NULL CHECK (purpose IN ('electronic_receipt','service_reminder','marketing')),
 channel TEXT NOT NULL CHECK (channel IN ('sms','email','telegram')),
 granted BOOLEAN NOT NULL, source TEXT NOT NULL CHECK (source IN ('in_person','written','customer_request')),
 "evidenceRef" TEXT NOT NULL CHECK ("evidenceRef" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{2,159}$'),
 "policyVersion" TEXT NOT NULL CHECK ("policyVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$'),
 "createdBy" TEXT NOT NULL REFERENCES "User"(id), "customerVersion" TIMESTAMP(3) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE("customerId",revision)
);
CREATE INDEX "ConsentEvent_organizationId_customerId_purpose_channel_revision_idx"
 ON "ConsentEvent"("organizationId","customerId",purpose,channel,revision);
CREATE FUNCTION pos_customer_consent_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE customer "Customer"; previous_revision INTEGER;
BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RETURN OLD;END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'CONSENT_HISTORY_IMMUTABLE' USING ERRCODE='23514';END IF;
 SELECT * INTO customer FROM "Customer" WHERE id=NEW."customerId" AND "organizationId"=NEW."organizationId" FOR UPDATE;
 IF customer.id IS NULL OR NOT pos_loyalty_owner(NEW."organizationId",NEW."createdBy") THEN
  RAISE EXCEPTION 'CONSENT_SCOPE_INVALID' USING ERRCODE='23514';END IF;
 IF NEW.granted THEN
  PERFORM assert_business_writable(NEW."organizationId");
  IF NOT customer."isActive" OR customer."mergedIntoId" IS NOT NULL THEN
   RAISE EXCEPTION 'CONSENT_CUSTOMER_INACTIVE' USING ERRCODE='23514';END IF;
 END IF;
 SELECT COALESCE(max(revision),0) INTO previous_revision FROM "ConsentEvent" WHERE "customerId"=customer.id;
 IF NEW.revision<>previous_revision+1 OR NEW."customerVersion" IS DISTINCT FROM customer."updatedAt" THEN
  RAISE EXCEPTION 'CONSENT_REVISION_CONFLICT' USING ERRCODE='23514';END IF;
 NEW."createdAt":=clock_timestamp()::timestamp(3);
 RETURN NEW;
END $$;
CREATE TRIGGER "ConsentEvent_guard" BEFORE INSERT OR UPDATE OR DELETE ON "ConsentEvent"
 FOR EACH ROW EXECUTE FUNCTION pos_customer_consent_guard();
COMMIT;
