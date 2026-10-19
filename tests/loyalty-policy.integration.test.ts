import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '@/lib/prisma';
import type {TokenPayload} from '@/lib/auth';
import {publishLoyaltyPolicy,readLoyaltyPolicy} from '@/server/loyalty/policy';
import type {LoyaltyPolicy} from '@/server/loyalty/calculations';
const url=new URL(process.env.DATABASE_URL??'');
if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/pos_test'||url.username!=='pos_test')throw Error('Isolated pos_test only');
const orgs:string[]=[],users:string[]=[];
after(async()=>{await prisma.organization.deleteMany({where:{id:{in:orgs}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect();});
const configuration:LoyaltyPolicy={points:{enabled:false,earnMoneyPerPoint:'100',redeemMoneyPerPoint:'1',maxRedeemPercent:'10',minEligibleNet:'100',expiryDays:30,earnOnDiscountedSales:false,earnOnCreditSales:false},cards:{enabled:false,discountPercent:'0',validityDays:null},promos:{enabled:false,allowStackingWithCard:false,allowStackingWithPoints:false},gifts:{enabled:false,minIssueAmount:'1000',maxIssueAmount:'1000000',validityDays:null,allowUnusedCashRefund:false}};
async function fixture(){const org=await prisma.organization.create({data:{name:'Loyalty policy fixture',phone:randomUUID()}});orgs.push(org.id);const user=await prisma.user.create({data:{fullName:'Loyalty policy owner',phone:randomUUID(),passwordHash:'not-a-login'}});users.push(user.id);const member=await prisma.organizationUser.create({data:{organizationId:org.id,userId:user.id,role:'owner'}});const session=await prisma.session.create({data:{organizationId:org.id,userId:user.id,tokenHash:randomUUID(),expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+3600000)}});const ctx:TokenPayload={organizationId:org.id,organizationUserId:member.id,userId:user.id,role:'owner',storeIds:[],sessionId:session.id};return {org,user,ctx};}
test('Administrator policy is explicitly configured, versioned, replay-safe and native immutable/proof protected',async()=>{
 const f=await fixture();assert.equal(await readLoyaltyPolicy(f.ctx),null);
 const input={operationId:randomUUID(),expectedRevision:0,configuration,reason:'Synthetic reviewed disabled rule policy'};
 const [a,b]=await Promise.all([publishLoyaltyPolicy(f.ctx,input),publishLoyaltyPolicy(f.ctx,input)]);assert.equal(a.id,b.id);assert.equal(a.revision,1);assert.deepEqual(a.configuration,configuration);
 await assert.rejects(publishLoyaltyPolicy(f.ctx,{...input,reason:'Changed original intent'}),{code:'OPERATION_PAYLOAD_CONFLICT'});
 const next=await publishLoyaltyPolicy(f.ctx,{...input,operationId:randomUUID(),expectedRevision:1,configuration:{...configuration,points:{...configuration.points,earnMoneyPerPoint:'200'}}});assert.equal(next.revision,2);
 await assert.rejects(publishLoyaltyPolicy(f.ctx,{...input,operationId:randomUUID()}),{code:'LOYALTY_POLICY_CHANGED'});
 await assert.rejects(prisma.loyaltyPolicyVersion.update({where:{id:a.id},data:{reason:'Rewrite original policy'}}));
 await assert.rejects(prisma.loyaltyPolicyVersion.delete({where:{id:a.id}}));
 await assert.rejects(prisma.loyaltyPolicyVersion.create({data:{organizationId:f.org.id,revision:3,configuration,createdBy:f.user.id,reason:'Missing native owner audit proof'}}));
 assert.equal((await readLoyaltyPolicy(f.ctx))?.revision,2);assert.equal(await prisma.loyaltyPolicyVersion.count({where:{organizationId:f.org.id}}),2);
 const foreign=await fixture();assert.equal(await readLoyaltyPolicy(foreign.ctx),null);await assert.rejects(readLoyaltyPolicy({...f.ctx,role:'admin'}),{code:'OWNER_REQUIRED'});
 // Activated features now have native persistence and checkout guards. Rules
 // remain explicitly owner-published and old policy versions stay immutable.
 const active=await publishLoyaltyPolicy(f.ctx,{...input,operationId:randomUUID(),expectedRevision:2,
  configuration:{...configuration,cards:{...configuration.cards,enabled:true},promos:{...configuration.promos,enabled:true}}});
 assert.equal(active.revision,3);assert.equal((await readLoyaltyPolicy(f.ctx))?.revision,3);
});
test('Native JSON policy validator agrees with strict rules and rejects malformed money, booleans, shape and dates',async()=>{
 const valid=await prisma.$queryRaw<{valid:boolean}[]>`SELECT pos_loyalty_configuration_valid(CAST(${JSON.stringify(configuration)} AS jsonb)) AS valid`;assert.equal(valid[0].valid,true);
 const bad=[{}, {...configuration,extra:true},{...configuration,points:{...configuration.points,enabled:'false'}},{...configuration,points:{...configuration.points,earnMoneyPerPoint:'1e3'}},{...configuration,points:{...configuration.points,expiryDays:1.5}},{...configuration,gifts:{...configuration.gifts,minIssueAmount:'1000001'}}];
 for(const value of bad){const [row]=await prisma.$queryRaw<{valid:boolean}[]>`SELECT pos_loyalty_configuration_valid(CAST(${JSON.stringify(value)} AS jsonb)) AS valid`;assert.equal(row.valid,false);}
});
