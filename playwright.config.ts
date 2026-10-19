import { defineConfig, devices } from '@playwright/test'
const connection=new URL(process.env.DATABASE_URL??'postgresql://invalid/invalid')
if (connection.hostname!=='127.0.0.1' || connection.pathname!=='/pos_test') throw new Error('Browser E2E requires the isolated localhost pos_test DB')
export default defineConfig({
 testDir:'./tests/e2e',testIgnore:['**/public-pricing-failure.spec.ts'],fullyParallel:false,workers:1,forbidOnly:Boolean(process.env.CI),retries:0,
 timeout:60000,expect:{timeout:10000},reporter:'list',
 // Lost-ack fault injection uses page.route, which service workers can bypass.
 // Dedicated PWA scenarios explicitly enable and test the real worker instead.
 use:{baseURL:'https://localhost:3100',ignoreHTTPSErrors:true,serviceWorkers:'block',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[{name:'chromium',use:{...devices['Desktop Chrome'],launchOptions:{args:['--ignore-certificate-errors']}}},...(process.env.POS_E2E_ALL_BROWSERS==='1'?[{name:'firefox',use:{...devices['Desktop Firefox']}},{name:'webkit',use:{...devices['Desktop Safari']}}]:[])],
 webServer:{command:'node scripts/e2e-server.cjs',url:'https://localhost:3100/api/health/ready',ignoreHTTPSErrors:true,reuseExistingServer:false,timeout:120000},
})
