-- pg_restore uses an empty search_path while copying rows. Bind the lookup proof
-- to the application's public schema instead of the caller's search_path.
CREATE OR REPLACE FUNCTION provider_restore_requires_lookup(identifier TEXT) RETURNS BOOLEAN
 LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public."ProviderIntent" p JOIN public."AuthRestoreCheckpoint" c ON p."createdAt"<=c."createdAt" WHERE p.id=identifier)
$$;
