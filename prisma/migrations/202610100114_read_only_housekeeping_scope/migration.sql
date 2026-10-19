BEGIN;
CREATE OR REPLACE FUNCTION subscription_business_write_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE old_org TEXT;new_org TEXT; BEGIN
 -- Only expiry of already elapsed manual reservations is housekeeping, never cash-ticket reconciliation.
 IF TG_TABLE_NAME='StockReservation' THEN
 IF TG_OP='UPDATE' AND OLD.kind='manual' AND OLD.status='active' AND NEW.status='expired' AND OLD."expiresAt"<=(clock_timestamp() AT TIME ZONE 'UTC') AND (to_jsonb(OLD)-'status')=(to_jsonb(NEW)-'status') THEN RETURN NEW;END IF;
 END IF;
 IF TG_TABLE_NAME='ReservationItem' THEN
 IF TG_OP='UPDATE' AND NEW."remainingQuantity"=0 AND (to_jsonb(OLD)-'remainingQuantity')=(to_jsonb(NEW)-'remainingQuantity') AND EXISTS(SELECT 1 FROM "StockReservation" r WHERE r.id=OLD."reservationId" AND r.kind='manual' AND r.status='active' AND r."expiresAt"<=(clock_timestamp() AT TIME ZONE 'UTC')) THEN RETURN NEW;END IF;
 END IF;
 IF TG_TABLE_NAME='ReservationEntry' THEN
 IF TG_OP='INSERT' AND NEW.kind='expire' AND NEW."actorId" IS NULL AND EXISTS(SELECT 1 FROM "ReservationItem" i JOIN "StockReservation" r ON r.id=i."reservationId" WHERE i.id=NEW."itemId" AND i."organizationId"=NEW."organizationId" AND i."storeId"=NEW."storeId" AND i."remainingQuantity"=NEW.quantity AND r.kind='manual' AND r.status='active' AND r."expiresAt"<=(clock_timestamp() AT TIME ZONE 'UTC') AND NEW."operationKey"=r.id||':expired') THEN RETURN NEW;END IF;
 END IF;
 IF TG_OP<>'INSERT' THEN old_org=business_row_organization(TG_TABLE_NAME,to_jsonb(OLD));END IF;
 IF TG_OP<>'DELETE' THEN new_org=business_row_organization(TG_TABLE_NAME,to_jsonb(NEW));END IF;
 -- Parent organization deletion is not implemented by the app; cascade cleanup has no live tenant.
 IF old_org IS NOT NULL AND EXISTS(SELECT 1 FROM "Organization" WHERE id=old_org) THEN PERFORM assert_business_writable(old_org);END IF;
 IF new_org IS NOT NULL AND new_org IS DISTINCT FROM old_org AND EXISTS(SELECT 1 FROM "Organization" WHERE id=new_org) THEN PERFORM assert_business_writable(new_org);END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;END $$;
COMMIT;
