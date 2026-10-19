CREATE TABLE "SupportPolicyVersion" (
 id TEXT PRIMARY KEY,version INTEGER NOT NULL UNIQUE CHECK(version>0),timezone TEXT NOT NULL CHECK(timezone='Asia/Tashkent'),
 weekdays INTEGER[] NOT NULL CHECK(cardinality(weekdays) BETWEEN 1 AND 7 AND weekdays<@ARRAY[1,2,3,4,5,6,7]),
 "opensMinute" INTEGER NOT NULL CHECK("opensMinute" BETWEEN 0 AND 1439),"closesMinute" INTEGER NOT NULL CHECK("closesMinute" BETWEEN 1 AND 1440 AND "closesMinute">"opensMinute"),
 "firstResponseMinutes" INTEGER NOT NULL CHECK("firstResponseMinutes" BETWEEN 1 AND 43200),"escalationMinutes" INTEGER NOT NULL CHECK("escalationMinutes" BETWEEN 1 AND 43200),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status='draft'),"createdBy" TEXT,reason TEXT NOT NULL CHECK(length(reason) BETWEEN 3 AND 2000),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "SupportPolicyVersion" (id,version,timezone,weekdays,"opensMinute","closesMinute","firstResponseMinutes","escalationMinutes",reason)
VALUES ('initial-support-draft-v1',1,'Asia/Tashkent',ARRAY[1,2,3,4,5,6],540,1080,240,240,'Owner-proposed internal targets; not an official customer SLA or emergency contact');
CREATE FUNCTION support_policy_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Support policy versions immutable';END IF;
 IF cardinality(NEW.weekdays)<>(SELECT count(DISTINCT day) FROM unnest(NEW.weekdays) day) THEN RAISE EXCEPTION 'Duplicate business weekdays';END IF;
 IF NEW."createdBy" IS NULL OR NOT EXISTS(SELECT 1 FROM "PlatformOperator" op JOIN "User" u ON u.id=op."userId" WHERE op."userId"=NEW."createdBy" AND op.role='platform_admin' AND op."isActive" AND u."isActive") THEN RAISE EXCEPTION 'Support policy requires platform admin';END IF;RETURN NEW;
END $$;
CREATE TRIGGER support_policy_guard BEFORE INSERT OR UPDATE OR DELETE ON "SupportPolicyVersion" FOR EACH ROW EXECUTE FUNCTION support_policy_guard();
CREATE TABLE "SupportTicket" (
 id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 "requestedBy" TEXT NOT NULL REFERENCES "User"(id),"assignedTo" TEXT REFERENCES "User"(id),
 title TEXT NOT NULL CHECK(length(title) BETWEEN 3 AND 160),description TEXT NOT NULL CHECK(length(description) BETWEEN 3 AND 5000),diagnostics JSONB NOT NULL,
 severity TEXT NOT NULL CHECK(severity IN ('normal','important','critical')),state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','in_progress','waiting_customer','resolved','closed')),
 "policyVersionId" TEXT NOT NULL REFERENCES "SupportPolicyVersion"(id),"firstResponseDueAt" TIMESTAMP(3) NOT NULL,"escalationDueAt" TIMESTAMP(3) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"firstRespondedAt" TIMESTAMP(3),"firstResolvedAt" TIMESTAMP(3),"resolvedAt" TIMESTAMP(3),"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(id,"organizationId"),CHECK("firstResponseDueAt">="createdAt" AND "escalationDueAt">="createdAt"),
 CHECK("firstRespondedAt" IS NULL OR "firstRespondedAt">="createdAt"),CHECK("firstResolvedAt" IS NULL OR "firstResolvedAt">="createdAt"),
 CHECK((state IN ('resolved','closed'))=("resolvedAt" IS NOT NULL)),CHECK("resolvedAt" IS NULL OR "firstResolvedAt" IS NOT NULL)
);
CREATE INDEX "SupportTicket_organizationId_createdAt_id_idx" ON "SupportTicket"("organizationId","createdAt",id);
CREATE INDEX "SupportTicket_state_severity_createdAt_idx" ON "SupportTicket"(state,severity,"createdAt");
CREATE TABLE "SupportTicketEvent" (
 id TEXT PRIMARY KEY,"ticketId" TEXT NOT NULL,"organizationId" TEXT NOT NULL,"actorId" TEXT NOT NULL REFERENCES "User"(id),
 kind TEXT NOT NULL CHECK(kind IN ('created','reply','state','assignment','severity')),message TEXT NOT NULL CHECK(length(message) BETWEEN 3 AND 5000),metadata JSONB NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY("ticketId","organizationId") REFERENCES "SupportTicket"(id,"organizationId") ON DELETE CASCADE
);
CREATE INDEX "SupportTicketEvent_ticketId_createdAt_id_idx" ON "SupportTicketEvent"("ticketId","createdAt",id);
CREATE FUNCTION support_ticket_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN IF EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RAISE EXCEPTION 'Ticket history immutable';END IF;RETURN OLD;END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.state<>'open' OR NEW."assignedTo" IS NOT NULL OR NEW."firstRespondedAt" IS NOT NULL OR NEW."firstResolvedAt" IS NOT NULL OR NEW."resolvedAt" IS NOT NULL OR NOT EXISTS(SELECT 1 FROM "OrganizationUser" WHERE "organizationId"=NEW."organizationId" AND "userId"=NEW."requestedBy" AND "isActive") THEN RAISE EXCEPTION 'Ticket source invalid';END IF;
 ELSE
  IF (NEW.id,NEW."organizationId",NEW."requestedBy",NEW.title,NEW.description,NEW.diagnostics,NEW."policyVersionId",NEW."firstResponseDueAt",NEW."escalationDueAt",NEW."createdAt") IS DISTINCT FROM
     (OLD.id,OLD."organizationId",OLD."requestedBy",OLD.title,OLD.description,OLD.diagnostics,OLD."policyVersionId",OLD."firstResponseDueAt",OLD."escalationDueAt",OLD."createdAt") OR
     (OLD."firstRespondedAt" IS NOT NULL AND NEW."firstRespondedAt" IS DISTINCT FROM OLD."firstRespondedAt") OR
     (OLD."firstResolvedAt" IS NOT NULL AND NEW."firstResolvedAt" IS DISTINCT FROM OLD."firstResolvedAt") THEN RAISE EXCEPTION 'Ticket source/first timestamps immutable';END IF;
 END IF;
 IF NEW."assignedTo" IS NOT NULL AND NEW."assignedTo" IS DISTINCT FROM (CASE WHEN TG_OP='UPDATE' THEN OLD."assignedTo" ELSE NULL END) AND NOT EXISTS(SELECT 1 FROM "PlatformOperator" op JOIN "User" u ON u.id=op."userId" WHERE op."userId"=NEW."assignedTo" AND op."isActive" AND u."isActive") THEN RAISE EXCEPTION 'Ticket assignee inactive';END IF;RETURN NEW;
END $$;
CREATE TRIGGER support_ticket_guard BEFORE INSERT OR UPDATE OR DELETE ON "SupportTicket" FOR EACH ROW EXECUTE FUNCTION support_ticket_guard();
CREATE FUNCTION support_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN IF EXISTS(SELECT 1 FROM "SupportTicket" WHERE id=OLD."ticketId") THEN RAISE EXCEPTION 'Ticket event history immutable';END IF;RETURN OLD;END IF;
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Ticket event immutable';END IF;RETURN NEW;
END $$;
CREATE TRIGGER support_event_guard BEFORE UPDATE OR DELETE ON "SupportTicketEvent" FOR EACH ROW EXECUTE FUNCTION support_event_guard();
CREATE FUNCTION support_ticket_requires_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM "SupportTicket" WHERE id=NEW.id) THEN RETURN NEW;END IF;
 IF NOT EXISTS(SELECT 1 FROM "SupportTicketEvent" WHERE "ticketId"=NEW.id AND "organizationId"=NEW."organizationId" AND "createdAt"=NEW."updatedAt" AND metadata->>'state'=NEW.state AND metadata->>'severity'=NEW.severity AND (metadata->>'assignedTo') IS NOT DISTINCT FROM NEW."assignedTo") THEN RAISE EXCEPTION 'Ticket mutation requires atomic history';END IF;
 IF NEW."firstRespondedAt" IS NOT NULL AND (TG_OP='INSERT' OR OLD."firstRespondedAt" IS NULL) AND NOT EXISTS(SELECT 1 FROM "SupportTicketEvent" e JOIN "PlatformOperator" op ON op."userId"=e."actorId" WHERE e."ticketId"=NEW.id AND e.kind='reply' AND e."createdAt"=NEW."firstRespondedAt" AND e.metadata->>'actorScope'='platform' AND op."isActive") THEN RAISE EXCEPTION 'First response requires real operator reply event';END IF;
 IF NEW."firstResolvedAt" IS NOT NULL AND (TG_OP='INSERT' OR OLD."firstResolvedAt" IS NULL) AND NOT EXISTS(SELECT 1 FROM "SupportTicketEvent" WHERE "ticketId"=NEW.id AND kind='state' AND "createdAt"=NEW."firstResolvedAt" AND metadata->>'state'='resolved') THEN RAISE EXCEPTION 'Resolution requires source event';END IF;RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER support_ticket_requires_event AFTER INSERT OR UPDATE ON "SupportTicket" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION support_ticket_requires_event();
