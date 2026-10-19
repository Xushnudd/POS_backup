-- SQL CHECK treats UNKNOWN as accepted; require explicit nonnull attestation.
ALTER TABLE "AuthRestoreCheckpoint" ADD CONSTRAINT auth_restore_review_shape CHECK (
 ("reviewedAt" IS NULL AND reviewer IS NULL AND "reviewEvidence" IS NULL) OR
 ("reviewedAt" IS NOT NULL AND reviewer IS NOT NULL AND "reviewEvidence" IS NOT NULL AND
  "reviewedAt">="createdAt" AND length(trim(reviewer)) BETWEEN 3 AND 200 AND length(trim("reviewEvidence")) BETWEEN 10 AND 2000)
);
