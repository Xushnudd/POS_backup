BEGIN;
CREATE FUNCTION batch_business_write_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE org text;
BEGIN
 org:=COALESCE(NEW."organizationId",OLD."organizationId");
 IF EXISTS(SELECT 1 FROM "Organization" WHERE id=org) THEN PERFORM assert_business_writable(org);END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER batch_subscription_read_only BEFORE INSERT OR UPDATE OR DELETE ON "InventoryBatch" FOR EACH ROW EXECUTE FUNCTION batch_business_write_guard();
CREATE TRIGGER batch_subscription_read_only BEFORE INSERT OR UPDATE OR DELETE ON "InventoryBatchEntry" FOR EACH ROW EXECUTE FUNCTION batch_business_write_guard();
CREATE TRIGGER batch_subscription_read_only BEFORE INSERT OR UPDATE OR DELETE ON "InventoryBatchDisposition" FOR EACH ROW EXECUTE FUNCTION batch_business_write_guard();
COMMIT;
