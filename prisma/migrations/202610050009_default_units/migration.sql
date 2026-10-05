BEGIN;
-- Preserve configured/legacy precision; add missing choices used by the existing UI.
INSERT INTO "Unit" (id,"organizationId",code,name,precision)
SELECT gen_random_uuid()::text,o.id,u.code,u.name,u.precision FROM "Organization" o CROSS JOIN (VALUES ('quti','Quti',0),('juft','Juft',0),('gramm','Gramm',6),('komplekt','Komplekt',0)) AS u(code,name,precision)
ON CONFLICT("organizationId",code) DO NOTHING;
CREATE OR REPLACE FUNCTION seed_pos_units() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO "Unit" (id,"organizationId",code,name,precision)
 SELECT gen_random_uuid()::text,NEW.id,u.code,u.name,u.precision FROM (VALUES ('dona','Dona',0),('kg','Kilogramm',6),('litr','Litr',6),('metr','Metr',6),('quti','Quti',0),('juft','Juft',0),('gramm','Gramm',6),('komplekt','Komplekt',0)) AS u(code,name,precision);
 RETURN NEW;
END $$;
COMMIT;
