import { formatUptime, updateStatusUI, initStreamEmbed } from './status.js';

const STATUS_POLL_INTERVAL = 10_000; // 10 seconds
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
  const channel = getTwitchChannel();
  if (channel) {
    initStreamEmbed(channel);
  }

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
