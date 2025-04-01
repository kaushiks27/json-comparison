/**
 * Deployment Automation Utility Functions
 * Purpose: Data extraction and processing for monthly deployment workflow
 * Version: 1.0
 * Last Updated: 2025-04-01
 */

/**
 * Extracts the week number from calendar content
 * @param {string} calendarContent - Raw text content from Confluence calendar
 * @returns {string|null} Extracted week number or null
 */
function extractWeekNumber(calendarContent) {
  const weekPattern = /W(\d+)/;
  const match = calendarContent.match(weekPattern);
  
  return match ? match[1] : null;
}

/**
 * Parses the deployment date from calendar content
 * @param {string} calendarContent - Raw text content from Confluence calendar
 * @returns {string|null} Extracted date or null
 */
function parseDateFromCalendar(calendarContent) {
  const datePattern = /(\w{3}, \w+ \d+)/;
  const match = calendarContent.match(datePattern);
  
  return match ? match[1] : null;
}

/**
 * Determines deployment environment based on day of the week
 * @param {string|Date} inputDate - Date to determine environment
 * @returns {string} Deployment environment (Prod, Preview, or Not Applicable)
 */
function determineDeploymentEnvironment(inputDate) {
  const date = new Date(inputDate);
  const day = date.getDay();
  
  switch(day) {
    case 2: // Tuesday
      return 'Prod';
    case 3: // Wednesday
      return 'Preview';
    default:
      return 'Not Applicable';
  }
}

/**
 * Extracts version number from calendar content
 * @param {string} calendarContent - Raw text content from Confluence calendar
 * @returns {string|null} Extracted version number or null
 */
function extractVersionNumber(calendarContent) {
  const versionPattern = /(\d{4}\.\d{2}\.\d+)/;
  const match = calendarContent.match(versionPattern);
  
  return match ? match[1] : null;
}

/**
 * Looks up CF tag based on version number in CF tag table
 * @param {string} version - Version number to look up
 * @param {string} cfTagTable - Raw text content of CF tag table
 * @returns {string|null} Extracted CF tag or null
 */
function lookupCFTag(version, cfTagTable) {
  const cfTagPattern = new RegExp(`\\| .*?\\| ${version}\\s*\\| (CF_\\d{4}\\.\\d+)`);
  const match = cfTagTable.match(cfTagPattern);
  
  return match ? match[1] : null;
}

/**
 * Comprehensive deployment information processor
 * @param {Object} params - Input parameters for processing
 * @param {string} params.calendarContent - Calendar page content
 * @param {string} params.cfTagTable - CF tag table content
 * @returns {Object} Processed deployment information
 */
function processDeploymentInformation(params) {
  const weekNumber = extractWeekNumber(params.calendarContent);
  const parsedDate = parseDateFromCalendar(params.calendarContent);
  const version = extractVersionNumber(params.calendarContent);
  const environment = determineDeploymentEnvironment(parsedDate);
  const cfTag = lookupCFTag(version, params.cfTagTable);

  return {
    weekNumber,
    date: parsedDate,
    version,
    environment,
    cfTag,
    fullComment: generateDeploymentComment({
      weekNumber,
      date: parsedDate,
      environment,
      version,
      cfTag
    })
  };
}

/**
 * Generates deployment comment in specified format
 * @param {Object} commentParams - Parameters for comment generation
 * @returns {string} Formatted deployment comment
 */
function generateDeploymentComment(commentParams) {
  const { weekNumber, date, environment, version, cfTag } = commentParams;
  
  return `Week ${weekNumber}
${date} - ${environment} - ${version} - ${cfTag}`;
}

// Export functions for module usage
module.exports = {
  extractWeekNumber,
  parseDateFromCalendar,
  determineDeploymentEnvironment,
  extractVersionNumber,
  lookupCFTag,
  processDeploymentInformation,
  generateDeploymentComment
};

// Example usage
function exampleWorkflow() {
  try {
    const sampleCalendarContent = 'W17 Weekly Update on Tues, Apr 22 - Version 2025.04.2';
    const sampleCFTagTable = '| 2025.04.2 | CF_2025.16 |';

    const deploymentInfo = processDeploymentInformation({
      calendarContent: sampleCalendarContent,
      cfTagTable: sampleCFTagTable
    });

    console.log('Deployment Information:', deploymentInfo);
  } catch (error) {
    console.error('Workflow processing error:', error);
  }
}

// Uncomment to run example
// exampleWorkflow();
