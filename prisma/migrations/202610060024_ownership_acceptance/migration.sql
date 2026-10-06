CREATE TABLE "OwnershipTransfer" (
 "id" TEXT PRIMARY KEY,
 "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
 "fromMembershipId" TEXT NOT NULL REFERENCES "OrganizationUser"("id") ON DELETE CASCADE,
 "toMembershipId" TEXT NOT NULL REFERENCES "OrganizationUser"("id") ON DELETE CASCADE,
 "state" TEXT NOT NULL DEFAULT 'pending' CHECK ("state" IN ('pending','accepted','cancelled','expired')),
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "acceptedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK ("fromMembershipId" <> "toMembershipId"),
 CHECK (("state"='accepted') = ("acceptedAt" IS NOT NULL)),
 CHECK ("expiresAt">"createdAt")
);
CREATE INDEX "OwnershipTransfer_organizationId_state_idx" ON "OwnershipTransfer"("organizationId","state");
CREATE UNIQUE INDEX "OwnershipTransfer_one_pending" ON "OwnershipTransfer"("organizationId") WHERE "state"='pending';
CREATE FUNCTION ownership_transfer_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD."state"<>'pending' THEN RAISE EXCEPTION 'Ownership transfer is terminal'; END IF;
 IF TG_OP='UPDATE' AND (NEW."organizationId",NEW."fromMembershipId",NEW."toMembershipId",NEW."expiresAt",NEW."createdAt") IS DISTINCT FROM (OLD."organizationId",OLD."fromMembershipId",OLD."toMembershipId",OLD."expiresAt",OLD."createdAt") THEN RAISE EXCEPTION 'Ownership request is immutable'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "OrganizationUser" WHERE "id"=NEW."fromMembershipId" AND "organizationId"=NEW."organizationId") OR NOT EXISTS (SELECT 1 FROM "OrganizationUser" WHERE "id"=NEW."toMembershipId" AND "organizationId"=NEW."organizationId") THEN RAISE EXCEPTION 'Ownership transfer tenant mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ownership_transfer_guard BEFORE INSERT OR UPDATE ON "OwnershipTransfer" FOR EACH ROW EXECUTE FUNCTION ownership_transfer_guard();
