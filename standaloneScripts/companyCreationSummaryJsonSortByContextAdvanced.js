const fs = require('fs');
const path = require('path');

// ==============================
// ✅ CONFIGURATION
// ==============================
const config = {
  context: {
    useCustom: true,              // If true, only process entries with this context name
    name: 'savingscalculator',    // Used if useCustom is true
    extractAll: false             // If true, process all contexts (ignored if useCustom = true)
  },
  output: {
    createFile: true,             // Write sorted/bucketed output files as JSON
    prefix: '',                   // Optional prefix for file names
    logToTerminal: true           // Log sorted or extracted data to terminal
  },
  extraction: {
    enabled: true,                // Enable extracting only specific fields
    onlyExtract: true,            // If true, only extract fields — skip sorting & file writing
    fields: [                     // Fields to extract from each summary entry
      'company',
      'company_id',
      'email',
      'cfs',
      'company_link',
      'dispatcher_link'
    ]
  },
  timeBatching: {
    enable: false,                 // If false, all entries are grouped together
    batchWindowMinutes: 10        // Gap (in minutes) for batching entries together
  },
  exportToCSV: {
    fullObjectToCSV: false,       // Export full sorted JSON object to CSV
    onlyExtractedToCSV: true      // Export only extracted fields to CSV (respects `extraction.fields`)
  },
  inputFile: '/Users/wasim.khan/VSCode/MyPlaywrightAndScripts/PlaywrightAutomation/tests/workingScripts/summaryFiles/company_creation_preview.json' // Relative or absolute path
};

// ==============================
// 🔧 UTILITY FUNCTIONS
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

const jsonToCSV = (items, fields) => {
  const header = fields.join(',');
  const rows = items.map(item =>
    fields.map(f => {
      const value = item[f];
      const safe = (value === undefined || value === null) ? 'valuenotexist' : String(value).replace(/"/g, '""');
      return `"${safe}"`;
    }).join(',')
  );
  return [header, ...rows].join('\n');
};

// ==============================
// 📥 LOAD INPUT FILE
// ==============================
let input;
try {
  const inputPath = path.isAbsolute(config.inputFile)
    ? config.inputFile
    : path.join(__dirname, config.inputFile);
  const raw = fs.readFileSync(inputPath, 'utf8');
  input = JSON.parse(raw);
} catch (err) {
  console.error(`❌ Failed to load input file at '${config.inputFile}':`, err.message);
  process.exit(1);
}

// ==============================
// 📦 GROUP BY CONTEXT
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
  console.error('❌ No matching context entries found based on config.');
  process.exit(1);
}

// ==============================
// 🔄 PROCESS EACH CONTEXT GROUP
// ==============================
Object.entries(contextGroups).forEach(([context, entries]) => {
  const sortedByTime = entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const buckets = [];

  for (const item of sortedByTime) {
    const itemTime = new Date(item.timestamp);
    let addedToBucket = false;

    if (!config.timeBatching.enable) {
      if (!buckets.length) buckets.push([]);
      buckets[0].push(item);
      continue;
    }

    for (const bucket of buckets) {
      const firstTime = new Date(bucket[0].timestamp);
      const diffMinutes = Math.abs(itemTime - firstTime) / (1000 * 60);
      if (diffMinutes <= config.timeBatching.batchWindowMinutes) {
        bucket.push(item);
        addedToBucket = true;
        break;
      }
    }

    if (!addedToBucket) {
      buckets.push([item]);
    }
  }

  // ==============================
  // 🧾 PROCESS EACH BUCKET
  // ==============================
  buckets.forEach((bucket, idx) => {
    const sortedBucket = bucket.sort((a, b) => a.run - b.run);
    const date = formatDate(sortedBucket[0].timestamp);
    const batchTag = buckets.length > 1 ? `_batch${idx + 1}` : '';
    const baseName = `${config.output.prefix}${date}_${context}_sorted${batchTag}`;

    // ✅ Extraction Mode
    if (config.extraction.enabled) {
      const extracted = sortedBucket.map(item =>
        extractFieldsFromEntry(item, config.extraction.fields)
      );

      if (config.output.logToTerminal) {
        console.log(`\n📄 Extracted fields [${context}]${batchTag}:`);
        console.table(extracted);
      }

      if (config.exportToCSV.onlyExtractedToCSV) {
        const csvContent = jsonToCSV(extracted, config.extraction.fields);
        fs.writeFileSync(path.join(__dirname, `${baseName}_extracted.csv`), csvContent);
        console.log(`📄 Extracted CSV exported: ${baseName}_extracted.csv`);
      }

      if (config.extraction.onlyExtract) return; // Skip rest of flow
    }

    // ✅ Structured Output JSON
    const output = {
      timestamp: new Date().toISOString(),
      environment: sortedBucket[0]?.environment || 'unknown',
      summary: sortedBucket
    };

    if (config.output.logToTerminal && !config.extraction.enabled) {
      console.log(`\n🗂️ Sorted [${context}]${batchTag}:`);
      console.table(sortedBucket.map(e => ({
        run: e.run,
        company: e.company,
        email: e.email
      })));
    }

    if (config.output.createFile) {
      fs.writeFileSync(
        path.join(__dirname, `${baseName}.json`),
        JSON.stringify(output, null, 2)
      );
      console.log(`✅ JSON file written: ${baseName}.json`);
    }

    // ✅ Full Object CSV Export
    if (config.exportToCSV.fullObjectToCSV) {
      const allFields = Object.keys(sortedBucket[0] || {});
      const csvContent = jsonToCSV(sortedBucket, allFields);
      fs.writeFileSync(path.join(__dirname, `${baseName}_full.csv`), csvContent);
      console.log(`📄 Full CSV exported: ${baseName}_full.csv`);
    }
  });
});
