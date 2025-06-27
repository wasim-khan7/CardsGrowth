const axios = require('axios');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');
const fs = require('fs');
const path = require('path');

const DRIVER_CREATION_THREADS = 4; // adjust as needed

const config = {
  driverContext: 'san24jun',
  numDrivers: 5,
  startCount: 1,
  authToken: 'OGQ3NjVhYjkwNjFjMGQ5ZDJkOTAwMmRjMWJlZDdlM2IzNTMyMTM0NGViZDkxODdmOWE3OGY0OWQ3NTk4YTYxZTJiYmE0YzA3M2JjZjcyYzc3NDk4NWNlZDJlMjY1MDA4NTNhODAzZDhlMGQyMWY4Nw==',
  environment: 'staging', // or 'preview'
};

const getBaseUrl = (env) => {
  if (env === 'preview') return 'https://p.k2labs.org';
  if (env === 'staging') return 'https://s.k2labs.org';
  throw new Error('Invalid environment');
};

const createDriver = async (index, context, token, env) => {
  const random = Math.floor(Math.random() * 100000);
  const name = `Driver_${context}_${index}_${random}`;
  const email = `wasim.khan+driver+${context}+${index}+${random}@gomotive.com`;
//   const phone = `3${Math.floor(100000000 + Math.random() * 899999999)}`; //if want random use this
    // const phone = '4086497692'; // Use a fixed phone number for sms testing
    const phone = '8057651210'; // Use 2nd fixed phone number for sms testing
    const baseUrl = getBaseUrl(env);

  const payload = {
    cycle: 'Other',
    role: 'driver',
    first_name: 'driver',
    last_name: `${context}_${index}`,
    email,
    phone,
    phone_country_code: '+1',
    phone_country_iso: 'US',
    username: `${context}_${index}_username`,
    password: 'Nopass@1234',
    dot_id: '',
    carrier_name: `WCS ${context} ${index} ${random}`,
    carrier_street: '123 Main St',
    carrier_city: 'Cleveland',
    carrier_state: 'AL',
    carrier_zip: '37645',
    terminal_street: '',
    terminal_city: '',
    terminal_state: '',
    terminal_zip: '',
    joined_at: null,
    driver_company_id: `driver${index}_id`,
    time_zone: 'Central Time (US & Canada)',
    eld_mode: 'exempt',
    minute_logs: false,
    force_eld_mode_changes: false,
    exemption_reason: 'exempt',
    drivers_license_number: `driver${index}_license`,
    drivers_license_state: 'AL',
    time_tracking_mode: 'not_required'
  };

  try {
    const response = await axios.post(`${baseUrl}/api/w3/users`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Web-User-Auth': token,
        'Origin': `https://app.${env === 'staging' ? 's' : 'p'}.k2labs.org`,
        'Referer': `https://app.${env === 'staging' ? 's' : 'p'}.k2labs.org/`,
      },
    });

    return {
      name,
      email,
      id: response.data?.id || response.data?.user_id || 'unknown',
    };
  } catch (err) {
    return {
      name,
      email,
      id: null,
      error: err.response?.data || err.message,
    };
  }
};

if (isMainThread) {
  const { driverContext, numDrivers, startCount, authToken, environment } = config;
  const driversPerThread = Math.ceil(numDrivers / DRIVER_CREATION_THREADS);
  const results = [];
  let completed = 0;
  const summaryPath = path.join(__dirname, `${environment}DriverSummary.json`);

  console.log(`🚀 Creating ${numDrivers} drivers using ${DRIVER_CREATION_THREADS} threads...\n`);

  for (let i = 0; i < DRIVER_CREATION_THREADS; i++) {
    const start = startCount + i * driversPerThread;
    const end = Math.min(start + driversPerThread - 1, startCount + numDrivers - 1);

    const worker = new Worker(__filename, {
      workerData: {
        from: start,
        to: end,
        context: driverContext,
        token: authToken,
        env: environment,
      },
    });

    worker.on('message', (msg) => {
      results.push(...msg);
      completed++;
      if (completed === DRIVER_CREATION_THREADS) {
        console.log('\n✅ Driver creation summary:\n');

        results.forEach((d, i) => {
          if (d.id) {
            console.log(`${i + 1}. ✅ ${d.name} | ${d.email} | ID: ${d.id}`);
          } else {
            console.log(`${i + 1}. ❌ ${d.name} | ${d.email} | ERROR: ${JSON.stringify(d.error)}`);
          }
        });

        const successful = results.filter(d => d.id);
        let previous = [];

        if (fs.existsSync(summaryPath)) {
          try {
            previous = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
          } catch (e) {
            console.warn(`⚠️ Failed to parse existing summary file: ${summaryPath}`);
          }
        }

        const updated = [...successful, ...previous];
        fs.writeFileSync(summaryPath, JSON.stringify(updated, null, 2));

        console.log(`\n📝 Saved ${successful.length} drivers to ${summaryPath}`);
      }
    });

    worker.on('error', (err) => {
      console.error(`❌ Worker error:`, err);
    });
  }
} else {
  const { from, to, context, token, env } = workerData;
  const tasks = [];

  (async () => {
    for (let i = from; i <= to; i++) {
      const result = await createDriver(i, context, token, env);
      tasks.push(result);
    }
    parentPort.postMessage(tasks);
  })();
}
