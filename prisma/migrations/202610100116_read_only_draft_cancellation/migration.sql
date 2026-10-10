BEGIN;
CREATE OR REPLACE FUNCTION subscription_operation_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 -- A cancelled unposted draft reserves only actor/hash identity, never economics.
 IF NEW.type='sale.create' AND NEW.state='cancelled' AND NEW."actorId" IS NOT NULL AND NEW.result='{"cancelled":true}'::jsonb THEN RETURN NEW;END IF;
 IF NEW.type NOT IN ('billing.plan.publish','billing.plan.assign','billing.invoice.create','billing.invoice.cancel','billing.payment.confirm','billing.subscription.cancel','billing.cost.record','billing.cost.cancel','retention.policy.publish','job.enqueue','job.retry','support.grant','support.revoke','support.ticket.create','support.ticket.command','support.policy.publish','security_notice_read','security_notice_retry') THEN PERFORM assert_business_writable(NEW."organizationId");END IF; RETURN NEW;END $$;
COMMIT;
