BEGIN;
CREATE TABLE "GiftCheckout" (
 id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 "giftId" TEXT NOT NULL REFERENCES "GiftCertificate"(id) DEFERRABLE INITIALLY DEFERRED,
 "saleId" TEXT NOT NULL UNIQUE REFERENCES "Sale"(id) DEFERRABLE INITIALLY DEFERRED,
 amount NUMERIC(14,2) NOT NULL CHECK(amount>0),"createdBy" TEXT NOT NULL REFERENCES "User"(id),"sessionId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "GiftCheckout_organizationId_createdAt_id_idx" ON "GiftCheckout"("organizationId","createdAt",id);
CREATE FUNCTION pos_gift_checkout_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sale "Sale";gift "GiftCertificate";balance "CustomerAdvanceBalance";
BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RETURN OLD;END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'GIFT_IMMUTABLE' USING ERRCODE='23514';END IF;
 PERFORM assert_business_writable(NEW."organizationId");
 SELECT * INTO sale FROM "Sale" WHERE id=NEW."saleId" FOR UPDATE;
 SELECT * INTO gift FROM "GiftCertificate" WHERE id=NEW."giftId";
 PERFORM pg_advisory_xact_lock(hashtextextended('loyalty-policy:'||NEW."organizationId",0));
 PERFORM 1 FROM "CustomerAdvance" WHERE id=gift."advanceId" FOR UPDATE;
 SELECT * INTO balance FROM "CustomerAdvanceBalance" WHERE id=gift."advanceId";
 IF sale.id IS NULL OR gift.id IS NULL OR sale.status<>'draft' OR sale."organizationId"<>NEW."organizationId" OR gift."organizationId"<>NEW."organizationId" OR balance."customerId" IS DISTINCT FROM sale."customerId" OR NEW.amount>balance.available OR NEW.amount>sale."totalAmount" OR (gift."expiresAt" IS NOT NULL AND gift."expiresAt"<=clock_timestamp()) OR NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=NEW."organizationId" AND "currencyCode"='UZS') OR (SELECT configuration#>'{gifts,enabled}' FROM "LoyaltyPolicyVersion" WHERE "organizationId"=NEW."organizationId" ORDER BY revision DESC LIMIT 1) IS DISTINCT FROM 'true'::jsonb OR EXISTS(SELECT 1 FROM "OfflineCashLease" WHERE "saleId"=sale.id AND state='issued') THEN RAISE EXCEPTION 'GIFT_SOURCE_INVALID' USING ERRCODE='23514';END IF;
 IF NOT auth_restore_ready() OR NOT EXISTS(SELECT 1 FROM "Session" s JOIN "User" u ON u.id=s."userId" JOIN "OrganizationUser" m ON m."userId"=u.id AND m."organizationId"=s."organizationId" WHERE s.id=NEW."sessionId" AND s."organizationId"=NEW."organizationId" AND s."userId"=NEW."createdBy" AND s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp() AND s."idleExpiresAt">clock_timestamp() AND u."isActive" AND m."isActive" AND (m.role='owner' OR EXISTS(SELECT 1 FROM "UserStore" WHERE "organizationUserId"=m.id AND "storeId"=sale."storeId")) AND (m.role<>'cashier' OR sale."cashierId"=u.id)) THEN RAISE EXCEPTION 'GIFT_SOURCE_INVALID' USING ERRCODE='23514';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END $$;
CREATE TRIGGER gift_checkout_guard BEFORE INSERT OR UPDATE OR DELETE ON "GiftCheckout" FOR EACH ROW EXECUTE FUNCTION pos_gift_checkout_guard();
CREATE FUNCTION pos_gift_checkout_proof() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM "Sale" s JOIN "GiftCertificate" g ON g.id=NEW."giftId" JOIN "CustomerAdvance" a ON a.id=g."advanceId" WHERE s.id=NEW."saleId" AND s.status='completed' AND s."organizationId"=NEW."organizationId" AND s."customerId"=a."customerId" AND COALESCE((SELECT sum(amount) FROM "Payment" WHERE "saleId"=s.id AND direction='in' AND "paymentType"='credit' AND "sourceType"='manual' AND status='recorded'),0)=NEW.amount AND EXISTS(SELECT 1 FROM "CustomerAdvanceAllocation" x JOIN "DebtEntry" e ON e.id=x."debtEntryId" WHERE x."advanceId"=a.id AND e."saleId"=s.id AND x.amount=NEW.amount AND x.xmin::text::bigint=txid_current()%4294967296) AND EXISTS(SELECT 1 FROM "AuditLog" h WHERE h."organizationId"=NEW."organizationId" AND h."actorId"=NEW."createdBy" AND h."entityType"='GiftCertificate' AND h."entityId"=g.id AND h.action='gift_checkout' AND h."afterData"->>'saleId'=s.id AND (h."afterData"->>'amount')::numeric=NEW.amount AND h."afterData"->'customerConsent'='true'::jsonb AND h.xmin::text::bigint=txid_current()%4294967296)) THEN RAISE EXCEPTION 'GIFT_SOURCE_INVALID' USING ERRCODE='23514';END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER gift_checkout_proof AFTER INSERT ON "GiftCheckout" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_gift_checkout_proof();
-- Fully funded certificate credit is a settlement channel, not new customer
-- borrowing. The deferred native source proof requires real gift consumption.
DO $$ DECLARE source text;needle text:='EXISTS(SELECT 1 FROM "Payment" WHERE "saleId"=NEW.id AND direction=''in'' AND "paymentType"=''credit'')';BEGIN
 source:=pg_get_functiondef('pos_loyalty_earn_from_sale()'::regprocedure);
 IF strpos(source,needle)=0 THEN RAISE EXCEPTION 'Unreviewed loyalty credit source';END IF;
 source:=replace(source,needle,'(COALESCE((SELECT sum(amount) FROM "Payment" WHERE "saleId"=NEW.id AND direction=''in'' AND "paymentType"=''credit''),0)>COALESCE((SELECT amount FROM "GiftCheckout" WHERE "saleId"=NEW.id),0))');EXECUTE source;
END $$;
DO $$ DECLARE source text;needle text:='WHEN ''Organization'' THEN';BEGIN
 source:=pg_get_functiondef('business_row_organization(text,jsonb)'::regprocedure);
 IF strpos(source,needle)=0 OR strpos(source,'''GiftCheckout''')>0 THEN RAISE EXCEPTION 'Unreviewed subscription scope';END IF;
 source:=replace(source,needle,'WHEN ''GiftCheckout'' THEN RETURN value->>''organizationId''; '||needle);EXECUTE source;
END $$;
CREATE TRIGGER subscription_read_only BEFORE INSERT OR UPDATE OR DELETE ON "GiftCheckout" FOR EACH ROW EXECUTE FUNCTION subscription_business_write_guard();
COMMIT;
