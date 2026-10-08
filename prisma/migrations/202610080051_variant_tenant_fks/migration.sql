ALTER TABLE "ProductVariant" ADD COLUMN "organizationId" TEXT;
UPDATE "ProductVariant" v SET "organizationId"=p."organizationId" FROM "Product" p WHERE p.id=v."productId";
ALTER TABLE "ProductVariant" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ProductVariant" ADD CONSTRAINT variant_product_tenant_fk FOREIGN KEY("organizationId","productId") REFERENCES "Product"("organizationId",id) ON DELETE CASCADE;
ALTER TABLE "ProductVariant" ADD CONSTRAINT variant_root_tenant_fk FOREIGN KEY("organizationId","rootProductId") REFERENCES "Product"("organizationId",id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
CREATE OR REPLACE FUNCTION variant_default() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 INSERT INTO "ProductVariant"("productId","rootProductId","organizationId",options) VALUES(NEW.id,NEW.id,NEW."organizationId",'{}'); RETURN NEW;
END $$;
