# Replay sources

The CommonJS sources used for isolated preparation, measurements, restart and validation are retained as plain-text evidence (`*-runner*.txt`, `finalize.txt`), following the previous code-review evidence convention. Node24 can execute these text files directly from the repository root, e.g. `node tasks/evidence/server-preparation-20261017/finalize.txt`. Historical logs may show their original `.cjs` filenames; renaming preserved runner bytes. No application lint rule was disabled.

These runners require their explicit isolated pos_test environment, prepared fixture and prior artifacts. Do not point them at a business/staging/production database. The raw service measurement executes the compiled guarded harness, with its source/compiled hash and actual exit/timing recorded separately. Seed sources do not claim a measurement.
