/**
 * Advanced JSON Functional Change Detection
 * Main entry point
 */

const path = require('path');
const { compareConnectors } = require('./comparator');
const { generateHTMLReport } = require('./report-generators/html-report');
const { generateMarkdownReport } = require('./report-generators/markdown-report');
const { generateJSONReport } = require('./report-generators/json-report');

// Paths to connector directories
const prevPath = path.join(__dirname, '..', 'connectors', 'previous');
const currPath = path.join(__dirname, '..', 'connectors', 'current');

async function run() {
  console.log("🔍 Starting functional change detection...");
  
  // Compare connectors
  console.log(`📂 Analyzing connectors in ${prevPath} and ${currPath}...`);
  const comparisonResult = await compareConnectors(prevPath, currPath);
  
  // Generate reports
  console.log("📝 Generating reports...");
  
  // Generate HTML report
  await generateHTMLReport(comparisonResult, path.join(__dirname, '..', 'functional-change-report.html'));
  console.log("✅ HTML report generated: functional-change-report.html");
  
  // Generate Markdown report
  await generateMarkdownReport(comparisonResult, path.join(__dirname, '..', 'functional-change-report.md'));
  console.log("✅ Markdown report generated: functional-change-report.md");
  
  // Generate JSON report
  await generateJSONReport(comparisonResult, path.join(__dirname, '..', 'functional-change-data.json'));
  console.log("✅ JSON data generated: functional-change-data.json");
  
  console.log("✨ Process complete!");
}

// Run the program
run().catch(error => {
  console.error(`❌ Error: ${error.message}`);
  process.exit(1);
});
