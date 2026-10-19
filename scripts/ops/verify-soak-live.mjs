import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname,basename} from 'node:path';
import {PrismaClient,Prisma} from '@prisma/client';
const url=new URL(process.env.DATABASE_URL??'');
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55439');
assert.equal(url.pathname,'/pos_test');assert.equal(url.username,'pos_test');
const path=resolve(process.argv[2]??'');assert.equal(dirname(path),resolve('tasks/evidence'));
assert.match(basename(path),/^soak-[0-9a-f-]{36}\.json$/);
const run=JSON.parse(await readFile(path,'utf8'));
assert.equal(basename(path),'soak-'+run.runId+'.json');
assert.match(run.fixture.organizationId,/^[0-9a-f-]{36}$/);
const db=new PrismaClient({datasources:{db:{url:url.toString()}}});
try{
  // One SQL snapshot, even if the next checkout commits during this read.
  const [row]=await db.$queryRaw(Prisma.sql`SELECT
    (SELECT count(*) FROM "Sale" WHERE "organizationId"=${run.fixture.organizationId} AND status='completed') AS sales,
    (SELECT count(*) FROM "Payment" WHERE "organizationId"=${run.fixture.organizationId}) AS payments,
    (SELECT count(*) FROM "SaleItem" i JOIN "Sale" s ON s.id=i."saleId" WHERE s."organizationId"=${run.fixture.organizationId} AND s.status='completed') AS items,
    (SELECT count(*) FROM "InventoryMovement" WHERE "organizationId"=${run.fixture.organizationId} AND "sourceType"='sale') AS movements,
    (SELECT COALESCE(sum(amount),0)::text FROM "Payment" WHERE "organizationId"=${run.fixture.organizationId}) AS cash,
    (SELECT COALESCE(sum("quantityDelta"),0)::text FROM "InventoryMovement" WHERE "organizationId"=${run.fixture.organizationId}) AS delta,
    (SELECT COALESCE(sum(b.quantity),0)::text FROM "InventoryBalance" b JOIN "Product" p ON p.id=b."productId" WHERE p."organizationId"=${run.fixture.organizationId}) AS stock`);
  assert.ok(row.sales>0n);assert.equal(row.payments,row.sales);assert.equal(row.items,row.sales);assert.equal(row.movements,row.sales);
  assert.equal(new Prisma.Decimal(row.cash).toFixed(2),new Prisma.Decimal(row.sales.toString()).mul('1.01').toFixed(2));
  assert.equal(new Prisma.Decimal(row.delta).toString(),'-'+row.sales.toString());
  assert.equal(new Prisma.Decimal(row.stock).add(row.sales.toString()).toString(),String(run.fixture.initialStockPerProduct*run.fixture.registers));
  const output=resolve('tasks/evidence','soak-live-'+run.runId+'.json');
  const result={runId:run.runId,at:new Date().toISOString(),readOnly:true,consistentSnapshot:true,
    scope:'own synthetic fixture only; not final task acceptance',result:row};
  await writeFile(output,JSON.stringify(result,(_,v)=>typeof v==='bigint'?v.toString():v,2)+'\n',{mode:0o600});
  console.info(JSON.stringify({output,matchedSales:row.sales.toString()}));
}finally{await db.$disconnect();}
