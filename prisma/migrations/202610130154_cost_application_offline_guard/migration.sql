BEGIN;
CREATE FUNCTION receipt_cost_offline_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM "ReceiptCostPlan" p JOIN "StockDocumentItem" item ON item."stockDocumentId"=p."stockDocumentId" JOIN "ReservationItem" i ON i."productId"=item."productId" AND i."organizationId"=NEW."organizationId" JOIN "StockReservation" r ON r.id=i."reservationId" WHERE p.id=NEW."planId" AND r.kind='cash_ticket' AND r.status='active' AND i."remainingQuantity">0) THEN RAISE EXCEPTION 'Resolve offline cash stock before cost application' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER receipt_cost_offline_guard BEFORE INSERT ON "ReceiptCostApplication" FOR EACH ROW EXECUTE FUNCTION receipt_cost_offline_guard();
COMMIT;
