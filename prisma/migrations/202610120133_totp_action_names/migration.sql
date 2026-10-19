-- Expand accepted MFA action names to the existing hyphenated operation namespace.
-- Existing names and bound action/key/hash/session identities are unchanged.
-- The same transaction keeps a validated constraint throughout publication.
BEGIN;
ALTER TABLE "TotpProof" ADD CONSTRAINT "TotpProof_action_name_check"
 CHECK (char_length(action) BETWEEN 3 AND 81 AND action ~ '^[a-z]' AND action !~ '[^a-z0-9_.-]') NOT VALID;
ALTER TABLE "TotpProof" VALIDATE CONSTRAINT "TotpProof_action_name_check";
ALTER TABLE "TotpProof" DROP CONSTRAINT "TotpProof_action_check";
COMMIT;
