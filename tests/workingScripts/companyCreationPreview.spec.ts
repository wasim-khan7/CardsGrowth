// works fine
import 'dotenv/config'; // Load environment variables from .env
import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ---- User configuration section ----
let totalRuns = 3;
let runStartCount = 1;
let environment = 'preview'; // 'preview' or 'staging'
let CompanyNameContext = 'testingScript3';
const CFS = [1, 5, 10];

// Flags
const useCFSArray = true;
const useContextName = true;
const useWasimEmailAsBaseEmail = true;
const customBaseEmail = 'custom.email@yourdomain.com';
const saveSummaryToFile = true;

// Environment checks
const envVariableLetter = environment === 'preview' ? 'p' : environment === 'staging' ? 's' : '';
if (!envVariableLetter) throw new Error('Environment must be "preview" or "staging"');
if (useContextName && !CompanyNameContext) throw new Error('CompanyNameContext must be set if useContextName is true');
if (useCFSArray && CFS.length < totalRuns) throw new Error('CFS array length must be at least as large as totalRuns');

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
interface SummaryEntry {
  run: number;
  email: string;
  company: string;
  cfs: number;
  status: 'SUCCESS' | 'FAILED';
  company_id?: string;
  dispatcher_id?: string;
  dispatcher_link?: string;
  error?: string;
}
const summary: SummaryEntry[] = [];

// Main test loop
for (let i = 0; i < totalRuns; i++) {
  const runCount = runStartCount + i;
  const totalVehicles = useCFSArray ? CFS[i] : Number(randomDigits(2)) + 1;
  const contextName = useContextName ? CompanyNameContext : randomAlphaNumeric(8);
  const baseEmail = useWasimEmailAsBaseEmail ? 'wasim.khan@gomotive.com' : customBaseEmail;

  test(`Company Creation Run ${runCount}`, async ({ browser }) => {
    let email = '';
    let companyName = '';
    const summaryEntry: SummaryEntry = { run: runCount, email: '', company: '', cfs: totalVehicles, status: 'FAILED' };

    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      await context.setHTTPCredentials({ username: process.env.AUTH_USER1, password: process.env.AUTH_PASS1 });
      await page.goto(`https://account.${envVariableLetter}.k2labs.org/sign-up`);
      await context.setHTTPCredentials({ username: process.env.AUTH_USER2, password: process.env.AUTH_PASS2 });

      await page.locator('#user_first_name').fill('Muhammad Wasim');
      await page.locator('#user_last_name').fill('Khan');
      await page.getByRole('textbox', { name: '(222) 222-' }).fill(randomPhoneNumber());
      await page.getByRole('textbox', { name: 'Extension' }).fill(randomDigits(5));

      const emailContextName = contextName.replace(/\s+/g, '_').toLowerCase();
      const [local, domain] = baseEmail.split('@');
      email = `${local}+${emailContextName}_${runCount}@${domain}`;
      await page.getByRole('textbox', { name: 'example@website.com' }).fill(email);

      await page.locator('#user_password').fill('Nopass@1234');
      await page.getByRole('checkbox', { name: 'I have read and accept the' }).check();
      await page.getByRole('button', { name: 'Next' }).click();

      await page.locator('#company_name').click();

      const WC = `WC${envVariableLetter}`;
      companyName = `${WC} ${contextName} ${runCount} ${totalVehicles}`;
      await page.locator('#company_name').fill(companyName);

      const street = '123 Main St';
      const city = 'Cleveland';
      const postalCode = randomDigits(5);
      await page.getByRole('group').filter({ hasText: 'Country* United States Canada' }).getByRole('button').click();
      await page.getByRole('link', { name: 'United States' }).click();
      await page.locator('#company_street').fill(street);
      await page.locator('#company_city').fill(city);
      await page.getByRole('button', { name: 'Select' }).click();
      await page.getByRole('link', { name: 'Indiana' }).click();
      await page.locator('#zip_code').fill(postalCode);
      await page.locator('#company_fleet_size').fill(totalVehicles.toString());
      const acceptButton = page.getByRole('button', { name: 'Accept' });
      try {
        if (await acceptButton.isVisible({ timeout: 5000 })) {
          await acceptButton.click();
        }
      } catch (e) {
        console.log('Accept button not found or not visible, continuing...');
      }

      let validateJson: any;

      page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/sessions/validate') && response.request().method() === 'GET') {
          const status = response.status();
          console.log(`Validate call for run #${runCount}: ${status} ${url}`);
          try {
            const body = await response.json();
            if (body?.user?.company_connection?.company_id && body?.user?.id) {
              validateJson = body;
            }
          } catch (err) {
            // Skip logging body or full error
          }
        }
      });

      await page.getByRole('button', { name: 'Go To Dashboard' }).click();
      await page.waitForTimeout(8000);

      if (!validateJson) throw new Error('Validate response not found or could not parse.');

      const company_id = validateJson?.user?.company_connection?.company_id?.toString();
      const dispatcher_id = validateJson?.user?.id?.toString();

      summaryEntry.status = 'SUCCESS';
      summaryEntry.email = email;
      summaryEntry.company = companyName;
      summaryEntry.cfs = totalVehicles;
      summaryEntry.company_id = company_id;
      summaryEntry.dispatcher_id = dispatcher_id;
      summaryEntry.dispatcher_link = company_id && dispatcher_id
        ? `https://account.${envVariableLetter}.k2labs.org/admin/dispatchers/${dispatcher_id}`
        : undefined;
    } catch (error: any) {
      summaryEntry.status = 'FAILED';
      summaryEntry.email = email;
      summaryEntry.company = companyName;
      summaryEntry.error = error?.message || String(error);
    } finally {
      summary.push(summaryEntry);
    }
  });
}

// Final sorted and grouped summary
function printSummary() {
  console.log('\n=== Final Company Creation Summary ===');
  const sorted = [...summary].sort((a, b) => a.run - b.run);
  for (const entry of sorted) {
    console.log(`Run #${entry.run}:`);
    console.log(`  Email: ${entry.email}`);
    console.log(`  Company: ${entry.company}`);
    console.log(`  CFS: ${entry.cfs}`);
    console.log(`  Status: ${entry.status}`);
    if (entry.status === 'SUCCESS') {
      console.log(`  Company ID: ${entry.company_id}`);
      console.log(`  Dispatcher ID: ${entry.dispatcher_id}`);
      console.log(`  Dispatcher Admin Link: ${entry.dispatcher_link}`);
    } else {
      console.log(`  Error: ${entry.error}`);
    }
  }
  console.log('====================================\n');
}

function saveSummaryFile(envName: string) {
  const summaryDir = path.join(__dirname, 'summaryFiles');
  if (!fs.existsSync(summaryDir)) fs.mkdirSync(summaryDir);

  const fileName = `company_creation_${envName.toLowerCase()}.txt`;
  const filePath = path.join(summaryDir, fileName);
  const timestamp = new Date().toISOString();
  let fileContent = `\n=== Summary Entry: ${timestamp} ===\n`;

  const sorted = [...summary].sort((a, b) => a.run - b.run);
  for (const entry of sorted) {
    fileContent += `Run #${entry.run}:
`;
    fileContent += `  Email: ${entry.email}
`;
    fileContent += `  Company: ${entry.company}
`;
    fileContent += `  CFS: ${entry.cfs}
`;
    fileContent += `  Status: ${entry.status}
`;
    if (entry.status === 'SUCCESS') {
      fileContent += `  Company ID: ${entry.company_id}
`;
      fileContent += `  Dispatcher ID: ${entry.dispatcher_id}
`;
      fileContent += `  Dispatcher Admin Link: ${entry.dispatcher_link}
`;
    } else {
      fileContent += `  Error: ${entry.error}
`;
    }
  }
  fileContent += '====================================\n';
  fs.appendFileSync(filePath, fileContent, 'utf8');
  console.log(`Summary updated at: ${filePath}`);
}

test.afterAll(async () => {
  printSummary();
  if (saveSummaryToFile) saveSummaryFile(environment);
});