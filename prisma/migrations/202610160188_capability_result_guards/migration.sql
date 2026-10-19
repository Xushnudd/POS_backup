BEGIN;
DO $$ DECLARE definition TEXT;BEGIN
 definition:=pg_get_functiondef('pos_receipt_share_proof()'::regprocedure);
 IF strpos(definition,'NEW.result->>''tokenHash'' !~')=0 THEN RAISE EXCEPTION 'UNKNOWN_RECEIPT_SHARE_GUARD';END IF;
 definition:=replace(definition,'NEW.result->>''tokenHash'' !~','COALESCE(NEW.result->>''tokenHash'','''') !~');
 definition:=replace(definition,'NEW.result->>''keyId'' !~','COALESCE(NEW.result->>''keyId'','''') !~');
 definition:=replace(definition,'(NEW.result->>''expiresAt'')::timestamptz<=','NEW.result->>''expiresAt'' IS NULL OR (NEW.result->>''expiresAt'')::timestamptz<=');
 EXECUTE definition;
 definition:=pg_get_functiondef('pos_reminder_source_guard()'::regprocedure);
 IF strpos(definition,'NEW.result->>''tokenHash'' !~')=0 THEN RAISE EXCEPTION 'UNKNOWN_REMINDER_GUARD';END IF;
 definition:=replace(definition,'NEW.result->>''tokenHash'' !~','COALESCE(NEW.result->>''tokenHash'','''') !~');
 definition:=replace(definition,'NEW.result->>''keyId'' !~','COALESCE(NEW.result->>''keyId'','''') !~');
 definition:=replace(definition,'IF TG_OP=''INSERT'' OR (NEW.state=','IF TG_OP=''INSERT'' OR (TG_OP=''UPDATE'' AND NEW.generation>OLD.generation) OR (NEW.state=');
 definition:=replace(definition,'octet_length(NEW.result::text)>1048576','octet_length(NEW.result::text)>1048576 OR jsonb_typeof(NEW.result->''snapshot'') IS DISTINCT FROM ''object'' OR (NEW.result->>''expiresAt'')::timestamptz IS DISTINCT FROM NEW."expiresAt" AT TIME ZONE ''UTC''');
 EXECUTE definition;
END $$;
COMMIT;
