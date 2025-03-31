const path = require('path');
const fs = require('fs').promises;

// Import custom modules
const config = require('./config-manager');
const logger = require('./logger');
const comparator = require('./advanced-comparator');
const reportGenerator = require('./report-generator');
const prioritizer = require('./advanced-prioritizer');

class FunctionalChangeDetectionTool {
  constructor() {
    this.connectorSources = config.get('connectorSources', {
      previous: path.join(process.cwd(), 'connectors', 'previous'),
      current: path.join(process.cwd(), 'connectors', 'current')
    });
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
    } catch (error) {
      logger.error('Environment validation failed', {
        error: error.message,
        paths: this.connectorSources
      });
      throw new Error('Invalid connector source directories');
    }
  }

  async runComparison() {
    const timer = logger.track('Full Comparison Process');

    try {
      // Validate environment before processing
      await this.validateEnvironment();

      // Perform connector comparison
      const comparisonResults = await comparator.compareConnectors(
        this.connectorSources.previous, 
        this.connectorSources.current
      );

      // Enrich comparison results with priority information
      const enrichedResults = comparisonResults.map(result => ({
        ...result,
        changes: result.changes.map(change => 
          prioritizer.classifyChange(change)
        )
      }));

      // Generate comprehensive report
      const reportPaths = await reportGenerator.generateReports(enrichedResults);

      const duration = timer.end();
      
      // Generate summary report
      const changeSummary = enrichedResults.reduce((summary, connector) => {
        summary[connector.connector] = prioritizer.generateChangeReport(connector.changes);
        return summary;
      }, {});

      logger.info('Comparison process complete', {
        duration: `${duration}ms`,
        reportPaths,
        changeSummary
      });

      return {
        results: enrichedResults,
        reportPaths,
        changeSummary
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

// Export a singleton instance
module.exports = new FunctionalChangeDetectionTool();

// If run directly, start the process
if (require.main === module) {
  (async () => {
    try {
      await module.exports.start();
    } catch (error) {
      console.error('Unhandled error:', error);
      process.exit(1);
    }
  })();
}