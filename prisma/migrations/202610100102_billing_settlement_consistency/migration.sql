CREATE FUNCTION billing_payment_settlement_check() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM "BillingPayment" WHERE id=NEW.id) AND NOT EXISTS(
 SELECT 1 FROM "BillingInvoice" i JOIN "OrganizationSubscription" s ON s."organizationId"=i."organizationId"
 WHERE i.id=NEW."invoiceId" AND i.state='paid' AND s."paidThrough">=i."periodEnd") THEN
 RAISE EXCEPTION 'Billing payment must settle invoice and paid period atomically';END IF;RETURN NEW;END $$;
CREATE CONSTRAINT TRIGGER billing_payment_settlement_check AFTER INSERT ON "BillingPayment" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION billing_payment_settlement_check();
