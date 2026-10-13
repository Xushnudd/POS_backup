BEGIN;
-- CreateTable
CREATE TABLE "LoyaltyPointLot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "initialPoints" BIGINT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyPointLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyPointEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "points" BIGINT NOT NULL,
    "returnId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyPointEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyPointLot_saleId_key" ON "LoyaltyPointLot"("saleId");

-- CreateIndex
CREATE INDEX "LoyaltyPointLot_organizationId_customerId_createdAt_id_idx" ON "LoyaltyPointLot"("organizationId", "customerId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "LoyaltyPointEntry_organizationId_lotId_createdAt_id_idx" ON "LoyaltyPointEntry"("organizationId", "lotId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyPointEntry_lotId_kind_returnId_key" ON "LoyaltyPointEntry"("lotId", "kind", "returnId");

-- AddForeignKey
ALTER TABLE "LoyaltyPointLot" ADD CONSTRAINT "LoyaltyPointLot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyPointLot" ADD CONSTRAINT "LoyaltyPointLot_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyPointLot" ADD CONSTRAINT "LoyaltyPointLot_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyPointLot" ADD CONSTRAINT "LoyaltyPointLot_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "LoyaltyPolicyVersion"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyPointEntry" ADD CONSTRAINT "LoyaltyPointEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyPointEntry" ADD CONSTRAINT "LoyaltyPointEntry_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "LoyaltyPointLot"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyPointEntry" ADD CONSTRAINT "LoyaltyPointEntry_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "SaleReturn"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "LoyaltyPointLot" ADD CONSTRAINT "LoyaltyPointLot_amount" CHECK("initialPoints">0 AND ("expiresAt" IS NULL OR "expiresAt">"createdAt"));
ALTER TABLE "LoyaltyPointEntry" ADD CONSTRAINT "LoyaltyPointEntry_kind" CHECK(kind='return_earn' AND points<0 AND "returnId" IS NOT NULL);

CREATE FUNCTION pos_loyalty_refund_target(lot_id text) RETURNS bigint LANGUAGE plpgsql STABLE AS $$
DECLARE lot "LoyaltyPointLot";sale "Sale";returned_basis numeric;
BEGIN
 SELECT * INTO lot FROM "LoyaltyPointLot" WHERE id=lot_id;
 SELECT * INTO sale FROM "Sale" WHERE id=lot."saleId";
 IF lot.id IS NULL OR sale.subtotal<=0 THEN RAISE EXCEPTION 'LOYALTY_SOURCE_INVALID' USING ERRCODE='23514';END IF;
 -- Weight the original pre-receipt-discount item values. This also works for
 -- a future fully-discounted receipt whose monetary refund is zero.
 SELECT COALESCE(sum(r.quantity*i."lineTotal"/i.quantity),0) INTO returned_basis FROM "SaleReturnItem" r JOIN "SaleItem" i ON i.id=r."saleItemId" JOIN "SaleReturn" h ON h.id=r."saleReturnId" WHERE i."saleId"=sale.id AND h.status='completed';
 IF returned_basis<0 OR returned_basis>sale.subtotal THEN RAISE EXCEPTION 'LOYALTY_REFUND_RECONCILIATION' USING ERRCODE='23514';END IF;
 RETURN LEAST(lot."initialPoints",ceil(lot."initialPoints"::numeric*returned_basis/sale.subtotal)::bigint);
END $$;

CREATE FUNCTION pos_loyalty_lot_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sale "Sale";policy "LoyaltyPolicyVersion";config jsonb;expected bigint;expiry timestamp;
BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RETURN OLD;END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'LOYALTY_JOURNAL_IMMUTABLE' USING ERRCODE='23514';END IF;
 IF pg_trigger_depth()<2 THEN RAISE EXCEPTION 'LOYALTY_NATIVE_SOURCE_REQUIRED' USING ERRCODE='23514';END IF;
 SELECT * INTO sale FROM "Sale" WHERE id=NEW."saleId";
 SELECT * INTO policy FROM "LoyaltyPolicyVersion" WHERE id=NEW."policyVersionId";
 config:=policy.configuration->'points';
 IF sale.id IS NULL OR policy.id IS NULL OR sale.status<>'completed' OR sale."organizationId"<>NEW."organizationId" OR policy."organizationId"<>NEW."organizationId" OR sale."customerId" IS DISTINCT FROM NEW."customerId" OR sale."completedAt"<policy."createdAt" OR config->>'enabled'<>'true' THEN RAISE EXCEPTION 'LOYALTY_SOURCE_INVALID' USING ERRCODE='23514';END IF;
 expected:=floor(COALESCE(sale."netAmount",sale."totalAmount")/(config->>'earnMoneyPerPoint')::numeric)::bigint;
 expiry:=CASE WHEN config->'expiryDays'='null'::jsonb THEN NULL ELSE sale."completedAt"+make_interval(days=>(config->>'expiryDays')::integer) END;
 IF NEW."initialPoints"<>expected OR NEW."expiresAt" IS DISTINCT FROM expiry THEN RAISE EXCEPTION 'LOYALTY_GRANT_INVALID' USING ERRCODE='23514';END IF;
 NEW."createdAt":=sale."completedAt";RETURN NEW;
END $$;
CREATE TRIGGER loyalty_lot_guard BEFORE INSERT OR UPDATE OR DELETE ON "LoyaltyPointLot" FOR EACH ROW EXECUTE FUNCTION pos_loyalty_lot_guard();

CREATE FUNCTION pos_loyalty_entry_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE lot "LoyaltyPointLot";ret "SaleReturn";target bigint;previous numeric;
BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RETURN OLD;END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'LOYALTY_JOURNAL_IMMUTABLE' USING ERRCODE='23514';END IF;
 IF pg_trigger_depth()<2 THEN RAISE EXCEPTION 'LOYALTY_NATIVE_SOURCE_REQUIRED' USING ERRCODE='23514';END IF;
 SELECT * INTO lot FROM "LoyaltyPointLot" WHERE id=NEW."lotId" FOR UPDATE;
 SELECT * INTO ret FROM "SaleReturn" WHERE id=NEW."returnId";
 IF lot.id IS NULL OR ret.id IS NULL OR NEW.kind<>'return_earn' OR ret.status<>'completed' OR ret."saleId"<>lot."saleId" OR NEW."organizationId"<>lot."organizationId" THEN RAISE EXCEPTION 'LOYALTY_RETURN_SOURCE_INVALID' USING ERRCODE='23514';END IF;
 target:=pos_loyalty_refund_target(lot.id);
 SELECT COALESCE(-sum(points),0) INTO previous FROM "LoyaltyPointEntry" WHERE "lotId"=lot.id AND kind='return_earn';
 IF NEW.points<>-(target-previous) OR NEW.points>=0 THEN RAISE EXCEPTION 'LOYALTY_RETURN_AMOUNT_INVALID' USING ERRCODE='23514';END IF;
 NEW."createdAt":=ret."returnedAt";RETURN NEW;
END $$;
CREATE TRIGGER loyalty_entry_guard BEFORE INSERT OR UPDATE OR DELETE ON "LoyaltyPointEntry" FOR EACH ROW EXECUTE FUNCTION pos_loyalty_entry_guard();

CREATE FUNCTION pos_loyalty_earn_from_sale() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE policy "LoyaltyPolicyVersion";config jsonb;net numeric;points bigint;lot_id text;
BEGIN
 IF NEW.status<>'completed' OR OLD.status='completed' OR NEW."customerId" IS NULL THEN RETURN NEW;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('loyalty-policy:'||NEW."organizationId",0));
 SELECT * INTO policy FROM "LoyaltyPolicyVersion" WHERE "organizationId"=NEW."organizationId" ORDER BY revision DESC LIMIT 1;
 IF policy.id IS NULL THEN RETURN NEW;END IF;
 config:=policy.configuration->'points';net:=COALESCE(NEW."netAmount",NEW."totalAmount");
 IF config->>'enabled'<>'true' OR net<(config->>'minEligibleNet')::numeric OR (config->>'earnOnDiscountedSales'='false' AND (NEW."discountAmount">0 OR EXISTS(SELECT 1 FROM "SaleItem" WHERE "saleId"=NEW.id AND "discountAmount">0))) OR (config->>'earnOnCreditSales'='false' AND EXISTS(SELECT 1 FROM "Payment" WHERE "saleId"=NEW.id AND direction='in' AND "paymentType"='credit')) THEN RETURN NEW;END IF;
 points:=floor(net/(config->>'earnMoneyPerPoint')::numeric)::bigint;
 IF points<=0 THEN RETURN NEW;END IF;
 lot_id:=gen_random_uuid()::text;
 INSERT INTO "LoyaltyPointLot"(id,"organizationId","customerId","saleId","policyVersionId","initialPoints","expiresAt") VALUES(lot_id,NEW."organizationId",NEW."customerId",NEW.id,policy.id,points,CASE WHEN config->'expiryDays'='null'::jsonb THEN NULL ELSE NEW."completedAt"+make_interval(days=>(config->>'expiryDays')::integer) END);
 INSERT INTO "AuditLog"(id,"organizationId","actorId","entityType","entityId",action,"afterData") VALUES(gen_random_uuid()::text,NEW."organizationId",NEW."cashierId",'LoyaltyPointLot',lot_id,'loyalty_points_earned',jsonb_build_object('saleId',NEW.id,'policyVersionId',policy.id,'points',points::text));
 RETURN NEW;
END $$;
CREATE TRIGGER loyalty_earn_from_sale AFTER UPDATE OF status ON "Sale" FOR EACH ROW EXECUTE FUNCTION pos_loyalty_earn_from_sale();

CREATE FUNCTION pos_loyalty_revoke_from_return() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE lot "LoyaltyPointLot";target bigint;previous numeric;entry_id text;
BEGIN
 IF NEW.status<>'completed' THEN RETURN NULL;END IF;
 SELECT * INTO lot FROM "LoyaltyPointLot" WHERE "saleId"=NEW."saleId" FOR UPDATE;
 IF lot.id IS NULL THEN RETURN NULL;END IF;
 IF EXISTS(SELECT 1 FROM "LoyaltyPointEntry" WHERE "lotId"=lot.id AND "returnId"=NEW.id AND kind='return_earn') THEN RETURN NULL;END IF;
 target:=pos_loyalty_refund_target(lot.id);
 SELECT COALESCE(-sum(points),0) INTO previous FROM "LoyaltyPointEntry" WHERE "lotId"=lot.id AND kind='return_earn';
 IF target<previous THEN RAISE EXCEPTION 'LOYALTY_REFUND_RECONCILIATION' USING ERRCODE='23514';END IF;
 IF target=previous THEN RETURN NULL;END IF;
 entry_id:=gen_random_uuid()::text;
 INSERT INTO "LoyaltyPointEntry"(id,"organizationId","lotId",kind,points,"returnId") VALUES(entry_id,lot."organizationId",lot.id,'return_earn',-(target-previous),NEW.id);
 INSERT INTO "AuditLog"(id,"organizationId","actorId","entityType","entityId",action,"afterData") VALUES(gen_random_uuid()::text,lot."organizationId",NEW."processedBy",'LoyaltyPointEntry',entry_id,'loyalty_points_revoked',jsonb_build_object('saleId',lot."saleId",'returnId',NEW.id,'points',(-(target-previous))::text));
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER loyalty_revoke_from_return AFTER INSERT ON "SaleReturn" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_loyalty_revoke_from_return();

DO $$ DECLARE source text;needle text:='WHEN ''Organization'' THEN';tab text;BEGIN
 source:=pg_get_functiondef('business_row_organization(text,jsonb)'::regprocedure);
 IF strpos(source,needle)=0 OR strpos(source,'''LoyaltyPointLot''')>0 THEN RAISE EXCEPTION 'Unreviewed subscription scope';END IF;
 source:=replace(source,needle,'WHEN ''LoyaltyPointLot'' THEN RETURN value->>''organizationId''; WHEN ''LoyaltyPointEntry'' THEN RETURN value->>''organizationId''; '||needle);EXECUTE source;
 FOREACH tab IN ARRAY ARRAY['LoyaltyPointLot','LoyaltyPointEntry'] LOOP
  EXECUTE format('CREATE TRIGGER subscription_read_only BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION subscription_business_write_guard()',tab);
 END LOOP;
END $$;
COMMIT;

