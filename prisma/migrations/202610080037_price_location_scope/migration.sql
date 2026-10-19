CREATE FUNCTION price_history_scope() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM "Product" WHERE id=NEW."productId" AND "organizationId"=NEW."organizationId") THEN RAISE EXCEPTION 'Price history tenant mismatch'; END IF;
 IF NEW."actorId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "OrganizationUser" WHERE "organizationId"=NEW."organizationId" AND "userId"=NEW."actorId") THEN RAISE EXCEPTION 'Price history actor mismatch'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER price_history_scope BEFORE INSERT ON "ProductPriceHistory" FOR EACH ROW EXECUTE FUNCTION price_history_scope();
CREATE FUNCTION damage_location_identity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW."organizationId" IS DISTINCT FROM OLD."organizationId" OR NEW."storeId" IS DISTINCT FROM OLD."storeId" THEN RAISE EXCEPTION 'Damage location identity is immutable'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER damage_location_identity BEFORE UPDATE ON "DamageLocation" FOR EACH ROW EXECUTE FUNCTION damage_location_identity();
