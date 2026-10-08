import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    // Verify both DB connectivity and the core migration contract.
    await prisma.$queryRaw`SELECT 1 FROM "Operation" LIMIT 0`
    await prisma.$queryRaw`SELECT "actorId" FROM "Operation" LIMIT 0`
    await prisma.$queryRaw`SELECT "bankName","bankAccount","paymentTerms" FROM "Supplier" LIMIT 0`
    await prisma.$queryRaw`SELECT "sourceType" FROM "Payment" LIMIT 0`
    const migrated=await prisma.$queryRaw<{total:bigint}[]>`SELECT count(*) AS total FROM "_prisma_migrations" WHERE migration_name IN ('202610060025_stock_journal_guards','202610070031_manual_refund_proof','202610070032_supplier_terms','202610070033_payment_source','202610070034_manual_collection_proof','202610070035_price_history','202610070036_return_dispositions','202610080037_price_location_scope','202610080038_financial_accounts','202610080039_financial_trigger_record','202610080040_financial_trigger_alias','202610080041_financial_cash_mirror','202610080042_supplier_ledger','202610080043_supplier_trigger_record','202610080044_supplier_payment_proof','202610080045_purchase_orders','202610080046_purchase_receipt_complete','202610080047_purchase_cascade_constraints','202610080048_zero_value_receipts','202610080049_supplier_credits','202610080050_product_variants','202610080051_variant_tenant_fks','202610080052_protected_files','202610080053_catalog_metadata','202610080054_file_image_links','202610080055_category_graph_lock','202610080056_cashier_pin','202610080057_tax_snapshots','202610080058_return_tax_allocation','202610080059_discount_authorization') AND finished_at IS NOT NULL AND rolled_back_at IS NULL`
    if (migrated[0]?.total!==BigInt(30)) throw new Error('Migration incomplete')
    return Response.json({ status: 'ready' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
