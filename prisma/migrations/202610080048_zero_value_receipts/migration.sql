-- Complimentary goods still have an original receipt/invoice trail, but no payable.
ALTER TABLE "SupplierInvoice" DROP CONSTRAINT "SupplierInvoice_amount_check";
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_amount_check" CHECK(amount>=0);
