-- Additive: existing blocked memberships remain blocked, without inventing archive history.
ALTER TABLE "OrganizationUser" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "OrganizationUser" ADD CONSTRAINT "OrganizationUser_archive_inactive"
  CHECK ("archivedAt" IS NULL OR "isActive" = false);
