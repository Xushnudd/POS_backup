import {defineConfig} from '@playwright/test';
import main from './playwright.config';

// The successful public-pricing cache lives for60 seconds. The real timeout
// scenario requires a fresh process, not a shortened production cache policy.
export default defineConfig({
 ...main,
 testMatch:'**/public-pricing-failure.spec.ts',
 testIgnore:[],
});
