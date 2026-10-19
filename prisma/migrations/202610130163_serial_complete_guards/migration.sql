BEGIN;
ALTER TABLE "SerialEvent" ADD CONSTRAINT serial_event_actor FOREIGN KEY("actorId") REFERENCES "User"(id);
ALTER TABLE "WarrantyService" ADD CONSTRAINT warranty_service_actor FOREIGN KEY("actorId") REFERENCES "User"(id);
ALTER TABLE "Product" ADD CONSTRAINT serial_no_batch CHECK(NOT "serialTracking" OR NOT "batchTracking");
CREATE FUNCTION pos_serial_policy_source() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW."serialTracking" AND (TG_OP='INSERT' OR NEW."serialTracking" IS DISTINCT FROM OLD."serialTracking" OR NEW."warrantyDays" IS DISTINCT FROM OLD."warrantyDays" OR NEW."warrantyTerms" IS DISTINCT FROM OLD."warrantyTerms") AND NOT EXISTS(SELECT 1 FROM "AuditLog" a JOIN "OrganizationUser" ou ON ou."userId"=a."actorId" AND ou."organizationId"=a."organizationId" JOIN "User" u ON u.id=ou."userId" WHERE a."organizationId"=NEW."organizationId" AND a."entityId"=NEW.id AND a."entityType"='Product' AND a.action='serial_policy' AND ou.role='owner' AND ou."isActive" AND u."isActive" AND a.xmin::text::bigint=txid_current()%4294967296 AND a."afterData"->>'warrantyDays'=NEW."warrantyDays"::text AND a."afterData"->>'warrantyTerms'=NEW."warrantyTerms") THEN RAISE EXCEPTION 'SERIAL_POLICY_OWNER_PROOF_REQUIRED'; END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER serial_policy_source AFTER INSERT OR UPDATE ON "Product" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_serial_policy_source();
CREATE FUNCTION pos_serial_sale_warranty() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.kind='sale' AND (SELECT count(*) FROM "Warranty" WHERE "saleEventId"=NEW.id)<>1 THEN RAISE EXCEPTION 'SERIAL_WARRANTY_REQUIRED'; END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER serial_warranty_required AFTER INSERT ON "SerialEvent" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_serial_sale_warranty();
CREATE FUNCTION pos_serial_unit_precision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.precision<>0 AND EXISTS(SELECT 1 FROM "Product" WHERE "organizationId"=NEW."organizationId" AND unit=NEW.code AND "serialTracking") THEN RAISE EXCEPTION 'SERIAL_INTEGER_UNIT_REQUIRED'; END IF;RETURN NEW;
END $$;
CREATE TRIGGER serial_unit_precision BEFORE UPDATE ON "Unit" FOR EACH ROW EXECUTE FUNCTION pos_serial_unit_precision();
CREATE FUNCTION pos_serial_warranty_source() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE w "Warranty";u "SerialNumber";BEGIN
 IF TG_TABLE_NAME='Warranty' THEN
  IF (SELECT xmin::text::bigint FROM "SerialEvent" WHERE id=NEW."saleEventId")<>txid_current()%4294967296 THEN RAISE EXCEPTION 'WARRANTY_CURRENT_SOURCE_REQUIRED'; END IF;
 ELSE
  SELECT * INTO w FROM "Warranty" WHERE id=NEW."warrantyId";
  SELECT * INTO u FROM "SerialNumber" WHERE id=w."serialId" FOR UPDATE;
  IF u.state<>'sold' OR u."lastSaleItemId" IS DISTINCT FROM w."saleItemId" OR NEW."createdAt"<>CURRENT_TIMESTAMP::timestamp(3) THEN RAISE EXCEPTION 'WARRANTY_CURRENT_SOURCE_REQUIRED'; END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER warranty_current_source BEFORE INSERT ON "Warranty" FOR EACH ROW EXECUTE FUNCTION pos_serial_warranty_source();
CREATE TRIGGER warranty_current_source BEFORE INSERT ON "WarrantyService" FOR EACH ROW EXECUTE FUNCTION pos_serial_warranty_source();
COMMIT;
