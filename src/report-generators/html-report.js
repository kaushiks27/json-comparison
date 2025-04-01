
/**
 * HTML report generator (Node.js only)
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

    // Replace template placeholders with actual data
    template = template.replace('{{REPORT_DATA}}', JSON.stringify(reports, null, 2));
    template = template.replace('{{STATS_DATA}}', JSON.stringify(statsData, null, 2));

    // Inject client-side script
    template = injectInitializationScript(template);

    // Write HTML file to output
    await fs.writeFile(outputPath, template, 'utf-8');

    logger.info('HTML report generated successfully', { path: outputPath });
  } catch (error) {
    logger.error('Failed to generate HTML report', error);
    throw error;
  }
}

function generateReportStats(reports) {
  const stats = {
    priority: { P0: 0, P1: 0, P2: 0 },
    changeTypes: {},
    categories: {}
  };

  reports.forEach(connector => {
    connector.changes.forEach(change => {
      stats.priority[change.priority] = (stats.priority[change.priority] || 0) + 1;
      stats.changeTypes[change.type] = (stats.changeTypes[change.type] || 0) + 1;

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

function injectInitializationScript(template) {
  const scriptTag = '<script src="report-client.js"></script>';
  return template.replace('</body>', `${scriptTag}</body>`);
}

module.exports = { generateHTMLReport };
