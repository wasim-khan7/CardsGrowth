// companyAndDriverCreator.spec.ts
import driverWorker from './driverWorker.js';
import 'dotenv/config';
import { test } from '@playwright/test';
import { Worker } from 'worker_threads';
import * as fs from 'fs';
import * as path from 'path';

// ================= USER CONFIGURATION =================
const totalCompanies = 15;
const driversPerCompany = 5;
const runStartCount = 1;
const environment = 'preview'; // 'preview' or 'staging'
const CompanyNameContext = 'RapidUpsells';
const driverContext = ''; // Leave empty to fallback to CompanyNameContext
const CFS = [1,9,10,11,49,50, 51,149,149,150,151,151, 999, 1000,1500]; // Must match totalCompanies count if useCFSArray is true

const summaryFileName = `compWithDrivers_summary_${environment}.txt`;

const maxDriverThreads = 5;

// ---------------- FLAGS ----------------
const driverCreation = false;
const useCFSArray = true;
const useContextName = true;
const useWasimEmailAsBaseEmail = true;
const customBaseEmail = 'custom.email@yourdomain.com';
const summaryFileIncludeEmail = true;
const summaryFileIncludeAuth = true;
const summaryFileIncludeToken = true;
const summaryFileIncludeUsername = true;
const summaryFileIncludeName = true;
const saveToSummaryFile = true;
const verboseLogging = false;
// =======================================================

const envLetter = environment === 'preview' ? 'P' : environment === 'staging' ? 'S' : '';
if (!envLetter) throw new Error('Environment must be "preview" or "staging"');
if (useCFSArray && CFS.length < totalCompanies)
  throw new Error('CFS length must match totalCompanies when useCFSArray is true');

function randomDigits(length: number) {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}
function randomPhone() {
  return `${Math.floor(Math.random() * 7 + 2)}${randomDigits(9)}`;
}
function randomAlphaNumeric(length: number) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}
function getAuthTokenFromCookies(cookies: any[]): string {
  const tokenCookie = cookies.find(c => c.name === 'auth_token');
  if (!tokenCookie) throw new Error('Auth token not found in cookies');
  return tokenCookie.value;
}

const companies: any[] = [];
const runTimestamp = new Date();

for (let i = 0; i < totalCompanies; i++) {
  const runIndex = runStartCount + i;
  const totalVehicles = useCFSArray ? CFS[i] : Math.floor(Math.random() * 100 + 1);
  const contextName = useContextName ? CompanyNameContext : randomAlphaNumeric(6);
  const baseEmail = useWasimEmailAsBaseEmail ? 'wasim.khan@gomotive.com' : customBaseEmail;

  test(`Create Company #${runIndex}`, async ({ browser }) => {
    const summary: any = { run: runIndex, cfs: totalVehicles, status: 'FAILED', drivers: [] };
    const context = await browser.newContext({
      httpCredentials: {
        username: process.env.AUTH_USER1 || '',
        password: process.env.AUTH_PASS1 || ''
      }
    });
    const page = await context.newPage();

    try {
      await page.goto(`https://account.${envLetter}.k2labs.org/sign-up`);
      await page.getByRole('textbox', { name: 'First Name' }).fill('Wasim');
      await page.getByRole('textbox', { name: 'Last Name' }).fill('Khan');
      await page.getByRole('textbox', { name: '(222) 222-' }).fill(randomPhone());
      await page.getByRole('textbox', { name: 'Extension' }).fill(randomDigits(4));

      const contextSlug = contextName.replace(/\s+/g, '_').toLowerCase();
      const [local, domain] = baseEmail.split('@');
      const email = `${local}+${contextSlug}_${runIndex}@${domain}`;
      await page.getByRole('textbox', { name: 'example@website.com' }).fill(email);

      await page.locator('#user_password').fill('Nopass@1234');
      await page.getByText('I have read and accept the').click();
      await page.getByRole('button', { name: 'Next' }).click();
      await page.locator('#company_name').fill(`WC${envLetter} ${contextName} ${runIndex} ${totalVehicles}`);
      await page.getByRole('textbox', { name: 'Street' }).fill('123 Main St');
      await page.getByRole('textbox', { name: 'City' }).fill('Cleveland');
      await page.getByRole('button', { name: 'Country' }).click();
      await page.getByRole('link', { name: 'United States' }).click();
      await page.getByRole('textbox', { name: 'Postal Code' }).fill(randomDigits(5));
      await page.getByRole('button', { name: 'State/Province' }).click();
      await page.getByRole('link', { name: 'Alabama' }).click();
      await page.getByRole('textbox', { name: 'Total Vehicles' }).fill(`${totalVehicles}`);
      await page.getByRole('button', { name: 'Go To Dashboard' }).click();
      await page.waitForLoadState('networkidle');

      const cookies = await context.cookies(`https://app.${envLetter.toLowerCase()}.k2labs.org`);
      const authToken = getAuthTokenFromCookies(cookies);

      summary.status = 'SUCCESS';
      summary.email = email;
      summary.company = `WC${envLetter} ${contextName} ${runIndex} ${totalVehicles}`;
      summary.authToken = authToken;

      if (driverCreation && authToken) {
        await createDriversParallel(authToken, summary.company, runIndex, summary);
      }
    } catch (err: any) {
      summary.status = 'FAILED';
      summary.error = err.message || String(err);
    } finally {
      companies.push(summary);
      await context.close();
    }
  });
}

test.afterAll(async () => {
  logAndSaveSummary(companies);
});

function logAndSaveSummary(entries: any[]) {
  const readable = runTimestamp.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const iso = runTimestamp.toISOString();
  let text = `\n=== Run at ${readable}  ${iso} ===\n`;

  for (const entry of entries) {
    if (entry.status === 'SUCCESS') {
      text += `Company: ${entry.company}, Email: ${entry.email}, CFS: ${entry.cfs}`;
      if (summaryFileIncludeAuth) text += `, AuthToken: ${entry.authToken}`;
      text += `\nDrivers created:`;
      if (entry.drivers.length > 0) {
        for (const d of entry.drivers) {
          text += `\n  - ${d.name || ''} ${summaryFileIncludeEmail ? `| ${d.email}` : ''} ${d.id ? `| ID: ${d.id}` : ''} | Status: ${d.status}`;
          if (d.error) text += ` | Error: ${d.error}`;
        }
      } else {
        text += ` None`;
      }
    } else {
      text += `Company: ${entry.company || 'Unknown'}, Email: ${entry.email || 'N/A'}, CFS: ${entry.cfs}, Creation status: Failed. Error info: ${entry.error}`;
    }
    text += `\n=============================\n`;
  }

  if (saveToSummaryFile) {
    const dir = path.join(__dirname, 'summaryFiles');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    fs.appendFileSync(path.join(dir, summaryFileName), text, 'utf-8');
  }

  console.log(text);
}

async function createDriversParallel(token: string, company: string, runNum: number, summary: any) {
  return new Promise<void>((resolve, reject) => {
    console.log('path.resolve gets this --> ',path.resolve(__dirname, './driverWorker.js'))
const worker = new Worker(path.resolve(__dirname, './driverWorker.js'), {      
  workerData: {
        authToken: token,
        runNumber: runNum,
        companyContext: company,
        driverContext: driverContext || CompanyNameContext,
        numDrivers: driversPerCompany,
        env: environment,
        summaryFileName,
        flags: {
          summaryFileIncludeEmail,
          summaryFileIncludeAuth,
          summaryFileIncludeToken,
          summaryFileIncludeUsername,
          summaryFileIncludeName,
          saveToSummaryFile,
          verboseLogging
        }
      }
    });

    worker.on('message', (msg) => {
      if (Array.isArray(msg)) summary.drivers = msg;
      if (verboseLogging) console.log(`Driver Worker Done for Company ${company}`, msg);
      resolve();
    });

    worker.on('error', (err) => {
      summary.drivers.push({ status: 'FAILED', error: err.message });
      reject(err);
    });
  });
}
