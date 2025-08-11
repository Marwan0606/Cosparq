const fs = require('fs');
const path = process.argv[2];
const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean);

lines.forEach((line, i) => {
  try { JSON.parse(line); }
  catch (e) {
    console.error(`Line ${i+1} invalid JSON:`, e.message);
    process.exit(1);
  }
});
console.log(`OK: ${lines.length} lines in ${path}`);