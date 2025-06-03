// this has some issues right now
import 'dotenv/config';
import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

// ==== User Config ====
const totalRuns = 4;
const runStartCount = 1;
const numberOfDriversPerCompany = 5;
const environment = 'preview'; // 'preview' | 'staging'
const CompanyNameContext = 'WTest';
const driverContext = 'WComp';
const CFS = [1, 5, 10, 49, 50, 51, 750, 999, 1234];
const customBaseEmail = 'custom.email@yourdomain.com';

// ==== Flags ====
const useCFSArray = true;
const useContextName = true;
const useWasimEmailAsBaseEmail = true;
const saveSummaryToFile = true;
const createDrivers = true;

// ==== Derived Values ====
const envLetter = environment === 'preview' ? 'P' : 'S';
const baseApiDomain = environment === 'preview' ? 'p.k2labs.org' : 's.k2labs.org';
const baseEmail = useWasimEmailAsBaseEmail ? 'wasim.khan@gomotive.com' : customBaseEmail;
const [local, domain] = baseEmail.split('@');

// ==== Types ====
type DriverEntry = { fullName: string, email: string, id?: string };
type SummaryEntry = {
  timestamp: string;
  run: number;
  email: string;
  company: string;
  cfs: number;
  status: 'SUCCESS' | 'FAILED';
  authToken?: string;
  drivers?: DriverEntry[];
  error?: string;
};

// ==== Utils ====
const randomDigits = (length: number) => Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
const randomAlphaNumeric = (length: number) =>
  Array.from({ length }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random() * 62))).join('');
const randomPhone = () => (Math.floor(Math.random() * 7) + 2).toString() + randomDigits(9);
const getAuthToken = (cookies: any[]) => cookies.find(c => c.name === 'auth_token')?.value || '';

// ==== Shared Summary ====
const summaryFilePath = path.join(__dirname, `summaryFiles/${environment}_summary.json`);
if (!fs.existsSync(path.dirname(summaryFilePath))) fs.mkdirSync(path.dirname(summaryFilePath), { recursive: true });

const writeSummaryEntry = (entry: SummaryEntry) => {
  let existing: SummaryEntry[] = [];
  if (fs.existsSync(summaryFilePath)) {
    existing = JSON.parse(fs.readFileSync(summaryFilePath, 'utf-8'));
  }
  existing.push(entry);
  fs.writeFileSync(summaryFilePath, JSON.stringify(existing, null, 2));
};

// ==== Parallel Company Runs ====
test.describe.parallel('Company Creation Multi-Run', () => {
  for (let i = 0; i < totalRuns; i++) {
    const runCount = runStartCount + i;

    test(`Run #${runCount}`, async ({ browser }) => {
      const totalVehicles = useCFSArray ? CFS[i] : Math.floor(Math.random() * 10000);
      const contextName = useContextName ? CompanyNameContext : randomAlphaNumeric(6);
      const companyName = `WC${envLetter} ${contextName} ${runCount} ${totalVehicles}`;
      const email = `${local}+${contextName.toLowerCase()}_${runCount}@${domain}`;
      const timestamp = new Date().toISOString();

      const drivers: DriverEntry[] = [];
      let authToken = '';

      try {
        const context = await browser.newContext({
          httpCredentials: {
            username: process.env.AUTH_USER1 || '',
            password: process.env.AUTH_PASS1 || ''
          }
        });
        const page = await context.newPage();
        await page.goto(`https://account.${envLetter}.k2labs.org/sign-up`);

        await page.getByRole('textbox', { name: 'First Name' }).fill('Muhammad Wasim');
        await page.getByRole('textbox', { name: 'Last Name' }).fill('Khan');
        await page.getByRole('textbox', { name: '(222) 222-' }).fill(randomPhone());
        await page.getByRole('textbox', { name: 'Extension' }).fill(randomDigits(4));
        await page.getByRole('textbox', { name: 'example@website.com' }).fill(email);
        await page.locator('#user_password').fill('Nopass@1234');
        await page.getByText('I have read and accept the').click();
        await page.getByRole('button', { name: 'Accept' }).click();
        await page.getByRole('button', { name: 'Next' }).click();

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

        const cookies = await context.cookies(`https://app.${envLetter}.k2labs.org`);
        authToken = getAuthToken(cookies);

        if (createDrivers) {
          const driverPromises = Array.from({ length: numberOfDriversPerCompany }).map(async (_, idx) => {
            const suffix = randomAlphaNumeric(4);
            const fullName = `Driver${driverContext}${idx + 1} ${suffix}`;
            const email = `${local}+driver${driverContext}${idx + 1}_${suffix}@${domain}`;
            const username = `driver${idx + 1}_${suffix}_username`;

            const res = await axios.post(`https://${baseApiDomain}/api/w3/users`, {
              role: 'driver',
              first_name: `Driver${driverContext}${idx + 1}`,
              last_name: suffix,
              email,
              phone: randomPhone(),
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
                'X-Web-User-Auth': authToken
              }
            });

            const id = res.data?.id || res.data?.user_id || '';
            return { fullName, email, id };
          });

          const createdDrivers = await Promise.all(driverPromises);
          drivers.push(...createdDrivers);
        }

        const summaryEntry: SummaryEntry = {
          timestamp,
          run: runCount,
          email,
          company: companyName,
          cfs: totalVehicles,
          status: 'SUCCESS',
          authToken,
          drivers
        };

        console.log(`✅ Run ${runCount}: ${email}, Company: ${companyName}, CFS: ${totalVehicles}`);
        if (drivers.length) {
          drivers.forEach(d => console.log(`   ↳ ${d.fullName} (${d.email}) ID: ${d.id || 'N/A'}`));
        }

        writeSummaryEntry(summaryEntry);

      } catch (err: any) {
        const summaryEntry: SummaryEntry = {
          timestamp,
          run: runCount,
          email,
          company: companyName,
          cfs: totalVehicles,
          status: 'FAILED',
          error: err.message || String(err)
        };
        console.error(`❌ Run ${runCount} failed: ${summaryEntry.error}`);
        writeSummaryEntry(summaryEntry);
      }
    });
  }
});
