-- A source can recur each month; prevent duplicate records for the same period.
DROP INDEX integration_active_source;
CREATE UNIQUE INDEX integration_active_source ON "IntegrationCost"
 ("organizationId",kind,source,currency,"periodStart","periodEnd")
 WHERE "cancelledAt" IS NULL;
