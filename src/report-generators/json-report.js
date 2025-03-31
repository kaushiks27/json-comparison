/**
 * JSON data report generator
 */

const fs = require('fs');

/**
 * Generate JSON report
 * @param {Array} reports - Array of connector reports
 * @param {string} outputPath - Path to write JSON file
 */
async function generateJSONReport(reports, outputPath) {
  // Create a formatted JSON string
  const jsonContent = JSON.stringify(reports, null, 2);
  
  // Write the JSON file
  fs.writeFileSync(outputPath, jsonContent, 'utf-8');
}

module.exports = { generateJSONReport };
