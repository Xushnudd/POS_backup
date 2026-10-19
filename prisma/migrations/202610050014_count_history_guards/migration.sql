BEGIN;
CREATE FUNCTION guard_count_reading_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM "StockCountLine" l JOIN "StockCount" c ON c.id=l."countId" JOIN "OrganizationUser" m ON m."organizationId"=c."organizationId" JOIN "User" u ON u.id=m."userId" WHERE l.id=NEW."lineId" AND c.status IN ('counting','review') AND m."userId"=NEW."countedBy" AND m."isActive" AND u."isActive" AND m.role IN ('owner','admin')) THEN
  RAISE EXCEPTION 'Count reading requires active count and authorized tenant actor' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "StockCountReading_insert_scope" BEFORE INSERT ON "StockCountReading" FOR EACH ROW EXECUTE FUNCTION guard_count_reading_insert();
CREATE FUNCTION guard_count_adjustment_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."adjustmentId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "StockDocument" d WHERE d.id=NEW."adjustmentId" AND d."organizationId"=NEW."organizationId" AND d."storeId"=NEW."storeId" AND d.status='confirmed' AND d."documentType"='adjustment') THEN
  RAISE EXCEPTION 'Invalid count adjustment scope' USING ERRCODE='23514';
 END IF;
 IF NEW.status IN ('approved','cancelled') AND (NEW."approvedBy" IS NULL OR NEW."approvedAt" IS NULL OR NEW.reason IS NULL OR LENGTH(TRIM(NEW.reason))<3) THEN
  RAISE EXCEPTION 'Count decision requires actor, timestamp and reason' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "StockCount_adjustment_scope" BEFORE INSERT OR UPDATE ON "StockCount" FOR EACH ROW EXECUTE FUNCTION guard_count_adjustment_scope();
COMMIT;
