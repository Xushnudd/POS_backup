ALTER TABLE "Product" ADD COLUMN mxik TEXT,ADD COLUMN "mxikSource" TEXT,ADD COLUMN "mxikRequired" BOOLEAN NOT NULL DEFAULT FALSE,ADD COLUMN "taxRequired" BOOLEAN NOT NULL DEFAULT FALSE,ADD COLUMN "markingRequired" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "Product" ADD CONSTRAINT product_classification_bounds CHECK((mxik IS NULL OR length(btrim(mxik)) BETWEEN 1 AND 100) AND ("mxikSource" IS NULL OR length(btrim("mxikSource")) BETWEEN 3 AND 2000));
ALTER TABLE "SaleItem" ADD COLUMN "complianceSnapshot" JSONB;
CREATE FUNCTION sale_classification_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.status='completed' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) AND EXISTS(
 SELECT 1 FROM "SaleItem" i JOIN "Product" p ON p.id=i."productId" WHERE i."saleId"=NEW.id AND (p."markingRequired" OR (p."taxRequired" AND (i."taxVersionId" IS NULL OR i."taxMode"='unconfigured')) OR (p."mxikRequired" AND (NULLIF(btrim(i."complianceSnapshot"->>'mxik'),'') IS NULL OR NULLIF(btrim(i."complianceSnapshot"->>'mxikSource'),'') IS NULL)))) THEN RAISE EXCEPTION 'Required product classification/integration unavailable';END IF;RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER sale_classification_guard AFTER INSERT OR UPDATE ON "Sale" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sale_classification_guard();
