ALTER TABLE "StockTransferItem" ADD COLUMN "damagedQuantity" NUMERIC(20,6) NOT NULL DEFAULT 0, ADD COLUMN "shortageQuantity" NUMERIC(20,6) NOT NULL DEFAULT 0;
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_outcome_conservation" CHECK ("damagedQuantity">=0 AND "shortageQuantity">=0 AND "receivedQuantity"+"returnedQuantity"+"damagedQuantity"+"shortageQuantity"<=quantity);
CREATE TABLE "TransferDispositionEntry" (
 id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 "storeId" TEXT NOT NULL REFERENCES "Store"(id),"productId" TEXT NOT NULL REFERENCES "Product"(id),
 "itemId" TEXT NOT NULL REFERENCES "StockTransferItem"(id) ON DELETE CASCADE,"operationId" TEXT NOT NULL,
 disposition TEXT NOT NULL CHECK(disposition IN ('damaged','shortage')),
 quantity NUMERIC(20,6) NOT NULL CHECK(quantity>0),"unitCost" NUMERIC(20,6) NOT NULL CHECK("unitCost">=0),
 "productName" TEXT NOT NULL,sku TEXT NOT NULL,unit TEXT NOT NULL,reason TEXT NOT NULL CHECK(length(btrim(reason)) BETWEEN 3 AND 2000),
 "actorId" TEXT NOT NULL REFERENCES "User"(id),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE("itemId","operationId",disposition)
);
CREATE INDEX "TransferDispositionEntry_organizationId_storeId_createdAt_id_idx" ON "TransferDispositionEntry"("organizationId","storeId","createdAt",id);
CREATE FUNCTION transfer_disposition_scope() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM "StockTransferItem" i JOIN "StockTransfer" t ON t.id=i."stockTransferId" JOIN "Product" p ON p.id=i."productId"
 WHERE i.id=NEW."itemId" AND t."organizationId"=NEW."organizationId" AND t."toStoreId"=NEW."storeId" AND i."productId"=NEW."productId" AND p."organizationId"=NEW."organizationId" AND i."unitCost"=NEW."unitCost" AND p.unit=NEW.unit AND t.status='sent') THEN RAISE EXCEPTION 'Transfer disposition original/scope mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "OrganizationUser" m JOIN "User" u ON u.id=m."userId" WHERE m."organizationId"=NEW."organizationId" AND m."userId"=NEW."actorId" AND m."isActive" AND u."isActive" AND m.role IN ('owner','admin')) THEN RAISE EXCEPTION 'Transfer disposition manager required'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER transfer_disposition_scope BEFORE INSERT ON "TransferDispositionEntry" FOR EACH ROW EXECUTE FUNCTION transfer_disposition_scope();
CREATE TRIGGER transfer_disposition_immutable BEFORE UPDATE OR DELETE ON "TransferDispositionEntry" FOR EACH ROW EXECUTE FUNCTION stock_journal_immutable();
CREATE FUNCTION transfer_disposition_conservation() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE item_id TEXT; row_item RECORD; damaged NUMERIC; shortage NUMERIC; BEGIN
 IF TG_TABLE_NAME='StockTransferItem' THEN item_id:=COALESCE(NEW.id,OLD.id);ELSE item_id:=COALESCE(NEW."itemId",OLD."itemId");END IF;
 SELECT * INTO row_item FROM "StockTransferItem" WHERE id=item_id;IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT COALESCE(sum(quantity) FILTER(WHERE disposition='damaged'),0),COALESCE(sum(quantity) FILTER(WHERE disposition='shortage'),0) INTO damaged,shortage FROM "TransferDispositionEntry" WHERE "itemId"=item_id;
 IF row_item."damagedQuantity"<>damaged OR row_item."shortageQuantity"<>shortage THEN RAISE EXCEPTION 'Transfer outcome journal/counter mismatch'; END IF;
 RETURN NULL;END $$;
CREATE CONSTRAINT TRIGGER transfer_item_outcomes AFTER INSERT OR UPDATE ON "StockTransferItem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION transfer_disposition_conservation();
CREATE CONSTRAINT TRIGGER transfer_entry_outcomes AFTER INSERT OR DELETE ON "TransferDispositionEntry" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION transfer_disposition_conservation();
