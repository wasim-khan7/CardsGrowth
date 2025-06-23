// works fine
import 'dotenv/config'; // Load environment variables from .env
import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ---- User configuration section ----
let totalRuns = 1;
let runStartCount = 2;
let environment = 'staging'; // 'preview' or 'staging'
let CompanyNameContext = 'wtest';
const CFS = [1, 50, 150, 999];

// Flags
const useCFSArray = true;
const useContextName = true;
const useWasimEmailAsBaseEmail = true;
const customBaseEmail = 'custom.email@yourdomain.com';
const saveSummaryToFile = true;

// Environment checks
const envVariableLetter = environment === 'preview' ? 'P' : environment === 'staging' ? 'S' : '';
if (!envVariableLetter) {
    throw new Error('Environment must be "preview" or "staging"');
}
if (useContextName && !CompanyNameContext) {
    throw new Error('CompanyNameContext must be set if useContextName is true');
}
if (useCFSArray && CFS.length < totalRuns) {
    throw new Error('CFS array length must be at least as large as totalRuns');
}

// Helpers
function randomDigits(length: number) {
    return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}

function randomPhoneNumber() {
    const firstDigit = Math.floor(Math.random() * 7) + 2;
    return firstDigit.toString() + randomDigits(9);
}

function randomAlphaNumeric(length: number) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

// Summary data
type SummaryEntry = {
    run: number,
    email: string,
    company: string,
    cfs: number,
    status: 'SUCCESS' | 'FAILED',
    error?: string
};
const summary: SummaryEntry[] = [];

// Main test loop
for (let i = 0; i < totalRuns; i++) {
    const runCount = runStartCount + i;
    const totalVehicles = useCFSArray ? CFS[i] : Number(randomDigits(2)) + 1;

    const contextName = useContextName ? CompanyNameContext : randomAlphaNumeric(8);
    const baseEmail = useWasimEmailAsBaseEmail ? 'parag.goyal@gomotive.com' : customBaseEmail;

test(`Company Creation Run ${runCount}`, async ({ browser }) => {
    let email = '';
    let companyName = '';
    try {
        const context = await browser.newContext();
        const page = await context.newPage();
        await context.setHTTPCredentials({
            username: process.env.AUTH_USER1,
            password: process.env.AUTH_PASS1
        });
        await page.goto(`https://account.${envVariableLetter}.k2labs.org/sign-up`);
        await context.setHTTPCredentials({
            username: process.env.AUTH_USER2,
            password: process.env.AUTH_PASS2
        });
        await page.getByRole('textbox', { name: 'First Name' }).fill('Muhammad Wasim');
        await page.getByRole('textbox', { name: 'Last Name' }).fill('Khan');
        await page.getByRole('textbox', { name: '(222) 222-' }).fill(randomPhoneNumber());
        await page.getByRole('textbox', { name: 'Extension' }).fill(randomDigits(5));
        await page.getByRole('textbox', { name: 'example@website.com' }).click();

        const emailContextName = contextName.replace(/\s+/g, '_').toLowerCase();
        const [local, domain] = baseEmail.split('@');
        email = `${local}+${emailContextName}_${runCount}@${domain}`;
        await page.getByRole('textbox', { name: 'example@website.com' }).fill(email);

        await page.locator('#user_password').fill('Nopass@1234');
        await page.getByText('I have read and accept the').click();
        await page.getByRole('button', { name: 'Next' }).click();
        await page.locator('#company_name').click();

        const WC = `WC${envVariableLetter}`;
        companyName = `${WC} ${contextName} ${runCount} ${totalVehicles}`;
        await page.locator('#company_name').fill(companyName);

        const street = '123 Main St';
        const city = 'Cleveland';
        const postalCode = randomDigits(5);

        await page.getByRole('textbox', { name: 'Street' }).fill(street);
        await page.getByRole('textbox', { name: 'City' }).fill(city);
        await page.getByRole('button', { name: 'Country' }).click();
        await page.getByRole('link', { name: 'United States' }).click();
        await page.getByRole('textbox', { name: 'Postal Code' }).fill(postalCode);
        await page.getByRole('button', { name: 'State/Province' }).click();
        await page.getByRole('link', { name: 'Alabama' }).click();
        await page.getByRole('textbox', { name: 'Total Vehicles' }).fill(totalVehicles.toString());
        await page.getByRole('button', { name: 'Go To Dashboard' }).click();
        await page.waitForTimeout(10000);
        await page.waitForLoadState('networkidle');

        summary.push({ run: runCount, email, company: companyName, cfs: totalVehicles, status: 'SUCCESS' });
    } catch (error: any) {
        summary.push({ run: runCount, email, company: companyName, cfs: totalVehicles, status: 'FAILED', error: error?.message || String(error) });
    } finally {
        printSummary();
    }
});
}

// Print summary to console
function printSummary() {
    console.log('\n--- Company Creation Summary ---');
    for (const entry of summary) {
        if (entry.status === 'SUCCESS') {
            console.log(`Run #${entry.run}: Email: ${entry.email}, Company: ${entry.company}, CFS: ${entry.cfs}, Status: SUCCESS`);
        } else {
            console.log(`Run #${entry.run}: Email: ${entry.email}, Company: ${entry.company}, CFS: ${entry.cfs}, Status: FAILED, Error: ${entry.error}`);
        }
    }
    console.log('--------------------------------\n');
}

// Save summary to one file per environment (append mode with timestamp)
function saveSummaryFile(envName: string) {
    const summaryDir = path.join(__dirname, 'summaryFiles');
    if (!fs.existsSync(summaryDir)) {
        fs.mkdirSync(summaryDir);
    }

    const fileName = `company_creation_${envName.toLowerCase()}.txt`;
    const filePath = path.join(summaryDir, fileName);

    const timestamp = new Date().toISOString();
    let fileContent = `\n=== Summary Entry: ${timestamp} ===\n`;
    for (const entry of summary) {
        if (entry.status === 'SUCCESS') {
            fileContent += `Run #${entry.run}: Email: ${entry.email}, Company: ${entry.company}, CFS: ${entry.cfs}, Status: SUCCESS\n`;
        } else {
            fileContent += `Run #${entry.run}: Email: ${entry.email}, Company: ${entry.company}, CFS: ${entry.cfs}, Status: FAILED, Error: ${entry.error}\n`;
        }
    }
    fileContent += '====================================\n';

    fs.appendFileSync(filePath, fileContent, 'utf8');
    console.log(`Summary updated at: ${filePath}`);
}

// After all tests
test.afterAll(async () => {
    printSummary();
    if (saveSummaryToFile) {
        saveSummaryFile(environment);
    }
});
