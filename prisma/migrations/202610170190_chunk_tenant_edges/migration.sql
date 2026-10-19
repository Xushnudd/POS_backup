BEGIN;
DO $$ DECLARE definition TEXT;name TEXT;BEGIN
 FOREACH name IN ARRAY ARRAY['pos_tenant_root(text,jsonb)','pos_tenant_expression(text,text)'] LOOP
  definition:=pg_get_functiondef(name::regprocedure);
  IF strpos(definition,'''JobExport''')=0 OR strpos(definition,'''JobExportChunk''')>0 THEN RAISE EXCEPTION 'UNKNOWN_CHUNK_TENANT_ROOT';END IF;
  EXECUTE replace(definition,'''JobExport''','''JobExport'',''JobExportChunk''');
 END LOOP;
END $$;
CREATE TRIGGER tenant_owner BEFORE UPDATE ON "JobExportChunk" FOR EACH ROW EXECUTE FUNCTION pos_tenant_owner_immutable();
CREATE CONSTRAINT TRIGGER tenant_edges AFTER INSERT OR UPDATE ON "JobExportChunk" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_tenant_edge_trigger();
COMMIT;
