BEGIN;
DO $$ DECLARE definition TEXT; BEGIN
 definition:=pg_get_functiondef('subscription_operation_guard()'::regprocedure);
 IF position('''customer.consent.withdraw''' IN definition)=0 THEN
  IF position('''job.enqueue'',''job.retry''' IN definition)=0 THEN RAISE EXCEPTION 'UNKNOWN_OPERATION_GUARD';END IF;
  definition:=replace(definition,'''job.enqueue'',''job.retry''','''job.enqueue'',''job.retry'',''customer.consent.withdraw''');
  EXECUTE definition;
 END IF;
END $$;
COMMIT;
