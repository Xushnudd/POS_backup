CREATE FUNCTION transfer_snapshot_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE state TEXT; BEGIN
 IF TG_TABLE_NAME='StockTransfer' THEN
  IF TG_OP='DELETE' THEN IF OLD.status<>'draft' AND EXISTS(SELECT 1 FROM "Organization" WHERE id=OLD."organizationId") THEN RAISE EXCEPTION 'Posted transfer cannot be deleted';END IF;RETURN OLD;END IF;
  IF OLD.status<>'draft' AND (NEW."organizationId",NEW."fromStoreId",NEW."toStoreId",NEW."createdBy",NEW."sentAt",NEW.note) IS DISTINCT FROM (OLD."organizationId",OLD."fromStoreId",OLD."toStoreId",OLD."createdBy",OLD."sentAt",OLD.note) THEN RAISE EXCEPTION 'Posted transfer snapshot immutable';END IF;
  IF OLD.status<>NEW.status AND NOT ((OLD.status='draft' AND NEW.status IN ('sent','cancelled')) OR (OLD.status='sent' AND NEW.status IN ('received','closed'))) THEN RAISE EXCEPTION 'Invalid transfer transition';END IF;
 ELSE
  SELECT status INTO state FROM "StockTransfer" WHERE id=COALESCE(NEW."stockTransferId",OLD."stockTransferId");
  IF TG_OP='DELETE' THEN IF state IS NOT NULL AND state<>'draft' THEN RAISE EXCEPTION 'Posted transfer item cannot be deleted';END IF;RETURN OLD;END IF;
  IF state IS NOT NULL AND state<>'draft' AND (NEW."stockTransferId",NEW."productId",NEW.quantity,NEW."unitCost") IS DISTINCT FROM (OLD."stockTransferId",OLD."productId",OLD.quantity,OLD."unitCost") THEN RAISE EXCEPTION 'Posted transfer item snapshot immutable';END IF;
  IF (NEW."receivedQuantity",NEW."returnedQuantity",NEW."damagedQuantity",NEW."shortageQuantity") IS DISTINCT FROM (OLD."receivedQuantity",OLD."returnedQuantity",OLD."damagedQuantity",OLD."shortageQuantity") AND state<>'sent' THEN RAISE EXCEPTION 'Transfer outcome requires sent transfer';END IF;
  IF NEW."receivedQuantity"<OLD."receivedQuantity" OR NEW."returnedQuantity"<OLD."returnedQuantity" OR NEW."damagedQuantity"<OLD."damagedQuantity" OR NEW."shortageQuantity"<OLD."shortageQuantity" THEN RAISE EXCEPTION 'Transfer outcomes cannot decrease';END IF;
 END IF;RETURN NEW;END $$;
CREATE TRIGGER transfer_snapshot_guard BEFORE UPDATE OR DELETE ON "StockTransfer" FOR EACH ROW EXECUTE FUNCTION transfer_snapshot_guard();
CREATE TRIGGER transfer_item_snapshot_guard BEFORE UPDATE OR DELETE ON "StockTransferItem" FOR EACH ROW EXECUTE FUNCTION transfer_snapshot_guard();
