-- Organization is the root itself, with only shared/global outgoing references.
-- Keep its BEFORE UPDATE identity guard. No deferred edge event is necessary;
-- legacy enrollment rehearsal can safely re-enable its own enrollment trigger.
DROP TRIGGER tenant_edges ON "Organization";
