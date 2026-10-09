ALTER TABLE "BackgroundJob" DROP CONSTRAINT "BackgroundJob_type_check";
ALTER TABLE "BackgroundJob" ADD CONSTRAINT "BackgroundJob_type_check" CHECK(type IN ('reconciliation','catalog_export'));
CREATE UNIQUE INDEX "BackgroundJob_id_organizationId_key" ON "BackgroundJob"(id,"organizationId");
CREATE TABLE "JobExport"("jobId" TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL,data BYTEA,filename TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL CHECK(size BETWEEN 1 AND 16777216),sha256 TEXT NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),"rowCount" INTEGER NOT NULL CHECK("rowCount" BETWEEN 0 AND 100000),"asOf" TIMESTAMP(3) NOT NULL,"expiresAt" TIMESTAMP(3) NOT NULL,FOREIGN KEY("jobId","organizationId") REFERENCES "BackgroundJob"(id,"organizationId") ON DELETE CASCADE,CHECK(data IS NULL OR octet_length(data)=size));
CREATE INDEX "JobExport_organizationId_expiresAt_idx" ON "JobExport"("organizationId","expiresAt");
