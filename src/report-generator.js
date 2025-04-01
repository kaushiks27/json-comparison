/**
 * Report Generator
 * Handles generation of different report formats
 */

const fs = require('fs').promises;
const path = require('path');
const config = require('./config-manager');
const logger = require('./logger');
const { formatValue } = require('./utils/file-utils');

// Import report generators
const htmlReportGenerator = require('./report-generators/html-report');
const markdownReportGenerator = require('./report-generators/markdown-report');
const jsonReportGenerator = require('./report-generators/json-report');

class ReportGenerator {
  constructor() {
    this.reportGenerators = {
      html: htmlReportGenerator.generateHTMLReport,
      markdown: markdownReportGenerator.generateMarkdownReport,
      json: jsonReportGenerator.generateJSONReport
    };
  }

  /**
   * Generate all enabled report formats
   * @param {Array} comparisonResults - Results from comparator
   * @returns {Array} - Paths to generated reports
   */
  async generateReports(comparisonResults) {
    const timer = logger.track('Report Generation');
    const enabledFormats = config.get('reportFormats', ['html', 'markdown', 'json']);
    
    logger.info('Generating reports', { formats: enabledFormats });
    
    // Process raw data for reports
    const processedData = this.processReportData(comparisonResults);
    
    // Generate each report format
    const reportPaths = [];
    
    for (const format of enabledFormats) {
      try {
        if (!this.reportGenerators[format]) {
          logger.warn(`Unsupported report format: ${format}`);
          continue;
        }
        
        const outputPath = path.join(process.cwd(), `functional-change-report.${format}`);
        
        await this.reportGenerators[format](processedData, outputPath);
        
        reportPaths.push({
          format,
          path: outputPath
        });
        
        logger.info(`Generated ${format} report`, { path: outputPath });
      } catch (error) {
        logger.error(`Failed to generate ${format} report`, error);
      }
    }
    
    const duration = timer.end();
    logger.info('Report generation complete', { 
      formats: enabledFormats,
      duration: `${duration}ms`
    });
    
    return reportPaths;
  }

  /**
   * Process and standardize report data
   * @param {Array} comparisonResults - Raw comparison results
   * @returns {Array} - Processed data for reports
   */
  processReportData(comparisonResults) {
    return comparisonResults.map(connectorReport => {
      // Ensure changes array exists
      const changes = connectorReport.changes || [];
      
      // Process each change to add priority
      const processedChanges = changes.map(change => {
        return {
          ...change,
          priority: this.determinePriority(change)
        };
      });
      
      return {
        connector: connectorReport.connector,
        changes: processedChanges,
        error: connectorReport.processingError
      };
    });
  }

  /**
   * Determine priority level for a change
   * @param {Object} change - Change object
   * @returns {string} - Priority level (P0, P1, P2)
   */
  determinePriority(change) {
    // Priority rules (simplified version)
    const priorityRules = {
      P0: ['auth', 'security', 'token', 'authentication', 'credential'],
      P1: ['actions', 'events', 'endpoint', 'trigger', 'method', 'output'],
      P2: ['metadata', 'description', 'version', 'icon']
    };
    
    // Convert change to string for keyword matching
    const changeString = JSON.stringify(change).toLowerCase();
    
    // Check against each priority level
    for (const [priority, keywords] of Object.entries(priorityRules)) {
      if (keywords.some(keyword => changeString.includes(keyword))) {
        return priority;
      }
    }
    
    // Default to lowest priority
    return 'P2';
  }

  /**
   * Generate stats from processed data
   * @param {Array} processedData - Processed report data
   * @returns {Object} - Statistics object
   */
  generateStats(processedData) {
    const stats = {
      priority: { P0: 0, P1: 0, P2: 0 },
      changeTypes: {},
      categories: {}
    };
    
    processedData.forEach(connector => {
      connector.changes.forEach(change => {
        // Count by priority
        stats.priority[change.priority] = (stats.priority[change.priority] || 0) + 1;
        
        // Count by change type
        stats.changeTypes[change.type] = (stats.changeTypes[change.type] || 0) + 1;
        
        // Count by category
        const category = change.category || 'other';
        if (!stats.categories[category]) {
          stats.categories[category] = { total: 0 };
        }
        stats.categories[category].total++;
        
        // Count by category and priority
        const priorityKey = change.priority || 'P2';
        stats.categories[category][priorityKey] = (stats.categories[category][priorityKey] || 0) + 1;
      });
    });
    
    return stats;
  }

  /**
   * Load template file
   * @param {string} templateName - Template filename
   * @returns {Promise<string>} - Template content
   */
  async loadTemplate(templateName) {
    try {
      const templatePath = path.join(process.cwd(), 'templates', templateName);
      return await fs.readFile(templatePath, 'utf8');
    } catch (error) {
      logger.error(`Failed to load template ${templateName}`, error);
      throw new Error(`Template not found: ${templateName}`);
    }
  }
}

module.exports = new ReportGenerator();