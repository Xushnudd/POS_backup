BEGIN;
-- Serialize child writes with checkout's parent lock. A concurrent draft edit
-- cannot slip through an unlocked status check as the receipt is posted.
CREATE OR REPLACE FUNCTION guard_posted_sale_item() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_parent TEXT; new_parent TEXT; parent RECORD;
BEGIN
 IF TG_OP <> 'INSERT' THEN old_parent=OLD."saleId"; END IF;
 IF TG_OP <> 'DELETE' THEN new_parent=NEW."saleId"; END IF;
 FOR parent IN
  SELECT s.status,s."organizationId" FROM "Sale" s
   WHERE s.id IN (old_parent,new_parent) ORDER BY s.id FOR UPDATE
 LOOP
  IF parent.status IN ('completed','partially_returned','returned')
     AND EXISTS(SELECT 1 FROM "Organization" WHERE id=parent."organizationId") THEN
   RAISE EXCEPTION 'Posted sale items are immutable' USING ERRCODE='23514';
  END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
COMMIT;
