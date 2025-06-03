const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

// ====== CONFIGURATION ======
const config = {
  driverContext: 'Test',
  numberOfDrivers: 5,
  startCount: 15,
  authToken: 'YjQ3NGYzNzczOTNkMDNiZDc5MDYwZTk4YjEyODdmZTNiZTRhNDM5ODhiODU1ZWI0ODQ0OTljMTA1MDExZTJjYjRjMTk2YjljN2IwOWZkOGM2NzUwYTQ0NmQzMjA0YTAyYWQ2NTdhNjA1MWQ4MjY0ZA==',
  environment: 'staging', // 'preview' or 'staging'

  // Summary flags
  saveToSummaryFile: true,
  verboseLogging: true,
  summaryFileIncludeName: true,
  summaryFileIncludeEmail: true,
  summaryFileIncludeUsername: true,
  summaryFileIncludePhone: true,
  summaryFileIncludeId: true,
  summaryFileIncludeAuth: true,
  summaryFileIncludeToken: true,
  summaryFileIncludeTimestamp: true,

  // Performance tuning
  numberOfThreads: 12,
};
// ============================

const apiUrl = config.environment === 'preview'
  ? 'https://p.k2labs.org/api/w3/users'
  : 'https://s.k2labs.org/api/w3/users';

const summaryFilePath = path.join(
  __dirname,
  `${config.environment}DriverCreation.json`
);

function generatePhoneNumber() {
  let phone;
  do {
    phone = Math.floor(Math.random() * 9000000000) + 1000000000;
  } while (/^[019]/.test(phone.toString()[0]));
  phone=4086497692; //comment this if want 
  return phone.toString();
}

function generateDriver(index) {
  const random = Math.floor(Math.random() * 100000);
  const name = `Driver_${config.driverContext}_${index}_${random}`;
  const email = `wasim.khan+driver_${config.driverContext}_${index}_${random}@gomotive.com`;
  const username = `driver_${config.driverContext}_${random}_username`;
  const phone = generatePhoneNumber();

  return { name, email, username, phone };
}

async function createDriver(driver) {
  try {
    const headers = {
      'accept': 'application/json, text/plain, */*',
      'authorization': `Bearer ${config.authToken}`,
      'content-type': 'application/json',
    };

    const payload = {
      first_name: driver.name.split('_')[0],
      last_name: driver.name.split('_')[2],
      email: driver.email,
      username: driver.username,
      phone: driver.phone,
      phone_country_code: '+1',
      phone_country_iso: 'US',
      role: 'driver',
      time_zone: 'Central Time (US & Canada)',
      eld_mode: 'exempt',
      exemption_reason: 'exempt',
      cycle: 'Other',
      metric_units: false,
      manual_driving_enabled: false,
      personal_conveyance_enabled: false,
      yard_moves_enabled: false,
      time_tracking_mode: 'not_required',
      drivers_license_number: `license_${driver.name}`,
      drivers_license_state: 'AL',
      carrier_name: `WCS ${driver.name}`,
      carrier_street: '123 Main St',
      carrier_city: 'Cleveland',
      carrier_state: 'AL',
      carrier_zip: '37645',
    };

    const response = await axios.post(apiUrl, payload, { headers });
    const user = response.data.user;

    return {
      success: true,
      summary: {
        ...(config.summaryFileIncludeName && { name: driver.name }),
        ...(config.summaryFileIncludeEmail && { email: driver.email }),
        ...(config.summaryFileIncludeUsername && { username: driver.username }),
        ...(config.summaryFileIncludePhone && { phone: driver.phone }),
        ...(config.summaryFileIncludeId && { id: user.id }),
        ...(config.summaryFileIncludeAuth && { authToken: config.summaryFileIncludeAuth ? config.authToken : undefined }),
        ...(config.summaryFileIncludeTimestamp && { timestamp: new Date().toISOString() }),
      },
    };
  } catch (error) {
    const errMsg = error.response?.data?.message || error.message || 'Unknown error';
    return { success: false, error: errMsg };
  }
}

async function main() {
  const drivers = [];
  for (let i = 0; i < config.numberOfDrivers; i++) {
    drivers.push(generateDriver(config.startCount + i));
  }

  const chunkSize = Math.ceil(drivers.length / config.numberOfThreads);
  const chunks = Array.from({ length: config.numberOfThreads }, (_, i) =>
    drivers.slice(i * chunkSize, (i + 1) * chunkSize)
  );

  const results = await Promise.all(
    chunks.map(
      (chunk) =>
        new Promise((resolve, reject) => {
          const worker = new Worker(__filename, {
            workerData: { chunk, config },
          });
          worker.on('message', resolve);
          worker.on('error', reject);
        })
    )
  );

  const allSummaries = results.flat();
  const successful = allSummaries.filter((r) => r.success).map((r) => r.summary);
  const failed = allSummaries.filter((r) => !r.success);
  const uniqueErrors = [...new Set(failed.map((f) => f.error))];

  if (config.verboseLogging) {
    console.log(`\nCreated ${successful.length} drivers successfully:`);
    successful.forEach((d, i) => console.log(`  ${i + 1}. ${JSON.stringify(d)}`));
    if (failed.length) {
      console.log(`\nFailed to create ${failed.length} drivers:`);
      uniqueErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    }
  }

  const summaryEntry = {
    runStats: {
      attempted: config.numberOfDrivers,
      succeeded: successful.length,
      failed: failed.length,
      timestamp: new Date().toISOString(),
    },
    ...(config.summaryFileIncludeToken && { authToken: config.authToken }),
    drivers: successful,
    errors: uniqueErrors,
  };

  if (config.saveToSummaryFile) {
    let existingData = [];
    if (fs.existsSync(summaryFilePath)) {
      try {
        const raw = fs.readFileSync(summaryFilePath);
        existingData = JSON.parse(raw.toString());
      } catch (e) {
        console.error('Failed to read existing summary. Starting fresh.');
      }
    }
    existingData.push(summaryEntry);
    fs.writeFileSync(summaryFilePath, JSON.stringify(existingData, null, 2));
  }

  console.log(
    `\nAttempted to create ${config.numberOfDrivers} drivers: ${successful.length} succeeded, ${failed.length} failed.`
  );
  console.log(`Driver creation script finished.\n`);
}

if (isMainThread) {
  main();
} else {
  const { chunk, config } = workerData;
  Promise.all(chunk.map(createDriver)).then((res) => parentPort.postMessage(res));
}
