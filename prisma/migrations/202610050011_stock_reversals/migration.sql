BEGIN;
ALTER TABLE "StockDocument" ADD COLUMN "reversalOfId" TEXT;
CREATE UNIQUE INDEX "StockDocument_reversalOfId_key" ON "StockDocument"("reversalOfId");
ALTER TABLE "StockDocument" ADD CONSTRAINT "StockDocument_reversalOfId_fkey" FOREIGN KEY("reversalOfId") REFERENCES "StockDocument"(id) ON DELETE NO ACTION ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
CREATE FUNCTION guard_stock_document() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'INSERT' AND OLD.status='confirmed' AND EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN
  RAISE EXCEPTION 'Confirmed stock document is immutable' USING ERRCODE='23514';
 END IF;
 IF TG_OP <> 'DELETE' AND NEW."reversalOfId" IS NOT NULL THEN
  IF NEW."documentType" <> 'reversal' OR NOT EXISTS(SELECT 1 FROM "StockDocument" d WHERE d.id=NEW."reversalOfId" AND d.status='confirmed' AND d."reversalOfId" IS NULL AND d."organizationId"=NEW."organizationId" AND d."storeId"=NEW."storeId") THEN
   RAISE EXCEPTION 'Invalid stock reversal scope' USING ERRCODE='23514';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "StockDocument_immutable" BEFORE INSERT OR UPDATE OR DELETE ON "StockDocument" FOR EACH ROW EXECUTE FUNCTION guard_stock_document();
CREATE FUNCTION guard_stock_document_item() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_id TEXT;
BEGIN
 IF TG_OP <> 'INSERT' THEN
  parent_id=OLD."stockDocumentId";
  IF EXISTS(SELECT 1 FROM "StockDocument" d JOIN "Organization" o ON o.id=d."organizationId" WHERE d.id=parent_id AND d.status='confirmed') THEN
   RAISE EXCEPTION 'Confirmed stock items are immutable' USING ERRCODE='23514';
  END IF;
 END IF;
 IF TG_OP <> 'DELETE' AND EXISTS(SELECT 1 FROM "StockDocument" d JOIN "Organization" o ON o.id=d."organizationId" WHERE d.id=NEW."stockDocumentId" AND d.status='confirmed') THEN
  RAISE EXCEPTION 'Confirmed stock items are immutable' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "StockDocumentItem_immutable" BEFORE INSERT OR UPDATE OR DELETE ON "StockDocumentItem" FOR EACH ROW EXECUTE FUNCTION guard_stock_document_item();
COMMIT;
