BEGIN;
ALTER TABLE "ConsentEvent" DROP CONSTRAINT "ConsentEvent_channel_check";
ALTER TABLE "ConsentEvent" ADD CONSTRAINT "ConsentEvent_channel_check" CHECK(channel IN ('sms','email','telegram','in_person'));
ALTER TABLE "ConsentEvent" ADD CONSTRAINT "ConsentEvent_in_person_purpose" CHECK(channel<>'in_person' OR purpose='service_reminder');
ALTER TABLE "BackgroundJob" DROP CONSTRAINT "BackgroundJob_type_check";
ALTER TABLE "BackgroundJob" ADD CONSTRAINT "BackgroundJob_type_check" CHECK(type IN ('reconciliation','catalog_export','tenant_export','report_export','customer_reminder'));
CREATE UNIQUE INDEX "BackgroundJob_reminder_daily_grant_idx" ON "BackgroundJob"("organizationId",(payload#>>'{reminder,customerId}'),(payload#>>'{reminder,consentEventId}'),(payload#>>'{reminder,noticeDate}')) WHERE type='customer_reminder';
CREATE FUNCTION pos_reminder_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE customer "Customer"; consent "ConsentEvent";
BEGIN
 IF NEW.type<>'customer_reminder' THEN RETURN NEW;END IF;
 IF TG_OP='INSERT' THEN
  IF jsonb_typeof(NEW.payload->'reminder') IS DISTINCT FROM 'object' OR NEW.payload#>>'{reminder,noticeDate}' IS DISTINCT FROM (SELECT to_char(clock_timestamp() AT TIME ZONE timezone,'YYYY-MM-DD') FROM "Organization" WHERE id=NEW."organizationId") THEN RAISE EXCEPTION 'REMINDER_SOURCE_INVALID' USING ERRCODE='23514';END IF;
 END IF;
 IF TG_OP='INSERT' OR (NEW.state='succeeded' AND OLD.state<>'succeeded') THEN
  SELECT * INTO customer FROM "Customer" WHERE id=NEW.payload#>>'{reminder,customerId}' AND "organizationId"=NEW."organizationId" FOR UPDATE;
  SELECT * INTO consent FROM "ConsentEvent" WHERE "customerId"=customer.id AND "organizationId"=NEW."organizationId" AND purpose='service_reminder' AND channel='in_person' ORDER BY revision DESC LIMIT 1;
  IF customer.id IS NULL OR NOT customer."isActive" OR customer."mergedIntoId" IS NOT NULL OR consent.id IS NULL OR NOT consent.granted OR consent.id IS DISTINCT FROM NEW.payload#>>'{reminder,consentEventId}' OR consent."customerRevision"<>customer."consentRevision" THEN RAISE EXCEPTION 'CUSTOMER_CONSENT_REQUIRED' USING ERRCODE='23514';END IF;
  IF NEW.state='succeeded' AND (NEW.result->>'customerId' IS DISTINCT FROM customer.id OR NEW.result->>'consentEventId' IS DISTINCT FROM consent.id OR NEW.result->>'version' IS DISTINCT FROM '1' OR NEW.result->>'keyId' !~ '^[a-f0-9]{64}$' OR NEW.result->>'tokenHash' !~ '^[a-f0-9]{64}$' OR octet_length(NEW.result::text)>1048576) THEN RAISE EXCEPTION 'REMINDER_RESULT_INVALID' USING ERRCODE='23514';END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER reminder_source_guard BEFORE INSERT OR UPDATE ON "BackgroundJob" FOR EACH ROW EXECUTE FUNCTION pos_reminder_source_guard();
COMMIT;
