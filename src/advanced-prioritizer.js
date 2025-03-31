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
    score += keywordMatches.length * ruleSet.factors.keywordMatch;

    // Path matching
    if (ruleSet.keywords.some(keyword => context.path.includes(keyword))) {
      score += ruleSet.factors.pathMatch;
    }

    // Structural change assessment
    const structuralChangeIndicators = [
      'added', 'removed', 'modified', 
      'file-added', 'file-removed'
    ];
    if (structuralChangeIndicators.includes(context.type)) {
      score += ruleSet.factors.structuralChange;
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
}

module.exports = new AdvancedPrioritizer();