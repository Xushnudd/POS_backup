CREATE TABLE "ProviderIntent" (
 id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE NO ACTION,
 "storeId" TEXT NOT NULL REFERENCES "Store"(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
 "actorId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
 "sourceType" TEXT NOT NULL,"sourceKey" TEXT NOT NULL,
 provider TEXT NOT NULL CHECK(provider ~ '^[a-z][a-z0-9_-]{0,63}$'),capability TEXT NOT NULL CHECK(capability IN ('payment','fiscal')),
 request JSONB NOT NULL CHECK(jsonb_typeof(request)='object' AND octet_length(request::text)<=4000),
 "requestHash" TEXT NOT NULL CHECK("requestHash" ~ '^[a-f0-9]{64}$'),
 state TEXT NOT NULL DEFAULT 'awaiting' CHECK(state IN ('awaiting','confirmed','failed','compensating','compensated','needs_review')),
 "compensatesId" TEXT UNIQUE REFERENCES "ProviderIntent"(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
 reason TEXT NOT NULL CHECK(length(btrim(reason)) BETWEEN 3 AND 2000),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ProviderIntent_source_fkey" FOREIGN KEY("organizationId","sourceType","sourceKey") REFERENCES "Operation"("organizationId",type,key) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED,
 CONSTRAINT "ProviderIntent_organizationId_sourceType_sourceKey_provider_capability_key" UNIQUE("organizationId","sourceType","sourceKey",provider,capability)
);
CREATE INDEX "ProviderIntent_organizationId_storeId_createdAt_id_idx" ON "ProviderIntent"("organizationId","storeId","createdAt",id);
CREATE TABLE "ProviderOutbox" (
 "intentId" TEXT PRIMARY KEY REFERENCES "ProviderIntent"(id) ON DELETE CASCADE ON UPDATE NO ACTION,
 state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','unknown','review','confirmed','failed')),
 mode TEXT NOT NULL DEFAULT 'submit' CHECK(mode IN ('submit','lookup')),
 generation INT NOT NULL DEFAULT 0 CHECK(generation>=0),
 "submitAttempts" INT NOT NULL DEFAULT 0 CHECK("submitAttempts" BETWEEN 0 AND 1),
 "lookupAttempts" INT NOT NULL DEFAULT 0 CHECK("lookupAttempts" BETWEEN 0 AND 32),
 "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"leaseToken" TEXT,"leaseUntil" TIMESTAMP(3),
 "externalId" TEXT CHECK("externalId" IS NULL OR length("externalId") BETWEEN 1 AND 200),
 "resultCode" TEXT CHECK("resultCode" IS NULL OR "resultCode" ~ '^[A-Z][A-Z0-9_]{0,63}$'),
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK((state='running' AND "leaseToken" IS NOT NULL AND "leaseUntil" IS NOT NULL) OR (state<>'running' AND "leaseToken" IS NULL AND "leaseUntil" IS NULL)),
 CHECK(mode<>'lookup' OR "submitAttempts"=1)
);
CREATE INDEX "ProviderOutbox_state_nextRunAt_idx" ON "ProviderOutbox"(state,"nextRunAt");
CREATE TABLE "ProviderEvent" (
 id TEXT PRIMARY KEY,"intentId" TEXT NOT NULL REFERENCES "ProviderIntent"(id) ON DELETE CASCADE ON UPDATE NO ACTION,
 event TEXT NOT NULL CHECK(event IN ('queued','claimed','unknown','confirmed','failed','review','lease_lost','compensation_requested')),
 generation INT NOT NULL CHECK(generation>=0),code TEXT CHECK(code IS NULL OR code ~ '^[A-Z][A-Z0-9_]{0,63}$'),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ProviderEvent_intentId_createdAt_id_idx" ON "ProviderEvent"("intentId","createdAt",id);
CREATE FUNCTION provider_intent_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p RECORD;
BEGIN
 IF TG_OP='DELETE' THEN IF EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RAISE EXCEPTION 'Provider intent history immutable' USING ERRCODE='23514';END IF;RETURN OLD;END IF;
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-'state') IS DISTINCT FROM (to_jsonb(OLD)-'state') OR
    (NEW.state<>OLD.state AND NOT((OLD.state='awaiting' AND NEW.state IN ('confirmed','failed','needs_review')) OR (OLD.state='confirmed' AND NEW.state='compensating') OR (OLD.state='compensating' AND NEW.state IN ('compensated','needs_review')) OR (OLD.state='needs_review' AND NEW.state IN ('confirmed','failed','compensated')))) THEN RAISE EXCEPTION 'Provider intent transition invalid' USING ERRCODE='23514';END IF;
  RETURN NEW;
 END IF;
 IF NEW.state<>'awaiting' OR NOT EXISTS(SELECT 1 FROM "Store" WHERE id=NEW."storeId" AND "organizationId"=NEW."organizationId") OR NOT EXISTS(SELECT 1 FROM "OrganizationUser" WHERE "userId"=NEW."actorId" AND "organizationId"=NEW."organizationId" AND "isActive") THEN RAISE EXCEPTION 'Provider intent scope invalid' USING ERRCODE='23514';END IF;
 IF NEW."compensatesId" IS NOT NULL THEN
  SELECT * INTO p FROM "ProviderIntent" WHERE id=NEW."compensatesId" FOR UPDATE;
  IF p.id IS NULL OR p.state<>'confirmed' OR p."organizationId"<>NEW."organizationId" OR p."storeId"<>NEW."storeId" OR p.provider<>NEW.provider OR p.capability<>NEW.capability OR p.request<>NEW.request THEN RAISE EXCEPTION 'Provider compensation source invalid' USING ERRCODE='23514';END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER provider_intent_guard BEFORE INSERT OR UPDATE OR DELETE ON "ProviderIntent" FOR EACH ROW EXECUTE FUNCTION provider_intent_guard();
CREATE FUNCTION provider_outbox_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN IF EXISTS(SELECT 1 FROM "ProviderIntent" p JOIN "Organization" o ON o.id=p."organizationId" WHERE p.id=OLD."intentId") THEN RAISE EXCEPTION 'Provider outbox history immutable' USING ERRCODE='23514';END IF;RETURN OLD;END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW."intentId"<>OLD."intentId" OR NEW.generation<OLD.generation OR NEW."submitAttempts"<OLD."submitAttempts" OR NEW."lookupAttempts"<OLD."lookupAttempts" OR (OLD.mode='lookup' AND NEW.mode<>'lookup') OR
   (OLD.state IN ('confirmed','failed') AND NEW IS DISTINCT FROM OLD) OR
   (OLD.state='review' AND NEW IS DISTINCT FROM OLD AND NOT(NEW.state='unknown' AND NEW.mode='lookup' AND NEW.generation=OLD.generation+1 AND NEW."submitAttempts"=OLD."submitAttempts" AND NEW."lookupAttempts"=OLD."lookupAttempts")) OR
   (OLD."externalId" IS NOT NULL AND NEW."externalId" IS DISTINCT FROM OLD."externalId") THEN RAISE EXCEPTION 'Provider outbox identity/terminal immutable' USING ERRCODE='23514';END IF;
  IF NEW.state<>OLD.state AND NOT((OLD.state='queued' AND NEW.state='running' AND NEW.mode='submit' AND NEW."submitAttempts"=1) OR
    (OLD.state='unknown' AND NEW.state='running' AND NEW.mode='lookup') OR
    (OLD.state='running' AND NEW.state IN ('unknown','review','confirmed','failed')) OR
    (OLD.state='review' AND NEW.state='unknown' AND NEW.mode='lookup')) THEN RAISE EXCEPTION 'Provider outbox transition invalid' USING ERRCODE='23514';END IF;
 ELSIF NEW.state<>'queued' OR NEW.mode<>'submit' OR NEW.generation<>0 OR NEW."submitAttempts"<>0 OR NEW."lookupAttempts"<>0 OR NEW."externalId" IS NOT NULL OR NEW."resultCode" IS NOT NULL THEN RAISE EXCEPTION 'Provider initial outbox invalid' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER provider_outbox_guard BEFORE INSERT OR UPDATE OR DELETE ON "ProviderOutbox" FOR EACH ROW EXECUTE FUNCTION provider_outbox_guard();
CREATE FUNCTION provider_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM "ProviderIntent" p JOIN "Organization" o ON o.id=p."organizationId" WHERE p.id=OLD."intentId") THEN RAISE EXCEPTION 'Provider event immutable' USING ERRCODE='23514';END IF;RETURN OLD;
END $$;
CREATE TRIGGER provider_event_guard BEFORE UPDATE OR DELETE ON "ProviderEvent" FOR EACH ROW EXECUTE FUNCTION provider_event_guard();
CREATE FUNCTION provider_intent_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM "Operation" WHERE "organizationId"=NEW."organizationId" AND type=NEW."sourceType" AND key=NEW."sourceKey" AND "actorId"=NEW."actorId" AND state='completed') THEN RAISE EXCEPTION 'Provider business operation missing' USING ERRCODE='23514';END IF;
 IF NOT EXISTS(SELECT 1 FROM "ProviderOutbox" WHERE "intentId"=NEW.id) THEN RAISE EXCEPTION 'Provider committed outbox missing' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER provider_intent_source_guard AFTER INSERT ON "ProviderIntent" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION provider_intent_source_guard();
CREATE FUNCTION provider_settlement_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p RECORD; b RECORD; identifier TEXT;
BEGIN
 IF TG_TABLE_NAME='ProviderIntent' THEN identifier:=NEW.id;ELSE identifier:=NEW."intentId";END IF;
 SELECT * INTO p FROM "ProviderIntent" WHERE id=identifier;
 SELECT * INTO b FROM "ProviderOutbox" WHERE "intentId"=identifier;
 IF p.id IS NULL THEN RETURN NEW;END IF;
 IF b."intentId" IS NULL OR (p.state IN ('confirmed','compensating','compensated') AND (b.state<>'confirmed' OR b."externalId" IS NULL)) OR
  (p.state='failed' AND b.state<>'failed') OR (p.state='awaiting' AND b.state NOT IN ('queued','running','unknown')) OR
  (b.state='confirmed' AND p.state NOT IN ('confirmed','compensating','compensated','needs_review')) OR
  (b.state='failed' AND p.state<>'failed') OR (b.state='review' AND p.state<>'needs_review') THEN RAISE EXCEPTION 'Provider business/outbox settlement mismatch' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER provider_intent_settlement_guard AFTER INSERT OR UPDATE ON "ProviderIntent" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION provider_settlement_guard();
CREATE CONSTRAINT TRIGGER provider_outbox_settlement_guard AFTER INSERT OR UPDATE ON "ProviderOutbox" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION provider_settlement_guard();
