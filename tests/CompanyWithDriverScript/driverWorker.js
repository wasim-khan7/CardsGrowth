// driverWorker.js
const { workerData, parentPort } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const https = require('https');

const {
  authToken,
  runNumber,
  companyContext,
  driverContext,
  numDrivers,
  env,
  summaryFileName,
  flags
} = workerData;

const {
  summaryFileIncludeEmail,
  summaryFileIncludeAuth,
  summaryFileIncludeToken,
  summaryFileIncludeUsername,
  summaryFileIncludeName,
  saveToSummaryFile,
  verboseLogging
} = flags;

const apiBaseUrl = env === 'preview'
  ? 'https://p.k2labs.org/api/w3/users'
  : env === 'staging'
    ? 'https://s.k2labs.org/api/w3/users'
    : null;

if (!apiBaseUrl) {
  parentPort.postMessage([{ status: 'FAILED', error: 'Invalid environment specified' }]);
  return;
}

function randomDigits(length) {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}

function randomPhone() {
  return `${Math.floor(Math.random() * 7 + 2)}${randomDigits(9)}`;
}

function randomName() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const name = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function createDriver(index) {
  return new Promise((resolve) => {
    const name = `Driver ${driverContext} ${runNumber}_${index}_${randomDigits(3)}`;
    const email = `wasim.khan+driver+${driverContext}_${runNumber}_${index}_${randomDigits(3)}@gomotive.com`;
    const postData = JSON.stringify({
  role: 'driver',
  first_name: name.split(' ')[0],
  last_name: name.split(' ').slice(1).join(' ') || 'Last',
  email,
  username: `driver${randomDigits(5)}`,
  password: 'Nopass@1234',
  phone: randomPhone(),
  phone_country_code: '+1',
  phone_country_iso: 'US',
  carrier_name: companyContext || 'Default Carrier Inc.',
  carrier_street: '123 Main St',
  carrier_city: 'Cleveland',
  carrier_state: 'AL',
  carrier_zip: '00952',
  terminal_street: '',
  terminal_city: '',
  terminal_state: '',
  terminal_zip: '',
  time_zone: 'Central Time (US & Canada)',
  eld_mode: 'exempt',
  exemption_reason: 'ExemptReason',
  dot_id: '',
  drivers_license_number: `DL${randomDigits(6)}`,
  drivers_license_state: 'AL',
  time_tracking_mode: 'not_required'
});

    console.log('postData:', postData);
    const req = https.request(apiBaseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        const result = { name, email, status: 'FAILED' };
        try {
          const json = JSON.parse(data);
          if (res.statusCode === 201 && json.id) {
            result.id = json.id;
            result.status = 'SUCCESS';
          } else {
            result.error = json.message || JSON.stringify(json);
          }
        } catch (e) {
          result.error = 'Invalid JSON response';
        }
        if (verboseLogging) console.log(`Driver ${index} result:`, result);
        resolve(result);
      });
    });

    req.on('error', (err) => {
      resolve({ name, email, status: 'FAILED', error: err.message });
    });

    req.write(postData);
    req.end();
  });
}

(async () => {
  const results = [];
  for (let i = 1; i <= numDrivers; i++) {
    results.push(await createDriver(i));
  }

  if (saveToSummaryFile) {
    const dir = path.join(__dirname, 'summaryFiles');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    const text = results.map((d) => {
      let line = `Driver: `;
      if (summaryFileIncludeName) line += `${d.name} `;
      if (summaryFileIncludeEmail) line += `| Email: ${d.email} `;
      if (summaryFileIncludeUsername && d.username) line += `| Username: ${d.username} `;
      if (d.id) line += `| ID: ${d.id} `;
      line += `| Status: ${d.status}`;
      if (d.error) line += ` | Error: ${d.error}`;
      return line;
    }).join('\n') + '\n';

    fs.appendFileSync(path.join(dir, summaryFileName), text, 'utf-8');
  }

  parentPort.postMessage(results);
})();
