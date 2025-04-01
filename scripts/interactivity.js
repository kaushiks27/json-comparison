/**
 * UI interactions and event handlers for report UI
 */

// Generate report content
function generateReportContent() {
  if (!window.reportData) return;
  
  const reportElement = document.getElementById('report-content');
  if (!reportElement) return;
  
  let reportHTML = '';
  
  // Generate connector sections
  for (const { connector, changes } of window.reportData) {
    if (!changes || changes.length === 0) continue;
    
    // Determine if connector has critical changes
    const hasCritical = changes.some(c => c.priority === 'P0');
    
    reportHTML += `
      <h2 id="connector-${connector}">🔌 Connector: ${connector}</h2>
      <details ${hasCritical ? 'open' : ''}>
        <summary><strong>Changes (${changes.length})</strong></summary>
    `;
    
    // Generate change summary
    const summary = [];
    if (changes.some(c => c.type === 'file-added')) {
      summary.push('🆕 New files added');
    }
    if (changes.some(c => c.type === 'file-removed')) {
      summary.push('🗑️ Files removed');
    }
    if (changes.some(c => c.type === 'folder-added')) {
      summary.push('📁 New folders added');
    }
    if (changes.some(c => c.type === 'folder-removed')) {
      summary.push('📁 Folders removed');
    }
    if (changes.some(c => c.type === 'modified' && c.path && c.path.includes('auth'))) {
      summary.push('🔐 Auth changes');
    }
    if (changes.some(c => c.type === 'modified' && c.path && c.path.includes('outputFields'))) {
      summary.push('📦 Output structure changes');
    }
    
    reportHTML += '<h3>🧾 Summary of Changes</h3><ul>';
    for (const item of summary) {
      reportHTML += `<li>${item}</li>`;
    }
    reportHTML += '</ul>';
    
    // Group changes by priority
    const changesByPriority = {
      P0: [],
      P1: [],
      P2: []
    };
    
    for (const change of changes) {
      const priority = change.priority || 'P2';
      changesByPriority[priority].push(change);
    }
    
    // Priority icons
    const priorityIcons = {
      P0: '🔴 Critical',
      P1: '🟠 Major',
      P2: '🟢 Minor'
    };
    
    // Show changes grouped by priority
    for (const priority of ['P0', 'P1', 'P2']) {
      const priorityChanges = changesByPriority[priority];
      if (priorityChanges.length === 0) continue;
      
      const openByDefault = priority === 'P0';
      
      reportHTML += `
        <h3>${priorityIcons[priority]} Changes (${priorityChanges.length})</h3>
        <details ${openByDefault ? 'open' : ''}>
          <summary><strong>${priority === 'P0' ? 'Critical' : priority === 'P1' ? 'Major' : 'Minor'} Changes</strong></summary>
      `;
      
      // Group by category
      const categorizedChanges = {};
      for (const change of priorityChanges) {
        const category = change.category || 'general';
        if (!categorizedChanges[category]) {
          categorizedChanges[category] = [];
        }
        categorizedChanges[category].push(change);
      }
      
      // Display changes by category
      for (const [category, categoryChanges] of Object.entries(categorizedChanges)) {
        const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1);
        
        if (Object.keys(categorizedChanges).length > 1) {
          reportHTML += `<h4>📂 ${categoryTitle}</h4>`;
        }
        
        // Display each change
        for (const change of categoryChanges) {
          const emoji = getChangeEmoji(change.type, change.priority);
          const anchor = `${connector}-${change.category}-${change.type}-${change.path || change.file || change.folder}`.replace(/[^\w-]/g, '-');
          
          reportHTML += `<div id="${anchor}" data-priority="${change.priority}" data-type="${change.type}" data-category="${change.category}" class="change-item">`;
          
          if (change.type === 'file-added') {
            reportHTML += `<p>${emoji} <strong>New file:</strong> <code>${change.file}</code></p>`;
          } else if (change.type === 'file-removed') {
            reportHTML += `<p>${emoji} <strong>Removed file:</strong> <code>${change.file}</code></p>`;
          } else if (change.type === 'folder-added') {
            reportHTML += `<p>${emoji} <strong>New folder added:</strong> <code>${change.folder}/</code></p>`;
          } else if (change.type === 'folder-removed') {
            reportHTML += `<p>${emoji} <strong>Folder removed:</strong> <code>${change.folder}/</code></p>`;
          } else if (change.type === 'added') {
            reportHTML += `
              <p>${emoji} <strong>Added:</strong> <code>${change.path}</code></p>
              <pre><code class="change-added">${JSON.stringify(change.newVal, null, 2)}</code></pre>
            `;
          } else if (change.type === 'removed') {
            reportHTML += `
              <p>${emoji} <strong>Removed:</strong> <code>${change.path}</code></p>
              <pre><code class="change-removed">${JSON.stringify(change.oldVal, null, 2)}</code></pre>
            `;
          } else if (change.type === 'modified') {
            // Check if values are simple or complex
            const isSimpleValue = (
              (typeof change.oldVal !== 'object' || change.oldVal === null) &&
              (typeof change.newVal !== 'object' || change.newVal === null)
            );
            
            reportHTML += `<p>${emoji} <strong>Changed:</strong> <code>${change.path}</code></p>`;
            
            if (isSimpleValue) {
              // For simple values, show inline diff
              const oldStr = String(change.oldVal);
              const newStr = String(change.newVal);
              
              reportHTML += `
                <div class="inline-diff">
                  <p><strong>Before:</strong> <code class="change-removed">${oldStr}</code></p>
                  <p><strong>After:</strong> <code class="change-added">${newStr}</code></p>
                </div>
              `;
            } else {
              // For complex objects, show side-by-side comparison
              reportHTML += `
                <table>
                  <tr>
                    <th>Before</th>
                    <th>After</th>
                  </tr>
                  <tr>
                    <td><pre><code class="change-removed">${JSON.stringify(change.oldVal, null, 2)}</code></pre></td>
                    <td><pre><code class="change-added">${JSON.stringify(change.newVal, null, 2)}</code></pre></td>
                  </tr>
                </table>
              `;
            }
          }
          
          reportHTML += '</div>';
        }
      }
      
      reportHTML += '</details>';
    }
    
    reportHTML += `
      </details>
      <p><a href="#table-of-contents">Back to Table of Contents</a></p>
    `;
  }
  
  reportElement.innerHTML = reportHTML;
}

// Generate table of contents
function generateTableOfContents() {
  if (!window.reportData) return;
  
  const tocElement = document.getElementById('table-of-contents');
  if (!tocElement) return;
  
  let tocHTML = `
    <h2>📖 Table of Contents</h2>
    <details open>
      <summary><strong>Navigation</strong></summary>
      <ul>
  `;
  
  // Add executive summary link
  tocHTML += `<li><a href="#executive-summary">Executive Summary</a></li>`;
  
  // Add connector links
  for (const { connector, changes } of window.reportData) {
    if (!changes || changes.length === 0) continue;
    
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
  if (!window.reportData) return;
  
  const executiveSummaryElement = document.getElementById('executive-summary');
  if (!executiveSummaryElement) return;
  
  const criticalChanges = [];
  
  // Collect critical and major changes
  for (const { connector, changes } of window.reportData) {
    if (!changes) continue;
    
    for (const change of changes) {
      if (change.priority === 'P0' || change.priority === 'P1') {
        criticalChanges.push({ connector, ...change });
      }
    }
  }
  
  if (criticalChanges.length === 0) {
    executiveSummaryElement.innerHTML = `
      <h2 id="executive-summary">🚨 Executive Summary</h2>
      <p>No critical or major changes detected.</p>
    `;
    return;
  }
  
  // Sort by priority, then connector
  criticalChanges.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority === 'P0' ? -1 : 1;
    }
    return a.connector.localeCompare(b.connector);
  });
  
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

// Generate statistics summary
function generateStatsSummary() {
  if (!window.statsData) return;
  
  const statsElement = document.getElementById('stats-summary');
  if (!statsElement) return;
  
  statsElement.innerHTML = `
    <h2>📊 Change Statistics</h2>
    <details open>
      <summary><strong>Statistics Overview</strong></summary>
      <div class="stats-grid">
        <div class="stats-card">
          <h3>Changes by Priority</h3>
          <div class="progress-container">
            <div class="progress-bar" style="width: ${getPercentage(window.statsData.priority.P0, getTotalChanges())}%; background-color: var(--color-p0);" title="Critical: ${window.statsData.priority.P0}">
              ${window.statsData.priority.P0}
            </div>
            <div class="progress-bar" style="width: ${getPercentage(window.statsData.priority.P1, getTotalChanges())}%; background-color: var(--color-p1);" title="Major: ${window.statsData.priority.P1}">
              ${window.statsData.priority.P1}
            </div>
            <div class="progress-bar" style="width: ${getPercentage(window.statsData.priority.P2, getTotalChanges())}%; background-color: var(--color-p2);" title="Minor: ${window.statsData.priority.P2}">
              ${window.statsData.priority.P2}
            </div>
          </div>
          <p>
            <span class="badge badge-p0">${window.statsData.priority.P0} Critical</span>
            <span class="badge badge-p1">${window.statsData.priority.P1} Major</span>
            <span class="badge badge-p2">${window.statsData.priority.P2} Minor</span>
          </p>
        </div>
        
        <div class="stats-card">
          <h3>Changes by Type</h3>
          <ul>
            <li>🆕 Added: ${getAddedCount()}</li>
            <li>❌ Removed: ${getRemovedCount()}</li>
            <li>✏️ Modified: ${getModifiedCount()}</li>
          </ul>
        </div>
        
        <div class="stats-card">
          <h3>Top Categories</h3>
          <ul>
            ${getTopCategories()}
          </ul>
        </div>
      </div>
    </details>
  `;
}

// Get total number of changes
function getTotalChanges() {
  if (!window.statsData) return 0;
  return window.statsData.priority.P0 + window.statsData.priority.P1 + window.statsData.priority.P2;
}

// Get number of added changes
function getAddedCount() {
  if (!window.statsData || !window.statsData.changeTypes) return 0;
  
  return (window.statsData.changeTypes.added || 0) + 
         (window.statsData.changeTypes['file-added'] || 0) + 
         (window.statsData.changeTypes['folder-added'] || 0);
}

// Get number of removed changes
function getRemovedCount() {
  if (!window.statsData || !window.statsData.changeTypes) return 0;
  
  return (window.statsData.changeTypes.removed || 0) + 
         (window.statsData.changeTypes['file-removed'] || 0) + 
         (window.statsData.changeTypes['folder-removed'] || 0);
}

// Get number of modified changes
function getModifiedCount() {
  if (!window.statsData || !window.statsData.changeTypes) return 0;
  
  return window.statsData.changeTypes.modified || 0;
}

// Get top categories HTML
function getTopCategories() {
  if (!window.statsData || !window.statsData.categories) return '';
  
  return Object.entries(window.statsData.categories)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 3)
    .map(([category, data]) => `
      <li>${category}: ${data.total} changes (${data.P0} critical)</li>
    `).join('');
}

// Calculate percentage
function getPercentage(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
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

// Setup back to top button
function setupBackToTop() {
  const backToTopButton = document.getElementById('back-to-top');
  if (!backToTopButton) return;
  
  // Show button when page is scrolled down
  window.addEventListener('scroll', function() {
    if (window.pageYOffset > 300) {
      backToTopButton.classList.add('visible');
    } else {
      backToTopButton.classList.remove('visible');
    }
  });
  
  // Scroll to top when button is clicked
  backToTopButton.addEventListener('click', function() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

// Initialize theme toggle
function initTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  if (!themeToggle) return;
  
  const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const storedTheme = localStorage.getItem('theme');
  
  if (storedTheme === 'dark' || (!storedTheme && prefersDarkMode)) {
    document.body.setAttribute('data-theme', 'dark');
    themeToggle.checked = true;
  }
  
  themeToggle.addEventListener('change', function() {
    if (this.checked) {
      document.body.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  });
}

// Initialize UI when data is loaded
document.addEventListener('reportDataLoaded', function() {
  initTheme();
  generateStatsSummary();
  generateTableOfContents();
  generateExecutiveSummary();
  generateReportContent();
  setupBackToTop();
  
  // Apply URL parameters if any
  if (typeof applyUrlParams === 'function') {
    applyUrlParams();
  }
});