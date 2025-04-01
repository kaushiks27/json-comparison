/**
 * HTML report generator
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../logger');

/**
 * Generate HTML report
 * @param {Array} reports - Array of connector reports
 * @param {string} outputPath - Path to write HTML file
 */
async function generateHTMLReport(reports, outputPath) {
  try {
    logger.info('Generating HTML report');
    
    // Read the HTML template
    const templatePath = path.join(process.cwd(), 'templates', 'html-template.html');
    let template = await fs.readFile(templatePath, 'utf-8');
    
    // Generate stats for the report
    const statsData = generateReportStats(reports);
    
    // Create data scripts to be injected into the HTML
    const reportDataScript = `<script id="report-data" type="application/json">${JSON.stringify(reports)}</script>`;
    const statsDataScript = `<script id="stats-data" type="application/json">${JSON.stringify(statsData)}</script>`;
    
    // Inject data scripts before closing body tag
    template = template.replace('</body>', `${reportDataScript}\n${statsDataScript}\n</body>`);
    
    // Copy necessary client scripts to output directory
    await copyClientScripts(path.dirname(outputPath));
    
    // Write the HTML report
    await fs.writeFile(outputPath, template, 'utf-8');
    
    logger.info('HTML report generated successfully', { path: outputPath });
  } catch (error) {
    logger.error('Failed to generate HTML report', error);
    throw error;
  }
}

/**
 * Generate statistics from report data
 * @param {Array} reports - Processed reports
 * @returns {Object} - Stats object
 */
function generateReportStats(reports) {
  const stats = {
    priority: { P0: 0, P1: 0, P2: 0 },
    changeTypes: {},
    categories: {}
  };
  
  reports.forEach(connector => {
    if (!connector.changes) return;
    
    connector.changes.forEach(change => {
      // Count by priority
      stats.priority[change.priority] = (stats.priority[change.priority] || 0) + 1;
      
      // Count by change type
      stats.changeTypes[change.type] = (stats.changeTypes[change.type] || 0) + 1;
      
      // Count by category
      const category = change.category || 'other';
      if (!stats.categories[category]) {
        stats.categories[category] = { total: 0, P0: 0, P1: 0, P2: 0 };
      }
      stats.categories[category].total++;
      stats.categories[category][change.priority]++;
    });
  });
  
  return stats;
}

/**
 * Copy client-side scripts to output directory
 * @param {string} outputDir - Output directory
 */
async function copyClientScripts(outputDir) {
  try {
    // Create scripts directory if it doesn't exist
    const scriptsDir = path.join(outputDir, 'scripts');
    await fs.mkdir(scriptsDir, { recursive: true });
    
    // Copy client-side scripts
    const templateScriptsDir = path.join(process.cwd(), 'templates', 'scripts');
    const scriptFiles = [
      'data-loader.js',
      'filters.js',
      'visualizations.js',
      'interactivity.js'
    ];
    
    for (const scriptFile of scriptFiles) {
      const sourcePath = path.join(templateScriptsDir, scriptFile);
      const destPath = path.join(scriptsDir, scriptFile);
      
      try {
        const scriptContent = await fs.readFile(sourcePath, 'utf-8');
        await fs.writeFile(destPath, scriptContent, 'utf-8');
      } catch (error) {
        logger.warn(`Failed to copy script ${scriptFile}: ${error.message}`);
      }
    }
    
    logger.info('Client scripts copied successfully');
  } catch (error) {
    logger.error('Failed to copy client scripts', error);
  }
}

module.exports = { generateHTMLReport };