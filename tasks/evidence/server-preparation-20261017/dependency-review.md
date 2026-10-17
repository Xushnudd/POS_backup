# Production dependency audit — 2026-10-17

Initial npm audit:0high/critical,2moderate entries (ExcelJS through UUID, one advisory).
[GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) concerns UUIDv3/v5/v6 output-buffer bounds and identifies11.1.1 as patched. The actual ExcelJS4.4.0 source uses CommonJS `require('uuid').v4` in extended XLSX conditional formatting; exploitability of that advisory through our v4 caller is not asserted.

A scoped npm override pins only `exceljs -> uuid` to11.1.1. ExcelJS was not downgraded, no new library or global UUID override was added. Official npm exports metadata confirms a CommonJS entry. The lock diff updates one installed package (8.3.2→11.1.1). A real XLSX generation/read roundtrip exercises that v4 consumer and exact decimal/text export. Final production-only npm audit reports zero findings; raw initial/final audit JSON is retained. This is an advisory snapshot, not an OS-image scan, penetration test or perpetual security guarantee. QA-01.08 external acceptance remains open.
