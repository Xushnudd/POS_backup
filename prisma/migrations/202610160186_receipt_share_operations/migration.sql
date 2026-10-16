BEGIN;
CREATE INDEX "Operation_receipt_sale_idx" ON "Operation"("organizationId",(result->>'saleId'),"createdAt" DESC) WHERE type='receipt.share';
DO $$ DECLARE definition TEXT;BEGIN
 definition:=pg_get_functiondef('subscription_operation_guard()'::regprocedure);
 IF strpos(definition,'''customer.consent.withdraw''')=0 THEN RAISE EXCEPTION 'UNKNOWN_OPERATION_GUARD';END IF;
 EXECUTE replace(definition,'''customer.consent.withdraw''','''customer.consent.withdraw'',''receipt.share.revoke''');
END $$;
CREATE FUNCTION pos_receipt_share_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.type IN ('receipt.share','receipt.share.revoke') AND EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RAISE EXCEPTION 'RECEIPT_SHARE_IMMUTABLE' USING ERRCODE='23514';END IF;RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' AND (OLD.type IN ('receipt.share','receipt.share.revoke') OR NEW.type IN ('receipt.share','receipt.share.revoke')) THEN RAISE EXCEPTION 'RECEIPT_SHARE_IMMUTABLE' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER receipt_share_history BEFORE UPDATE OR DELETE ON "Operation" FOR EACH ROW EXECUTE FUNCTION pos_receipt_share_history();
CREATE FUNCTION pos_receipt_share_proof() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sale "Sale"; proof TEXT; shared JSONB;
BEGIN
 IF NEW.type NOT IN ('receipt.share','receipt.share.revoke') THEN RETURN NULL;END IF;
 SELECT * INTO sale FROM "Sale" WHERE id=NEW.result->>'saleId' AND "organizationId"=NEW."organizationId";
 IF sale.id IS NULL OR sale."completedAt" IS NULL OR NEW.state<>'completed' OR NEW.key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'RECEIPT_SHARE_SOURCE_INVALID' USING ERRCODE='23514';END IF;
 IF NEW.type='receipt.share' THEN
  IF NEW.result->>'version' IS DISTINCT FROM '1' OR NEW.result->>'keyId' !~ '^[a-f0-9]{64}$' OR NEW.result->>'tokenHash' !~ '^[a-f0-9]{64}$'
    OR (NEW.result->>'expiresAt')::timestamptz<=clock_timestamp() OR (NEW.result->>'expiresAt')::timestamptz>clock_timestamp()+INTERVAL '1 day'
    OR NEW.result#>>'{snapshot,receiptNo}' IS DISTINCT FROM sale."receiptNo" OR (NEW.result#>>'{snapshot,totalAmount}')::numeric IS DISTINCT FROM sale."totalAmount"
    OR (NEW.result#>>'{snapshot,subtotal}')::numeric IS DISTINCT FROM sale.subtotal OR (NEW.result#>>'{snapshot,discountAmount}')::numeric IS DISTINCT FROM sale."discountAmount"
    OR jsonb_typeof(NEW.result->'snapshot') IS DISTINCT FROM 'object' OR octet_length(NEW.result::text)>262144 THEN RAISE EXCEPTION 'RECEIPT_SHARE_SNAPSHOT_INVALID' USING ERRCODE='23514';END IF;
 ELSE
  SELECT result INTO shared FROM "Operation" WHERE "organizationId"=NEW."organizationId" AND type='receipt.share' AND key=NEW.key;
  IF shared IS NULL OR shared->>'saleId' IS DISTINCT FROM sale.id OR NEW.result->>'revoked' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'RECEIPT_SHARE_SOURCE_INVALID' USING ERRCODE='23514';END IF;
 END IF;
 SELECT a.id INTO proof FROM "AuditLog" a JOIN "Session" s ON s.id=a."afterData"->>'sessionId' AND s."userId"=a."actorId" AND s."organizationId"=a."organizationId"
 JOIN "User" u ON u.id=s."userId" JOIN "OrganizationUser" m ON m."userId"=u.id AND m."organizationId"=s."organizationId"
 WHERE a."organizationId"=NEW."organizationId" AND a."actorId"=NEW."actorId" AND a."entityType"='Sale' AND a."entityId"=sale.id
 AND a.action=CASE WHEN NEW.type='receipt.share' THEN 'receipt_link_granted' ELSE 'receipt_link_revoked' END AND a."afterData"->>'operationId'=NEW.key
 AND a.xmin::text::bigint=txid_current()%4294967296 AND auth_restore_ready() AND s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp() AND s."idleExpiresAt">clock_timestamp() AND u."isActive" AND m."isActive"
 AND (m.role='owner' OR (m.role IN ('admin','cashier') AND EXISTS(SELECT 1 FROM "UserStore" us WHERE us."organizationUserId"=m.id AND us."storeId"=sale."storeId") AND (m.role<>'cashier' OR sale."cashierId"=u.id)))
 AND (NEW.type='receipt.share.revoke' OR (a."afterData"->>'consent'='true' AND a."afterData"->>'channel'='in_person' AND a."afterData"->>'source'='customer_request' AND a."afterData"->>'policyVersion'='direct-receipt-v1' AND a."afterData"->>'expiresAt'=NEW.result->>'expiresAt'))
 FOR SHARE OF s,u,m;
 IF proof IS NULL THEN RAISE EXCEPTION 'RECEIPT_SHARE_ACTOR_PROOF_REQUIRED' USING ERRCODE='23514';END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER receipt_share_proof AFTER INSERT ON "Operation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_receipt_share_proof();
COMMIT;
