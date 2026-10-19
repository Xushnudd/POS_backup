CREATE TABLE "FileAsset" (
 id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 "productId" TEXT NOT NULL REFERENCES "Product"(id) ON DELETE CASCADE,
 "createdBy" TEXT NOT NULL REFERENCES "User"(id) DEFERRABLE INITIALLY DEFERRED,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120), mime TEXT NOT NULL CHECK(mime='image/webp'),
 size INTEGER NOT NULL CHECK(size BETWEEN 1 AND 524288), sha256 TEXT NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
 width INTEGER NOT NULL CHECK(width BETWEEN 1 AND 2048), height INTEGER NOT NULL CHECK(height BETWEEN 1 AND 2048),
 data BYTEA, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3), "deletedAt" TIMESTAMP(3),
 CHECK(("deletedAt" IS NULL AND data IS NOT NULL AND octet_length(data)=size) OR ("deletedAt" IS NOT NULL AND data IS NULL)),
 FOREIGN KEY("organizationId","productId") REFERENCES "Product"("organizationId",id) ON DELETE CASCADE
);
CREATE INDEX "FileAsset_organizationId_productId_createdAt_idx" ON "FileAsset"("organizationId","productId","createdAt");
CREATE FUNCTION file_asset_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN IF EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RAISE EXCEPTION 'file metadata retained; use tombstone' USING ERRCODE='23514'; END IF; RETURN OLD; END IF;
 IF TG_OP='UPDATE' AND (OLD."deletedAt" IS NOT NULL OR NEW."deletedAt" IS NULL OR NEW.data IS NOT NULL OR (to_jsonb(NEW)-'data'-'deletedAt')<>(to_jsonb(OLD)-'data'-'deletedAt')) THEN RAISE EXCEPTION 'file content immutable' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' AND NOT EXISTS(SELECT 1 FROM "OrganizationUser" WHERE "organizationId"=NEW."organizationId" AND "userId"=NEW."createdBy" AND "isActive" AND role IN ('owner','admin')) THEN RAISE EXCEPTION 'file actor scope' USING ERRCODE='23514'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER file_asset_identity BEFORE INSERT OR UPDATE OR DELETE ON "FileAsset" FOR EACH ROW EXECUTE FUNCTION file_asset_guard();
