/** Health API response shape */
export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  uptime: number;
  lastTickAt: string | null;
  tickCount: number;
  currentActivity: string | null;
  currentMood: string;
  memoryCount: number;
}

const MOOD_EMOJI: Record<string, string> = {
  happy: '(^_^)',
  curious: '(o.o)',
  anxious: '(>_<)',
  excited: '(*o*)',
  frustrated: '(-_-)',
  content: '(u_u)',
  neutral: '(._.)',
};

/** Format seconds into human-readable uptime string */
export function formatUptime(seconds: number): string {
  if (seconds < 0 || !Number.isFinite(seconds)) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.floor(seconds)}s`;
}

/** Format activity name for display */
export function formatActivity(activity: string | null): string {
  if (!activity) return '—';
  return activity
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Format mood for display with emoji */
export function formatMood(mood: string): string {
  const emoji = MOOD_EMOJI[mood.toLowerCase()] || MOOD_EMOJI['neutral'];
  const name = mood.charAt(0).toUpperCase() + mood.slice(1);
  return `${emoji} ${name}`;
}

/** Validate and parse health response */
export function parseHealthResponse(data: unknown): HealthResponse | null {
  if (
    typeof data !== 'object' ||
    data === null ||
    !('status' in data) ||
    !('uptime' in data)
  ) {
    return null;
  }
  const d = data as Record<string, unknown>;
  const status = d['status'];
  if (status !== 'ok' && status !== 'degraded' && status !== 'error') {
    return null;
  }
  return {
    status,
    uptime: typeof d['uptime'] === 'number' ? d['uptime'] : 0,
    lastTickAt: typeof d['lastTickAt'] === 'string' ? d['lastTickAt'] : null,
    tickCount: typeof d['tickCount'] === 'number' ? d['tickCount'] : 0,
    currentActivity:
      typeof d['currentActivity'] === 'string' ? d['currentActivity'] : null,
    currentMood:
      typeof d['currentMood'] === 'string' ? d['currentMood'] : 'neutral',
    memoryCount: typeof d['memoryCount'] === 'number' ? d['memoryCount'] : 0,
  };
}

/** Update DOM elements with status data (or null for offline) */
export function updateStatusUI(data: unknown): void {
  const activityEl = document.getElementById('status-activity');
  const moodEl = document.getElementById('status-mood');
  const uptimeEl = document.getElementById('status-uptime');
  const serverEl = document.getElementById('status-server');

  if (!data) {
    if (activityEl) activityEl.textContent = '—';
    if (moodEl) moodEl.textContent = '—';
    if (uptimeEl) uptimeEl.textContent = '—';
    if (serverEl) {
      serverEl.innerHTML =
        '<span class="status-dot status-dot--offline"></span> Offline';
    }
    return;
  }

  const health = parseHealthResponse(data);
  if (!health) {
    if (serverEl) {
      serverEl.innerHTML =
        '<span class="status-dot status-dot--offline"></span> Error';
    }
    return;
  }

  if (activityEl) activityEl.textContent = formatActivity(health.currentActivity);
  if (moodEl) moodEl.textContent = formatMood(health.currentMood);
  if (uptimeEl) uptimeEl.textContent = formatUptime(health.uptime);
  if (serverEl) {
    const dotClass =
      health.status === 'ok'
        ? 'status-dot--online'
        : health.status === 'degraded'
          ? 'status-dot--degraded'
          : 'status-dot--offline';
    const label =
      health.status === 'ok'
        ? 'Online'
        : health.status === 'degraded'
          ? 'Degraded'
          : 'Error';
    serverEl.innerHTML = `<span class="status-dot ${dotClass}"></span> ${label}`;
  }
}

/** Initialize Twitch stream embed */
export function initStreamEmbed(channel: string): void {
  const container = document.getElementById('stream-embed');
  if (!container) return;

  // Sanitize channel name — only alphanumeric + underscores
  const safeChannel = channel.replace(/[^a-zA-Z0-9_]/g, '');
  if (!safeChannel) return;

  const parent = window.location.hostname;
  container.innerHTML = '';
  const iframe = document.createElement('iframe');
  iframe.src = `https://player.twitch.tv/?channel=${encodeURIComponent(safeChannel)}&parent=${encodeURIComponent(parent)}`;
  iframe.allowFullscreen = true;
  iframe.setAttribute(
    'allow',
    'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
  );
  container.appendChild(iframe);
}
