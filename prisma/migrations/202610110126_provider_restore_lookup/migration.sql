-- Restored queued intents may have executed outside the recovered database.
-- Never resubmit them; retain identity and perform lookup or manual review.
CREATE OR REPLACE FUNCTION provider_outbox_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN IF EXISTS(SELECT 1 FROM "ProviderIntent" p JOIN "Organization" o ON o.id=p."organizationId" WHERE p.id=OLD."intentId") THEN RAISE EXCEPTION 'Provider outbox history immutable' USING ERRCODE='23514';END IF;RETURN OLD;END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.state='running' AND NOT auth_restore_ready() THEN RAISE EXCEPTION 'Provider restore review required' USING ERRCODE='23514'; END IF;
  IF OLD.state='queued' AND NEW.state='running' AND EXISTS(
    SELECT 1 FROM "ProviderIntent" p JOIN "AuthRestoreCheckpoint" c ON p."createdAt"<=c."createdAt" WHERE p.id=OLD."intentId"
  ) AND (NEW.mode<>'lookup' OR NEW."submitAttempts"<>OLD."submitAttempts" OR NEW."lookupAttempts"<>OLD."lookupAttempts"+1) THEN
    RAISE EXCEPTION 'Restored provider intent requires original identity lookup' USING ERRCODE='23514';
  END IF;
  IF NEW."intentId"<>OLD."intentId" OR NEW.generation<OLD.generation OR NEW."submitAttempts"<OLD."submitAttempts" OR NEW."lookupAttempts"<OLD."lookupAttempts" OR (OLD.mode='lookup' AND NEW.mode<>'lookup') OR
   (OLD.state IN ('confirmed','failed') AND NEW IS DISTINCT FROM OLD) OR
   (OLD.state='review' AND NEW IS DISTINCT FROM OLD AND NOT(NEW.state='unknown' AND NEW.mode='lookup' AND NEW.generation=OLD.generation+1 AND NEW."submitAttempts"=OLD."submitAttempts" AND NEW."lookupAttempts"=OLD."lookupAttempts")) OR
   (OLD."externalId" IS NOT NULL AND NEW."externalId" IS DISTINCT FROM OLD."externalId") THEN RAISE EXCEPTION 'Provider outbox identity/terminal immutable' USING ERRCODE='23514';END IF;
  IF NEW.state<>OLD.state AND NOT((OLD.state='queued' AND NEW.state='running' AND NEW.mode='submit' AND NEW."submitAttempts"=1) OR
    (OLD.state='queued' AND NEW.state='running' AND NEW.mode='lookup' AND NEW."submitAttempts"=OLD."submitAttempts" AND NEW."lookupAttempts"=OLD."lookupAttempts"+1 AND EXISTS(SELECT 1 FROM "ProviderIntent" p JOIN "AuthRestoreCheckpoint" c ON p."createdAt"<=c."createdAt" WHERE p.id=OLD."intentId")) OR
    (OLD.state='unknown' AND NEW.state='running' AND NEW.mode='lookup') OR
    (OLD.state='running' AND NEW.state IN ('unknown','review','confirmed','failed')) OR
    (OLD.state='review' AND NEW.state='unknown' AND NEW.mode='lookup')) THEN RAISE EXCEPTION 'Provider outbox transition invalid' USING ERRCODE='23514';END IF;
 ELSIF NEW.state<>'queued' OR NEW.mode<>'submit' OR NEW.generation<>0 OR NEW."submitAttempts"<>0 OR NEW."lookupAttempts"<>0 OR NEW."externalId" IS NOT NULL OR NEW."resultCode" IS NOT NULL THEN RAISE EXCEPTION 'Provider initial outbox invalid' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
