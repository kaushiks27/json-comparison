/**
 * Priority classifier module
 * Determines priority levels for different types of changes
 */

// Priority levels for different types of changes
const PRIORITY_LEVELS = {
  P0: "Critical", // Authentication, security-related fields
  P1: "Major",    // New actions, removed features, altered structure
  P2: "Minor"     // Description updates, cosmetic changes
};

// Priority mapping rules
const PRIORITY_RULES = {
  // P0 - Critical changes
  "auth/": "P0",
  "security": "P0",
  "permissions": "P0",
  "authentication": "P0",
  "authorization": "P0",
  
  // P1 - Major changes
  "actions/": "P1",
  "events/": "P1",
  "file-added": "P1",
  "file-removed": "P1",
  "folder-added": "P1",
  "folder-removed": "P1",
  "endpoint": "P1",
  "httpMethod": "P1",
  "inputFields": "P1",
  "outputFields": "P1",
  "trigger": "P1",
  "payload": "P1",
  
  // Default to P2 - Minor changes
  "default": "P2"
};

/**
 * Determine priority level based on change type and path
 * @param {Object} change - The change object
 * @returns {string} - Priority level (P0, P1, P2)
 */
function determinePriority(change) {
  // Check exact matches first
  if (change.category === "auth") return "P0";
  
  // Check for pattern matches in path or content
  for (const [pattern, priority] of Object.entries(PRIORITY_RULES)) {
    if (pattern === "default") continue;
    
    // Check if the pattern appears in the path or type
    if (
      (change.path && change.path.includes(pattern)) ||
      (change.file && change.file.includes(pattern)) ||
      (change.folder && change.folder.includes(pattern)) ||
      (change.type && change.type.includes(pattern))
    ) {
      return priority;
    }
    
    // For modified changes, check if old or new values contain critical keywords
    if (change.type === "modified" && (
      (typeof change.oldVal === "string" && change.oldVal.includes(pattern)) ||
      (typeof change.newVal === "string" && change.newVal.includes(pattern))
    )) {
      return priority; 
    }
  }
  
  // Default to P2 - Minor changes
  return PRIORITY_RULES.default;
}

/**
 * Get emoji for change type
 * @param {string} type - Type of change
 * @param {string} priority - Priority level
 * @returns {string} - Emoji representation
 */
function getChangeEmoji(type, priority) {
  switch (type) {
    case "file-added":
    case "folder-added":
    case "added":
      return "➕";
    case "file-removed":
    case "folder-removed":
    case "removed":
      return "❌";
    case "modified":
      return "✏️";
    default:
      // Use priority-based emoji for other cases
      if (priority === "P0") return "🚨";
      if (priority === "P1") return "⚠️";
      return "ℹ️";
  }
}

/**
 * Generate statistics for visualization
 * @param {Array} reports - Array of connector reports
 * @returns {Object} - Statistics object
 */
function generateStats(reports) {
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
    categories: {},
    connectors: {}
  };
  
  for (const { connector, changes } of reports) {
    stats.connectors[connector] = {
      total: changes.length,
      P0: 0,
      P1: 0,
      P2: 0,
    };
    
    for (const change of changes) {
      // Count by priority
      stats.priority[change.priority]++;
      stats.connectors[connector][change.priority]++;
      
      // Count by change type
      stats.changeTypes[change.type]++;
      
      // Count by category
      if (!stats.categories[change.category]) {
        stats.categories[change.category] = {
          total: 0,
          P0: 0,
          P1: 0,
          P2: 0
        };
      }
      stats.categories[change.category].total++;
      stats.categories[change.category][change.priority]++;
    }
  }
  
  return stats;
}

module.exports = { 
  PRIORITY_LEVELS, 
  determinePriority, 
  getChangeEmoji,
  generateStats
};
