import 'dotenv/config'; // Load environment variables from .env
import { test } from '@playwright/test';

// ---- User configuration section ----
let totalRuns = 1; // How many times to run the test in this script run
let runStartCount = 3; // Set this to the starting runCount (e.g., 8 to start from 8)
let environment = 'preview'; // Set to 'preview' or 'staging'
let CompanyNameContext = 'Wave2 Expansion'; // <-- Set your company context here
const CFS = [15]; // Array of totalVehicles for each run
// -------------------------------------

// Derive envVariableLetter from environment
const envVariableLetter = environment === 'preview' ? 'P' : environment === 'staging' ? 'S' : '';
if (!envVariableLetter) {
    throw new Error('Environment must be "preview" or "staging"');
}
if (!CompanyNameContext) {
    throw new Error('CompanyNameContext must be set');
}
if (CFS.length < totalRuns) {
    throw new Error('CFS array length must be at least as large as totalRuns');
}

// Helper functions for random data
function randomDigits(length: number) {
    let result = '';
    for (let i = 0; i < length; i++) {
        result += Math.floor(Math.random() * 10).toString();
    }
    return result;
}

// Helper for phone number that doesn't start with 0 or 9
function randomPhoneNumber() {
    let firstDigit = Math.floor(Math.random() * 8) + 1; // 1-8
    let rest = randomDigits(9);
    return firstDigit.toString() + rest;
}

// Arrays to collect results for logging
const emailsUsed: string[] = [];
const companyNames: string[] = [];
const cfsUsed: number[] = [];
const failedRuns: { runCount: number, error: string }[] = [];

// Main loop to run the test multiple times
for (let i = 0; i < totalRuns; i++) {
    const runCount = runStartCount + i;
    const totalVehicles = CFS[i];

    test(`Company Creation Run ${runCount}`, async ({ browser }) => {
        try {
            test.setTimeout(60000);
            const context = await browser.newContext({
                httpCredentials: {
                    username: process.env.AUTH_USER1 || '',
                    password: process.env.AUTH_PASS1 || ''
                }
            });

            const page = await context.newPage();

            await page.goto('https://account.p.k2labs.org/sign-up');
            await page.getByRole('textbox', { name: 'First Name' }).fill('Muhammad Wasim');
            await page.getByRole('textbox', { name: 'Last Name' }).fill('Khan');
            // Fill phone number and extension with random/fake data
            await page.getByRole('textbox', { name: '(222) 222-' }).fill(randomPhoneNumber());
            await page.getByRole('textbox', { name: 'Extension' }).fill(randomDigits(5));
            await page.getByRole('textbox', { name: 'example@website.com' }).click();
            // Use a dynamic email based on contextName and runCount
            const emailContextName = CompanyNameContext.replace(/\s+/g, '_').toLowerCase();
            const email = `wasim.khan+${emailContextName}_${runCount}@gomotive.com`;
            await page.getByRole('textbox', { name: 'example@website.com' }).fill(email);

            await page.locator('#user_password').fill('Nopass@1234');
            await page.getByText('I have read and accept the').click();
            await page.getByRole('button', { name: 'Accept' }).click();
            await page.getByRole('button', { name: 'Next' }).click();
            await page.locator('#company_name').click();

            // Company name includes WC, context, runCount, and CFS value
            const WC = `WC${envVariableLetter}`;
            const companyName = `${WC} ${CompanyNameContext} ${runCount} ${totalVehicles}`;
            await page.locator('#company_name').fill(companyName);

            // --- Use constants for address ---
            const street = '123 Main St';
            const city = 'Cleveland';
            const postalCode = randomDigits(5);
            // ---------------------------------

            await page.getByRole('textbox', { name: 'Street' }).click();
            await page.getByRole('textbox', { name: 'Street' }).fill(street);
            await page.getByRole('textbox', { name: 'City' }).fill(city);
            await page.getByRole('button', { name: 'Country' }).click();
            await page.getByRole('link', { name: 'United States' }).click();
            await page.getByRole('textbox', { name: 'Postal Code' }).fill(postalCode);
            await page.getByRole('button', { name: 'State/Province' }).click();
            await page.getByRole('link', { name: 'Alabama' }).click(); // make this dynamic if needed
            await page.getByRole('textbox', { name: 'Total Vehicles' }).click();
            await page.getByRole('textbox', { name: 'Total Vehicles' }).fill(totalVehicles.toString());
            await page.getByRole('button', { name: 'Go To Dashboard' }).click();

            // Collect for logging
            emailsUsed.push(email);
            companyNames.push(companyName);
            cfsUsed.push(totalVehicles);
        } catch (error: any) {
            failedRuns.push({ runCount, error: error?.message || String(error) });
        }
    });
}

// Log results after all tests are scheduled
test.afterAll(async () => {
    // Print summary
    console.log('\n--- Company Creation Summary ---');
    for (let i = 0; i < emailsUsed.length; i++) {
        console.log(`Run #${runStartCount + i}: Email: ${emailsUsed[i]}, Company: ${companyNames[i]}, CFS: ${cfsUsed[i]}`);
    }
    if (failedRuns.length > 0) {
        console.log('\n--- Failed Runs ---');
        for (const fail of failedRuns) {
            console.log(`Run #${fail.runCount}: Error: ${fail.error}`);
        }
    }
    console.log('--------------------------------\n');
});