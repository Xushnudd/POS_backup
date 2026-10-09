import {deploymentState} from '@/server/deployment/state'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    if((await deploymentState()).maintenance)throw new Error('Maintenance drain')
    // Verify both DB connectivity and the core migration contract.
    await prisma.$queryRaw`SELECT 1 FROM "Operation" LIMIT 0`
    await prisma.$queryRaw`SELECT "actorId" FROM "Operation" LIMIT 0`
    await prisma.$queryRaw`SELECT "bankName","bankAccount","paymentTerms" FROM "Supplier" LIMIT 0`
    await prisma.$queryRaw`SELECT "sourceType" FROM "Payment" LIMIT 0`
    const migrated=await prisma.$queryRaw<{total:bigint}[]>`SELECT count(*) AS total FROM "_prisma_migrations" WHERE migration_name IN ('202610060025_stock_journal_guards','202610070031_manual_refund_proof','202610070032_supplier_terms','202610070033_payment_source','202610070034_manual_collection_proof','202610070035_price_history','202610070036_return_dispositions','202610080037_price_location_scope','202610080038_financial_accounts','202610080039_financial_trigger_record','202610080040_financial_trigger_alias','202610080041_financial_cash_mirror','202610080042_supplier_ledger','202610080043_supplier_trigger_record','202610080044_supplier_payment_proof','202610080045_purchase_orders','202610080046_purchase_receipt_complete','202610080047_purchase_cascade_constraints','202610080048_zero_value_receipts','202610080049_supplier_credits','202610080050_product_variants','202610080051_variant_tenant_fks','202610080052_protected_files','202610080053_catalog_metadata','202610080054_file_image_links','202610080055_category_graph_lock','202610080056_cashier_pin','202610080057_tax_snapshots','202610080058_return_tax_allocation','202610080059_discount_authorization','202610080060_transfer_dispositions','202610080061_transfer_snapshot_guards','202610080062_support_grants','202610080063_price_rules','202610080064_price_rule_guards','202610080065_customer_identity','202610080066_receipt_join_indexes','202610080067_receipt_index','202610080068_receipt_index','202610080069_receipt_index','202610080070_receipt_index','202610080071_receipt_index','202610080072_receipt_index','202610080073_receipt_index','202610080074_stock_locations_reservations','202610080075_reservation_unit_guards','202610090076_offline_cash_leases','202610090077_offline_uncertain_stock','202610090078_offline_sale_payload','202610090079_offline_count_freeze','202610090080_offline_owner_settlement','202610090081_offline_settlement_proof_guards','202610090082_onboarding_checkpoints','202610090083_sale_exchanges','202610090084_background_jobs','202610090085_security_events','202610090086_security_notice_retry','202610090087_product_classification','202610090088_unit_conversions','202610090089_payment_receipt_indexes','202610090090_payment_shift_index','202610090091_inventory_product_index','202610090092_catalog_export_jobs','202610090093_export_artifact_guards','202610090094_customer_advances','202610090095_advance_trigger_alias') AND finished_at IS NOT NULL AND rolled_back_at IS NULL`
    if (migrated[0]?.total!==BigInt(66)) throw new Error('Migration incomplete')
    return Response.json({ status: 'ready' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
