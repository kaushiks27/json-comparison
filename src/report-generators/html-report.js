/**
 * HTML report generator
 */

const fs = require('fs');
const path = require('path');
const { generateStats } = require('../advanced-prioritizer');

/**
 * Generate HTML report
 * @param {Array} reports - Array of connector reports
 * @param {string} outputPath - Path to write HTML file
 */
async function generateHTMLReport(reports, outputPath) {
  const stats = generateStats(reports);
  
  // Read the HTML template
  const templatePath = path.join(__dirname, '../../templates/html-template.html');
  let template = fs.readFileSync(templatePath, 'utf-8');
  
  // Replace placeholders with data
  template = template.replace('{{REPORT_DATA}}', JSON.stringify(reports));
  template = template.replace('{{STATS_DATA}}', JSON.stringify(stats));
  
  // Write the HTML report
  fs.writeFileSync(outputPath, template, 'utf-8');
}

module.exports = { generateHTMLReport };
