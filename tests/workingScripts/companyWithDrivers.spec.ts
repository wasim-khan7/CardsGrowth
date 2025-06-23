// this is working fine
import 'dotenv/config';
import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

// ---- User configuration section ----
let totalRuns = 1;
let runStartCount = 1;
const numberOfDriversPerCompany = 2;
let environment = 'preview'; // 'preview' or 'staging'
let CompanyNameContext = 'RUEnt120';
let driverContext = 'RUEnt120';
const CFS = [50,150,151,800];
const customBaseEmail = 'custom.email@yourdomain.com';


// Flags
const useCFSArray = true;
const useContextName = true;
const useWasimEmailAsBaseEmail = true;
const saveSummaryToFile = true;
const createDrivers = true;

// --- Environment checks ---
const envVariableLetter = environment === 'preview' ? 'P' : environment === 'staging' ? 'S' : '';
if (!envVariableLetter) throw new Error('Environment must be "preview" or "staging"');
const baseApiDomain = environment === 'preview' ? 'p.k2labs.org'
                    : environment === 'staging' ? 's.k2labs.org'
                    : (() => { throw new Error('Unsupported environment'); })();

if (useContextName && !CompanyNameContext) throw new Error('CompanyNameContext must be set if useContextName is true');
if (useCFSArray && CFS.length < totalRuns) throw new Error('CFS array length must be at least as large as totalRuns');

// --- Helper functions ---
function randomDigits(length: number) {
    return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}

function randomAlphaNumeric(length: number) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

function randomPhoneNumber() {
    const firstDigit = Math.floor(Math.random() * 7) + 2; // 2-8
    return firstDigit.toString() + randomDigits(9);
}

function getAuthTokenFromCookies(cookies: any[]): string {
    const tokenCookie = cookies.find(c => c.name === 'auth_token');
    if (!tokenCookie) throw new Error('Auth token not found in cookies');
    return tokenCookie.value;
}

// --- Types and summary ---
type DriverEntry = { fullName: string, email: string };
type SummaryEntry = {
    run: number,
    email: string,
    company: string,
    cfs: number,
    status: 'SUCCESS' | 'FAILED',
    drivers?: DriverEntry[],
    error?: string
};
const summary: SummaryEntry[] = [];

// --- Main test ---
test('Company Creation Multi-Run', async ({ browser }) => {
    for (let i = 0; i < totalRuns; i++) {
        const runCount = runStartCount + i;
        const totalVehicles = useCFSArray ? CFS[i] : Math.floor(Math.random() * 10000);
        const contextName = useContextName ? CompanyNameContext : randomAlphaNumeric(8);
        const baseEmail = useWasimEmailAsBaseEmail ? 'wasim.khan@gomotive.com' : customBaseEmail;

        let email = '';
        let companyName = '';
        const drivers: DriverEntry[] = [];

        try {
            const context = await browser.newContext({
                httpCredentials: {
                    username: process.env.AUTH_USER1 || '',
                    password: process.env.AUTH_PASS1 || ''
                }
            });
            const page = await context.newPage();
            await page.goto(`https://account.${envVariableLetter}.k2labs.org/sign-up`);

            await page.getByRole('textbox', { name: 'First Name' }).fill('Muhammad Wasim');
            await page.getByRole('textbox', { name: 'Last Name' }).fill('Khan');
            await page.getByRole('textbox', { name: '(222) 222-' }).fill(randomPhoneNumber());
            await page.getByRole('textbox', { name: 'Extension' }).fill(randomDigits(5));

            const emailContextName = contextName.replace(/\s+/g, '_').toLowerCase();
            const [local, domain] = baseEmail.split('@');
            email = `${local}+${emailContextName}_${runCount}@${domain}`;
            await page.getByRole('textbox', { name: 'example@website.com' }).fill(email);

            await page.locator('#user_password').fill('Nopass@1234');
            await page.getByText('I have read and accept the').click();
            await page.getByRole('button', { name: 'Accept' }).click();
            await page.getByRole('button', { name: 'Next' }).click();

            const WC = `WC${envVariableLetter}`;
            companyName = `${WC} ${contextName} ${runCount} ${totalVehicles}`;
            await page.locator('#company_name').fill(companyName);

            await page.getByRole('textbox', { name: 'Street' }).fill('123 Main St');
            await page.getByRole('textbox', { name: 'City' }).fill('Cleveland');
            await page.getByRole('button', { name: 'Country' }).click();
            await page.getByRole('link', { name: 'United States' }).click();
            await page.getByRole('textbox', { name: 'Postal Code' }).fill(randomDigits(5));
            await page.getByRole('button', { name: 'State/Province' }).click();
            await page.getByRole('link', { name: 'Alabama' }).click();
            await page.getByRole('textbox', { name: 'Total Vehicles' }).fill(totalVehicles.toString());
            await page.getByRole('button', { name: 'Go To Dashboard' }).click();
            await page.waitForLoadState('networkidle');

            if (createDrivers) {
                const cookies = await context.cookies(`https://app.${envVariableLetter.toLowerCase()}.k2labs.org`);
                const authToken = getAuthTokenFromCookies(cookies);

                for (let d = 1; d <= numberOfDriversPerCompany; d++) {
                    const suffix = randomAlphaNumeric(4);
                    const driverFullName = `Driver${driverContext}${d} ${suffix}`;
                    const driverEmail = `${local}+driver${driverContext}${d}_${suffix}@${domain}`;
                    const username = `driver${d}_${suffix}_username`;

                    await axios.post(`https://${baseApiDomain}/api/w3/users`, {
                        role: 'driver',
                        first_name: `Driver${driverContext}${d}`,
                        last_name: suffix,
                        email: driverEmail,
                        phone: randomPhoneNumber(),
                        phone_country_code: '+1',
                        phone_country_iso: 'US',
                        username,
                        password: 'Nopass@1234',
                        dot_id: '',
                        carrier_name: companyName,
                        carrier_street: '123 Main St',
                        carrier_city: 'Cleveland',
                        carrier_state: 'AL',
                        carrier_zip: '00952',
                        time_zone: 'Central Time (US & Canada)',
                        eld_mode: 'exempt',
                        force_eld_mode_changes: false,
                        exemption_reason: 'ExemptReason',
                        drivers_license_number: `DL${suffix}`,
                        time_tracking_mode: 'not_required'
                    }, {
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Web-User-Auth': authToken
                        }
                    });

                    drivers.push({ fullName: driverFullName, email: driverEmail });
                }
            }

            summary.push({ run: runCount, email, company: companyName, cfs: totalVehicles, status: 'SUCCESS', drivers });
        } catch (error: any) {
            summary.push({ run: runCount, email, company: companyName, cfs: totalVehicles, status: 'FAILED', error: error?.message || String(error) });
        }
    }
});

// --- Summary + Save ---
test.afterAll(async () => {
    console.log('\n--- Company Creation Summary ---');
    for (const entry of summary) {
        if (entry.status === 'SUCCESS') {
            console.log(`Run #${entry.run}: Email: ${entry.email}, Company: ${entry.company}, CFS: ${entry.cfs}`);
            if (entry.drivers) {
                for (const driver of entry.drivers) {
                    console.log(`   - ${driver.fullName}, Email: ${driver.email}`);
                }
            }
        } else {
            console.log(`Run #${entry.run}: FAILED, Error: ${entry.error}`);
        }
    }

    if (saveSummaryToFile && summary.length > 0) {
        const lastContextName = summary[summary.length - 1].company.split(' ')[1];
        const summaryDir = path.join(__dirname, 'summaryFiles');
        if (!fs.existsSync(summaryDir)) fs.mkdirSync(summaryDir);
        const baseName = lastContextName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
        let fileName = `${baseName}_summary.txt`;
        let filePath = path.join(summaryDir, fileName);
        let suffix = 1;
        while (fs.existsSync(filePath)) {
            fileName = `${baseName}_summary_${suffix}.txt`;
            filePath = path.join(summaryDir, fileName);
            suffix++;
        }

        let fileContent = '--- Company Creation Summary ---\n';
        for (const entry of summary) {
            fileContent += `Run #${entry.run}: Email: ${entry.email}, Company: ${entry.company}, CFS: ${entry.cfs}\n`;
            if (entry.drivers) {
                for (const driver of entry.drivers) {
                    fileContent += `   - ${driver.fullName}, Email: ${driver.email}\n`;
                }
            }
        }
        fileContent += '--------------------------------\n';
        fs.writeFileSync(filePath, fileContent, 'utf8');
        console.log(`Summary saved to: ${filePath}`);
    }
});
