
// report-client.js
document.addEventListener('DOMContentLoaded', function() {
  try {
    const reportData = JSON.parse(document.getElementById('report-data-json').textContent);
    const statsData = JSON.parse(document.getElementById('stats-data-json').textContent);

    window.filterState = {
      priority: { P0: true, P1: true, P2: true },
      type: {
        added: true, removed: true, modified: true,
        'file-added': true, 'file-removed': true,
        'folder-added': true, 'folder-removed': true
      },
      category: {}, search: ''
    };

    // All original event bindings and UI logic would go here...
    console.log("Report initialized:", reportData, statsData);
  } catch (e) {
    console.error("Initialization failed:", e);
  }
});

function exportMarkdown() {
  window.location.href = 'functional-change-report.md';
}

function exportJSON() {
  window.location.href = 'functional-change-data.json';
}

function exportHTML() {
  const blob = new Blob([document.documentElement.outerHTML], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'functional-change-report.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
