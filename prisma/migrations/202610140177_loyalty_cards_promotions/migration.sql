BEGIN;
CREATE TABLE "LoyaltyCard" (
 id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 "customerId" TEXT NOT NULL REFERENCES "Customer"(id),"policyVersionId" TEXT NOT NULL REFERENCES "LoyaltyPolicyVersion"(id),
 code TEXT NOT NULL,"createdBy" TEXT NOT NULL REFERENCES "User"(id),reason TEXT NOT NULL,
 "expiresAt" TIMESTAMP(3),"revokedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE("organizationId",code),CHECK(code~'^[A-Z0-9][A-Z0-9_-]{2,63}$'),CHECK(length(btrim(reason)) BETWEEN 3 AND 2000)
);
CREATE INDEX "LoyaltyCard_organizationId_customerId_createdAt_id_idx" ON "LoyaltyCard"("organizationId","customerId","createdAt",id);
CREATE TABLE "LoyaltyPromotion" (
 id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 "policyVersionId" TEXT NOT NULL REFERENCES "LoyaltyPolicyVersion"(id),code TEXT NOT NULL,configuration JSONB NOT NULL,
 "createdBy" TEXT NOT NULL REFERENCES "User"(id),reason TEXT NOT NULL,"revokedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE("organizationId",code),CHECK(code~'^[A-Z0-9][A-Z0-9_-]{2,63}$'),CHECK(length(btrim(reason)) BETWEEN 3 AND 2000)
);
CREATE INDEX "LoyaltyPromotion_organizationId_createdAt_id_idx" ON "LoyaltyPromotion"("organizationId","createdAt",id);
CREATE TABLE "LoyaltyBenefitSelection" (
 id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 "saleId" TEXT NOT NULL REFERENCES "Sale"(id),"customerId" TEXT NOT NULL REFERENCES "Customer"(id),"policyVersionId" TEXT NOT NULL REFERENCES "LoyaltyPolicyVersion"(id),
 "cardId" TEXT REFERENCES "LoyaltyCard"(id),"promotionId" TEXT REFERENCES "LoyaltyPromotion"(id),state TEXT NOT NULL DEFAULT 'prepared',
 "discountAmount" NUMERIC(14,2) NOT NULL,"cardAmount" NUMERIC(14,2) NOT NULL,"promotionAmount" NUMERIC(14,2) NOT NULL,
 "baseDiscountAmount" NUMERIC(14,2) NOT NULL,"originalDiscountPercent" NUMERIC(5,2),"subtotalSnapshot" NUMERIC(14,2) NOT NULL,"itemsSnapshot" JSONB NOT NULL,
 "createdBy" TEXT NOT NULL REFERENCES "User"(id),"sessionId" TEXT NOT NULL,reason TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK("cardId" IS NOT NULL OR "promotionId" IS NOT NULL),CHECK(state IN ('prepared','posted','cancelled')),
 CHECK("discountAmount">0 AND "cardAmount">=0 AND "promotionAmount">=0 AND "discountAmount"="cardAmount"+"promotionAmount" AND "baseDiscountAmount">=0),CHECK(length(btrim(reason)) BETWEEN 3 AND 2000)
);
CREATE UNIQUE INDEX "LoyaltyBenefitSelection_active_sale" ON "LoyaltyBenefitSelection"("saleId") WHERE state IN ('prepared','posted');
CREATE INDEX "LoyaltyBenefitSelection_organizationId_saleId_createdAt_id_idx" ON "LoyaltyBenefitSelection"("organizationId","saleId","createdAt",id);
CREATE INDEX "LoyaltyBenefitSelection_promotionId_state_customerId_idx" ON "LoyaltyBenefitSelection"("promotionId",state,"customerId");

CREATE FUNCTION pos_loyalty_owner(org text,actor text) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM "OrganizationUser" m JOIN "User" u ON u.id=m."userId" WHERE m."organizationId"=org AND m."userId"=actor AND m.role='owner' AND m."customRoleId" IS NULL AND m."isActive" AND u."isActive")
$$;
CREATE FUNCTION pos_promotion_configuration_valid(c jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE key text;
BEGIN
 IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR octet_length(c::text)>32768 OR (SELECT count(*) FROM jsonb_object_keys(c))<>11 OR jsonb_typeof(c->'enabled') IS DISTINCT FROM 'boolean' OR jsonb_typeof(c->'kind') IS DISTINCT FROM 'string' OR c->>'kind' NOT IN ('percent','fixed') THEN RETURN FALSE;END IF;
 FOREACH key IN ARRAY ARRAY['value','minEligibleNet','maxDiscount'] LOOP
  IF jsonb_typeof(c->key) IS DISTINCT FROM 'string' OR length(c->>key)>30 OR (c->>key)!~'^\d+(\.\d{1,2})?$' OR (c->>key)::numeric>=1000000000000 THEN RETURN FALSE;END IF;
 END LOOP;
 IF (c->>'value')::numeric<=0 OR (c->>'maxDiscount')::numeric<=0 OR (c->>'kind'='percent' AND (c->>'value')::numeric>100) THEN RETURN FALSE;END IF;
 FOREACH key IN ARRAY ARRAY['maxUses','maxUsesPerCustomer'] LOOP
  IF jsonb_typeof(c->key) IS DISTINCT FROM 'number' OR (c->>key)::numeric<>trunc((c->>key)::numeric) OR (c->>key)::numeric<1 OR (c->>key)::numeric>(CASE WHEN key='maxUses' THEN 100000000 ELSE 100000 END) THEN RETURN FALSE;END IF;
 END LOOP;
 IF jsonb_typeof(c->'storeIds') IS DISTINCT FROM 'array' OR jsonb_array_length(c->'storeIds')>100 OR jsonb_typeof(c->'productIds') IS DISTINCT FROM 'array' OR jsonb_array_length(c->'productIds')<>0 THEN RETURN FALSE;END IF;
 IF (SELECT count(*) FROM jsonb_array_elements_text(c->'storeIds'))<>(SELECT count(DISTINCT value) FROM jsonb_array_elements_text(c->'storeIds')) OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(c->'storeIds') WHERE value!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN RETURN FALSE;END IF;
 FOREACH key IN ARRAY ARRAY['startsAt','endsAt'] LOOP
  IF jsonb_typeof(c->key) IS DISTINCT FROM 'string' OR (c->>key)!~'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$' THEN RETURN FALSE;END IF;
 END LOOP;
 IF (c->>'startsAt')::timestamptz>=(c->>'endsAt')::timestamptz THEN RETURN FALSE;END IF;
 RETURN TRUE;
EXCEPTION WHEN OTHERS THEN RETURN FALSE;
END $$;
ALTER TABLE "LoyaltyPromotion" ADD CONSTRAINT "LoyaltyPromotion_config" CHECK(pos_promotion_configuration_valid(configuration));

CREATE FUNCTION pos_loyalty_registry_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE policy "LoyaltyPolicyVersion";section text;
BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RETURN OLD;END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'LOYALTY_REGISTRY_IMMUTABLE' USING ERRCODE='23514';END IF;
 PERFORM assert_business_writable(NEW."organizationId");
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-'revokedAt') IS DISTINCT FROM (to_jsonb(OLD)-'revokedAt') OR OLD."revokedAt" IS NOT NULL OR NEW."revokedAt" IS NULL THEN RAISE EXCEPTION 'LOYALTY_REGISTRY_IMMUTABLE' USING ERRCODE='23514';END IF;
  NEW."revokedAt":=clock_timestamp();RETURN NEW;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('loyalty-policy:'||NEW."organizationId",0));
 SELECT * INTO policy FROM "LoyaltyPolicyVersion" WHERE "organizationId"=NEW."organizationId" ORDER BY revision DESC LIMIT 1;
 section:=CASE WHEN TG_TABLE_NAME='LoyaltyCard' THEN 'cards' ELSE 'promos' END;
 IF policy.id IS DISTINCT FROM NEW."policyVersionId" OR policy.configuration#>ARRAY[section,'enabled'] IS DISTINCT FROM 'true'::jsonb OR NEW."revokedAt" IS NOT NULL OR NOT pos_loyalty_owner(NEW."organizationId",NEW."createdBy") OR NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=NEW."organizationId" AND "currencyCode"='UZS') THEN RAISE EXCEPTION 'LOYALTY_POLICY_CHANGED' USING ERRCODE='23514';END IF;
 NEW."createdAt":=transaction_timestamp()::timestamp(3);
 IF TG_TABLE_NAME='LoyaltyCard' THEN
  IF NOT EXISTS(SELECT 1 FROM "Customer" WHERE id=NEW."customerId" AND "organizationId"=NEW."organizationId" AND "isActive" AND "mergedIntoId" IS NULL) OR NEW."expiresAt" IS DISTINCT FROM (CASE WHEN policy.configuration#>'{cards,validityDays}'='null'::jsonb THEN NULL ELSE NEW."createdAt"+make_interval(days=>(policy.configuration#>>'{cards,validityDays}')::integer) END) THEN RAISE EXCEPTION 'CARD_UNAVAILABLE' USING ERRCODE='23514';END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(NEW.configuration->'storeIds') ids WHERE NOT EXISTS(SELECT 1 FROM "Store" WHERE id=ids.value AND "organizationId"=NEW."organizationId" AND "isActive")) THEN RAISE EXCEPTION 'PROMO_STORE_UNAVAILABLE' USING ERRCODE='23514';END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER loyalty_card_guard BEFORE INSERT OR UPDATE OR DELETE ON "LoyaltyCard" FOR EACH ROW EXECUTE FUNCTION pos_loyalty_registry_guard();
CREATE TRIGGER loyalty_promotion_guard BEFORE INSERT OR UPDATE OR DELETE ON "LoyaltyPromotion" FOR EACH ROW EXECUTE FUNCTION pos_loyalty_registry_guard();
CREATE FUNCTION pos_loyalty_registry_proof() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected text;
BEGIN
 expected:=CASE WHEN TG_OP='INSERT' THEN 'issued' ELSE 'revoked' END;
 IF NOT EXISTS(SELECT 1 FROM "AuditLog" a WHERE a."organizationId"=NEW."organizationId" AND a."entityType"=TG_TABLE_NAME AND a."entityId"=NEW.id AND a.action='loyalty_registry_'||expected AND a.xmin::text::bigint=txid_current()%4294967296 AND pos_loyalty_owner(a."organizationId",a."actorId") AND (TG_OP<>'INSERT' OR (a."actorId"=NEW."createdBy" AND a."afterData"->>'code'=NEW.code AND a."afterData"->>'policyVersionId'=NEW."policyVersionId"))) THEN RAISE EXCEPTION 'LOYALTY_REGISTRY_PROOF_REQUIRED' USING ERRCODE='23514';END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER loyalty_card_proof AFTER INSERT OR UPDATE ON "LoyaltyCard" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_loyalty_registry_proof();
CREATE CONSTRAINT TRIGGER loyalty_promotion_proof AFTER INSERT OR UPDATE ON "LoyaltyPromotion" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_loyalty_registry_proof();

CREATE FUNCTION pos_loyalty_benefit_amounts(selection_id text) RETURNS TABLE(card_amount numeric,promotion_amount numeric) LANGUAGE plpgsql AS $$
DECLARE selection "LoyaltyBenefitSelection";sale "Sale";policy "LoyaltyPolicyVersion";card "LoyaltyCard";promo "LoyaltyPromotion";cfg jsonb;base numeric;root text;
BEGIN
 SELECT * INTO selection FROM "LoyaltyBenefitSelection" WHERE id=selection_id;
 SELECT * INTO sale FROM "Sale" WHERE id=selection."saleId";
 PERFORM pg_advisory_xact_lock(hashtextextended('loyalty-policy:'||selection."organizationId",0));
 SELECT * INTO policy FROM "LoyaltyPolicyVersion" WHERE "organizationId"=selection."organizationId" ORDER BY revision DESC LIMIT 1;
 IF policy.id IS DISTINCT FROM selection."policyVersionId" THEN RAISE EXCEPTION 'LOYALTY_POLICY_CHANGED' USING ERRCODE='23514';END IF;
 base:=selection."subtotalSnapshot"-selection."baseDiscountAmount";card_amount:=0;promotion_amount:=0;
 IF selection."cardId" IS NOT NULL THEN
  SELECT * INTO card FROM "LoyaltyCard" WHERE id=selection."cardId" FOR SHARE;
  IF card.id IS NULL OR card."organizationId"<>selection."organizationId" OR card."revokedAt" IS NOT NULL OR (card."expiresAt" IS NOT NULL AND card."expiresAt"<=clock_timestamp()) OR policy.configuration#>'{cards,enabled}' IS DISTINCT FROM 'true'::jsonb OR pos_loyalty_wallet_root(card."customerId",selection."organizationId") IS DISTINCT FROM pos_loyalty_wallet_root(selection."customerId",selection."organizationId") THEN RAISE EXCEPTION 'CARD_UNAVAILABLE' USING ERRCODE='23514';END IF;
  card_amount:=round(base*(policy.configuration#>>'{cards,discountPercent}')::numeric/100,2);base:=base-card_amount;
 END IF;
 IF selection."promotionId" IS NOT NULL THEN
  SELECT * INTO promo FROM "LoyaltyPromotion" WHERE id=selection."promotionId" FOR UPDATE;cfg:=promo.configuration;
  IF promo.id IS NULL OR promo."organizationId"<>selection."organizationId" OR promo."revokedAt" IS NOT NULL OR cfg->'enabled' IS DISTINCT FROM 'true'::jsonb OR policy.configuration#>'{promos,enabled}' IS DISTINCT FROM 'true'::jsonb OR clock_timestamp()<(cfg->>'startsAt')::timestamptz OR clock_timestamp()>=(cfg->>'endsAt')::timestamptz THEN RAISE EXCEPTION 'PROMO_UNAVAILABLE' USING ERRCODE='23514';END IF;
  IF selection."cardId" IS NOT NULL AND policy.configuration#>'{promos,allowStackingWithCard}' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'PROMO_STACKING_DENIED' USING ERRCODE='23514';END IF;
  IF jsonb_array_length(cfg->'storeIds')>0 AND NOT (cfg->'storeIds' ? sale."storeId") THEN RAISE EXCEPTION 'PROMO_STORE_UNAVAILABLE' USING ERRCODE='23514';END IF;
  IF base<(cfg->>'minEligibleNet')::numeric THEN RAISE EXCEPTION 'PROMO_MIN_AMOUNT' USING ERRCODE='23514';END IF;
  root:=pos_loyalty_wallet_root(selection."customerId",selection."organizationId");
  IF (SELECT count(*) FROM "LoyaltyBenefitSelection" WHERE "promotionId"=promo.id AND state='posted' AND id<>selection.id)>=(cfg->>'maxUses')::integer OR (SELECT count(*) FROM "LoyaltyBenefitSelection" WHERE "promotionId"=promo.id AND state='posted' AND id<>selection.id AND pos_loyalty_wallet_root("customerId",selection."organizationId")=root)>=(cfg->>'maxUsesPerCustomer')::integer THEN RAISE EXCEPTION 'PROMO_USE_LIMIT' USING ERRCODE='23514';END IF;
  promotion_amount:=LEAST(base,(cfg->>'maxDiscount')::numeric,CASE WHEN cfg->>'kind'='percent' THEN round(base*(cfg->>'value')::numeric/100,2) ELSE (cfg->>'value')::numeric END);
 END IF;
 RETURN NEXT;
END $$;
CREATE FUNCTION pos_loyalty_benefit_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sale "Sale";
BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RETURN OLD;END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'LOYALTY_REGISTRY_IMMUTABLE' USING ERRCODE='23514';END IF;
 SELECT * INTO sale FROM "Sale" WHERE id=NEW."saleId" FOR UPDATE;
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-'state') IS DISTINCT FROM (to_jsonb(OLD)-'state') OR OLD.state<>'prepared' OR NEW.state NOT IN ('posted','cancelled') OR (NEW.state='posted' AND (pg_trigger_depth()<2 OR sale.status<>'completed')) OR (NEW.state='cancelled' AND sale.status NOT IN ('draft','voided')) THEN RAISE EXCEPTION 'LOYALTY_REGISTRY_IMMUTABLE' USING ERRCODE='23514';END IF;
  RETURN NEW;
 END IF;
 PERFORM assert_business_writable(NEW."organizationId");
 IF sale.id IS NULL OR sale.status<>'draft' OR NEW.state<>'prepared' OR sale."organizationId"<>NEW."organizationId" OR sale."customerId" IS DISTINCT FROM NEW."customerId" OR sale.subtotal<>NEW."subtotalSnapshot" OR sale."discountAmount"<>NEW."baseDiscountAmount" OR sale."discountPercent" IS DISTINCT FROM NEW."originalDiscountPercent" OR pos_loyalty_item_snapshot(sale.id) IS DISTINCT FROM NEW."itemsSnapshot" OR EXISTS(SELECT 1 FROM "LoyaltyRedemption" WHERE "saleId"=sale.id AND state IN ('prepared','posted')) OR EXISTS(SELECT 1 FROM "OfflineCashLease" WHERE "saleId"=sale.id AND state='issued') OR NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=NEW."organizationId" AND "currencyCode"='UZS') THEN RAISE EXCEPTION 'LOYALTY_SALE_CHANGED' USING ERRCODE='23514';END IF;
 IF NOT auth_restore_ready() OR NOT EXISTS(SELECT 1 FROM "Session" s JOIN "User" u ON u.id=s."userId" JOIN "OrganizationUser" m ON m."userId"=u.id AND m."organizationId"=s."organizationId" WHERE s.id=NEW."sessionId" AND s."organizationId"=NEW."organizationId" AND s."userId"=NEW."createdBy" AND s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp() AND s."idleExpiresAt">clock_timestamp() AND u."isActive" AND m."isActive" AND (m.role='owner' OR EXISTS(SELECT 1 FROM "UserStore" WHERE "organizationUserId"=m.id AND "storeId"=sale."storeId")) AND (m.role<>'cashier' OR sale."cashierId"=u.id)) THEN RAISE EXCEPTION 'LOYALTY_ACTOR_CHANGED' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER loyalty_benefit_guard BEFORE INSERT OR UPDATE OR DELETE ON "LoyaltyBenefitSelection" FOR EACH ROW EXECUTE FUNCTION pos_loyalty_benefit_guard();
CREATE FUNCTION pos_loyalty_benefit_snapshot(selection_id text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE selection "LoyaltyBenefitSelection";sale "Sale";points "LoyaltyRedemption";expected numeric;
BEGIN
 SELECT * INTO selection FROM "LoyaltyBenefitSelection" WHERE id=selection_id;
 IF selection.state='cancelled' THEN RETURN;END IF;
 SELECT * INTO sale FROM "Sale" WHERE id=selection."saleId";
 SELECT * INTO points FROM "LoyaltyRedemption" WHERE "saleId"=sale.id AND state IN ('prepared','posted');
 expected:=selection."baseDiscountAmount"+selection."discountAmount";
 IF points.id IS NOT NULL THEN
  IF points."baseDiscountAmount"<>expected OR (selection."promotionId" IS NOT NULL AND (SELECT configuration#>'{promos,allowStackingWithPoints}' FROM "LoyaltyPolicyVersion" WHERE id=selection."policyVersionId") IS DISTINCT FROM 'true'::jsonb) THEN RAISE EXCEPTION 'PROMO_STACKING_DENIED' USING ERRCODE='23514';END IF;
  expected:=expected+points."discountAmount";
 END IF;
 IF sale."customerId" IS DISTINCT FROM selection."customerId" OR sale.subtotal<>selection."subtotalSnapshot" OR sale."discountAmount"<>expected OR sale."discountPercent" IS NOT NULL OR pos_loyalty_item_snapshot(sale.id) IS DISTINCT FROM selection."itemsSnapshot" THEN RAISE EXCEPTION 'LOYALTY_SALE_CHANGED' USING ERRCODE='23514';END IF;
END $$;
CREATE FUNCTION pos_loyalty_benefit_proof() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE amounts record;
BEGIN
 PERFORM pos_loyalty_benefit_snapshot(NEW.id);
 IF TG_OP='INSERT' THEN
  SELECT * INTO amounts FROM pos_loyalty_benefit_amounts(NEW.id);
  IF NEW."cardAmount"<>amounts.card_amount OR NEW."promotionAmount"<>amounts.promotion_amount OR NOT EXISTS(SELECT 1 FROM "AuditLog" WHERE "organizationId"=NEW."organizationId" AND "actorId"=NEW."createdBy" AND "entityType"='LoyaltyBenefitSelection' AND "entityId"=NEW.id AND action='loyalty_benefit_prepared' AND xmin::text::bigint=txid_current()%4294967296 AND "afterData"->>'saleId'=NEW."saleId" AND ("afterData"->>'discountAmount')::numeric=NEW."discountAmount") THEN RAISE EXCEPTION 'LOYALTY_REGISTRY_PROOF_REQUIRED' USING ERRCODE='23514';END IF;
 ELSIF NEW.state='cancelled' AND (SELECT status FROM "Sale" WHERE id=NEW."saleId")<>'voided' AND NOT EXISTS(SELECT 1 FROM "AuditLog" WHERE "organizationId"=NEW."organizationId" AND "entityType"='LoyaltyBenefitSelection' AND "entityId"=NEW.id AND action='loyalty_benefit_cancelled' AND xmin::text::bigint=txid_current()%4294967296) THEN RAISE EXCEPTION 'LOYALTY_REGISTRY_PROOF_REQUIRED' USING ERRCODE='23514';END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER loyalty_benefit_proof AFTER INSERT OR UPDATE ON "LoyaltyBenefitSelection" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_loyalty_benefit_proof();
CREATE FUNCTION pos_loyalty_benefit_sale_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE selection record;sale_id text;
BEGIN
 sale_id:=CASE WHEN TG_TABLE_NAME='Sale' THEN NEW.id ELSE COALESCE(NEW."saleId",OLD."saleId") END;
 FOR selection IN SELECT id FROM "LoyaltyBenefitSelection" WHERE "saleId"=sale_id AND state IN ('prepared','posted') LOOP PERFORM pos_loyalty_benefit_snapshot(selection.id);END LOOP;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER loyalty_benefit_sale_guard AFTER UPDATE ON "Sale" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_loyalty_benefit_sale_guard();
CREATE CONSTRAINT TRIGGER loyalty_benefit_item_guard AFTER INSERT OR UPDATE OR DELETE ON "SaleItem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_loyalty_benefit_sale_guard();
CREATE FUNCTION pos_loyalty_benefit_post() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE selection "LoyaltyBenefitSelection";amounts record;
BEGIN
 IF NEW.status=OLD.status THEN RETURN NEW;END IF;
 SELECT * INTO selection FROM "LoyaltyBenefitSelection" WHERE "saleId"=NEW.id AND state='prepared';
 IF selection.id IS NULL THEN RETURN NEW;END IF;
 IF NEW.status='voided' THEN UPDATE "LoyaltyBenefitSelection" SET state='cancelled' WHERE id=selection.id;RETURN NEW;END IF;
 IF NEW.status<>'completed' THEN RETURN NEW;END IF;
 PERFORM pos_loyalty_benefit_snapshot(selection.id);
 SELECT * INTO amounts FROM pos_loyalty_benefit_amounts(selection.id);
 IF selection."cardAmount"<>amounts.card_amount OR selection."promotionAmount"<>amounts.promotion_amount THEN RAISE EXCEPTION 'LOYALTY_POLICY_CHANGED' USING ERRCODE='23514';END IF;
 UPDATE "LoyaltyBenefitSelection" SET state='posted' WHERE id=selection.id;
 INSERT INTO "AuditLog"(id,"organizationId","actorId","entityType","entityId",action,"afterData") VALUES(gen_random_uuid()::text,selection."organizationId",NEW."discountApprovedBy",'LoyaltyBenefitSelection',selection.id,'loyalty_benefit_posted',jsonb_build_object('saleId',NEW.id,'discountAmount',selection."discountAmount"));
 RETURN NEW;
END $$;
CREATE TRIGGER loyalty_benefit_post AFTER UPDATE OF status ON "Sale" FOR EACH ROW EXECUTE FUNCTION pos_loyalty_benefit_post();
CREATE FUNCTION pos_loyalty_benefit_offline_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM "LoyaltyBenefitSelection" WHERE "saleId"=NEW."saleId" AND state IN ('prepared','posted')) THEN RAISE EXCEPTION 'LOYALTY_OFFLINE_UNAVAILABLE' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER loyalty_benefit_offline_guard BEFORE INSERT ON "OfflineCashLease" FOR EACH ROW EXECUTE FUNCTION pos_loyalty_benefit_offline_guard();
DO $$ DECLARE source text;needle text:='WHEN ''Organization'' THEN';tab text;BEGIN
 source:=pg_get_functiondef('business_row_organization(text,jsonb)'::regprocedure);
 IF strpos(source,needle)=0 THEN RAISE EXCEPTION 'Unreviewed subscription scope';END IF;
 source:=replace(source,needle,'WHEN ''LoyaltyCard'' THEN RETURN value->>''organizationId''; WHEN ''LoyaltyPromotion'' THEN RETURN value->>''organizationId''; WHEN ''LoyaltyBenefitSelection'' THEN RETURN value->>''organizationId''; '||needle);EXECUTE source;
 FOREACH tab IN ARRAY ARRAY['LoyaltyCard','LoyaltyPromotion','LoyaltyBenefitSelection'] LOOP EXECUTE format('CREATE TRIGGER subscription_read_only BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION subscription_business_write_guard()',tab);END LOOP;
END $$;
COMMIT;
