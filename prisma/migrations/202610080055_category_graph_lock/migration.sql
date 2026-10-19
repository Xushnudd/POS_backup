CREATE OR REPLACE FUNCTION category_tree_lock() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 UPDATE "Organization" SET name=name WHERE id=NEW."organizationId"; RETURN NEW;
END $$;
