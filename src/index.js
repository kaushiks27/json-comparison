/**
 * Advanced JSON Functional Change Detection
 * Main entry point
 */

const path = require('path');
const fs = require('fs').promises;
const config = require('./config-manager');
const logger = require('./logger');
const AdvancedComparator = require('./advanced-comparator');
const reportGenerator = require('./report-generator');

class FunctionalChangeDetectionTool {
  constructor() {
    this.connectorSources = config.get('connectorSources', {
      previous: path.join(process.cwd(), 'connectors', 'previous'),
      current: path.join(process.cwd(), 'connectors', 'current')
    });
    
    // Initialize components
    this.comparator = new AdvancedComparator();
    this.reportGen = reportGenerator;
  }

  async validateEnvironment() {
    try {
      // Check connector source directories
      await Promise.all([
        fs.access(this.connectorSources.previous),
        fs.access(this.connectorSources.current)
      ]);

      logger.info('Environment validation successful', {
        previousPath: this.connectorSources.previous,
        currentPath: this.connectorSources.current
      });
      return true;
    } catch (error) {
      logger.error('Environment validation failed', {
        error: error.message,
        paths: this.connectorSources
      });
      return false;
    }
  }

  async runComparison() {
    const timer = logger.track('Full Comparison Process');

    try {
      // Validate environment before processing
      const isValid = await this.validateEnvironment();
      if (!isValid) {
        throw new Error('Invalid connector source directories');
      }

      logger.info('Starting connector comparison', {
        prevPath: this.connectorSources.previous,
        currPath: this.connectorSources.current
      });

      // Perform connector comparison
      const comparisonResults = await this.comparator.compareConnectors(
        this.connectorSources.previous, 
        this.connectorSources.current
      );

      // Generate comprehensive report
      const reportPaths = await this.reportGen.generateReports(comparisonResults);

      const duration = timer.end();
      
      logger.info('Comparison process complete', {
        duration: `${duration}ms`,
        reportPaths
      });

      return {
        results: comparisonResults,
        reportPaths
      };
    } catch (error) {
      logger.error('Comparison process failed', error);
      throw error;
    }
  }

  async start() {
    try {
      logger.info('Functional Change Detection Tool Starting');
      
      const result = await this.runComparison();
      
      logger.info('Change detection completed successfully', {
        totalConnectors: result.results.length,
        reportGenerated: result.reportPaths.length > 0
      });

      return result;
    } catch (error) {
      logger.error('Functional Change Detection Tool Failed', error);
      process.exitCode = 1;
      return null;
    }
  }
}

// Create instance and export
const detectionTool = new FunctionalChangeDetectionTool();
module.exports = detectionTool;

// If run directly, start the process
if (require.main === module) {
  (async () => {
    try {
      await detectionTool.start();
    } catch (error) {
      console.error('Unhandled error:', error);
      process.exit(1);
    }
  })();
}