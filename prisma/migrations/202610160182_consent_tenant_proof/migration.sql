BEGIN;
DO $$ DECLARE definition TEXT; needle TEXT:='IF model_name=''Organization'' THEN'; BEGIN
 definition:=pg_get_functiondef('pos_tenant_root(text,jsonb)'::regprocedure);
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'UNKNOWN_TENANT_ROOT';END IF;
 definition:=replace(definition,needle,'IF model_name=''ConsentEvent'' THEN RETURN row_data->>''organizationId'';END IF; '||needle);
 EXECUTE definition;
 definition:=pg_get_functiondef('pos_tenant_expression(text,text)'::regprocedure);
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'UNKNOWN_TENANT_EXPRESSION';END IF;
 definition:=replace(definition,needle,'IF model_name=''ConsentEvent'' THEN RETURN format(''%I."organizationId"'',row_alias);END IF; '||needle);
 EXECUTE definition;
END $$;
CREATE TRIGGER tenant_owner BEFORE UPDATE ON "ConsentEvent" FOR EACH ROW EXECUTE FUNCTION pos_tenant_owner_immutable();
CREATE CONSTRAINT TRIGGER tenant_edges AFTER INSERT OR UPDATE ON "ConsentEvent" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_tenant_edge_trigger();
CREATE FUNCTION pos_customer_consent_proof() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE proof RECORD;
BEGIN
 SELECT a.id INTO proof FROM "AuditLog" a
 JOIN "Session" s ON s.id=a."afterData"->>'sessionId' AND s."userId"=a."actorId" AND s."organizationId"=a."organizationId"
 JOIN "User" u ON u.id=s."userId"
 JOIN "OrganizationUser" m ON m."organizationId"=s."organizationId" AND m."userId"=u.id
 WHERE a."organizationId"=NEW."organizationId" AND a."actorId"=NEW."createdBy" AND a."entityType"='ConsentEvent' AND a."entityId"=NEW.id
 AND a.action=CASE WHEN NEW.granted THEN 'consent_granted' ELSE 'consent_withdrawn' END
 AND a.xmin::text::bigint=txid_current()%4294967296
 AND a."afterData"->>'customerId'=NEW."customerId" AND a."afterData"->>'purpose'=NEW.purpose
 AND a."afterData"->>'channel'=NEW.channel AND a."afterData"->>'revision'=NEW.revision::text
 AND a."afterData"->>'granted'=NEW.granted::text AND a."afterData"->>'source'=NEW.source
 AND a."afterData"->>'evidenceRef'=NEW."evidenceRef" AND a."afterData"->>'policyVersion'=NEW."policyVersion"
 AND auth_restore_ready() AND s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp() AND s."idleExpiresAt">clock_timestamp()
 AND u."isActive" AND m."isActive" AND m.role='owner' AND m."customRoleId" IS NULL
 FOR SHARE OF s,u,m;
 IF proof.id IS NULL THEN RAISE EXCEPTION 'CONSENT_ACTOR_PROOF_REQUIRED' USING ERRCODE='23514';END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER consent_actor_proof AFTER INSERT ON "ConsentEvent" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_customer_consent_proof();
COMMIT;
