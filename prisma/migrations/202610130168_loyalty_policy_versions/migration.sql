BEGIN;
-- CreateTable
CREATE TABLE "LoyaltyPolicyVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "configuration" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyPolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoyaltyPolicyVersion_organizationId_createdAt_id_idx" ON "LoyaltyPolicyVersion"("organizationId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyPolicyVersion_organizationId_revision_key" ON "LoyaltyPolicyVersion"("organizationId", "revision");

-- AddForeignKey
ALTER TABLE "LoyaltyPolicyVersion" ADD CONSTRAINT "LoyaltyPolicyVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyPolicyVersion" ADD CONSTRAINT "LoyaltyPolicyVersion_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;


CREATE FUNCTION pos_loyalty_configuration_valid(c jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE path text[];value jsonb;section text;expected integer;
BEGIN
 IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR octet_length(c::text)>16384 THEN RETURN FALSE;END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(c))<>4 THEN RETURN FALSE;END IF;
 FOREACH section IN ARRAY ARRAY['points','cards','promos','gifts'] LOOP
  IF jsonb_typeof(c->section) IS DISTINCT FROM 'object' THEN RETURN FALSE;END IF;
  expected:=CASE section WHEN 'points' THEN 8 WHEN 'cards' THEN 3 WHEN 'promos' THEN 3 ELSE 5 END;
  IF (SELECT count(*) FROM jsonb_object_keys(c->section))<>expected THEN RETURN FALSE;END IF;
 END LOOP;
 FOREACH path SLICE 1 IN ARRAY ARRAY[['points','enabled'],['points','earnOnDiscountedSales'],['points','earnOnCreditSales'],['cards','enabled'],['promos','enabled'],['promos','allowStackingWithCard'],['promos','allowStackingWithPoints'],['gifts','enabled'],['gifts','allowUnusedCashRefund']] LOOP
  IF jsonb_typeof(c#>path) IS DISTINCT FROM 'boolean' THEN RETURN FALSE;END IF;
 END LOOP;
 FOREACH path SLICE 1 IN ARRAY ARRAY[['points','earnMoneyPerPoint'],['points','redeemMoneyPerPoint'],['points','maxRedeemPercent'],['points','minEligibleNet'],['cards','discountPercent'],['gifts','minIssueAmount'],['gifts','maxIssueAmount']] LOOP
  IF jsonb_typeof(c#>path) IS DISTINCT FROM 'string' OR length(c#>>path)>30 OR (c#>>path)!~'^\d+(\.\d{1,2})?$' THEN RETURN FALSE;END IF;
  IF (c#>>path)::numeric>=1000000000000 THEN RETURN FALSE;END IF;
 END LOOP;
 IF (c#>>'{points,earnMoneyPerPoint}')::numeric<=0 OR (c#>>'{points,redeemMoneyPerPoint}')::numeric<=0 OR (c#>>'{gifts,minIssueAmount}')::numeric<=0 OR (c#>>'{gifts,maxIssueAmount}')::numeric<(c#>>'{gifts,minIssueAmount}')::numeric OR (c#>>'{points,maxRedeemPercent}')::numeric>100 OR (c#>>'{cards,discountPercent}')::numeric>100 THEN RETURN FALSE;END IF;
 FOREACH path SLICE 1 IN ARRAY ARRAY[['points','expiryDays'],['cards','validityDays'],['gifts','validityDays']] LOOP
  value:=c#>path;
  IF value IS NULL THEN RETURN FALSE;END IF;
  IF value<>'null'::jsonb THEN
   IF jsonb_typeof(value) IS DISTINCT FROM 'number' THEN RETURN FALSE;END IF;
   IF value::text::numeric<>trunc(value::text::numeric) OR value::text::numeric NOT BETWEEN 1 AND 36500 THEN RETURN FALSE;END IF;
  END IF;
 END LOOP;
 RETURN TRUE;
END $$;
ALTER TABLE "LoyaltyPolicyVersion" ADD CONSTRAINT "LoyaltyPolicyVersion_config" CHECK(pos_loyalty_configuration_valid(configuration));
ALTER TABLE "LoyaltyPolicyVersion" ADD CONSTRAINT "LoyaltyPolicyVersion_reason" CHECK(length(btrim(reason)) BETWEEN 3 AND 2000 AND revision>0);
CREATE FUNCTION pos_loyalty_policy_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RETURN OLD;END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'LOYALTY_POLICY_IMMUTABLE' USING ERRCODE='23514';END IF;
 PERFORM assert_business_writable(NEW."organizationId");
 PERFORM pg_advisory_xact_lock(hashtextextended('loyalty-policy:'||NEW."organizationId",0));
 IF NEW.revision<>COALESCE((SELECT max(revision)+1 FROM "LoyaltyPolicyVersion" WHERE "organizationId"=NEW."organizationId"),1) OR NOT EXISTS(SELECT 1 FROM "OrganizationUser" m JOIN "User" u ON u.id=m."userId" WHERE m."organizationId"=NEW."organizationId" AND m."userId"=NEW."createdBy" AND m.role='owner' AND m."isActive" AND m."customRoleId" IS NULL AND u."isActive") THEN RAISE EXCEPTION 'LOYALTY_POLICY_OWNER_REQUIRED' USING ERRCODE='23514';END IF;
 NEW."createdAt":=clock_timestamp();RETURN NEW;
END $$;
CREATE TRIGGER loyalty_policy_guard BEFORE INSERT OR UPDATE OR DELETE ON "LoyaltyPolicyVersion" FOR EACH ROW EXECUTE FUNCTION pos_loyalty_policy_guard();
CREATE FUNCTION pos_loyalty_policy_proof() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM "AuditLog" a WHERE a."organizationId"=NEW."organizationId" AND a."actorId"=NEW."createdBy" AND a."entityType"='LoyaltyPolicyVersion' AND a."entityId"=NEW.id AND a.action='loyalty_policy_published' AND a.xmin::text::bigint=txid_current()%4294967296 AND a."afterData"->'configuration'=NEW.configuration AND a."afterData"->>'revision'=NEW.revision::text AND a."afterData"->>'reason'=NEW.reason) THEN RAISE EXCEPTION 'LOYALTY_POLICY_PROOF_REQUIRED' USING ERRCODE='23514';END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER loyalty_policy_proof AFTER INSERT ON "LoyaltyPolicyVersion" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_loyalty_policy_proof();
-- Preserve all existing child/root write scopes; add the new direct journal.
DO $$ DECLARE source text;needle text:='WHEN ''Organization'' THEN';BEGIN
 source:=pg_get_functiondef('business_row_organization(text,jsonb)'::regprocedure);
 IF strpos(source,needle)=0 OR strpos(source,'''LoyaltyPolicyVersion''')>0 THEN RAISE EXCEPTION 'Unreviewed subscription scope';END IF;
 source:=replace(source,needle,'WHEN ''LoyaltyPolicyVersion'' THEN RETURN value->>''organizationId''; '||needle);EXECUTE source;
END $$;
CREATE TRIGGER subscription_read_only BEFORE INSERT OR UPDATE OR DELETE ON "LoyaltyPolicyVersion" FOR EACH ROW EXECUTE FUNCTION subscription_business_write_guard();

COMMIT;
