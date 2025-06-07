// Dashboard.js - Real-time monitoring dashboard

// Connect to WebSocket server
const socket = io();

// References to DOM elements
const elements = {
  // Status bar elements
  serverUptime: document.getElementById('server-uptime'),
  dbStatus: document.getElementById('db-status'),
  cacheStatus: document.getElementById('cache-status'),
  memoryUsage: document.getElementById('memory-usage'),
  cpuLoad: document.getElementById('cpu-load'),
  
  // Database metrics
  dbReadSpeed: document.getElementById('db-read-speed'),
  dbWriteSpeed: document.getElementById('db-write-speed'),
  dbReadTime: document.getElementById('db-read-time'),
  dbWriteTime: document.getElementById('db-write-time'),
  
  // Cache metrics
  cacheHits: document.getElementById('cache-hits'),
  cacheMisses: document.getElementById('cache-misses'),
  cacheHitRatio: document.getElementById('cache-hit-ratio'),
  cacheKeys: document.getElementById('cache-keys'),
  
  // System metrics
  systemCpuLoad: document.getElementById('system-cpu-load'),
  systemMemoryUsed: document.getElementById('system-memory-used'),
  systemPlatform: document.getElementById('system-platform'),
  systemHostname: document.getElementById('system-hostname'),
  
  // API metrics
  apiTotal: document.getElementById('api-total'),
  apiRpm: document.getElementById('api-rpm'),
  apiSuccessRate: document.getElementById('api-success-rate'),
  apiAvgTime: document.getElementById('api-avg-time'),
  
  // Terminal elements
  apiTerminal: document.getElementById('api-terminal'),
  apiTotalRequests: document.getElementById('api-total-requests'),
  apiRequestsPerSecond: document.getElementById('api-requests-per-second'),
  apiAvgResponseTime: document.getElementById('api-avg-response-time'),
  clearTerminalBtn: document.getElementById('clear-terminal'),
  pauseTerminalBtn: document.getElementById('pause-terminal'),
  
  // Modal elements
  requestDetailsModal: document.getElementById('request-details-modal'),
  modalClose: document.querySelector('.modal-close'),
  detailId: document.getElementById('detail-id'),
  detailMethod: document.getElementById('detail-method'),
  detailUrl: document.getElementById('detail-url'),
  detailTime: document.getElementById('detail-time'),
  detailIp: document.getElementById('detail-ip'),
  detailUserAgent: document.getElementById('detail-user-agent'),
  detailHeaders: document.getElementById('detail-headers'),
  detailQuery: document.getElementById('detail-query'),
  detailBody: document.getElementById('detail-body'),
  detailStatus: document.getElementById('detail-status'),
  detailResponseTime: document.getElementById('detail-response-time'),
  detailResponseSize: document.getElementById('detail-response-size')
};

// Chart configurations and instances
const charts = {
  dbOperations: null,
  cacheHitRatio: null,
  systemResources: null,
  apiRequests: null
};

// Data for charts
const chartData = {
  timestamps: [],
  dbReads: [],
  dbWrites: [],
  cacheHits: [],
  cacheMisses: [],
  cpuLoad: [],
  memoryUsage: [],
  apiRequestsPerSecond: [],
  apiRequestsPerMinute: []
};

// Terminal state
const terminal = {
  isPaused: false,
  pendingRequests: {},
  maxLines: 100,
  requestCount: 0
};

// Maximum data points to keep in charts (for real-time scrolling effect)
const MAX_DATA_POINTS = 20;

// Initialize charts
function initializeCharts() {
  // Set Chart.js global defaults
  Chart.defaults.font.family = "'Segoe UI', 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.color = '#666';
  
  // Database Operations Chart
  charts.dbOperations = new Chart(
    document.getElementById('db-operations-chart'),
    {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Read Operations',
            data: [],
            borderColor: '#3498db',
            backgroundColor: 'rgba(52, 152, 219, 0.1)',
            tension: 0.3,
            fill: true
          },
          {
            label: 'Write Operations',
            data: [],
            borderColor: '#e74c3c',
            backgroundColor: 'rgba(231, 76, 60, 0.1)',
            tension: 0.3,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Database Operations'
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: false
            }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Operations'
            },
            suggestedMin: 0
          }
        }
      }
    }
  );
  
  // Cache Hit Ratio Chart
  charts.cacheHitRatio = new Chart(
    document.getElementById('cache-hit-ratio-chart'),
    {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Hits',
            data: [],
            borderColor: '#2ecc71',
            backgroundColor: 'rgba(46, 204, 113, 0.1)',
            tension: 0.3,
            fill: true
          },
          {
            label: 'Misses',
            data: [],
            borderColor: '#f39c12',
            backgroundColor: 'rgba(243, 156, 18, 0.1)',
            tension: 0.3,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Cache Performance'
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: false
            }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Count'
            },
            suggestedMin: 0
          }
        }
      }
    }
  );
  
  // System Resources Chart
  charts.systemResources = new Chart(
    document.getElementById('system-resources-chart'),
    {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'CPU Load',
            data: [],
            borderColor: '#9b59b6',
            backgroundColor: 'rgba(155, 89, 182, 0.1)',
            tension: 0.3,
            fill: true,
            yAxisID: 'y'
          },
          {
            label: 'Memory Usage %',
            data: [],
            borderColor: '#16a085',
            backgroundColor: 'rgba(22, 160, 133, 0.1)',
            tension: 0.3,
            fill: true,
            yAxisID: 'y'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'System Resources'
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: false
            }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Percentage (%)'
            },
            suggestedMin: 0,
            suggestedMax: 100
          }
        }
      }
    }
  );
  
  // API Requests Chart
  charts.apiRequests = new Chart(
    document.getElementById('api-requests-chart'),
    {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Requests/Second',
            data: [],
            borderColor: '#e74c3c',
            backgroundColor: 'rgba(231, 76, 60, 0.1)',
            tension: 0.3,
            fill: false
          },
          {
            label: 'Requests/Minute',
            data: [],
            borderColor: '#3498db',
            backgroundColor: 'rgba(52, 152, 219, 0.1)',
            tension: 0.3,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'API Request Rates'
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: false
            }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Requests'
            },
            suggestedMin: 0
          }
        }
      }
    }
  );
}

// Helper function to format timestamp for chart labels
function formatTimeLabel() {
  const now = new Date();
  return now.getHours().toString().padStart(2, '0') + ':' + 
         now.getMinutes().toString().padStart(2, '0') + ':' + 
         now.getSeconds().toString().padStart(2, '0');
}

// Helper function to format uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// Update chart with new data point
function updateChart(chart, label, ...dataPoints) {
  if (!chart) return;
  
  // Add new label (timestamp)
  chart.data.labels.push(label);
  
  // Add data points to each dataset
  dataPoints.forEach((value, index) => {
    if (index < chart.data.datasets.length) {
      chart.data.datasets[index].data.push(value);
    }
  });
  
  // Remove old data points if we exceed the maximum
  if (chart.data.labels.length > MAX_DATA_POINTS) {
    chart.data.labels.shift();
    chart.data.datasets.forEach(dataset => {
      dataset.data.shift();
    });
  }
  
  // Update the chart
  chart.update();
}

// Initialize WebSocket event handlers
function setupSocketEvents() {
  // Connection status
  socket.on('connect', () => {
    console.log('Connected to WebSocket server');
    
    // Subscribe to all metrics
    socket.emit('subscribe', ['all']);
  });
  
  socket.on('disconnect', () => {
    console.log('Disconnected from WebSocket server');
  });
  
  // Initial data on connection
  socket.on('initialData', (data) => {
    console.log('Received initial data', data);
    
    // Update system info
    elements.systemPlatform.textContent = data.system.platform;
    elements.systemHostname.textContent = data.system.hostname;
    
    // Update status indicators
    updateStatusIndicators(data.database.availability.isConnected, data.cache.availability.isConnected);
    
    // Update API metrics if available
    if (data.api) {
      updateApiMetrics(data.api);
    }
  });
  
  // Database metrics updates
  socket.on('database-metrics', (data) => {
    // Update database performance metrics
    elements.dbReadSpeed.textContent = data.performance.readSpeed;
    elements.dbWriteSpeed.textContent = data.performance.writeSpeed;
    elements.dbReadTime.textContent = `${data.performance.avgReadTimeMs} ms`;
    elements.dbWriteTime.textContent = `${data.performance.avgWriteTimeMs} ms`;
    
    // Update database chart
    const timeLabel = formatTimeLabel();
    updateChart(
      charts.dbOperations, 
      timeLabel,
      data.performance.readOperations,
      data.performance.writeOperations
    );
    
    // Update database status
    elements.dbStatus.textContent = data.availability.isConnected ? 'Connected' : 'Disconnected';
    elements.dbStatus.className = 'value status-indicator ' + (data.availability.isConnected ? 'connected' : 'disconnected');
  });
  
  // Cache metrics updates
  socket.on('cache-metrics', (data) => {
    // Update cache performance metrics
    elements.cacheHits.textContent = data.hits;
    elements.cacheMisses.textContent = data.misses;
    elements.cacheHitRatio.textContent = data.hitRate;
    elements.cacheKeys.textContent = data.storage.currentKeys;
    
    // Update cache chart
    const timeLabel = formatTimeLabel();
    updateChart(
      charts.cacheHitRatio,
      timeLabel,
      data.hits,
      data.misses
    );
    
    // Update cache status
    elements.cacheStatus.textContent = data.availability.isConnected ? 'Connected' : 'Disconnected';
    elements.cacheStatus.className = 'value status-indicator ' + (data.availability.isConnected ? 'connected' : 'disconnected');
  });
  
  // System metrics updates
  socket.on('system-metrics', (data) => {
    // Update system metrics
    elements.systemCpuLoad.textContent = `${data.loadAvg[0].toFixed(2)}`;
    elements.systemMemoryUsed.textContent = `${data.memoryUsage}%`;
    
    // Update system chart
    const timeLabel = formatTimeLabel();
    updateChart(
      charts.systemResources,
      timeLabel,
      data.loadAvg[0],
      data.memoryUsage
    );
    
    // Update memory usage in header
    elements.memoryUsage.textContent = `${data.memoryUsage}%`;
  });
  
  // API request metrics updates
  socket.on('api-request-metrics', (data) => {
    updateApiMetrics(data);
    
    // Update API requests chart
    const timeLabel = formatTimeLabel();
    updateChart(
      charts.apiRequests,
      timeLabel,
      data.requestsPerSecond,
      data.requestsPerMinute
    );
  });
  
  // New API request event
  socket.on('new-api-request', (data) => {
    if (!terminal.isPaused) {
      addRequestToTerminal(data);
      terminal.pendingRequests[data.id] = data;
    }
  });
  
  // API request completed event
  socket.on('api-request-completed', (data) => {
    if (terminal.pendingRequests[data.id]) {
      const requestData = terminal.pendingRequests[data.id];
      updateRequestInTerminal(data.id, data.responseStatus, data.responseTime);
      delete terminal.pendingRequests[data.id];
    }
  });
  
  // API request details response
  socket.on('api-request-details', (data) => {
    showRequestDetails(data);
  });
  
  // Basic metrics (fast updates)
  socket.on('basic-metrics', (data) => {
    // Update basic metrics in header
    elements.serverUptime.textContent = formatUptime(data.uptime);
    elements.cpuLoad.textContent = data.system.cpuLoad;
    
    // Update API metrics in terminal header
    if (data.api) {
      elements.apiRequestsPerSecond.textContent = data.api.requestsPerSecond;
      elements.apiTotalRequests.textContent = data.api.totalRequests;
    }
  });
}

// Update API metrics display
function updateApiMetrics(data) {
  // Update API card metrics
  elements.apiTotal.textContent = data.totalRequests;
  elements.apiRpm.textContent = data.requestsPerMinute;
  
  // Calculate success rate
  let successCount = 0;
  let totalWithStatus = 0;
  
  for (const [code, count] of Object.entries(data.statusCodes)) {
    const codeNum = parseInt(code, 10);
    if (codeNum >= 200 && codeNum < 400) {
      successCount += count;
    }
    totalWithStatus += count;
  }
  
  const successRate = totalWithStatus > 0 ? 
    Math.round((successCount / totalWithStatus) * 100) : 100;
  
  elements.apiSuccessRate.textContent = `${successRate}%`;
  elements.apiAvgTime.textContent = `${data.averageResponseTime.toFixed(2)} ms`;
  
  // Update terminal header metrics
  elements.apiTotalRequests.textContent = data.totalRequests;
  elements.apiRequestsPerSecond.textContent = data.requestsPerSecond;
  elements.apiAvgResponseTime.textContent = `${data.averageResponseTime.toFixed(2)} ms`;
}

// Add a request to the terminal display
function addRequestToTerminal(request) {
  // Create terminal line
  const line = document.createElement('div');
  line.className = 'terminal-line';
  line.dataset.requestId = request.id;
  
  // Format time
  const time = new Date(request.timestamp);
  const timeStr = time.toLocaleTimeString();
  
  // Construct terminal line HTML
  line.innerHTML = `
    <span class="terminal-time">[${timeStr}]</span>
    <span class="terminal-method ${request.method.toLowerCase()}">${request.method}</span>
    <span class="terminal-url">${request.url}</span>
    <span class="terminal-status pending">PENDING</span>
    <span class="terminal-time-value"></span>
  `;
  
  // Add click event to show details
  line.addEventListener('click', () => {
    // Request details from server
    socket.emit('get-api-request-details', request.id);
  });
  
  // Add to terminal
  elements.apiTerminal.appendChild(line);
  
  // Scroll to bottom
  elements.apiTerminal.scrollTop = elements.apiTerminal.scrollHeight;
  
  // Limit terminal lines
  limitTerminalLines();
}

// Update a request in the terminal with response data
function updateRequestInTerminal(requestId, status, responseTime) {
  const line = elements.apiTerminal.querySelector(`.terminal-line[data-request-id="${requestId}"]`);
  if (!line) return;
  
  // Get status class
  let statusClass = 'pending';
  if (status >= 200 && status < 300) statusClass = 'success';
  else if (status >= 300 && status < 400) statusClass = 'redirect';
  else if (status >= 400 && status < 500) statusClass = 'client-error';
  else if (status >= 500) statusClass = 'server-error';
  
  // Update status and response time
  const statusElement = line.querySelector('.terminal-status');
  const timeElement = line.querySelector('.terminal-time-value');
  
  if (statusElement) {
    statusElement.textContent = status;
    statusElement.className = `terminal-status ${statusClass}`;
  }
  
  if (timeElement) {
    timeElement.textContent = `${responseTime.toFixed(2)} ms`;
  }
}

// Limit the number of terminal lines
function limitTerminalLines() {
  const lines = elements.apiTerminal.querySelectorAll('.terminal-line');
  if (lines.length > terminal.maxLines) {
    for (let i = 0; i < lines.length - terminal.maxLines; i++) {
      elements.apiTerminal.removeChild(lines[i]);
    }
  }
}

// Clear the terminal
function clearTerminal() {
  // Keep only the welcome message
  const welcome = elements.apiTerminal.querySelector('.terminal-welcome');
  elements.apiTerminal.innerHTML = '';
  if (welcome) {
    elements.apiTerminal.appendChild(welcome);
  }
}

// Show request details in modal
function showRequestDetails(data) {
  // Set basic details
  elements.detailId.textContent = data.id;
  elements.detailMethod.textContent = data.method;
  elements.detailUrl.textContent = data.url;
  elements.detailTime.textContent = new Date(data.timestamp).toLocaleString();
  elements.detailIp.textContent = data.ip || 'Unknown';
  elements.detailUserAgent.textContent = data.userAgent || 'Unknown';
  
  // Format JSON data
  elements.detailHeaders.textContent = JSON.stringify(data.headers, null, 2);
  elements.detailQuery.textContent = JSON.stringify(data.query, null, 2);
  elements.detailBody.textContent = JSON.stringify(data.body, null, 2);
  
  // Set response details
  if (data.responseStatus) {
    elements.detailStatus.textContent = data.responseStatus;
    
    // Add status color
    if (data.responseStatus >= 200 && data.responseStatus < 300) {
      elements.detailStatus.className = 'detail-value text-success';
    } else if (data.responseStatus >= 300 && data.responseStatus < 400) {
      elements.detailStatus.className = 'detail-value text-warning';
    } else {
      elements.detailStatus.className = 'detail-value text-danger';
    }
  } else {
    elements.detailStatus.textContent = 'Pending';
    elements.detailStatus.className = 'detail-value';
  }
  
  elements.detailResponseTime.textContent = data.responseTime ? 
    `${data.responseTime.toFixed(2)} ms` : 'Pending';
  
  elements.detailResponseSize.textContent = data.responseSize ? 
    `${formatSize(data.responseSize)}` : 'Unknown';
  
  // Show modal
  elements.requestDetailsModal.style.display = 'block';
}

// Format size in bytes to human-readable format
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
  else return (bytes / 1048576).toFixed(2) + ' MB';
}

// Update status indicators
function updateStatusIndicators(dbConnected, cacheConnected) {
  elements.dbStatus.textContent = dbConnected ? 'Connected' : 'Disconnected';
  elements.dbStatus.className = 'value status-indicator ' + (dbConnected ? 'connected' : 'disconnected');
  
  elements.cacheStatus.textContent = cacheConnected ? 'Connected' : 'Disconnected';
  elements.cacheStatus.className = 'value status-indicator ' + (cacheConnected ? 'connected' : 'disconnected');
}

// Initialize UI event handlers
function setupUIEventHandlers() {
  // Terminal controls
  elements.clearTerminalBtn.addEventListener('click', clearTerminal);
  
  elements.pauseTerminalBtn.addEventListener('click', () => {
    terminal.isPaused = !terminal.isPaused;
    elements.pauseTerminalBtn.textContent = terminal.isPaused ? 'Resume' : 'Pause';
    elements.pauseTerminalBtn.classList.toggle('active', terminal.isPaused);
  });
  
  // Modal close button
  elements.modalClose.addEventListener('click', () => {
    elements.requestDetailsModal.style.display = 'none';
  });
  
  // Close modal when clicking outside
  window.addEventListener('click', (event) => {
    if (event.target === elements.requestDetailsModal) {
      elements.requestDetailsModal.style.display = 'none';
    }
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (event) => {
    // Escape to close modal
    if (event.key === 'Escape') {
      elements.requestDetailsModal.style.display = 'none';
    }
    
    // Ctrl+K to clear terminal
    if (event.key === 'k' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      clearTerminal();
    }
  });
}

// Initialize the dashboard
function initializeDashboard() {
  console.log('Initializing dashboard...');
  initializeCharts();
  setupSocketEvents();
  setupUIEventHandlers();
}

// Start the dashboard when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeDashboard); 