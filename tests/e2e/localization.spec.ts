import {test,expect} from '@playwright/test';
test('Locale preference changes without navigating or clearing a credential draft and is isolated per SSR request',async({page})=>{
 await page.goto('/login');const phone=page.locator('input[type="tel"]'),password=page.locator('input[type="password"]');
 await phone.fill('901234567');await password.fill('unsent-test-only-password');const url=page.url();
 await page.getByLabel('Til',{exact:true}).selectOption('ru');await expect(page.locator('html')).toHaveAttribute('lang','ru');await expect(page.getByLabel('Язык',{exact:true})).toHaveValue('ru');await expect(page.getByRole('heading',{name:'Вход в систему',exact:true})).toBeVisible();await expect(phone).toHaveValue('901234567');await expect(password).toHaveValue('unsent-test-only-password');expect(page.url()).toBe(url);
 page.once('dialog',dialog=>dialog.accept());await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','ru');await expect(password).toHaveValue('');
 const [uz,ru]=await Promise.all([page.request.get('/login',{headers:{cookie:'pos_locale=uz'}}),page.request.get('/login',{headers:{cookie:'pos_locale=ru'}})]);expect(uz.ok()).toBe(true);expect(ru.ok()).toBe(true);const uzHtml=await uz.text(),ruHtml=await ru.text();expect(uzHtml).toMatch(/<html[^>]*lang="uz"/);expect(ruHtml).toMatch(/<html[^>]*lang="ru"/);expect(ruHtml).toMatch(/<select[^>]*aria-label="Язык"/);expect(uzHtml).toMatch(/<select[^>]*aria-label="Til"/);
});
