// 1. src/advanced-comparator.js
// ===========================
const fs = require('fs').promises;
const path = require('path');
const config = require('./config-manager');
const logger = require('./logger');
const { loadJSON } = require('./utils/file-utils');

class AdvancedComparator {
  constructor() {
    this.SIGNIFICANT_FILE_TYPES = ['.json'];
    this.MAX_DEPTH = config.get('maxComparisonDepth', 5);
  }

  async compareConnectors(prevPath, currPath) {
    logger.info('Starting connector comparison', { prevPath, currPath });
    const timer = logger.track('Connector Comparison');

    try {
      await this.validatePaths(prevPath, currPath);
      
      const prevConnectors = await this.listConnectors(prevPath);
      const currConnectors = await this.listConnectors(currPath);
      
      const allConnectors = new Set([...prevConnectors, ...currConnectors]);
      const results = [];

      for (const connector of allConnectors) {
        try {
          const comparisonResult = await this.compareConnector(
            path.join(prevPath, connector), 
            path.join(currPath, connector)
          );
          
          results.push({
            connector,
            changes: comparisonResult
          });
        } catch (connectorError) {
          logger.error(`Failed to process connector ${connector}`, connectorError);
          results.push({
            connector,
            changes: [],
            processingError: connectorError.message
          });
        }
      }

      const duration = timer.end();
      logger.info('Connector comparison complete', { 
        totalConnectors: results.length,
        duration: `${duration}ms`
      });

      return results;
    } catch (error) {
      logger.error('Connector comparison failed', error);
      throw error;
    }
  }

  async compareConnector(prevConnectorPath, currConnectorPath) {
    const changes = [];
    const folders = config.get('comparableFolders', ['actions', 'auth', 'events', 'metadata', 'meta']);

    for (const folder of folders) {
      const prevFolderPath = path.join(prevConnectorPath, folder);
      const currFolderPath = path.join(currConnectorPath, folder);

      try {
        // Check if folders exist
        const prevFolderExists = await this.pathExists(prevFolderPath);
        const currFolderExists = await this.pathExists(currFolderPath);
        
        // If both folders don't exist, skip
        if (!prevFolderExists && !currFolderExists) {
          continue;
        }
        
        // If one folder exists but the other doesn't, record a folder added/removed change
        if (prevFolderExists && !currFolderExists) {
          changes.push({
            type: 'folder-removed',
            folder: folder,
            category: folder
          });
          continue;
        }
        
        if (!prevFolderExists && currFolderExists) {
          changes.push({
            type: 'folder-added',
            folder: folder,
            category: folder
          });
        }

        // Compare contents if at least one folder exists
        const folderChanges = await this.compareFolderContents(
          prevFolderPath, 
          currFolderPath, 
          folder
        );
        
        changes.push(...folderChanges);
      } catch (folderError) {
        logger.warn(`Skipping folder ${folder} due to error`, folderError);
      }
    }

    return changes;
  }

  async compareFolderContents(prevPath, currPath, category) {
    const changes = [];
    
    try {
      const prevFiles = await this.listRelevantFiles(prevPath);
      const currFiles = await this.listRelevantFiles(currPath);

      const allFiles = new Set([...prevFiles, ...currFiles]);

      for (const file of allFiles) {
        const prevFilePath = path.join(prevPath, file);
        const currFilePath = path.join(currPath, file);

        const changeDetails = await this.compareFiles(
          prevFilePath, 
          currFilePath, 
          category
        );

        if (changeDetails) {
          if (Array.isArray(changeDetails)) {
            changes.push(...changeDetails);
          } else {
            changes.push(changeDetails);
          }
        }
      }
    } catch (error) {
      logger.warn(`Error comparing folder contents: ${prevPath} vs ${currPath}`, error);
    }

    return changes;
  }

  async compareFiles(prevPath, currPath, category) {
    try {
      const prevExists = await this.pathExists(prevPath);
      const currExists = await this.pathExists(currPath);

      if (!prevExists && currExists) {
        return this.createFileAddedChange(currPath, category);
      }

      if (prevExists && !currExists) {
        return this.createFileRemovedChange(prevPath, category);
      }

      if (prevExists && currExists) {
        return this.compareFileContents(prevPath, currPath, category);
      }
    } catch (error) {
      logger.error(`File comparison error: ${prevPath} vs ${currPath}`, error);
    }

    return null;
  }

  async createFileAddedChange(filePath, category) {
    const fileName = path.basename(filePath);
    return {
      type: 'file-added',
      file: `${category}/${fileName}`,
      category
    };
  }

  async createFileRemovedChange(filePath, category) {
    const fileName = path.basename(filePath);
    return {
      type: 'file-removed',
      file: `${category}/${fileName}`,
      category
    };
  }

  async compareFileContents(prevPath, currPath, category) {
    const prevContent = await loadJSON(prevPath);
    const currContent = await loadJSON(currPath);
    
    if (!prevContent || !currContent) {
      return null;
    }
    
    return this.deepCompareObjects(prevContent, currContent, '', category);
  }

  deepCompareObjects(prev, curr, basePath = '', category) {
    const changes = [];
    
    // Get all keys from both objects
    const allKeys = new Set([
      ...Object.keys(prev || {}),
      ...Object.keys(curr || {})
    ]);
    
    for (const key of allKeys) {
      const path = basePath ? `${basePath}.${key}` : key;
      
      // Key exists in prev but not in curr
      if (prev.hasOwnProperty(key) && !curr.hasOwnProperty(key)) {
        changes.push({
          type: 'removed',
          path,
          oldVal: prev[key],
          category
        });
        continue;
      }
      
      // Key exists in curr but not in prev
      if (!prev.hasOwnProperty(key) && curr.hasOwnProperty(key)) {
        changes.push({
          type: 'added',
          path,
          newVal: curr[key],
          category
        });
        continue;
      }
      
      // Key exists in both, check if values are different
      if (JSON.stringify(prev[key]) !== JSON.stringify(curr[key])) {
        // If both values are objects, recurse
        if (
          typeof prev[key] === 'object' && prev[key] !== null &&
          typeof curr[key] === 'object' && curr[key] !== null &&
          !Array.isArray(prev[key]) && !Array.isArray(curr[key])
        ) {
          const nestedChanges = this.deepCompareObjects(prev[key], curr[key], path, category);
          changes.push(...nestedChanges);
        } else {
          changes.push({
            type: 'modified',
            path,
            oldVal: prev[key],
            newVal: curr[key],
            category
          });
        }
      }
    }
    
    return changes;
  }

  async validatePaths(prevPath, currPath) {
    const [prevExists, currExists] = await Promise.all([
      this.pathExists(prevPath),
      this.pathExists(currPath)
    ]);
    
    if (!prevExists || !currExists) {
      throw new Error('Invalid connector paths');
    }
  }

  async listConnectors(basePath) {
    try {
      const entries = await fs.readdir(basePath, { withFileTypes: true });
      return entries
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
    } catch (error) {
      logger.error('Failed to list connectors', error);
      return [];
    }
  }

  async listRelevantFiles(dirPath) {
    try {
      if (!(await this.pathExists(dirPath))) return [];

      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries
        .filter(entry => 
          entry.isFile() && 
          this.SIGNIFICANT_FILE_TYPES.some(type => entry.name.endsWith(type))
        )
        .map(entry => entry.name);
    } catch (error) {
      logger.warn(`Could not list files in ${dirPath}`, error);
      return [];
    }
  }

  async pathExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = new AdvancedComparator();


// 2. src/utils/file-utils.js
// ==========================
// The file exists but we're ensuring it has all needed functions
const fs = require('fs').promises;
const path = require('path');

/**
 * Load and parse JSON file safely
 * @param {string} filepath - Path to JSON file
 * @returns {Object|null} - Parsed JSON or null if error
 */
async function loadJSON(filepath) {
  try {
    const content = await fs.readFile(filepath, "utf-8");
    return JSON.parse(content);
  } catch (e) {
    console.error(`❌ Error parsing ${filepath}: ${e.message}`);
    return null;
  }
}

/**
 * Recursively collect all .json files in a given folder
 * @param {string} basePath - Base directory path
 * @returns {Object} - Object mapping filenames to parsed JSON content
 */
async function collectJSONFiles(basePath) {
  try {
    const entries = await fs.readdir(basePath, { withFileTypes: true });
    const jsonFiles = {};

    for (const entry of entries) {
      const entryPath = path.join(basePath, entry.name);
      if (entry.isFile() && entry.name.endsWith(".json")) {
        jsonFiles[entry.name] = await loadJSON(entryPath);
      }
    }

    return jsonFiles;
  } catch (e) {
    console.error(`❌ Error collecting JSON files from ${basePath}: ${e.message}`);
    return {};
  }
}

/**
 * Format JSON value for display (with truncation for large values)
 * @param {any} value - Value to format
 * @param {number} truncateLength - Length at which to truncate
 * @returns {string} - Formatted value
 */
function formatValue(value, truncateLength = 80) {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  
  try {
    const json = JSON.stringify(value);
    if (json.length <= truncateLength) return json;
    return json.substring(0, truncateLength) + "...";
  } catch (e) {
    return String(value);
  }
}

module.exports = {
  loadJSON,
  collectJSONFiles,
  formatValue
};


// 3. src/advanced-prioritizer.js
// ===============================
// Fix issues with imports and add missing functions
const config = require('./config-manager');
const logger = require('./logger');

class AdvancedPrioritizer {
  constructor() {
    this.priorityRules = this.loadPriorityRules();
  }

  loadPriorityRules() {
    // Default rules with option to extend via configuration
    const defaultRules = {
      critical: {
        keywords: [
          'auth', 'security', 'authentication', 
          'token', 'permission', 'access', 'credential'
        ],
        factors: {
          pathMatch: 1.5,
          keywordMatch: 2.0,
          structuralChange: 1.8
        },
        priority: 'P0'
      },
      major: {
        keywords: [
          'endpoint', 'action', 'event', 
          'input', 'output', 'method', 'trigger'
        ],
        factors: {
          pathMatch: 1.2,
          keywordMatch: 1.5,
          structuralChange: 1.3
        },
        priority: 'P1'
      },
      minor: {
        keywords: [
          'description', 'metadata', 'version', 
          'category', 'name', 'comment'
        ],
        factors: {
          pathMatch: 1.0,
          keywordMatch: 1.0,
          structuralChange: 1.0
        },
        priority: 'P2'
      }
    };

    // Allow custom rules from configuration
    const customRules = config.get('priorityRules', {});
    return { ...defaultRules, ...customRules };
  }

  calculatePriority(change) {
    try {
      const changeContext = this.normalizeChangeContext(change);
      
      // Calculate priority based on multiple factors
      const scores = Object.entries(this.priorityRules).map(([level, ruleSet]) => ({
        level,
        score: this.calculatePriorityScore(changeContext, ruleSet)
      }));

      // Sort by score in descending order
      const prioritizedScore = scores.sort((a, b) => b.score - a.score)[0];
      
      logger.debug('Priority Calculation', {
        change: changeContext,
        scores,
        selectedPriority: prioritizedScore.level
      });

      return this.priorityRules[prioritizedScore.level].priority;
    } catch (error) {
      logger.warn('Priority calculation failed', { 
        change, 
        error: error.message 
      });
      return 'P2'; // Default to lowest priority
    }
  }

  normalizeChangeContext(change) {
    // Create a normalized representation of the change
    return {
      type: change.type || 'unknown',
      path: (change.path || '').toLowerCase(),
      file: (change.file || '').toLowerCase(),
      category: (change.category || '').toLowerCase(),
      value: JSON.stringify(change).toLowerCase()
    };
  }

  calculatePriorityScore(context, ruleSet) {
    let score = 0;

    // Keyword matching
    const keywordMatches = ruleSet.keywords.filter(keyword => 
      Object.values(context).some(val => val.includes(keyword))
    );
    score += keywordMatches.length * (ruleSet.factors?.keywordMatch || 1.0);

    // Path matching
    if (ruleSet.keywords.some(keyword => context.path.includes(keyword))) {
      score += ruleSet.factors?.pathMatch || 1.0;
    }

    // Structural change assessment
    const structuralChangeIndicators = [
      'added', 'removed', 'modified', 
      'file-added', 'file-removed'
    ];
    if (structuralChangeIndicators.includes(context.type)) {
      score += ruleSet.factors?.structuralChange || 1.0;
    }

    return score;
  }

  // Advanced priority classification with more nuanced approach
  classifyChange(change) {
    const priority = this.calculatePriority(change);
    
    return {
      ...change,
      priority,
      significance: this.assessSignificance(change, priority)
    };
  }

  assessSignificance(change, priority) {
    const significanceMap = {
      'P0': {
        label: 'Critical',
        description: 'Immediate attention required. Potential security or core functionality impact.',
        actionRequired: 'Urgent review and mitigation'
      },
      'P1': {
        label: 'Major',
        description: 'Significant change affecting core features or system behavior.',
        actionRequired: 'Detailed review and testing'
      },
      'P2': {
        label: 'Minor',
        description: 'Low-impact change with minimal system effect.',
        actionRequired: 'Standard review process'
      }
    };

    return significanceMap[priority];
  }

  // Utility method for generating comprehensive change reports
  generateChangeReport(changes) {
    const summary = {
      total: changes.length,
      byPriority: { P0: 0, P1: 0, P2: 0 },
      byType: {},
      categories: {}
    };

    changes.forEach(change => {
      const prioritizedChange = this.classifyChange(change);
      
      // Count by priority
      summary.byPriority[prioritizedChange.priority]++;

      // Count by type
      summary.byType[change.type] = 
        (summary.byType[change.type] || 0) + 1;

      // Count by category
      const category = change.category || 'uncategorized';
      summary.categories[category] = 
        (summary.categories[category] || 0) + 1;
    });

    return summary;
  }

  // Get change emoji based on type and priority
  getChangeEmoji(type, priority) {
    switch (type) {
      case 'file-added':
      case 'folder-added':
      case 'added':
        return '➕';
      case 'file-removed':
      case 'folder-removed':
      case 'removed':
        return '❌';
      case 'modified':
        return '✏️';
      default:
        // Use priority-based emoji for other cases
        if (priority === 'P0') return '🚨';
        if (priority === 'P1') return '⚠️';
        return 'ℹ️';
    }
  }

  // Generate statistics from report data
  generateStats(processedData) {
    const stats = {
      priority: { P0: 0, P1: 0, P2: 0 },
      changeTypes: {
        added: 0,
        removed: 0,
        modified: 0,
        'file-added': 0,
        'file-removed': 0,
        'folder-added': 0,
        'folder-removed': 0
      },
      categories: {}
    };

    processedData.forEach(connector => {
      connector.changes.forEach(change => {
        // Count priorities
        stats.priority[change.priority || 'P2']++;

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
        stats.categories[category][change.priority || 'P2']++;
      });
    });

    return stats;
  }
}

module.exports = new AdvancedPrioritizer();


// 4. src/report-generator.js
// ==========================
const fs = require('fs').promises;
const path = require('path');
const config = require('./config-manager');
const logger = require('./logger');

class ReportGenerator {
  constructor() {
    this.supportedFormats = {
      html: this.generateHTMLReport.bind(this),
      markdown: this.generateMarkdownReport.bind(this),
      json: this.generateJSONReport.bind(this)
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
      `functional-change-report.${format === 'html' ? 'html' : format === 'markdown' ? 'md' : 'json'}`
    );

    try {
      // Process the data first
      const processedData = this.processReportData(comparisonResults);
      
      // Generate the report using the appropriate format
      await this.supportedFormats[format](processedData, outputPath);
      
      logger.info(`${format.toUpperCase()} report generated`, { path: outputPath });
      return outputPath;
    } catch (error) {
      logger.error(`Failed to generate ${format} report`, error);
      throw error;
    }
  }

  async generateHTMLReport(processedData, outputPath) {
    try {
      const template = await this.loadTemplate('html-template.html');
      
      const stats = this.generateStats(processedData);
  
      const filledTemplate = template
        .replace('{{REPORT_DATA}}', JSON.stringify(processedData))
        .replace('{{STATS_DATA}}', JSON.stringify(stats));
  
      await fs.writeFile(outputPath, filledTemplate, 'utf8');
    } catch (error) {
      logger.error(`Failed to generate HTML report: ${error.message}`, error);
      throw error;
    }
  }

  async generateMarkdownReport(processedData, outputPath) {
    try {
      const { generateMarkdownReport } = require('./report-generators/markdown-report');
      await generateMarkdownReport(processedData, outputPath);
    } catch (error) {
      logger.error(`Failed to generate Markdown report: ${error.message}`, error);
      throw error;
    }
  }

  async generateJSONReport(processedData, outputPath) {
    try {
      const { generateJSONReport } = require('./report-generators/json-report');
      await generateJSONReport(processedData, outputPath);
    } catch (error) {
      logger.error(`Failed to generate JSON report: ${error.message}`, error);
      throw error;
    }
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
    // Process the comparison results to add priority information
    const prioritizer = require('./advanced-prioritizer');
    
    return comparisonResults.map(connectorReport => ({
      connector: connectorReport.connector,
      changes: Array.isArray(connectorReport.changes) 
        ? connectorReport.changes.map(change => prioritizer.classifyChange(change))
        : []
    }));
  }

  generateStats(processedData) {
    const prioritizer = require('./advanced-prioritizer');
    return prioritizer.generateStats(processedData);
  }
}

module.exports = new ReportGenerator();


// 5. src/index.js
// ===============
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
      const [prevExists, currExists] = await Promise.all([
        this.pathExists(this.connectorSources.previous),
        this.pathExists(this.connectorSources.current)
      ]);
      
      if (!prevExists || !currExists) {
        throw new Error('Invalid connector source directories');
      }

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
  
  async pathExists(dirPath) {
    try {
      await fs.access(dirPath);
      return true;
    } catch {
      return false;
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

      // Generate comprehensive report
      const reportPaths = await reportGenerator.generateReports(comparisonResults);

      const duration = timer.end();
      
      // Generate summary report
      const changeSummary = comparisonResults.reduce((summary, connector) => {
        summary[connector.connector] = prioritizer.generateChangeReport(connector.changes || []);
        return summary;
      }, {});

      logger.info('Comparison process complete', {
        duration: `${duration}ms`,
        reportPaths,
        changeSummary
      });

      return {
        results: comparisonResults,
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
const tool = new FunctionalChangeDetectionTool();
module.exports = tool;

// If run directly, start the process
if (require.main === module) {
  (async () => {
    try {
      await tool.start();
    } catch (error) {
      console.error('Unhandled error:', error);
      process.exit(1);
    }
  })();
}


// 6. src/report-generators/markdown-report.js
// ==========================================
const fs = require('fs').promises;
const path = require('path');

/**
 * Generate Markdown report
 * @param {Array} reports - Array of connector reports
 * @param {string} outputPath - Path to write Markdown file
 */
async function generateMarkdownReport(reports, outputPath) {
  // Import helper functions and modules
  const prioritizer = require('../advanced-prioritizer');
  const { formatValue } = require('../utils/file-utils');
  
  const stats = prioritizer.generateStats(reports);
  const lines = ["# 📋 Functional Change Report\n"];
  
  // Add priority counts summary
  lines.push(`> **Change Summary:** ${stats.priority.P0} Critical, ${stats.priority.P1} Major, ${stats.priority.P2} Minor changes\n`);
  
  // Collect critical changes for executive summary
  const criticalChanges = [];
  for (const { connector, changes } of reports) {
    for (const change of changes) {
      if (change.priority === "P0" || change.priority === "P1") {
        criticalChanges.push({ connector, ...change });
      }
    }
  }
  
  // Create executive summary if there are any critical changes
  if (criticalChanges.length > 0) {
    lines.push(`## 🚨 Executive Summary\n`);
    
    // Group by connector
    const criticalByConnector = {};
    for (const change of criticalChanges) {
      if (!criticalByConnector[change.connector]) {
        criticalByConnector[change.connector] = [];
      }
      criticalByConnector[change.connector].push(change);
    }
    
    // List critical changes by connector
    for (const [connector, changes] of Object.entries(criticalByConnector)) {
      lines.push(`### ${connector}\n`);
      
      for (const change of changes) {
        const emoji = prioritizer.getChangeEmoji(change.type, change.priority);
        const priority = change.priority === "P0" ? "🔴" : "🟠";
        
        let description;
        if (change.type === "file-added") {
          description = `Added file: \`${change.file}\``;
        } else if (change.type === "file-removed") {
          description = `Removed file: \`${change.file}\``;
        } else if (change.type === "folder-added") {
          description = `Added folder: \`${change.folder}/\``;
        } else if (change.type === "folder-removed") {
          description = `Removed folder: \`${change.folder}/\``;
        } else if (change.type === "added") {
          description = `Added \`${change.path}\` with value \`${formatValue(change.newVal)}\``;
        } else if (change.type === "removed") {
          description = `Removed \`${change.path}\` (was \`${formatValue(change.oldVal)}\`)`;
        } else if (change.type === "modified") {
          description = `Changed \`${change.path}\``;
        }
        
        lines.push(`- ${priority} ${emoji} ${description}`);
      }
      
      lines.push('');
    }
  }
  
  // Detailed changes by connector
  for (const { connector, changes } of reports) {
    if (changes.length === 0) continue;
    
    lines.push(`## 🔌 Connector: \`${connector}\`\n`);

    // Generate a summary of changes
    const summary = [];
    const categoryMap = {};

    for (const change of changes) {
      const cat = change.category || "general";
      if (!categoryMap[cat]) categoryMap[cat] = [];
      categoryMap[cat].push(change);

      if (change.type === "file-added") summary.push(`🆕 ${change.file}`);
      if (change.type === "file-removed") summary.push(`🗑️ ${change.file}`);
      if (change.type === "folder-added")
        summary.push(`📁 New folder: ${change.folder}`);
      if (change.type === "folder-removed")
        summary.push(`📁 Removed folder: ${change.folder}`);
      if (change.type === "modified" && change.path && change.path.includes("auth"))
        summary.push(`🔐 Auth change`);
      if (change.type === "modified" && change.path && change.path.includes("outputFields"))
        summary.push(`📦 Output structure changed`);
    }

    lines.push(`### 🧾 Summary of Changes`);
    for (const item of [...new Set(summary)]) {
      lines.push(`- ${item}`);
    }
    lines.push('');

    // Group changes by category
    for (const [category, catChanges] of Object.entries(categoryMap)) {
      const catTitle = category.charAt(0).toUpperCase() + category.slice(1);
      lines.push(`### 📂 ${catTitle} Changes`);

      for (const change of catChanges) {
        const emoji = prioritizer.getChangeEmoji(change.type, change.priority);
        
        if (change.type === "file-added") {
          lines.push(`${emoji} New file: \`${change.file}\``);
        } else if (change.type === "file-removed") {
          lines.push(`${emoji} Removed file: \`${change.file}\``);
        } else if (change.type === "folder-added") {
          lines.push(`${emoji} New folder added: \`${change.folder}/\``);
        } else if (change.type === "folder-removed") {
          lines.push(`${emoji} Folder removed: \`${change.folder}/\``);
        } else if (change.type === "added") {
          lines.push(`${emoji} Added \`${change.path}\` with value \`${formatValue(change.newVal)}\``);
        } else if (change.type === "removed") {
          lines.push(`${emoji} Removed \`${change.path}\` (was \`${formatValue(change.oldVal)}\`)`);
        } else if (change.type === "modified") {
          lines.push(`${emoji} Changed \`${change.path}\`: \`${formatValue(change.oldVal)}\` → \`${formatValue(change.newVal)}\``);
        }
      }
      
      lines.push('');
    }
  }

  await fs.writeFile(outputPath, lines.join("\n"), 'utf-8');
}

module.exports = { generateMarkdownReport };


// 7. src/report-generators/json-report.js
// ======================================
const fs = require('fs').promises;

/**
 * Generate JSON report
 * @param {Array} reports - Array of connector reports
 * @param {string} outputPath - Path to write JSON file
 */
async function generateJSONReport(reports, outputPath) {
  // Create a formatted JSON string
  const jsonContent = JSON.stringify(reports, null, 2);
  
  // Write the JSON file
  await fs.writeFile(outputPath, jsonContent, 'utf-8');
}

module.exports = { generateJSONReport };


// 8. src/report-generators/html-report.js
// ======================================
const fs = require('fs').promises;
const path = require('path');

/**
 * Generate HTML report
 * @param {Array} reports - Array of connector reports
 * @param {string} outputPath - Path to write HTML file
 */
async function generateHTMLReport(reports, outputPath) {
  // Import required modules
  const prioritizer = require('../advanced-prioritizer');
  const stats = prioritizer.generateStats(reports);
  
  // Read the HTML template
  const templatePath = path.join(__dirname, '../../templates/html-template.html');
  let template = await fs.readFile(templatePath, 'utf-8');
  
  // Replace placeholders with data
  template = template.replace('{{REPORT_DATA}}', JSON.stringify(reports));
  template = template.replace('{{STATS_DATA}}', JSON.stringify(stats));
  
  // Write the HTML report
  await fs.writeFile(outputPath, template, 'utf-8');
}

module.exports = { generateHTMLReport };


// 9. run-detection.sh
// ===================
// This should be a simple shell script to run the detection tool
#!/bin/bash

# Run the functional change detection script
node src/index.js