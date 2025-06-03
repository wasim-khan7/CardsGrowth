const { test, expect } = require('@playwright/test');
require('dotenv').config({ path: './environmentConfigs/.env.motive' });



test('Motive Bank Linking - Handle Plaid iFrame and Popup', async ({ browser }) => {
    test.setTimeout(60000);
    

    const context = await browser.newContext();
    const page = await context.newPage();

    // Set HTTP Basic Authentication (First set of credentials)
    await context.setHTTPCredentials({
        username: process.env.authentication1Username,
        password: process.env.authentication1Password
    });

    // Navigate to the login page
    await page.goto(process.env.loginUrl);

    // Fill login credentials (Second set of credentials)
    await context.setHTTPCredentials({
        username: process.env.authentication2Username,
        password: process.env.authentication2Password
    });

    await page.locator('#user_email').fill(process.env.userEmail);
    await page.locator('#user_password').fill(process.env.userPassword);
    await page.getByRole('button', { name: 'Log in' }).click();

    // Navigate to fleet cards page
    await page.goto(`${process.env.baseUrl}/en-US/#/admin/fleet-cards/card-application`);
    await page.getByRole('button', { name: 'Verify bank account' }).click(); // Plaid iFrame appears

    // Handle Plaid iFrame
    const plaidFrame = await page.frameLocator('#plaid-link-iframe-1');
    await plaidFrame.locator('button:has-text("Continue")').click();
    await plaidFrame.locator('button:has-text("Continue as guest")').click();
    await plaidFrame.locator('.CondensedSearchTile-module__searchImage').nth(3).click();

    // Handle Plaid bank popup
    const [plaidBankPopup] = await Promise.all([
        page.waitForEvent('popup'), // Detect new window
        plaidFrame.locator('button:has-text("Continue to login")').click() // Click to trigger popup
    ]);

    await plaidBankPopup.waitForLoadState();
    await plaidBankPopup.locator('#username').fill(process.env.plaidBankUserName);
    await plaidBankPopup.locator('#password').fill(process.env.plaidBankPassword);
    await plaidBankPopup.locator('button:has-text("Sign in")').click();
    await plaidBankPopup.getByRole('button', { name: 'Get code' }).click();
    await plaidBankPopup.getByRole('button', { name: 'Submit' }).click();
    
    const checkbox = await plaidBankPopup.locator('label').filter({ hasText: 'Plaid Checking' }).getByRole('checkbox');
    await checkbox.waitFor();
    await checkbox.click();
    await plaidBankPopup.getByRole('button', { name: 'Continue' }).click();
    await plaidBankPopup.getByLabel('I have read and accept the').click();
    await plaidBankPopup.getByRole('button', { name: 'Connect account information' }).click();
    
    // Control back to iframe
    await plaidFrame.getByRole('button', { name: 'Finish without saving' }).click();

    await page.pause();
});
