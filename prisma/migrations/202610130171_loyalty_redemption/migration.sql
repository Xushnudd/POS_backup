BEGIN;
-- AlterTable
ALTER TABLE "LoyaltyPointEntry" ADD COLUMN     "redemptionId" TEXT,
ADD COLUMN     "transferId" TEXT;

-- CreateTable
CREATE TABLE "LoyaltyRedemption" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'prepared',
    "points" BIGINT NOT NULL,
    "discountAmount" DECIMAL(14,2) NOT NULL,
    "baseDiscountAmount" DECIMAL(14,2) NOT NULL,
    "subtotalSnapshot" DECIMAL(14,2) NOT NULL,
    "itemsSnapshot" JSONB NOT NULL,
    "originalDiscountPercent" DECIMAL(5,2),
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyRecoveryTransfer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fromLotId" TEXT NOT NULL,
    "toLotId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "points" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyRecoveryTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoyaltyRedemption_organizationId_saleId_createdAt_id_idx" ON "LoyaltyRedemption"("organizationId", "saleId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "LoyaltyRecoveryTransfer_organizationId_createdAt_id_idx" ON "LoyaltyRecoveryTransfer"("organizationId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyRecoveryTransfer_saleId_fromLotId_toLotId_key" ON "LoyaltyRecoveryTransfer"("saleId", "fromLotId", "toLotId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyPointEntry_lotId_kind_transferId_key" ON "LoyaltyPointEntry"("lotId", "kind", "transferId");

-- AddForeignKey
ALTER TABLE "LoyaltyPointEntry" ADD CONSTRAINT "LoyaltyPointEntry_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "LoyaltyRedemption"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyPointEntry" ADD CONSTRAINT "LoyaltyPointEntry_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "LoyaltyRecoveryTransfer"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyRedemption" ADD CONSTRAINT "LoyaltyRedemption_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyRedemption" ADD CONSTRAINT "LoyaltyRedemption_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyRedemption" ADD CONSTRAINT "LoyaltyRedemption_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "LoyaltyPolicyVersion"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyRedemption" ADD CONSTRAINT "LoyaltyRedemption_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyRecoveryTransfer" ADD CONSTRAINT "LoyaltyRecoveryTransfer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyRecoveryTransfer" ADD CONSTRAINT "LoyaltyRecoveryTransfer_fromLotId_fkey" FOREIGN KEY ("fromLotId") REFERENCES "LoyaltyPointLot"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyRecoveryTransfer" ADD CONSTRAINT "LoyaltyRecoveryTransfer_toLotId_fkey" FOREIGN KEY ("toLotId") REFERENCES "LoyaltyPointLot"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyRecoveryTransfer" ADD CONSTRAINT "LoyaltyRecoveryTransfer_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "LoyaltyRecoveryTransfer" ADD COLUMN "returnId" text REFERENCES "SaleReturn"(id) ON DELETE NO ACTION ON UPDATE CASCADE;
DROP INDEX "LoyaltyRecoveryTransfer_saleId_fromLotId_toLotId_key";
CREATE UNIQUE INDEX loyalty_recovery_sale_source ON "LoyaltyRecoveryTransfer"("saleId","fromLotId","toLotId") WHERE "returnId" IS NULL;
CREATE UNIQUE INDEX loyalty_recovery_return_source ON "LoyaltyRecoveryTransfer"("returnId","fromLotId","toLotId") WHERE "returnId" IS NOT NULL;

CREATE UNIQUE INDEX loyalty_redemption_active ON "LoyaltyRedemption"("saleId") WHERE state IN ('prepared','posted');
ALTER TABLE "LoyaltyRedemption" ADD CONSTRAINT loyalty_redemption_values CHECK(state IN ('prepared','posted','cancelled') AND points>0 AND "discountAmount">0 AND "baseDiscountAmount">=0 AND "subtotalSnapshot">="baseDiscountAmount"+"discountAmount" AND length(btrim(reason)) BETWEEN 3 AND 2000 AND jsonb_typeof("itemsSnapshot")='array');
ALTER TABLE "LoyaltyRecoveryTransfer" ADD CONSTRAINT loyalty_transfer_values CHECK(points>0 AND "fromLotId"<>"toLotId");
ALTER TABLE "LoyaltyPointEntry" DROP CONSTRAINT "LoyaltyPointEntry_kind";
ALTER TABLE "LoyaltyPointEntry" ADD CONSTRAINT "LoyaltyPointEntry_kind" CHECK(
 (kind='return_earn' AND points<0 AND "returnId" IS NOT NULL AND "redemptionId" IS NULL AND "transferId" IS NULL) OR
 (kind='redeem' AND points<0 AND "returnId" IS NULL AND "redemptionId" IS NOT NULL AND "transferId" IS NULL) OR
 (kind='return_redeem' AND points>0 AND "returnId" IS NOT NULL AND "redemptionId" IS NOT NULL AND "transferId" IS NULL) OR
 (kind IN ('recovery_in','recovery_out') AND "returnId" IS NULL AND "redemptionId" IS NULL AND "transferId" IS NOT NULL AND ((kind='recovery_in' AND points>0) OR (kind='recovery_out' AND points<0)))
);
CREATE UNIQUE INDEX loyalty_redeem_lot_source ON "LoyaltyPointEntry"("lotId","redemptionId") WHERE kind='redeem';

CREATE FUNCTION pos_loyalty_wallet_root(customer_id text,org text) RETURNS text LANGUAGE sql STABLE AS $$
 SELECT root.id FROM "Customer" c JOIN "Customer" root ON root.id=COALESCE(c."mergedIntoId",c.id) AND root."organizationId"=c."organizationId" AND root."mergedIntoId" IS NULL WHERE c.id=customer_id AND c."organizationId"=org
$$;
CREATE VIEW "LoyaltyPointBalance" AS SELECT l.*,pos_loyalty_wallet_root(l."customerId",l."organizationId") AS "walletCustomerId",l."initialPoints"::numeric+COALESCE(sum(e.points),0) AS balance FROM "LoyaltyPointLot" l LEFT JOIN "LoyaltyPointEntry" e ON e."lotId"=l.id GROUP BY l.id;
CREATE FUNCTION pos_loyalty_lock_wallet(customer_id text,org text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE root text;
BEGIN
 root:=pos_loyalty_wallet_root(customer_id,org);
 IF root IS NULL THEN RAISE EXCEPTION 'LOYALTY_CUSTOMER_CHANGED' USING ERRCODE='23514';END IF;
 PERFORM id FROM "Customer" WHERE id=root AND "organizationId"=org FOR SHARE;
 IF root IS DISTINCT FROM pos_loyalty_wallet_root(customer_id,org) THEN RAISE EXCEPTION 'LOYALTY_CUSTOMER_CHANGED' USING ERRCODE='23514';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('points-wallet:'||org||':'||root,0));RETURN root;
END $$;
CREATE FUNCTION pos_loyalty_available(customer_id text,org text,at_time timestamp) RETURNS numeric LANGUAGE sql STABLE AS $$
 SELECT GREATEST(0,COALESCE(sum(CASE WHEN balance<0 THEN balance WHEN "expiresAt" IS NULL OR "expiresAt">at_time THEN balance ELSE 0 END),0)) FROM "LoyaltyPointBalance" WHERE "organizationId"=org AND "walletCustomerId"=pos_loyalty_wallet_root(customer_id,org)
$$;
CREATE FUNCTION pos_loyalty_item_snapshot(sale_id text) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'productId',"productId",'quantity',quantity,'unit',unit,'unitPrice',"unitPrice",'lineTotal',"lineTotal",'discountAmount',"discountAmount",'discountPercent',"discountPercent",'taxVersionId',"taxVersionId",'taxMode',"taxMode",'taxRate',"taxRate",'priceRuleId',"priceRuleId",'priceSnapshot',"priceSnapshot",'conversionSnapshot',"conversionSnapshot") ORDER BY id),'[]'::jsonb) FROM "SaleItem" WHERE "saleId"=sale_id
$$;

CREATE FUNCTION pos_loyalty_redemption_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sale "Sale";policy "LoyaltyPolicyVersion";actor_role text;cap numeric;
BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RETURN OLD;END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'LOYALTY_JOURNAL_IMMUTABLE' USING ERRCODE='23514';END IF;
 SELECT * INTO sale FROM "Sale" WHERE id=NEW."saleId";
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-'state') IS DISTINCT FROM (to_jsonb(OLD)-'state') OR OLD.state<>'prepared' OR NEW.state NOT IN ('posted','cancelled') THEN RAISE EXCEPTION 'LOYALTY_JOURNAL_IMMUTABLE' USING ERRCODE='23514';END IF;
  IF NEW.state='posted' AND (pg_trigger_depth()<2 OR sale.status<>'completed') THEN RAISE EXCEPTION 'LOYALTY_NATIVE_SOURCE_REQUIRED' USING ERRCODE='23514';END IF;
  IF NEW.state='cancelled' AND sale.status NOT IN ('draft','voided') THEN RAISE EXCEPTION 'LOYALTY_CANCEL_INVALID' USING ERRCODE='23514';END IF;
  RETURN NEW;
 END IF;
 IF sale.id IS NULL OR sale.status<>'draft' OR NEW.state<>'prepared' OR sale."organizationId"<>NEW."organizationId" OR sale."customerId" IS DISTINCT FROM NEW."customerId" OR sale.subtotal<>NEW."subtotalSnapshot" OR sale."discountAmount"<>NEW."baseDiscountAmount" OR sale."discountPercent" IS DISTINCT FROM NEW."originalDiscountPercent" OR pos_loyalty_item_snapshot(sale.id) IS DISTINCT FROM NEW."itemsSnapshot" THEN RAISE EXCEPTION 'LOYALTY_SALE_CHANGED' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM "OfflineCashLease" WHERE "saleId"=sale.id AND state='issued') OR NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=NEW."organizationId" AND "currencyCode"='UZS') THEN RAISE EXCEPTION 'LOYALTY_SOURCE_UNSUPPORTED' USING ERRCODE='23514';END IF;
 SELECT m.role INTO actor_role FROM "OrganizationUser" m JOIN "User" u ON u.id=m."userId" JOIN "Session" s ON s.id=NEW."sessionId" AND s."userId"=u.id AND s."organizationId"=m."organizationId" WHERE m."organizationId"=NEW."organizationId" AND m."userId"=NEW."createdBy" AND m."isActive" AND u."isActive" AND s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp() AND s."idleExpiresAt">clock_timestamp() AND (m.role='owner' OR EXISTS(SELECT 1 FROM "UserStore" WHERE "organizationUserId"=m.id AND "storeId"=sale."storeId")) AND (m.role<>'cashier' OR sale."cashierId"=u.id);
 IF actor_role IS NULL OR NOT auth_restore_ready() THEN RAISE EXCEPTION 'LOYALTY_ACTOR_CHANGED' USING ERRCODE='23514';END IF;
 PERFORM pos_loyalty_lock_wallet(NEW."customerId",NEW."organizationId");
 PERFORM pg_advisory_xact_lock(hashtextextended('loyalty-policy:'||NEW."organizationId",0));
 SELECT * INTO policy FROM "LoyaltyPolicyVersion" WHERE "organizationId"=NEW."organizationId" ORDER BY revision DESC LIMIT 1;
 cap:=trunc((sale.subtotal-sale."discountAmount")*(policy.configuration#>>'{points,maxRedeemPercent}')::numeric/100,2);
 IF policy.id IS DISTINCT FROM NEW."policyVersionId" OR policy.configuration#>>'{points,enabled}'<>'true' OR NEW."discountAmount"<>NEW.points::numeric*(policy.configuration#>>'{points,redeemMoneyPerPoint}')::numeric OR NEW."discountAmount">cap OR NEW.points>pos_loyalty_available(NEW."customerId",NEW."organizationId",clock_timestamp()::timestamp) THEN RAISE EXCEPTION 'POINTS_BALANCE_CHANGED' USING ERRCODE='23514';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END $$;
CREATE TRIGGER loyalty_redemption_guard BEFORE INSERT OR UPDATE OR DELETE ON "LoyaltyRedemption" FOR EACH ROW EXECUTE FUNCTION pos_loyalty_redemption_guard();

CREATE FUNCTION pos_loyalty_redemption_proof() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_row "LoyaltyRedemption";sale "Sale";
BEGIN
 SELECT * INTO current_row FROM "LoyaltyRedemption" WHERE id=NEW.id;
 SELECT * INTO sale FROM "Sale" WHERE id=NEW."saleId";
 IF current_row.state IN ('prepared','posted') AND (sale."customerId" IS DISTINCT FROM NEW."customerId" OR sale.subtotal<>NEW."subtotalSnapshot" OR sale."discountAmount"<>NEW."baseDiscountAmount"+NEW."discountAmount" OR sale."discountPercent" IS NOT NULL OR pos_loyalty_item_snapshot(sale.id) IS DISTINCT FROM NEW."itemsSnapshot") THEN RAISE EXCEPTION 'LOYALTY_SALE_CHANGED' USING ERRCODE='23514';END IF;
 IF TG_OP='INSERT' AND NOT EXISTS(SELECT 1 FROM "AuditLog" WHERE "organizationId"=NEW."organizationId" AND "actorId"=NEW."createdBy" AND "entityType"='LoyaltyRedemption' AND "entityId"=NEW.id AND action='loyalty_redemption_prepared' AND xmin::text::bigint=txid_current()%4294967296 AND "afterData"->>'points'=NEW.points::text AND "afterData"->>'saleId'=NEW."saleId" AND ("afterData"->>'discountAmount')::numeric=NEW."discountAmount") THEN RAISE EXCEPTION 'LOYALTY_REDEMPTION_PROOF_REQUIRED' USING ERRCODE='23514';END IF;
 IF current_row.state='posted' AND (sale.status NOT IN ('completed','partially_returned','returned') OR COALESCE((SELECT -sum(points) FROM "LoyaltyPointEntry" WHERE "redemptionId"=NEW.id AND kind='redeem'),0)<>NEW.points OR EXISTS(SELECT 1 FROM "LoyaltyPointEntry" e JOIN "LoyaltyPointLot" l ON l.id=e."lotId" WHERE e."redemptionId"=NEW.id AND e.kind='redeem' AND l."expiresAt"<=clock_timestamp())) THEN RAISE EXCEPTION 'LOYALTY_POSTING_INVALID' USING ERRCODE='23514';END IF;
 IF TG_OP='UPDATE' AND NEW.state='cancelled' AND sale.status<>'voided' AND NOT EXISTS(SELECT 1 FROM "AuditLog" a JOIN "OrganizationUser" m ON m."organizationId"=a."organizationId" AND m."userId"=a."actorId" JOIN "Session" s ON s.id=a."afterData"->>'sessionId' AND s."userId"=m."userId" AND s."organizationId"=m."organizationId" JOIN "User" u ON u.id=m."userId" WHERE a."organizationId"=NEW."organizationId" AND a."entityId"=NEW.id AND a."entityType"='LoyaltyRedemption' AND a.action='loyalty_redemption_cancelled' AND a.xmin::text::bigint=txid_current()%4294967296 AND m."isActive" AND u."isActive" AND s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp() AND s."idleExpiresAt">clock_timestamp() AND (m.role='owner' OR EXISTS(SELECT 1 FROM "UserStore" WHERE "organizationUserId"=m.id AND "storeId"=sale."storeId")) AND (m.role<>'cashier' OR sale."cashierId"=u.id)) THEN RAISE EXCEPTION 'LOYALTY_CANCEL_PROOF_REQUIRED' USING ERRCODE='23514';END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER loyalty_redemption_proof AFTER INSERT OR UPDATE ON "LoyaltyRedemption" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_loyalty_redemption_proof();

CREATE FUNCTION pos_loyalty_sale_quote_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE quote "LoyaltyRedemption";sale_id text;sale "Sale";
BEGIN
 IF TG_TABLE_NAME='Sale' THEN sale_id:=NEW.id;ELSE sale_id:=COALESCE(NEW."saleId",OLD."saleId");END IF;
 SELECT * INTO quote FROM "LoyaltyRedemption" WHERE "saleId"=sale_id AND state IN ('prepared','posted');
 IF quote.id IS NULL THEN RETURN NULL;END IF;
 SELECT * INTO sale FROM "Sale" WHERE id=sale_id;
 IF sale."customerId" IS DISTINCT FROM quote."customerId" OR sale.subtotal<>quote."subtotalSnapshot" OR sale."discountAmount"<>quote."baseDiscountAmount"+quote."discountAmount" OR sale."discountPercent" IS NOT NULL OR pos_loyalty_item_snapshot(sale_id) IS DISTINCT FROM quote."itemsSnapshot" THEN RAISE EXCEPTION 'LOYALTY_SALE_CHANGED' USING ERRCODE='23514';END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER loyalty_sale_quote_guard AFTER UPDATE ON "Sale" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_loyalty_sale_quote_guard();
CREATE CONSTRAINT TRIGGER loyalty_item_quote_guard AFTER INSERT OR UPDATE OR DELETE ON "SaleItem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_loyalty_sale_quote_guard();

CREATE FUNCTION pos_loyalty_transfer_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source "Sale";from_row "LoyaltyPointBalance";to_row "LoyaltyPointBalance";
BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RETURN OLD;END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'LOYALTY_JOURNAL_IMMUTABLE' USING ERRCODE='23514';END IF;
 IF pg_trigger_depth()<2 THEN RAISE EXCEPTION 'LOYALTY_NATIVE_SOURCE_REQUIRED' USING ERRCODE='23514';END IF;
 SELECT * INTO source FROM "Sale" WHERE id=NEW."saleId";
 SELECT * INTO from_row FROM "LoyaltyPointBalance" WHERE id=NEW."fromLotId";
 SELECT * INTO to_row FROM "LoyaltyPointBalance" WHERE id=NEW."toLotId";
 IF source.id IS NULL OR source."organizationId"<>NEW."organizationId" OR from_row."organizationId"<>NEW."organizationId" OR to_row."organizationId"<>NEW."organizationId" OR from_row."walletCustomerId" IS DISTINCT FROM to_row."walletCustomerId" OR from_row."walletCustomerId" IS DISTINCT FROM pos_loyalty_wallet_root(source."customerId",NEW."organizationId") OR from_row.balance<NEW.points OR to_row.balance>-NEW.points OR (from_row."expiresAt" IS NOT NULL AND from_row."expiresAt"<=clock_timestamp()) OR (NEW."returnId" IS NULL AND source.status<>'completed') OR (NEW."returnId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "SaleReturn" WHERE id=NEW."returnId" AND "saleId"=source.id AND status='completed')) THEN RAISE EXCEPTION 'LOYALTY_RECOVERY_INVALID' USING ERRCODE='23514';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END $$;
CREATE TRIGGER loyalty_transfer_guard BEFORE INSERT OR UPDATE OR DELETE ON "LoyaltyRecoveryTransfer" FOR EACH ROW EXECUTE FUNCTION pos_loyalty_transfer_guard();

CREATE OR REPLACE FUNCTION pos_loyalty_entry_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE lot "LoyaltyPointLot";ret "SaleReturn";quote "LoyaltyRedemption";transfer "LoyaltyRecoveryTransfer";target bigint;previous numeric;balance numeric;allocated numeric;returned_basis numeric;sale "Sale";
BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RETURN OLD;END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'LOYALTY_JOURNAL_IMMUTABLE' USING ERRCODE='23514';END IF;
 IF pg_trigger_depth()<2 THEN RAISE EXCEPTION 'LOYALTY_NATIVE_SOURCE_REQUIRED' USING ERRCODE='23514';END IF;
 SELECT * INTO lot FROM "LoyaltyPointLot" WHERE id=NEW."lotId" FOR UPDATE;
 IF lot.id IS NULL OR NEW."organizationId"<>lot."organizationId" THEN RAISE EXCEPTION 'LOYALTY_SOURCE_INVALID' USING ERRCODE='23514';END IF;
 IF NEW.kind='return_earn' THEN
  SELECT * INTO ret FROM "SaleReturn" WHERE id=NEW."returnId";
  IF ret.id IS NULL OR ret.status<>'completed' OR ret."saleId"<>lot."saleId" THEN RAISE EXCEPTION 'LOYALTY_RETURN_SOURCE_INVALID' USING ERRCODE='23514';END IF;
  target:=pos_loyalty_refund_target(lot.id);
  SELECT COALESCE(-sum(points),0) INTO previous FROM "LoyaltyPointEntry" WHERE "lotId"=lot.id AND kind='return_earn';
  IF NEW.points<>-(target-previous) OR NEW.points>=0 THEN RAISE EXCEPTION 'LOYALTY_RETURN_AMOUNT_INVALID' USING ERRCODE='23514';END IF;
  NEW."createdAt":=ret."returnedAt";
 ELSIF NEW.kind='redeem' THEN
  SELECT * INTO quote FROM "LoyaltyRedemption" WHERE id=NEW."redemptionId";
 SELECT b.balance INTO balance FROM "LoyaltyPointBalance" b WHERE b.id=lot.id;
  IF quote.id IS NULL OR quote.state<>'posted' OR quote."organizationId"<>lot."organizationId" OR lot."saleId"=quote."saleId" OR pos_loyalty_wallet_root(lot."customerId",lot."organizationId") IS DISTINCT FROM pos_loyalty_wallet_root(quote."customerId",quote."organizationId") OR balance<-NEW.points OR (lot."expiresAt" IS NOT NULL AND lot."expiresAt"<=clock_timestamp()) OR EXISTS(SELECT 1 FROM "LoyaltyPointBalance" earlier WHERE earlier."organizationId"=lot."organizationId" AND earlier."walletCustomerId"=pos_loyalty_wallet_root(lot."customerId",lot."organizationId") AND earlier.balance>0 AND (earlier."expiresAt" IS NULL OR earlier."expiresAt">clock_timestamp()) AND (earlier."createdAt",earlier.id)<(lot."createdAt",lot.id)) THEN RAISE EXCEPTION 'POINTS_BALANCE_CHANGED' USING ERRCODE='23514';END IF;
  NEW."createdAt":=clock_timestamp();
 ELSIF NEW.kind='return_redeem' THEN
  SELECT * INTO quote FROM "LoyaltyRedemption" WHERE id=NEW."redemptionId";
  SELECT * INTO ret FROM "SaleReturn" WHERE id=NEW."returnId";
  SELECT * INTO sale FROM "Sale" WHERE id=quote."saleId";
  IF quote.id IS NULL OR quote.state<>'posted' OR ret.id IS NULL OR ret."saleId"<>quote."saleId" OR ret.status<>'completed' OR sale.subtotal<=0 THEN RAISE EXCEPTION 'LOYALTY_RETURN_SOURCE_INVALID' USING ERRCODE='23514';END IF;
  SELECT -sum(points) INTO allocated FROM "LoyaltyPointEntry" WHERE "lotId"=lot.id AND "redemptionId"=quote.id AND kind='redeem';
  SELECT COALESCE(sum(r.quantity*i."lineTotal"/i.quantity),0) INTO returned_basis FROM "SaleReturnItem" r JOIN "SaleItem" i ON i.id=r."saleItemId" JOIN "SaleReturn" h ON h.id=r."saleReturnId" WHERE i."saleId"=sale.id AND h.status='completed';
  target:=LEAST(allocated,floor(allocated*returned_basis/sale.subtotal))::bigint;
  SELECT COALESCE(sum(points),0) INTO previous FROM "LoyaltyPointEntry" WHERE "lotId"=lot.id AND "redemptionId"=quote.id AND kind='return_redeem';
  IF allocated IS NULL OR NEW.points<>target-previous OR NEW.points<=0 THEN RAISE EXCEPTION 'LOYALTY_RETURN_AMOUNT_INVALID' USING ERRCODE='23514';END IF;
  NEW."createdAt":=ret."returnedAt";
 ELSE
  SELECT * INTO transfer FROM "LoyaltyRecoveryTransfer" WHERE id=NEW."transferId";
  IF transfer.id IS NULL OR transfer."organizationId"<>NEW."organizationId" OR (NEW.kind='recovery_out' AND (NEW."lotId"<>transfer."fromLotId" OR NEW.points<>-transfer.points)) OR (NEW.kind='recovery_in' AND (NEW."lotId"<>transfer."toLotId" OR NEW.points<>transfer.points)) OR NEW.kind NOT IN ('recovery_out','recovery_in') THEN RAISE EXCEPTION 'LOYALTY_RECOVERY_INVALID' USING ERRCODE='23514';END IF;
  NEW."createdAt":=transfer."createdAt";
 END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION pos_loyalty_transfer_entries() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO "LoyaltyPointEntry"(id,"organizationId","lotId",kind,points,"transferId") VALUES(gen_random_uuid()::text,NEW."organizationId",NEW."fromLotId",'recovery_out',-NEW.points,NEW.id),(gen_random_uuid()::text,NEW."organizationId",NEW."toLotId",'recovery_in',NEW.points,NEW.id);
 INSERT INTO "AuditLog"(id,"organizationId","entityType","entityId",action,"afterData") VALUES(gen_random_uuid()::text,NEW."organizationId",'LoyaltyRecoveryTransfer',NEW.id,'loyalty_recovery_settled',jsonb_build_object('saleId',NEW."saleId",'returnId',NEW."returnId",'points',NEW.points::text));RETURN NEW;
END $$;
CREATE TRIGGER loyalty_transfer_entries AFTER INSERT ON "LoyaltyRecoveryTransfer" FOR EACH ROW EXECUTE FUNCTION pos_loyalty_transfer_entries();

CREATE FUNCTION pos_loyalty_settle_recovery(sale_id text,return_id text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
DECLARE sale "Sale";root text;
BEGIN
 SELECT * INTO sale FROM "Sale" WHERE id=sale_id;
 IF sale."customerId" IS NULL THEN RETURN;END IF;
 root:=pos_loyalty_lock_wallet(sale."customerId",sale."organizationId");
 IF (SELECT count(*) FROM "LoyaltyPointBalance" WHERE "organizationId"=sale."organizationId" AND "walletCustomerId"=root AND (balance<0 OR (balance>0 AND ("expiresAt" IS NULL OR "expiresAt">clock_timestamp()))))>10000 THEN RAISE EXCEPTION 'POINT_WALLET_TOO_LARGE' USING ERRCODE='23514';END IF;
 -- Prefix intervals turn FIFO recovery into one set-based statement. Each
 -- overlap transfers the exact intersection of a credit and debt interval.
 WITH credits AS (SELECT id,balance,sum(balance) OVER(ORDER BY "createdAt",id) AS ending FROM "LoyaltyPointBalance" WHERE "organizationId"=sale."organizationId" AND "walletCustomerId"=root AND balance>0 AND ("expiresAt" IS NULL OR "expiresAt">clock_timestamp())),
 debts AS (SELECT id,-balance AS debt,sum(-balance) OVER(ORDER BY "createdAt",id) AS ending FROM "LoyaltyPointBalance" WHERE "organizationId"=sale."organizationId" AND "walletCustomerId"=root AND balance<0)
 INSERT INTO "LoyaltyRecoveryTransfer"(id,"organizationId","fromLotId","toLotId","saleId","returnId",points)
 SELECT gen_random_uuid()::text,sale."organizationId",c.id,d.id,sale.id,return_id,(LEAST(c.ending,d.ending)-GREATEST(c.ending-c.balance,d.ending-d.debt))::bigint FROM credits c JOIN debts d ON c.ending-c.balance<d.ending AND d.ending-d.debt<c.ending ORDER BY c.ending,d.ending;
END $$;
CREATE FUNCTION pos_loyalty_settle_new_lot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pos_loyalty_settle_recovery(NEW."saleId");RETURN NEW;END $$;
CREATE TRIGGER loyalty_settle_new_lot AFTER INSERT ON "LoyaltyPointLot" FOR EACH ROW EXECUTE FUNCTION pos_loyalty_settle_new_lot();

CREATE FUNCTION pos_loyalty_post_redemption() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE quote "LoyaltyRedemption";policy "LoyaltyPolicyVersion";lot "LoyaltyPointBalance";remaining bigint;take_points bigint;root text;
BEGIN
 IF NEW.status='voided' AND OLD.status='draft' THEN
  UPDATE "LoyaltyRedemption" SET state='cancelled' WHERE "saleId"=NEW.id AND state='prepared';RETURN NEW;
 END IF;
 IF NEW.status<>'completed' OR OLD.status='completed' THEN RETURN NEW;END IF;
 SELECT * INTO quote FROM "LoyaltyRedemption" WHERE "saleId"=NEW.id AND state='prepared' FOR UPDATE;
 IF quote.id IS NULL THEN RETURN NEW;END IF;
 root:=pos_loyalty_lock_wallet(quote."customerId",quote."organizationId");
 PERFORM pg_advisory_xact_lock(hashtextextended('loyalty-policy:'||quote."organizationId",0));
 SELECT * INTO policy FROM "LoyaltyPolicyVersion" WHERE "organizationId"=quote."organizationId" ORDER BY revision DESC LIMIT 1;
 IF policy.id IS DISTINCT FROM quote."policyVersionId" OR policy.configuration#>>'{points,enabled}'<>'true' OR NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=quote."organizationId" AND "currencyCode"='UZS') OR EXISTS(SELECT 1 FROM "OfflineCashLease" WHERE "saleId"=NEW.id AND state='consumed') OR quote.points>pos_loyalty_available(quote."customerId",quote."organizationId",clock_timestamp()::timestamp) THEN RAISE EXCEPTION 'POINTS_BALANCE_CHANGED' USING ERRCODE='23514';END IF;
 UPDATE "LoyaltyRedemption" SET state='posted' WHERE id=quote.id;
 PERFORM pos_loyalty_settle_recovery(NEW.id);
 remaining:=quote.points;
 FOR lot IN SELECT * FROM "LoyaltyPointBalance" WHERE "organizationId"=quote."organizationId" AND "walletCustomerId"=root AND balance>0 AND ("expiresAt" IS NULL OR "expiresAt">clock_timestamp()) AND "saleId"<>NEW.id ORDER BY "createdAt",id LOOP
  take_points:=LEAST(remaining,lot.balance)::bigint;
  INSERT INTO "LoyaltyPointEntry"(id,"organizationId","lotId",kind,points,"redemptionId") VALUES(gen_random_uuid()::text,quote."organizationId",lot.id,'redeem',-take_points,quote.id);
  remaining:=remaining-take_points;EXIT WHEN remaining=0;
 END LOOP;
 IF remaining<>0 THEN RAISE EXCEPTION 'POINTS_BALANCE_CHANGED' USING ERRCODE='23514';END IF;
 INSERT INTO "AuditLog"(id,"organizationId","actorId","entityType","entityId",action,"afterData") VALUES(gen_random_uuid()::text,quote."organizationId",NEW."discountApprovedBy",'LoyaltyRedemption',quote.id,'loyalty_points_redeemed',jsonb_build_object('saleId',NEW.id,'points',quote.points::text,'discountAmount',quote."discountAmount"));
 RETURN NEW;
END $$;
-- Spend only already-earned points. This trigger precedes the earn trigger,
-- so a receipt cannot finance its own discount from its future reward grant.
CREATE TRIGGER loyalty_a_post_redemption AFTER UPDATE OF status ON "Sale" FOR EACH ROW EXECUTE FUNCTION pos_loyalty_post_redemption();

CREATE FUNCTION pos_loyalty_restore_redeemed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE quote "LoyaltyRedemption";sale "Sale";debit record;target bigint;prior numeric;returned_basis numeric;root text;
BEGIN
 IF NEW.status<>'completed' THEN RETURN NULL;END IF;
 SELECT * INTO quote FROM "LoyaltyRedemption" WHERE "saleId"=NEW."saleId" AND state='posted';
 IF quote.id IS NULL THEN RETURN NULL;END IF;
 root:=pos_loyalty_lock_wallet(quote."customerId",quote."organizationId");
 SELECT * INTO sale FROM "Sale" WHERE id=quote."saleId";
 SELECT COALESCE(sum(r.quantity*i."lineTotal"/i.quantity),0) INTO returned_basis FROM "SaleReturnItem" r JOIN "SaleItem" i ON i.id=r."saleItemId" JOIN "SaleReturn" h ON h.id=r."saleReturnId" WHERE i."saleId"=sale.id AND h.status='completed';
 FOR debit IN SELECT "lotId",-sum(points) AS allocated FROM "LoyaltyPointEntry" WHERE "redemptionId"=quote.id AND kind='redeem' GROUP BY "lotId" ORDER BY "lotId" LOOP
  target:=LEAST(debit.allocated,floor(debit.allocated*returned_basis/sale.subtotal))::bigint;
  SELECT COALESCE(sum(points),0) INTO prior FROM "LoyaltyPointEntry" WHERE "lotId"=debit."lotId" AND "redemptionId"=quote.id AND kind='return_redeem';
  IF target<prior THEN RAISE EXCEPTION 'LOYALTY_REFUND_RECONCILIATION' USING ERRCODE='23514';END IF;
  IF target>prior THEN
   INSERT INTO "LoyaltyPointEntry"(id,"organizationId","lotId",kind,points,"returnId","redemptionId") VALUES(gen_random_uuid()::text,quote."organizationId",debit."lotId",'return_redeem',target-prior,NEW.id,quote.id);
  END IF;
 END LOOP;
 PERFORM pos_loyalty_settle_recovery(sale.id,NEW.id);
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER loyalty_restore_redeemed AFTER INSERT ON "SaleReturn" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_loyalty_restore_redeemed();

-- Both spend and refund use wallet-before-lot lock order, including aliases.
DO $$ DECLARE source text;needle text:='SELECT * INTO lot FROM "LoyaltyPointLot" WHERE "saleId"=NEW."saleId" FOR UPDATE;';BEGIN
 source:=pg_get_functiondef('pos_loyalty_revoke_from_return()'::regprocedure);
 IF strpos(source,needle)=0 THEN RAISE EXCEPTION 'Unreviewed loyalty refund source';END IF;
 source:=replace(source,needle,'IF NOT EXISTS(SELECT 1 FROM "LoyaltyPointLot" WHERE "saleId"=NEW."saleId") THEN RETURN NULL;END IF; PERFORM pos_loyalty_lock_wallet((SELECT "customerId" FROM "Sale" WHERE id=NEW."saleId"),(SELECT "organizationId" FROM "Sale" WHERE id=NEW."saleId")); '||needle);
 EXECUTE source;
END $$;

CREATE FUNCTION pos_loyalty_offline_boundary() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM "LoyaltyRedemption" WHERE "saleId"=NEW."saleId" AND state IN ('prepared','posted')) THEN RAISE EXCEPTION 'LOYALTY_OFFLINE_UNAVAILABLE' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER loyalty_offline_boundary BEFORE INSERT ON "OfflineCashLease" FOR EACH ROW EXECUTE FUNCTION pos_loyalty_offline_boundary();

DO $$ DECLARE source text;needle text:='WHEN ''Organization'' THEN';tab text;BEGIN
 source:=pg_get_functiondef('business_row_organization(text,jsonb)'::regprocedure);
 IF strpos(source,needle)=0 OR strpos(source,'''LoyaltyRedemption''')>0 THEN RAISE EXCEPTION 'Unreviewed subscription scope';END IF;
 source:=replace(source,needle,'WHEN ''LoyaltyRedemption'' THEN RETURN value->>''organizationId''; WHEN ''LoyaltyRecoveryTransfer'' THEN RETURN value->>''organizationId''; '||needle);EXECUTE source;
 FOREACH tab IN ARRAY ARRAY['LoyaltyRedemption','LoyaltyRecoveryTransfer'] LOOP
  EXECUTE format('CREATE TRIGGER subscription_read_only BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION subscription_business_write_guard()',tab);
 END LOOP;
END $$;
COMMIT;

