BEGIN;
-- Terminal core operation outcomes; provider pending/unknown belongs to its own ledger.
ALTER TABLE "Operation" ADD COLUMN state TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_terminal_state" CHECK (state IN ('completed','cancelled'));
COMMIT;
