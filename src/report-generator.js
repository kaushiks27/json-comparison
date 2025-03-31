const fs = require('fs').promises;
const path = require('path');
const config = require('./config-manager');
const logger = require('./logger');

class ReportGenerator {
  constructor() {
    this.supportedFormats = {
      html: this.generateHTMLReport,
      markdown: this.generateMarkdownReport,
      json: this.generateJSONReport
    };
  }

  async generateReports(comparisonResults) {
    const timer = logger.track('Report Generation');
    const enabledFormats = config.get('reportFormats', ['html', 'markdown', 'json']);
    const reportPromises = enabledFormats.map(format => 
      this.generateReport(format, comparisonResults)
    );

    try {
      const reports = await Promise.allSettled(reportPromises);
      
      const failedReports = reports
        .filter(result => result.status === 'rejected')
        .map(result => result.reason);

      if (failedReports.length > 0) {
        logger.warn('Some reports failed to generate', failedReports);
      }

      const duration = timer.end();
      logger.info('Report generation complete', { 
        formats: enabledFormats,
        duration: `${duration}ms`
      });

      return reports;
    } catch (error) {
      logger.error('Report generation failed', error);
      throw error;
    }
  }

  async generateReport(format, comparisonResults) {
    if (!this.supportedFormats[format]) {
      throw new Error(`Unsupported report format: ${format}`);
    }

    const outputPath = path.join(
      process.cwd(), 
      `functional-change-report.${format}`
    );

    try {
      const reportContent = await this.supportedFormats[format](comparisonResults);
      await fs.writeFile(outputPath, reportContent, 'utf8');
      
      logger.info(`${format.toUpperCase()} report generated`, { path: outputPath });
      return outputPath;
    } catch (error) {
      logger.error(`Failed to generate ${format} report`, error);
      throw error;
    }
  }

  async generateHTMLReport(comparisonResults) {
    const template = await this.loadTemplate('html-template.html');
    
    const processedData = this.processReportData(comparisonResults);
    const stats = this.generateStats(processedData);

    return template
      .replace('{{REPORT_DATA}}', JSON.stringify(processedData))
      .replace('{{STATS_DATA}}', JSON.stringify(stats));
  }

  async generateMarkdownReport(comparisonResults) {
    const processedData = this.processReportData(comparisonResults);
    const stats = this.generateStats(processedData);

    const lines = [
      '# 📋 Functional Change Report',
      '',
      `> **Change Summary:** ${stats.priority.P0} Critical, ${stats.priority.P1} Major, ${stats.priority.P2} Minor changes`,
      '',
      this.generateExecutiveSummary(processedData),
      this.generateDetailedChanges(processedData)
    ];

    return lines.join('\n');
  }

  async generateJSONReport(comparisonResults) {
    return JSON.stringify(
      this.processReportData(comparisonResults), 
      null, 
      2
    );
  }

  async loadTemplate(templateName) {
    const templatePath = path.join(__dirname, '..', 'templates', templateName);
    try {
      return await fs.readFile(templatePath, 'utf8');
    } catch (error) {
      logger.error(`Failed to load template ${templateName}`, error);
      throw error;
    }
  }

  processReportData(comparisonResults) {
    return comparisonResults.map(connectorReport => ({
      connector: connectorReport.connector,
      changes: this.normalizeChanges(connectorReport.changes || [])
    }));
  }

  normalizeChanges(changes) {
    return changes.map(change => ({
      ...change,
      priority: this.determinePriority(change)
    }));
  }

  determinePriority(change) {
    // Simplified priority determination
    const priorityRules = {
      P0: ['auth', 'security', 'authentication'],
      P1: ['actions', 'events', 'endpoint', 'trigger'],
      P2: ['metadata', 'description']
    };

    for (const [priority, keywords] of Object.entries(priorityRules)) {
      if (keywords.some(keyword => 
        JSON.stringify(change).toLowerCase().includes(keyword)
      )) {
        return priority;
      }
    }

    return 'P2'; // Default to lowest priority
  }

  generateStats(processedData) {
    const stats = {
      priority: { P0: 0, P1: 0, P2: 0 },
      changeTypes: {
        added: 0,
        removed: 0,
        modified: 0
      },
      categories: {}
    };

    processedData.forEach(connector => {
      connector.changes.forEach(change => {
        // Count priorities
        stats.priority[change.priority]++;

        // Count change types
        if (change.type) {
          stats.changeTypes[change.type] = 
            (stats.changeTypes[change.type] || 0) + 1;
        }

        // Count by category
        const category = change.category || 'uncategorized';
        if (!stats.categories[category]) {
          stats.categories[category] = { 
            total: 0, 
            P0: 0, 
            P1: 0, 
            P2: 0 
          };
        }
        stats.categories[category].total++;
        stats.categories[category][change.priority]++;
      });
    });

    return stats;
  }

  generateExecutiveSummary(processedData) {
    const criticalChanges = processedData
      .flatMap(connector => 
        connector.changes
          .filter(change => ['P0', 'P1'].includes(change.priority))
          .map(change => ({ ...change, connector: connector.connector }))
      )
      .sort((a, b) => 
        a.priority === 'P0' ? -1 : 
        b.priority === 'P0' ? 1 : 0
      );

    if (criticalChanges.length === 0) {
      return '## 🚨 Executive Summary\nNo critical changes detected.';
    }

    const summaryLines = ['## 🚨 Executive Summary'];
    
    const groupedChanges = criticalChanges.reduce((acc, change) => {
      if (!acc[change.connector]) {
        acc[change.connector] = [];
      }
      acc[change.connector].push(change);
      return acc;
    }, {});

    Object.entries(groupedChanges).forEach(([connector, changes]) => {
      summaryLines.push(`### ${connector}`);
      changes.forEach(change => {
        const priorityEmoji = change.priority === 'P0' ? '🔴' : '🟠';
        summaryLines.push(`- ${priorityEmoji} ${this.formatChangeDescription(change)}`);
      });
      summaryLines.push('');
    });

    return summaryLines.join('\n');
  }

  formatChangeDescription(change) {
    const typeDescriptions = {
      'file-added': `Added file: \`${change.file}\``,
      'file-removed': `Removed file: \`${change.file}\``,
      'added': `Added \`${change.path}\``,
      'removed': `Removed \`${change.path}\``,
      'modified': `Changed \`${change.path}\``
    };

    return typeDescriptions[change.type] || JSON.stringify(change);
  }

  generateDetailedChanges(processedData) {
    const detailedLines = [];

    processedData.forEach(connector => {
      if (connector.changes.length === 0) return;

      detailedLines.push(`## 🔌 Connector: \`${connector.connector}\``);
      
      const changesByPriority = {
        P0: connector.changes.filter(c => c.priority === 'P0'),
        P1: connector.changes.filter(c => c.priority === 'P1'),
        P2: connector.changes.filter(c => c.priority === 'P2')
      };

      Object.entries(changesByPriority).forEach(([priority, changes]) => {
        if (changes.length === 0) return;

        const priorityLabels = {
          'P0': '🔴 Critical Changes',
          'P1': '🟠 Major Changes',
          'P2': '🟢 Minor Changes'
        };

        detailedLines.push(`### ${priorityLabels[priority]} (${changes.length})`);
        
        changes.forEach(change => {
          detailedLines.push(`- ${this.formatChangeDescription(change)}`);
        });
        
        detailedLines.push('');
      });
    });

    return detailedLines.join('\n');
  }
}

module.exports = new ReportGenerator();