const fs = require('fs');
const path = require('path');

// ==============================
// CONFIGURATION OBJECT
// ==============================
const config = {
  context: {
    useCustom: true,               // If true, only process entries with this context name
    name: 'savingscalculator',     // Used if useCustom is true
    extractAll: false              // If true, process all contexts (ignored if useCustom = true)
  },
  output: {
    createFile: true,              // Write sorted/bucketed output files
    prefix: '',                    // Optional file name prefix
    logToTerminal: true            // Log extracted or sorted entries to terminal
  },
  extraction: {
    enabled: true,                 // Enable extraction of specific fields
    onlyExtract: true,            // If true, extract fields only (no sorting, no output files)
    fields: [                      // Fields to extract from each summary item
      'company',
      'email',
      'company_id',
      'dispatcher_link'
    ]
  },
  inputFile: '/Users/wasim.khan/VSCode/MyPlaywrightAndScripts/PlaywrightAutomation/tests/workingScripts/summaryFiles/company_creation_preview.json' // Relative or absolute path
};

// ==============================
// LOAD INPUT FILE
// ==============================
let input;
try {
  const inputPath = path.isAbsolute(config.inputFile)
    ? config.inputFile
    : path.join(__dirname, config.inputFile);
  const raw = fs.readFileSync(inputPath, 'utf8');
  input = JSON.parse(raw);
} catch (err) {
  console.error(`Failed to load input file at '${config.inputFile}':`, err.message);
  process.exit(1);
}

// ==============================
// UTILITY FUNCTIONS
// ==============================
const extractContext = email => {
  const match = email.match(/\+([a-zA-Z]+)_\d+@/);
  return match ? match[1] : null;
};

const extractRun = email => {
  const match = email.match(/_(\d+)@/);
  return match ? parseInt(match[1], 10) : null;
};

const formatDate = dateStr => new Date(dateStr).toISOString().split('T')[0];

const extractFieldsFromEntry = (entry, fields) => {
  const result = {};
  for (const field of fields) {
    result[field] = entry[field] !== undefined ? entry[field] : 'valuenotexist';
  }
  return result;
};

// ==============================
// GROUP BY CONTEXT
// ==============================
const contextGroups = {};

for (const entry of input) {
  for (const item of entry.summary) {
    const context = extractContext(item.email);
    const run = extractRun(item.email);
    if (!context || run === null) continue;

    if (config.context.useCustom && context !== config.context.name) continue;

    if (!contextGroups[context]) contextGroups[context] = [];

    contextGroups[context].push({
      ...item,
      timestamp: entry.timestamp,
      environment: entry.environment,
      run
    });
  }
}

if (!Object.keys(contextGroups).length) {
  console.error('No matching context entries found based on config.');
  process.exit(1);
}

// ==============================
// PROCESS EACH CONTEXT GROUP
// ==============================
Object.entries(contextGroups).forEach(([context, entries]) => {
  const sortedByTime = entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const buckets = [];

  for (const item of sortedByTime) {
    const itemTime = new Date(item.timestamp);
    let addedToBucket = false;

    for (const bucket of buckets) {
      const firstTime = new Date(bucket[0].timestamp);
      const diffMinutes = Math.abs(itemTime - firstTime) / (1000 * 60);
      if (diffMinutes <= 10) {
        bucket.push(item);
        addedToBucket = true;
        break;
      }
    }

    if (!addedToBucket) buckets.push([item]);
  }

  // ==============================
  // 🧾 PROCESS EACH BUCKET
  // ==============================
  buckets.forEach((bucket, idx) => {
    const sortedBucket = bucket.sort((a, b) => a.run - b.run);

    // Extraction Mode
    if (config.extraction.enabled) {
      const extracted = sortedBucket.map(item =>
        extractFieldsFromEntry(item, config.extraction.fields)
      );

      if (config.output.logToTerminal) {
        console.log(`\n📄 Extracted fields [${context}]${buckets.length > 1 ? ` batch ${idx + 1}` : ''}:`);
        console.table(extracted);
      }

      if (config.extraction.onlyExtract) return;
    }

    // Structured Output (if not onlyExtract mode)
    const output = {
      timestamp: new Date().toISOString(),
      environment: sortedBucket[0]?.environment || 'unknown',
      summary: sortedBucket
    };

    if (config.output.logToTerminal && !config.extraction.enabled) {
      console.log(`\n🗂️ Sorted [${context}]${buckets.length > 1 ? ` batch ${idx + 1}` : ''}:`);
      console.table(sortedBucket.map(e => ({
        run: e.run,
        company: e.company,
        email: e.email
      })));
    }

    // Output to File
    if (config.output.createFile) {
      const date = formatDate(sortedBucket[0].timestamp);
      const batchTag = buckets.length > 1 ? `_batch${idx + 1}` : '';
      const fileName = `${config.output.prefix}${date}_${context}_sorted${batchTag}.json`;

      fs.writeFileSync(path.join(__dirname, fileName), JSON.stringify(output, null, 2));
      console.log(`File written: ${fileName}`);
    }
  });
});
