BEGIN;
CREATE FUNCTION pos_serial_initial_state() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.state<>'available' OR NEW.version<>0 OR NEW."lastSaleItemId" IS NOT NULL OR NEW."lastTransferId" IS NOT NULL THEN RAISE EXCEPTION 'SERIAL_INITIAL_STATE_INVALID'; END IF;
 NEW."createdAt":=CURRENT_TIMESTAMP::timestamp(3);RETURN NEW;
END $$;
CREATE TRIGGER serial_initial_state BEFORE INSERT ON "SerialNumber" FOR EACH ROW EXECUTE FUNCTION pos_serial_initial_state();
CREATE FUNCTION pos_serial_balance_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM "Product" p JOIN "Organization" o ON o.id=p."organizationId" WHERE p.id=OLD."productId" AND p."serialTracking") AND EXISTS(SELECT 1 FROM "SerialNumber" WHERE "productId"=OLD."productId" AND "storeId"=OLD."storeId" AND state='available') THEN RAISE EXCEPTION 'SERIAL_STOCK_CONSERVATION'; END IF;RETURN OLD;
END $$;
CREATE TRIGGER serial_balance_delete BEFORE DELETE ON "InventoryBalance" FOR EACH ROW EXECUTE FUNCTION pos_serial_balance_delete();
CREATE FUNCTION pos_serial_transfer_input() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW."serialInput" IS DISTINCT FROM OLD."serialInput" AND EXISTS(SELECT 1 FROM "StockTransfer" WHERE id=OLD."stockTransferId" AND status<>'draft') THEN RAISE EXCEPTION 'SERIAL_TRANSFER_INPUT_IMMUTABLE'; END IF;RETURN NEW;
END $$;
CREATE TRIGGER serial_transfer_input BEFORE UPDATE ON "StockTransferItem" FOR EACH ROW EXECUTE FUNCTION pos_serial_transfer_input();
COMMIT;
