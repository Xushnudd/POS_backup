CREATE TABLE "BillingInvoice" (
 id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 "planVersionId" TEXT NOT NULL REFERENCES "BillingPlanVersion"(id),
 amount NUMERIC(14,2) NOT NULL CHECK(amount>=0), currency TEXT NOT NULL CHECK(currency='UZS'),
 "periodStart" TIMESTAMP(3) NOT NULL, "periodEnd" TIMESTAMP(3) NOT NULL CHECK("periodEnd">"periodStart"),
 state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','paid','cancelled')),
 "createdBy" TEXT NOT NULL REFERENCES "User"(id), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "cancelledAt" TIMESTAMP(3), "cancellationReason" TEXT,
 CHECK((state='cancelled' AND "cancelledAt" IS NOT NULL AND "cancellationReason" IS NOT NULL AND length("cancellationReason") BETWEEN 3 AND 2000) OR
 (state<>'cancelled' AND "cancelledAt" IS NULL AND "cancellationReason" IS NULL))
);
CREATE UNIQUE INDEX billing_open_invoice ON "BillingInvoice"("organizationId") WHERE state='open';
CREATE INDEX "BillingInvoice_organizationId_createdAt_id_idx" ON "BillingInvoice"("organizationId","createdAt",id);
CREATE TABLE "BillingPayment" (
 id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 "invoiceId" TEXT NOT NULL UNIQUE REFERENCES "BillingInvoice"(id), amount NUMERIC(14,2) NOT NULL CHECK(amount>=0),
 currency TEXT NOT NULL CHECK(currency='UZS'), channel TEXT NOT NULL CHECK(channel='manual_bank'),
 "proofHash" TEXT NOT NULL UNIQUE CHECK("proofHash" ~ '^[a-f0-9]{64}$'),
 "confirmedBy" TEXT NOT NULL REFERENCES "User"(id), reason TEXT NOT NULL CHECK(length(reason) BETWEEN 3 AND 2000),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE FUNCTION billing_invoice_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN IF EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RAISE EXCEPTION 'Billing invoice immutable';END IF;RETURN OLD;END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.state<>'open' OR NOT EXISTS(SELECT 1 FROM "BillingPlanVersion" v WHERE v.id=NEW."planVersionId" AND v."monthlyPrice"=NEW.amount AND v.currency=NEW.currency) THEN RAISE EXCEPTION 'Invoice original plan snapshot mismatch';END IF;
 ELSE
  IF OLD.state<>'open' OR NEW.id<>OLD.id OR NEW."organizationId"<>OLD."organizationId" OR NEW."planVersionId"<>OLD."planVersionId" OR
  NEW.amount<>OLD.amount OR NEW.currency<>OLD.currency OR NEW."periodStart"<>OLD."periodStart" OR NEW."periodEnd"<>OLD."periodEnd" OR NEW."createdBy"<>OLD."createdBy" OR NEW."createdAt"<>OLD."createdAt" OR NEW.state NOT IN ('paid','cancelled') THEN RAISE EXCEPTION 'Billing invoice transition immutable';END IF;
 END IF;RETURN NEW;END $$;
CREATE TRIGGER billing_invoice_guard BEFORE INSERT OR UPDATE OR DELETE ON "BillingInvoice" FOR EACH ROW EXECUTE FUNCTION billing_invoice_guard();
CREATE FUNCTION billing_payment_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN IF EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RAISE EXCEPTION 'Billing payment immutable';END IF;RETURN OLD;END IF;
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Billing payment immutable';END IF;
 IF NOT EXISTS(SELECT 1 FROM "BillingInvoice" i WHERE i.id=NEW."invoiceId" AND i."organizationId"=NEW."organizationId" AND i.amount=NEW.amount AND i.currency=NEW.currency AND i.state='open') OR
 NOT EXISTS(SELECT 1 FROM "PlatformOperator" p JOIN "User" u ON u.id=p."userId" WHERE p."userId"=NEW."confirmedBy" AND p.role='platform_admin' AND p."isActive" AND u."isActive") THEN RAISE EXCEPTION 'Billing payment scope/proof approval mismatch';END IF;
 RETURN NEW;END $$;
CREATE TRIGGER billing_payment_guard BEFORE INSERT OR UPDATE OR DELETE ON "BillingPayment" FOR EACH ROW EXECUTE FUNCTION billing_payment_guard();
CREATE FUNCTION billing_paid_invoice_check() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM "BillingInvoice" WHERE id=NEW.id AND state='paid') AND NOT EXISTS(SELECT 1 FROM "BillingPayment" WHERE "invoiceId"=NEW.id) THEN RAISE EXCEPTION 'Paid invoice requires payment proof';END IF;
 RETURN NEW;END $$;
CREATE CONSTRAINT TRIGGER billing_paid_invoice_check AFTER INSERT OR UPDATE ON "BillingInvoice" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION billing_paid_invoice_check();
CREATE FUNCTION billing_paid_period_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (TG_OP='INSERT' AND NEW."paidThrough" IS NOT NULL) OR (TG_OP='UPDATE' AND NEW."paidThrough" IS DISTINCT FROM OLD."paidThrough") THEN
 IF NEW."paidThrough" IS NULL OR NOT EXISTS(SELECT 1 FROM "BillingInvoice" i JOIN "BillingPayment" p ON p."invoiceId"=i.id
 WHERE i."organizationId"=NEW."organizationId" AND i.state='paid' AND i."periodEnd"=NEW."paidThrough" AND i."planVersionId"=NEW."planVersionId") THEN RAISE EXCEPTION 'Subscription paid period requires confirmed invoice';END IF;
 END IF;RETURN NEW;END $$;
CREATE TRIGGER billing_paid_period_guard BEFORE INSERT OR UPDATE ON "OrganizationSubscription" FOR EACH ROW EXECUTE FUNCTION billing_paid_period_guard();
