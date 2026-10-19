// Vendor-neutral boundaries only. No provider SDK, endpoint, protocol or driver.
export type IntegrationResult<T> = { state: 'confirmed'; value: T } | { state: 'pending' | 'unknown'; externalId?: string } | { state: 'failed'; code: string }
export interface PaymentProvider {
  readonly name: string
  charge(input: { operationId: string; amount: string; currency: string; saleId: string }): Promise<IntegrationResult<{ externalId: string }>>
  status(externalId: string): Promise<IntegrationResult<{ externalId: string }>>
  refund(input: { operationId: string; externalId: string; amount: string }): Promise<IntegrationResult<{ externalId: string }>>
}
export interface FiscalProvider {
  submit(input: { operationId: string; documentId: string }): Promise<IntegrationResult<{ externalId: string }>>
  status(externalId: string): Promise<IntegrationResult<{ externalId: string }>>
}
export interface ReceiptPrinter { print(document: { receiptId: string; copy: boolean }): Promise<void> }
export interface Scale { readWeight(): Promise<{ quantity: string; unit: string }> }
export interface BarcodeScanner { subscribe(onCode: (code: string) => void): () => void }
export interface CashDrawer { open(input: { operationId: string; shiftId: string }): Promise<void> }
export class IntegrationUnavailable extends Error {
  constructor(public capability: string) { super(`${capability} integration is not configured`) }
}
