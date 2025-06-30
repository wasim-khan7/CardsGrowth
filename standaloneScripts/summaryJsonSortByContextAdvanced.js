const fs = require('fs');
const path = require('path');
const os = require('os');

// ==============================
// 📦 CONFIGURATION
// ==============================
const config = {
  context: {
    useCustom: true,                         // Only include entries whose context starts with this name
    name: 'scgroup1_local',                  // Prefix to match in context (e.g. scgroup1_local_1)
    extractAll: false                        // If true and useCustom = false, process all contexts
  },
  output: {
    createOutputFile: true,                  // Write JSON output to file
    logExtractedDataToConsole: true          // Show the extracted data in terminal
  },
  extraction: {
    enabled: true,                           // Extract only specific fields from each summary item
    onlyExtractAndShowDontCreateOutputFile: true,  // Only extract & log, skip file creation
    fields: [                                // Fields to extract from each summary item
      'company',
      'email',
      'company_id',
      'dispatcher_link'
    ]
  },
  csvExport: {
    exportToCSVasWell: true,                 // Export data to CSV
    csvOptions: {
      fullObjectToCSV: false,                // If true, dump entire object into CSV
      onlyExtractedToCSV: true               // If true, dump only the extracted fields
    }
  },
  inputFile: '/Users/wasim.khan/VSCode/MyPlaywrightAndScripts/PlaywrightAutomation/tests/workingScripts/summaryFiles/company_creation_preview.json'
};

// ==============================
// 📂 Load Input
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
// 🛠️ Utilities
// ==============================
const extractContext = email => {
  const match = email.match(/\+([^@]+)@/);
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

const convertToCSV = (dataArray, fileName) => {
  if (!dataArray.length) return;

  const headers = Object.keys(dataArray[0]);
  const rows = dataArray.map(obj =>
    headers.map(header => (obj[header] ?? '')).join(',')
  );

  const csvContent = [headers.join(','), ...rows].join(os.EOL);
  fs.writeFileSync(path.join(__dirname, fileName), csvContent);
  console.log(`📄 CSV file written: ${fileName}`);
};

// ==============================
// 🧠 Context Grouping
// ==============================
const contextGroups = {};
const allExtracted = [];

for (const entry of input) {
  for (const item of entry.summary) {
    const context = extractContext(item.email);
    const run = extractRun(item.email);
    if (!context || run === null) continue;

    if (config.context.useCustom && !context.startsWith(config.context.name)) continue;

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
  console.error('⚠️ No matching context entries found based on config.');
  process.exit(1);
}

// ==============================
// 📊 Process Each Group
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

  // 🧾 Handle Each Bucket
  buckets.forEach((bucket, idx) => {
    const sortedBucket = bucket.sort((a, b) => a.run - b.run);

    if (config.extraction.enabled) {
      const extracted = sortedBucket.map(item =>
        extractFieldsFromEntry(item, config.extraction.fields)
      );
      allExtracted.push(...extracted);

      if (config.extraction.onlyExtractAndShowDontCreateOutputFile) return;
    }

    // File Output (if not extraction-only mode)
    const output = {
      timestamp: new Date().toISOString(),
      environment: sortedBucket[0]?.environment || 'unknown',
      summary: sortedBucket
    };

    if (config.output.createOutputFile) {
      const date = formatDate(sortedBucket[0].timestamp);
      const batchTag = buckets.length > 1 ? `_batch${idx + 1}` : '';
      const fileName = `${date}_${context}_sorted${batchTag}.json`;

      fs.writeFileSync(path.join(__dirname, fileName), JSON.stringify(output, null, 2));
      console.log(`📁 JSON file written: ${fileName}`);
    }
  });
});

// ==============================
// 📦 Combined Output
// ==============================
if (
  config.output.logExtractedDataToConsole &&
  config.extraction.enabled &&
  allExtracted.length > 0
) {
  console.log(`\n📄 All Extracted Fields Combined:`);
  console.table(allExtracted);
}

// ==============================
// 📤 Export to CSV
// ==============================
if (
  config.csvExport.exportToCSVasWell &&
  allExtracted.length > 0 &&
  config.extraction.enabled
) {
  const dateTag = new Date().toISOString().split('T')[0];
  const contextTag = config.context.useCustom ? config.context.name : 'all';

  if (config.csvExport.csvOptions.onlyExtractedToCSV) {
    convertToCSV(allExtracted, `${dateTag}_${contextTag}_extracted.csv`);
  }

  if (config.csvExport.csvOptions.fullObjectToCSV) {
    // Optional: combine full objects from all entries for CSV (slower, optional)
    const fullObjects = [];
    Object.values(contextGroups).forEach(group =>
      group.forEach(item => fullObjects.push(item))
    );
    convertToCSV(fullObjects, `${dateTag}_${contextTag}_fullObjects.csv`);
  }
}
