-- A recovered queued intent has no local submission attempt. Lookup must not
-- fabricate one just to satisfy the pre-recovery counter invariant.
CREATE FUNCTION provider_restore_requires_lookup(identifier TEXT) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM "ProviderIntent" p JOIN "AuthRestoreCheckpoint" c ON p."createdAt"<=c."createdAt" WHERE p.id=identifier)
$$;
DO $$
DECLARE original_constraint TEXT;
BEGIN
 SELECT conname INTO STRICT original_constraint FROM pg_constraint
 WHERE conrelid='"ProviderOutbox"'::regclass AND contype='c'
 AND pg_get_constraintdef(oid) LIKE '%mode%lookup%submitAttempts%';
 EXECUTE format('ALTER TABLE "ProviderOutbox" DROP CONSTRAINT %I',original_constraint);
END $$;
ALTER TABLE "ProviderOutbox" ADD CONSTRAINT provider_lookup_submission_or_restore
 CHECK(mode<>'lookup' OR "submitAttempts"=1 OR
 ("submitAttempts"=0 AND "lookupAttempts">0 AND provider_restore_requires_lookup("intentId")));
