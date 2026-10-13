BEGIN;
-- Zero describes no configured amount for an inactive gift feature. It never
-- becomes an active price/limit; activation still requires positive values.
DO $$ DECLARE source text;needle text:='(c#>>''{gifts,minIssueAmount}'')::numeric<=0';BEGIN
 source:=pg_get_functiondef('pos_loyalty_configuration_valid(jsonb)'::regprocedure);
 IF strpos(source,needle)=0 THEN RAISE EXCEPTION 'Unreviewed loyalty configuration';END IF;
 source:=replace(source,needle,'((c#>>''{gifts,enabled}'')::boolean AND (c#>>''{gifts,minIssueAmount}'')::numeric<=0)');EXECUTE source;
END $$;
COMMIT;
