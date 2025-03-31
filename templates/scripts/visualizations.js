/**
 * Visualization and stats functionality
 */

// Generate statistics summary with visualizations
function generateStatsSummary() {
  const statsElement = document.getElementById('stats-summary');
  
  statsElement.innerHTML = `
    <h2>📊 Change Statistics</h2>
    <details open>
      <summary><strong>Statistics Overview</strong></summary>
      <div class="stats-grid">
        <div class="stats-card">
          <h3>Changes by Priority</h3>
          <div class="progress-container">
            <div class="progress-bar" style="width: ${getPercentage(statsData.priority.P0, getTotalChanges())}%; background-color: var(--color-p0);" title="Critical: ${statsData.priority.P0}">
              ${statsData.priority.P0}
            </div>
            <div class="progress-bar" style="width: ${getPercentage(statsData.priority.P1, getTotalChanges())}%; background-color: var(--color-p1);" title="Major: ${statsData.priority.P1}">
              ${statsData.priority.P1}
            </div>
            <div class="progress-bar" style="width: ${getPercentage(statsData.priority.P2, getTotalChanges())}%; background-color: var(--color-p2);" title="Minor: ${statsData.priority.P2}">
              ${statsData.priority.P2}
            </div>
          </div>
          <p>
            <span class="badge badge-p0">${statsData.priority.P0} Critical</span>
            <span class="badge badge-p1">${statsData.priority.P1} Major</span>
            <span class="badge badge-p2">${statsData.priority.P2} Minor</span>
          </p>
        </div>
        
        <div class="stats-card">
          <h3>Changes by Type</h3>
          <ul>
            <li>🆕 Added: ${statsData.changeTypes.added + statsData.changeTypes['file-added'] + statsData.changeTypes['folder-added']}</li>
            <li>❌ Removed: ${statsData.changeTypes.removed + statsData.changeTypes['file-removed'] + statsData.changeTypes['folder-removed']}</li>
            <li>✏️ Modified: ${statsData.changeTypes.modified}</li>
          </ul>
        </div>
        
        <div class="stats-card">
          <h3>Top Categories</h3>
          <ul>
            ${Object.entries(statsData.categories)
              .sort((a, b) => b[1].total - a[1].total)
              .slice(0, 3)
              .map(([category, data]) => `
                <li>${category}: ${data.total} changes (${data.P0} critical)</li>
              `).join('')}
          </ul>
        </div>
      </div>
    </details>
  `;
}

// Get total number of changes
function getTotalChanges() {
  return statsData.priority.P0 + statsData.priority.P1 + statsData.priority.P2;
}

// Calculate percentage
function getPercentage(value, total) {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

// Generate table of contents
function generateTableOfContents() {
  const tocElement = document.getElementById('table-of-contents');
  
  let tocHTML = `
    <h2>📖 Table of Contents</h2>
    <details open>
      <summary><strong>Navigation</strong></summary>
      <ul>
  `;
  
  // Add executive summary link
  tocHTML += `<li><a href="#executive-summary">Executive Summary</a></li>`;
  
  // Add connector links
  for (const { connector, changes } of reportData) {
    if (changes.length === 0) continue;
    
    const p0Count = changes.filter(c => c.priority === 'P0').length;
    const p1Count = changes.filter(c => c.priority === 'P1').length;
    const p2Count = changes.filter(c => c.priority === 'P2').length;
    
    const badges = [];
    if (p0Count > 0) badges.push(`<span class="badge badge-p0">${p0Count}</span>`);
    if (p1Count > 0) badges.push(`<span class="badge badge-p1">${p1Count}</span>`);
    if (p2Count > 0) badges.push(`<span class="badge badge-p2">${p2Count}</span>`);
    
    tocHTML += `<li><a href="#connector-${connector}">${connector}</a> ${badges.join(' ')}</li>`;
  }
  
  tocHTML += `
      </ul>
    </details>
  `;
  
  tocElement.innerHTML = tocHTML;
}

// Generate executive summary
function generateExecutiveSummary() {
  const executiveSummaryElement = document.getElementById('executive-summary');
  const criticalChanges = [];
  
  // Collect critical and major changes
  for (const { connector, changes } of reportData) {
    for (const change of changes) {
      if (change.priority === 'P0' || change.priority === 'P1') {
        criticalChanges.push({ connector, ...change });
      }
    }
  }
  
  // Sort by priority, then connector
  criticalChanges.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority === 'P0' ? -1 : 1;
    }
    return a.connector.localeCompare(b.connector);
  });
  
  if (criticalChanges.length === 0) {
    executiveSummaryElement.innerHTML = `
      <h2 id="executive-summary">🚨 Executive Summary</h2>
      <p>No critical or major changes detected.</p>
    `;
    return;
  }
  
  // Group by connector
  const criticalByConnector = {};
  for (const change of criticalChanges) {
    if (!criticalByConnector[change.connector]) {
      criticalByConnector[change.connector] = [];
    }
    criticalByConnector[change.connector].push(change);
  }
  
  let summaryHTML = `
    <h2 id="executive-summary">🚨 Executive Summary</h2>
    <details open>
      <summary><strong>Critical and Major Changes (${criticalChanges.length})</strong></summary>
  `;
  
  // List critical changes by connector
  for (const [connector, changes] of Object.entries(criticalByConnector)) {
    summaryHTML += `<h3>${connector}</h3><ul>`;
    
    for (const change of changes) {
      const emoji = getChangeEmoji(change.type, change.priority);
      const priority = change.priority === 'P0' ? '🔴' : '🟠';
      
      // Create anchor link
      const anchor = `${connector}-${change.category}-${change.type}-${change.path || change.file || change.folder}`.replace(/[^\w-]/g, '-');
      
      let description;
      if (change.type === 'file-added') {
        description = `Added file: <code>${change.file}</code>`;
      } else if (change.type === 'file-removed') {
        description = `Removed file: <code>${change.file}</code>`;
      } else if (change.type === 'folder-added') {
        description = `Added folder: <code>${change.folder}/</code>`;
      } else if (change.type === 'folder-removed') {
        description = `Removed folder: <code>${change.folder}/</code>`;
      } else if (change.type === 'added') {
        description = `Added <code>${change.path}</code>`;
      } else if (change.type === 'removed') {
        description = `Removed <code>${change.path}</code>`;
      } else if (change.type === 'modified') {
        description = `Changed <code>${change.path}</code>`;
      }
      
      summaryHTML += `<li data-priority="${change.priority}" data-type="${change.type}" data-category="${change.category}">${priority} ${emoji} ${description} <a href="#${anchor}">(details)</a></li>`;
    }
    
    summaryHTML += '</ul>';
  }
  
  summaryHTML += '</details>';
  executiveSummaryElement.innerHTML = summaryHTML;
}

// Get emoji for change type
function getChangeEmoji(type, priority) {
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
