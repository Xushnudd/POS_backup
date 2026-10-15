BEGIN;
-- These tenant journals have specialized business guards as well. Register
-- their roots and native relationship checks in the common tenant contract.
DO $$ DECLARE definition TEXT; needle TEXT:='IF model_name=''Organization'' THEN'; names TEXT:='''ReportSchedule'',''ReportScheduleRun'',''LoyaltyPolicyVersion'',''LoyaltyPointLot'',''LoyaltyPointEntry'',''GiftCertificate'',''LoyaltyRedemption'',''LoyaltyRecoveryTransfer'',''GiftCheckout'',''LoyaltyCard'',''LoyaltyPromotion'',''LoyaltyBenefitSelection'''; tab TEXT; BEGIN
 definition:=pg_get_functiondef('pos_tenant_root(text,jsonb)'::regprocedure);
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'UNKNOWN_TENANT_ROOT';END IF;
 definition:=replace(definition,needle,'IF model_name IN ('||names||') THEN RETURN row_data->>''organizationId'';END IF; '||needle);EXECUTE definition;
 definition:=pg_get_functiondef('pos_tenant_expression(text,text)'::regprocedure);
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'UNKNOWN_TENANT_EXPRESSION';END IF;
 definition:=replace(definition,needle,'IF model_name IN ('||names||') THEN RETURN format(''%I."organizationId"'',row_alias);END IF; '||needle);EXECUTE definition;
 FOREACH tab IN ARRAY ARRAY['ReportSchedule','ReportScheduleRun','LoyaltyPolicyVersion','LoyaltyPointLot','LoyaltyPointEntry','GiftCertificate','LoyaltyRedemption','LoyaltyRecoveryTransfer','GiftCheckout','LoyaltyCard','LoyaltyPromotion','LoyaltyBenefitSelection'] LOOP
  EXECUTE format('CREATE TRIGGER tenant_owner BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION pos_tenant_owner_immutable()',tab);
  EXECUTE format('CREATE CONSTRAINT TRIGGER tenant_edges AFTER INSERT OR UPDATE ON %I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_tenant_edge_trigger()',tab);
 END LOOP;
END $$;
COMMIT;
