CREATE FUNCTION product_asset_link() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW."imageUrl" LIKE '/api/files/%' AND NOT EXISTS(SELECT 1 FROM "FileAsset" WHERE id=substring(NEW."imageUrl" FROM 12) AND "organizationId"=NEW."organizationId" AND "deletedAt" IS NULL AND ("expiresAt" IS NULL OR "expiresAt">CURRENT_TIMESTAMP)) THEN RAISE EXCEPTION 'image asset unavailable or tenant mismatch' USING ERRCODE='23514'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER product_asset_scope BEFORE INSERT OR UPDATE OF "imageUrl" ON "Product" FOR EACH ROW EXECUTE FUNCTION product_asset_link();
CREATE FUNCTION file_image_unlink() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW."deletedAt" IS NOT NULL THEN UPDATE "Product" SET "imageUrl"=NULL WHERE "organizationId"=NEW."organizationId" AND "imageUrl"='/api/files/'||NEW.id; END IF; RETURN NEW;
END $$;
CREATE TRIGGER file_asset_unlink AFTER UPDATE OF "deletedAt" ON "FileAsset" FOR EACH ROW EXECUTE FUNCTION file_image_unlink();
