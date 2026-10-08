import {Prisma} from '@prisma/client'
import {z} from 'zod'
import {prisma} from '@/lib/prisma'
import type {TokenPayload} from '@/lib/auth'
import {AccessError,tenantScope} from '../auth/policy'
import {audit,runOperation} from '../operations'
import {amountSchema,positiveAmountSchema,requireOpenShift} from '../sales/service'
import {decimal,money} from '../sales/calculations'
import {shiftCashSummary} from './shifts'
export const accountSchema=z.object({operationId:z.string().uuid(),storeId:z.string().uuid(),registerId:z.string().uuid().optional(),name:z.string().trim().min(1).max(200),kind:z.enum(['cash','bank','provider']),openingBalance:amountSchema.default(0),reason:z.string().trim().min(3).max(2000)}).strict().refine(x=>(x.kind==='cash')===!!x.registerId,'Naqd hisob kassa bilan bog‘lanishi kerak');
export const categorySchema=z.object({operationId:z.string().uuid(),name:z.string().trim().min(1).max(200),treatment:z.enum(['operating','capitalised']).default('operating')}).strict();
export const expenseSchema=z.object({operationId:z.string().uuid(),accountId:z.string().uuid(),expenseCategoryId:z.string().uuid(),shiftId:z.string().uuid().optional(),amount:positiveAmountSchema,reason:z.string().trim().min(3).max(2000)}).strict();
export const transferSchema=z.object({operationId:z.string().uuid(),fromAccountId:z.string().uuid(),toAccountId:z.string().uuid(),fromShiftId:z.string().uuid().optional(),toShiftId:z.string().uuid().optional(),amount:positiveAmountSchema,reason:z.string().trim().min(3).max(2000)}).strict().refine(x=>x.fromAccountId!==x.toAccountId,'Hisoblar har xil bo‘lishi kerak');
export const reversalSchema=z.object({operationId:z.string().uuid(),reason:z.string().trim().min(3).max(2000),shifts:z.record(z.string().uuid(),z.string().uuid()).default({})}).strict();
export function financeManager(ctx:TokenPayload,owner=false){if(owner?ctx.role!=='owner':!['owner','admin'].includes(ctx.role))throw new AccessError(403,owner?'OWNER_REQUIRED':'MANAGER_REQUIRED');}
export async function lockAccounts(tx:Prisma.TransactionClient,ctx:TokenPayload,ids:string[]){
 for(const id of [...new Set(ids)].sort())await tx.$queryRaw`SELECT id FROM "FinancialAccount" WHERE id=${id} AND "organizationId"=${ctx.organizationId} FOR UPDATE`;
 const rows=await tx.financialAccount.findMany({where:{id:{in:ids},isActive:true,AND:tenantScope('FinancialAccount',ctx)}});
 if(rows.length!==new Set(ids).size)throw new AccessError(404,'ACCOUNT_NOT_FOUND');return rows;
}
export async function accountBalance(tx:Prisma.TransactionClient,account:{id:string;kind:string;registerId:string|null}){
 if(account.kind!=='cash'){const sum=await tx.accountEntry.aggregate({where:{accountId:account.id},_sum:{amount:true}});return {balance:decimal(sum._sum.amount??0),shiftId:null,source:'manual_account_journal'};}
 const shift=await tx.shift.findFirst({where:{registerId:account.registerId!},orderBy:[{openedAt:'desc'},{id:'desc'}]});
 if(!shift)return {balance:decimal(0),shiftId:null,source:'register_cash_book'};
 if(shift.status==='closed')return {balance:decimal(shift.countedCash??shift.expectedCash??0),shiftId:shift.id,source:'closed_counted_cash'};
 const payments=await tx.payment.findMany({where:{shiftId:shift.id}}),movements=await tx.cashMovement.findMany({where:{shiftId:shift.id}});
 return {balance:shiftCashSummary(shift.openingCash,payments,movements).expectedCash,shiftId:shift.id,source:'open_shift_cash_book'};
}
// Cash entries mirror the existing shift journal; their ledger amount is never
// added again to cashBalance. Bank/provider accounts are manual books only.
export async function postAccountEntry(tx:Prisma.TransactionClient,ctx:TokenPayload,account:{id:string;registerId:string|null;kind:string},documentId:string,amount:Prisma.Decimal,reason:string,shiftId?:string){
 let cashMovementId:string|undefined;
 if(account.kind==='cash'){
  if(!shiftId)throw new AccessError(400,'CASH_SHIFT_REQUIRED');const shift=await requireOpenShift(tx,ctx,shiftId);
  if(shift.registerId!==account.registerId)throw new AccessError(409,'ACCOUNT_SHIFT_MISMATCH');
  if(amount.lt(0)&&(await accountBalance(tx,account)).balance.lt(amount.abs()))throw new AccessError(409,'ACCOUNT_FUNDS_INSUFFICIENT');
  cashMovementId=(await tx.cashMovement.create({data:{shiftId,movementType:amount.gt(0)?'cash_in':'cash_out',amount:amount.abs(),reason,createdBy:ctx.userId}})).id;
 }else if(amount.lt(0)&&(await accountBalance(tx,account)).balance.lt(amount.abs()))throw new AccessError(409,'ACCOUNT_FUNDS_INSUFFICIENT');
 return tx.accountEntry.create({data:{organizationId:ctx.organizationId,accountId:account.id,documentId,amount,cashMovementId}});
}
export async function createAccount(ctx:TokenPayload,input:z.infer<typeof accountSchema>){
 financeManager(ctx,true);return runOperation(ctx,'finance.account',input.operationId,input,async tx=>{
  const store=await tx.store.findFirst({where:{id:input.storeId,isActive:true,AND:tenantScope('Store',ctx)}});if(!store)throw new AccessError(404,'NOT_FOUND');
  if(input.registerId&&!await tx.register.findFirst({where:{id:input.registerId,storeId:store.id,isActive:true}}))throw new AccessError(404,'REGISTER_NOT_FOUND');
  if(input.kind==='cash'&&!money(input.openingBalance).isZero())throw new AccessError(400,'CASH_OPENING_IS_SHIFT','Naqd boshlang‘ich pul smena orqali olinadi');
  const account=await tx.financialAccount.create({data:{organizationId:ctx.organizationId,storeId:store.id,registerId:input.registerId,name:input.name,kind:input.kind}});
  if(money(input.openingBalance).gt(0)){const doc=await tx.financialDocument.create({data:{organizationId:ctx.organizationId,storeId:store.id,kind:'opening',amount:money(input.openingBalance),reason:input.reason,actorId:ctx.userId}});await postAccountEntry(tx,ctx,account,doc.id,doc.amount,input.reason);}
  await audit(tx,ctx,'FinancialAccount',account.id,'created',{kind:input.kind,reason:input.reason,openingBalance:input.openingBalance});return account;
 });
}
export async function createExpenseCategory(ctx:TokenPayload,input:z.infer<typeof categorySchema>){financeManager(ctx,true);return runOperation(ctx,'finance.category',input.operationId,input,async tx=>{const row=await tx.expenseCategory.create({data:{organizationId:ctx.organizationId,name:input.name,treatment:input.treatment}});await audit(tx,ctx,'ExpenseCategory',row.id,'created',{treatment:input.treatment});return row;});}
export async function postExpense(ctx:TokenPayload,input:z.infer<typeof expenseSchema>){financeManager(ctx);return runOperation(ctx,'finance.expense',input.operationId,input,async tx=>{
 const [account]=await lockAccounts(tx,ctx,[input.accountId]);const category=await tx.expenseCategory.findFirst({where:{id:input.expenseCategoryId,organizationId:ctx.organizationId,isActive:true}});if(!category)throw new AccessError(404,'EXPENSE_CATEGORY_NOT_FOUND');
 const doc=await tx.financialDocument.create({data:{organizationId:ctx.organizationId,storeId:account.storeId,kind:'expense',amount:money(input.amount),categoryId:category.id,reason:input.reason,actorId:ctx.userId}});
 await postAccountEntry(tx,ctx,account,doc.id,doc.amount.negated(),input.reason,input.shiftId);await audit(tx,ctx,'FinancialDocument',doc.id,'expense_posted',{categoryId:category.id,treatment:category.treatment,amount:doc.amount,reason:input.reason,approvedBy:ctx.userId});return doc;
 });}
export async function transferAccounts(ctx:TokenPayload,input:z.infer<typeof transferSchema>){financeManager(ctx);return runOperation(ctx,'finance.transfer',input.operationId,input,async tx=>{
 const accounts=await lockAccounts(tx,ctx,[input.fromAccountId,input.toAccountId]),from=accounts.find(a=>a.id===input.fromAccountId)!,to=accounts.find(a=>a.id===input.toAccountId)!;
 const doc=await tx.financialDocument.create({data:{organizationId:ctx.organizationId,storeId:from.storeId,kind:'transfer',amount:money(input.amount),reason:input.reason,actorId:ctx.userId}});
 await postAccountEntry(tx,ctx,from,doc.id,doc.amount.negated(),input.reason,input.fromShiftId);await postAccountEntry(tx,ctx,to,doc.id,doc.amount,input.reason,input.toShiftId);await audit(tx,ctx,'FinancialDocument',doc.id,'accounts_transferred',{fromAccountId:from.id,toAccountId:to.id,amount:doc.amount,reason:input.reason});return doc;
 });}
export async function reverseFinancialDocument(ctx:TokenPayload,id:string,input:z.infer<typeof reversalSchema>){financeManager(ctx);return runOperation(ctx,'finance.reverse',input.operationId,{id,...input},async tx=>{
 await tx.$queryRaw`SELECT id FROM "FinancialDocument" WHERE id=${id} FOR UPDATE`;
 const original=await tx.financialDocument.findFirst({where:{id,AND:tenantScope('FinancialDocument',ctx)},include:{entries:true,reversal:true}});
 if(!original)throw new AccessError(404,'NOT_FOUND');if(!['expense','transfer'].includes(original.kind)||original.reversal)throw new AccessError(409,'INVALID_REVERSAL');
 const accounts=await lockAccounts(tx,ctx,original.entries.map(e=>e.accountId));
 const doc=await tx.financialDocument.create({data:{organizationId:ctx.organizationId,storeId:original.storeId,kind:original.kind+'_reversal',amount:original.amount,categoryId:original.categoryId,reversalOfId:original.id,reason:input.reason,actorId:ctx.userId}});
 // Debit before credit so both funding checks refer to committed available money.
 for(const entry of [...original.entries].sort((a,b)=>b.amount.comparedTo(a.amount)))await postAccountEntry(tx,ctx,accounts.find(a=>a.id===entry.accountId)!,doc.id,entry.amount.negated(),input.reason,input.shifts[entry.accountId]);
 await audit(tx,ctx,'FinancialDocument',doc.id,'reversed',{originalId:id,reason:input.reason});return doc;
 });}
export async function listAccounts(ctx:TokenPayload){financeManager(ctx);return prisma.$transaction(async tx=>{
 const accounts=await tx.financialAccount.findMany({where:{AND:tenantScope('FinancialAccount',ctx)},orderBy:[{name:'asc'},{id:'asc'}],take:10001});
 if(accounts.length>10000)throw new AccessError(413,'ACCOUNT_LIST_TOO_LARGE','Hisoblar ro‘yxati 10000 dan oshdi; qisman ro‘yxat qaytarilmaydi');
 if(!accounts.length)return [];
 // One bounded aggregate query avoids loading every payment/movement for every till.
 const balances=await tx.$queryRaw<{id:string;balance:Prisma.Decimal;shiftId:string|null;source:string}[]>`SELECT a.id,
 CASE WHEN a.kind<>'cash' THEN COALESCE(book.amount,0) WHEN s.id IS NULL THEN 0 WHEN s.status='closed' THEN COALESCE(s."countedCash",s."expectedCash",0) ELSE s."openingCash"+COALESCE(pay.amount,0)+COALESCE(cash.amount,0) END AS balance,
 s.id AS "shiftId",CASE WHEN a.kind<>'cash' THEN 'manual_account_journal' WHEN s.id IS NULL THEN 'register_cash_book' WHEN s.status='closed' THEN 'closed_counted_cash' ELSE 'open_shift_cash_book' END AS source
 FROM "FinancialAccount" a
 LEFT JOIN LATERAL(SELECT sum(e.amount) AS amount FROM "AccountEntry" e WHERE e."accountId"=a.id AND a.kind<>'cash') book ON true
 LEFT JOIN LATERAL(SELECT * FROM "Shift" sh WHERE sh."registerId"=a."registerId" AND a.kind='cash' ORDER BY sh."openedAt" DESC,sh.id DESC LIMIT 1) s ON true
 LEFT JOIN LATERAL(SELECT sum(CASE WHEN p.direction='in' THEN p.amount ELSE -p.amount END) AS amount FROM "Payment" p WHERE p."shiftId"=s.id AND p."paymentType"='cash' AND p.status='recorded' AND s.status='open') pay ON true
 LEFT JOIN LATERAL(SELECT sum(CASE WHEN c."movementType" IN ('cash_in','correction_in') THEN c.amount ELSE -c.amount END) AS amount FROM "CashMovement" c WHERE c."shiftId"=s.id AND s.status='open') cash ON true
 WHERE a.id IN (${Prisma.join(accounts.map(a=>a.id))})`;
 const byId=new Map(balances.map(b=>[b.id,b]));return accounts.map(account=>({...account,...byId.get(account.id)!}));
 },{isolationLevel:'RepeatableRead'});}
