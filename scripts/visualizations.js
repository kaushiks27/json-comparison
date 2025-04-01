/**
 * Visualization functions for report UI
 */

// This file contains any additional visualizations we might add in the future
// Currently the visualizations are primarily handled in interactivity.js

// Create simple bar chart for a distribution
function createBarChart(elementId, data, options = {}) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const {
    width = 300,
    height = 150,
    margin = { top: 10, right: 10, bottom: 30, left: 40 },
    barColor = '#0366d6',
    textColor = 'var(--color-text)'
  } = options;
  
  // Calculate inner dimensions
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  
  // Create SVG element
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  
  // Create group for chart
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('transform', `translate(${margin.left},${margin.top})`);
  svg.appendChild(g);
  
  // Calculate scales
  const xScale = innerWidth / data.length;
  const maxValue = Math.max(...Object.values(data));
  const yScale = innerHeight / maxValue;
  
  // Draw bars
  let index = 0;
  for (const [key, value] of Object.entries(data)) {
    const barWidth = xScale * 0.8;
    const barHeight = value * yScale;
    const x = index * xScale + (xScale - barWidth) / 2;
    const y = innerHeight - barHeight;
    
    // Create bar rectangle
    const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bar.setAttribute('x', x);
    bar.setAttribute('y', y);
    bar.setAttribute('width', barWidth);
    bar.setAttribute('height', barHeight);
    bar.setAttribute('fill', barColor);
    g.appendChild(bar);
    
    // Create label
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x + barWidth / 2);
    text.setAttribute('y', innerHeight + 15);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', textColor);
    text.setAttribute('font-size', '12px');
    text.textContent = key;
    g.appendChild(text);
    
    // Create value label
    const valueText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    valueText.setAttribute('x', x + barWidth / 2);
    valueText.setAttribute('y', y - 5);
    valueText.setAttribute('text-anchor', 'middle');
    valueText.setAttribute('fill', textColor);
    valueText.setAttribute('font-size', '10px');
    valueText.textContent = value;
    g.appendChild(valueText);
    
    index++;
  }
  
  // Clear element and add chart
  element.innerHTML = '';
  element.appendChild(svg);
}

// Create pie chart
function createPieChart(elementId, data, options = {}) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const {
    width = 200,
    height = 200,
    colors = ['#0366d6', '#dc3545', '#28a745', '#ffc107', '#17a2b8'],
    textColor = 'var(--color-text)'
  } = options;
  
  // Calculate total
  const total = Object.values(data).reduce((sum, value) => sum + value, 0);
  if (total === 0) return;
  
  // Create SVG element
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', '-1 -1 2 2');
  
  // Draw pie slices
  let startAngle = 0;
  let index = 0;
  const radius = 1;
  const cx = 0;
  const cy = 0;
  
  for (const [key, value] of Object.entries(data)) {
    const percentage = value / total;
    const endAngle = startAngle + percentage * Math.PI * 2;
    
    // Calculate start and end points
    const startX = cx + radius * Math.sin(startAngle);
    const startY = cy - radius * Math.cos(startAngle);
    const endX = cx + radius * Math.sin(endAngle);
    const endY = cy - radius * Math.cos(endAngle);
    
    // Create arc path
    const largeArcFlag = percentage > 0.5 ? 1 : 0;
    const pathData = [
      `M ${cx} ${cy}`,
      `L ${startX} ${startY}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`,
      'Z'
    ].join(' ');
    
    const slice = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    slice.setAttribute('d', pathData);
    slice.setAttribute('fill', colors[index % colors.length]);
    slice.setAttribute('stroke', 'var(--color-bg)');
    slice.setAttribute('stroke-width', '0.01');
    
    // Add title for tooltip
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${key}: ${value} (${Math.round(percentage * 100)}%)`;
    slice.appendChild(title);
    
    svg.appendChild(slice);
    
    // Move to next slice
    startAngle = endAngle;
    index++;
  }
  
  // Clear element and add chart
  element.innerHTML = '';
  element.appendChild(svg);
  
  // Create legend
  const legend = document.createElement('div');
  legend.style.marginTop = '10px';
  legend.style.display = 'flex';
  legend.style.flexWrap = 'wrap';
  legend.style.justifyContent = 'center';
  
  index = 0;
  for (const [key, value] of Object.entries(data)) {
    const percentage = value / total;
    
    const legendItem = document.createElement('div');
    legendItem.style.display = 'flex';
    legendItem.style.alignItems = 'center';
    legendItem.style.margin = '0 10px 5px 0';
    
    const colorBox = document.createElement('div');
    colorBox.style.width = '12px';
    colorBox.style.height = '12px';
    colorBox.style.backgroundColor = colors[index % colors.length];
    colorBox.style.marginRight = '5px';
    
    const label = document.createElement('span');
    label.textContent = `${key}: ${value} (${Math.round(percentage * 100)}%)`;
    
    legendItem.appendChild(colorBox);
    legendItem.appendChild(label);
    legend.appendChild(legendItem);
    
    index++;
  }
  
  element.appendChild(legend);
}

// Function to create and add tooltip to element
function addTooltip(element, text) {
  if (!element) return;
  
  element.setAttribute('title', text);
  
  // Optional: Create custom tooltip
  element.addEventListener('mouseenter', function(e) {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = text;
    tooltip.style.position = 'absolute';
    tooltip.style.backgroundColor = 'var(--color-dark)';
    tooltip.style.color = 'white';
    tooltip.style.padding = '5px 10px';
    tooltip.style.borderRadius = '3px';
    tooltip.style.zIndex = '1000';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.transition = 'opacity 0.3s';
    tooltip.style.fontSize = '12px';
    
    document.body.appendChild(tooltip);
    
    const updatePosition = function(e) {
      tooltip.style.left = (e.pageX + 10) + 'px';
      tooltip.style.top = (e.pageY + 10) + 'px';
    };
    
    updatePosition(e);
    
    element.addEventListener('mousemove', updatePosition);
    
    element.addEventListener('mouseleave', function() {
      document.body.removeChild(tooltip);
      element.removeEventListener('mousemove', updatePosition);
    }, { once: true });
  });
}