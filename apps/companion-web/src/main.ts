import { formatUptime, updateStatusUI, initStreamEmbed } from './status.js';
import { MindFeedClient } from './ws-client.js';
import { createMindFeed } from './mind-feed.js';
import { createStatusBar } from './status-bar.js';
import { createEmotionChart } from './emotion-chart.js';

const STATUS_POLL_INTERVAL = 10_000;
const STATUS_API_URL = '/api/health';

function getStatusApiUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('statusUrl') || STATUS_API_URL;
}

function getTwitchChannel(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('channel') || null;
}

async function pollStatus(apiUrl: string): Promise<void> {
  try {
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: unknown = await res.json();
    updateStatusUI(data);
  } catch {
    updateStatusUI(null);
  }
}

function start(): void {
  // Init game iframe
  const channel = getTwitchChannel();
  if (channel) {
    initStreamEmbed(channel);
  }

  // Init mind feed
  const mindFeed = createMindFeed();
  const sidebar = document.getElementById('mind-feed-sidebar');
  if (sidebar) {
    sidebar.appendChild(mindFeed.getContainer());
  }

  // Init status bar
  const statusBar = createStatusBar();
  const statusBarContainer = document.getElementById('status-bar');
  if (statusBarContainer) {
    statusBarContainer.appendChild(statusBar.container);
  }

  // Init emotion chart
  const emotionChart = createEmotionChart();
  const emotionContainer = document.getElementById('emotion-chart');
  if (emotionContainer) {
    emotionContainer.appendChild(emotionChart.container);
  }

  // Connect to WebSocket mind feed
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}/ws/mind-feed`;

  const wsClient = new MindFeedClient({
    url: wsUrl,
    onEvent: (event) => {
      mindFeed.addEvent(event);

      // Update status bar from events
      if (event.type === 'mood_change') {
        statusBar.update({ mood: String(event.data.mood ?? '') });
      }
      if (event.type === 'activity_change') {
        statusBar.update({ activity: String(event.data.activity ?? '') });
      }
      if (event.type === 'status' && event.data.brainOnline !== undefined) {
        statusBar.update({ isLive: Boolean(event.data.brainOnline) });
        const badge = document.getElementById('nav-live-badge');
        if (badge) {
          if (event.data.brainOnline) {
            badge.innerHTML = '<span class="live-dot live-dot--on"></span> LIVE';
          } else {
            badge.innerHTML = '<span class="live-dot"></span> OFFLINE';
          }
        }
      }
    },
    onStatusChange: (status) => {
      statusBar.update({ isLive: status === 'connected' });
      const badge = document.getElementById('nav-live-badge');
      if (badge) {
        if (status === 'connected') {
          badge.innerHTML = '<span class="live-dot live-dot--on"></span> LIVE';
        } else {
          badge.innerHTML = '<span class="live-dot"></span> OFFLINE';
        }
      }
    },
  });
  wsClient.connect();

  // Poll health API for status updates
  const apiUrl = getStatusApiUrl();
  void pollStatus(apiUrl);
  setInterval(() => void pollStatus(apiUrl), STATUS_POLL_INTERVAL);
}

// Export for testing
export { formatUptime, getStatusApiUrl, getTwitchChannel };

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}
