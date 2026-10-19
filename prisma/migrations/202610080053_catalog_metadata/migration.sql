CREATE TABLE "Brand"(id TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 200),"isActive" BOOLEAN NOT NULL DEFAULT TRUE,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,UNIQUE("organizationId",name),UNIQUE("organizationId",id));
ALTER TABLE "Category" ADD COLUMN "parentId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Category_tenant_id_key" ON "Category"("organizationId",id);
ALTER TABLE "Category" ADD CONSTRAINT category_parent_fk FOREIGN KEY("organizationId","parentId") REFERENCES "Category"("organizationId",id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX category_parent_idx ON "Category"("organizationId","parentId");
ALTER TABLE "Product" ADD COLUMN "brandId" TEXT, ADD COLUMN description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=4000);
ALTER TABLE "Product" ADD CONSTRAINT product_brand_fk FOREIGN KEY("organizationId","brandId") REFERENCES "Brand"("organizationId",id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
CREATE FUNCTION category_tree_lock() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 UPDATE "Organization" SET "updatedAt"="updatedAt" WHERE id=NEW."organizationId"; RETURN NEW;
END $$;
CREATE TRIGGER category_graph_lock BEFORE INSERT OR UPDATE OF "parentId" ON "Category" FOR EACH ROW EXECUTE FUNCTION category_tree_lock();
CREATE FUNCTION category_tree_check() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE bad BOOLEAN; BEGIN
 IF EXISTS(SELECT 1 FROM "Organization" WHERE id=NEW."organizationId") THEN
 WITH RECURSIVE ancestors AS (SELECT id,"parentId",ARRAY[id] path,FALSE cycle FROM "Category" WHERE id=NEW.id UNION ALL SELECT p.id,p."parentId",a.path||p.id,p.id=ANY(a.path) FROM ancestors a JOIN "Category" p ON p.id=a."parentId" WHERE NOT a.cycle AND cardinality(a.path)<=100)
 SELECT EXISTS(SELECT 1 FROM ancestors WHERE cycle OR cardinality(path)>100) INTO bad;
 IF bad THEN RAISE EXCEPTION 'category cycle or depth limit' USING ERRCODE='23514'; END IF;
 END IF; RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER category_tree_valid AFTER INSERT OR UPDATE ON "Category" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION category_tree_check();
