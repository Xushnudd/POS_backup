CREATE TABLE "DamageLocation" (
 id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 "storeId" TEXT NOT NULL UNIQUE REFERENCES "Store"(id) ON DELETE CASCADE,name TEXT NOT NULL DEFAULT 'Brak qaytarmalari',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "ReturnDispositionEntry" (
 id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 "storeId" TEXT NOT NULL REFERENCES "Store"(id),"productId" TEXT NOT NULL REFERENCES "Product"(id),
 "returnItemId" TEXT NOT NULL UNIQUE REFERENCES "SaleReturnItem"(id),"locationId" TEXT REFERENCES "DamageLocation"(id),
 disposition TEXT NOT NULL CHECK(disposition IN ('damaged','write_off')),
 quantity NUMERIC(20,6) NOT NULL CHECK(quantity>0),"unitCost" NUMERIC(20,6) NOT NULL CHECK("unitCost">=0),
 "productName" TEXT NOT NULL,sku TEXT NOT NULL,unit TEXT,"actorId" TEXT NOT NULL REFERENCES "User"(id),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK((disposition='damaged')=("locationId" IS NOT NULL))
);
CREATE INDEX "ReturnDispositionEntry_organizationId_storeId_disposition_createdAt_id_idx" ON "ReturnDispositionEntry"("organizationId","storeId",disposition,"createdAt",id);
CREATE FUNCTION disposition_scope() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_TABLE_NAME='DamageLocation' THEN
 IF NOT EXISTS(SELECT 1 FROM "Store" WHERE id=NEW."storeId" AND "organizationId"=NEW."organizationId") THEN RAISE EXCEPTION 'Location tenant mismatch'; END IF;
 ELSE
 IF NOT EXISTS(SELECT 1 FROM "SaleReturnItem" ri JOIN "SaleReturn" r ON r.id=ri."saleReturnId" JOIN "Sale" s ON s.id=r."saleId" JOIN "SaleItem" i ON i.id=ri."saleItemId"
 WHERE ri.id=NEW."returnItemId" AND s."organizationId"=NEW."organizationId" AND s."storeId"=NEW."storeId" AND ri."productId"=NEW."productId" AND ri.disposition=NEW.disposition AND ri.quantity=NEW.quantity AND i."unitCost"=NEW."unitCost" AND r."processedBy"=NEW."actorId") THEN RAISE EXCEPTION 'Disposition original return mismatch'; END IF;
 IF NEW."locationId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "DamageLocation" WHERE id=NEW."locationId" AND "organizationId"=NEW."organizationId" AND "storeId"=NEW."storeId") THEN RAISE EXCEPTION 'Damage location mismatch'; END IF;
 END IF;
 RETURN NEW; END $$;
CREATE TRIGGER damage_location_scope BEFORE INSERT OR UPDATE ON "DamageLocation" FOR EACH ROW EXECUTE FUNCTION disposition_scope();
CREATE TRIGGER return_disposition_scope BEFORE INSERT ON "ReturnDispositionEntry" FOR EACH ROW EXECUTE FUNCTION disposition_scope();
CREATE TRIGGER return_disposition_immutable BEFORE UPDATE OR DELETE ON "ReturnDispositionEntry" FOR EACH ROW EXECUTE FUNCTION stock_journal_immutable();
-- Existing disposition choices are preserved with original refund date and cost.
INSERT INTO "DamageLocation"(id,"organizationId","storeId") SELECT gen_random_uuid()::text,s."organizationId",s."storeId" FROM "SaleReturnItem" ri JOIN "SaleReturn" r ON r.id=ri."saleReturnId" JOIN "Sale" s ON s.id=r."saleId" WHERE ri.disposition='damaged' GROUP BY s."organizationId",s."storeId";
INSERT INTO "ReturnDispositionEntry" SELECT gen_random_uuid()::text,s."organizationId",s."storeId",ri."productId",ri.id,CASE WHEN ri.disposition='damaged' THEN l.id ELSE NULL END,ri.disposition,ri.quantity,i."unitCost",i."productName",i.sku,i.unit,r."processedBy",r."returnedAt" FROM "SaleReturnItem" ri JOIN "SaleReturn" r ON r.id=ri."saleReturnId" JOIN "Sale" s ON s.id=r."saleId" JOIN "SaleItem" i ON i.id=ri."saleItemId" LEFT JOIN "DamageLocation" l ON l."storeId"=s."storeId" WHERE ri.disposition IN ('damaged','write_off');
