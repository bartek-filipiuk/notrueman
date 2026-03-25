#!/bin/bash
set -euo pipefail

# ============================================================
# No True Man Show — Streamer Entrypoint
# Starts: Xvfb → PulseAudio → Chromium → FFmpeg → RTMP
# ============================================================

log() { echo "[streamer] $(date -u +%H:%M:%S) $*"; }

# Validate required env
if [ -z "${RTMP_URL:-}" ]; then
    log "ERROR: RTMP_URL is not set. Provide it via .env or docker-compose."
    log "Example: RTMP_URL=rtmp://live.twitch.tv/app/YOUR_STREAM_KEY"
    exit 1
fi

cleanup() {
    log "Shutting down..."
    kill "${FFMPEG_PID:-0}" "${CHROME_PID:-0}" "${XVFB_PID:-0}" "${PULSE_PID:-0}" 2>/dev/null || true
    wait 2>/dev/null || true
    log "Done."
}
trap cleanup EXIT INT TERM

# Parse resolution
WIDTH="${RESOLUTION%%x*}"
HEIGHT="${RESOLUTION##*x}"

# ---- 1. Start Xvfb (virtual display) ----
log "Starting Xvfb at ${DISPLAY} (${RESOLUTION}x24)"
Xvfb "${DISPLAY}" -screen 0 "${RESOLUTION}x24" -ac +extension GLX +render -noreset &
XVFB_PID=$!
sleep 1

# Verify Xvfb is running
if ! kill -0 "${XVFB_PID}" 2>/dev/null; then
    log "ERROR: Xvfb failed to start"
    exit 1
fi
log "Xvfb running (PID ${XVFB_PID})"

# ---- 2. Start PulseAudio (virtual audio sink) ----
log "Starting PulseAudio"
pulseaudio --daemonize --no-cpu-limit --exit-idle-time=-1 \
    --load="module-null-sink sink_name=virtual_out" \
    --load="module-native-protocol-unix auth-anonymous=1 socket=/tmp/pulse/native" \
    2>/dev/null || true
sleep 1
log "PulseAudio started"

# ---- 3. Start Chromium ----
CHROME_ARGS=(
    --no-sandbox
    --disable-setuid-sandbox
    --disable-dev-shm-usage
    --disable-gpu
    --disable-background-timer-throttling
    --disable-backgrounding-occluded-windows
    --disable-renderer-backgrounding
    --disable-extensions
    --disable-component-update
    --disable-translate
    --no-first-run
    --autoplay-policy=no-user-gesture-required
    --window-size="${WIDTH},${HEIGHT}"
    --window-position=0,0
    --kiosk
    ${CHROME_FLAGS}
)

start_chrome() {
    log "Starting Chromium → ${STREAM_URL}"
    chromium "${CHROME_ARGS[@]}" "${STREAM_URL}" &
    CHROME_PID=$!
    sleep 3

    if ! kill -0 "${CHROME_PID}" 2>/dev/null; then
        log "ERROR: Chromium failed to start"
        return 1
    fi
    log "Chromium running (PID ${CHROME_PID})"
}

start_chrome

# ---- 4. Start FFmpeg (RTMP stream) ----
start_ffmpeg() {
    log "Starting FFmpeg → ${RTMP_URL%%\?*}..." # Log URL without key

    ffmpeg \
        -hide_banner -loglevel warning \
        -f x11grab -video_size "${RESOLUTION}" -framerate "${FRAMERATE}" -i "${DISPLAY}" \
        -f pulse -i default \
        -c:v libx264 -preset veryfast -tune zerolatency \
        -b:v "${VIDEO_BITRATE}" -maxrate "${VIDEO_BITRATE}" -bufsize "$((${VIDEO_BITRATE%k} * 2))k" \
        -g "$((FRAMERATE * 2))" -sc_threshold 0 \
        -pix_fmt yuv420p \
        -c:a aac -b:a "${AUDIO_BITRATE}" -ar 44100 \
        -f flv \
        "${RTMP_URL}" &
    FFMPEG_PID=$!
    sleep 2

    if ! kill -0 "${FFMPEG_PID}" 2>/dev/null; then
        log "ERROR: FFmpeg failed to start"
        return 1
    fi
    log "FFmpeg streaming (PID ${FFMPEG_PID})"
}

start_ffmpeg

# ---- 5. Watchdog loop ----
LAST_RECYCLE=$(date +%s)

log "Streamer running. Watchdog active (recycle every ${RECYCLE_INTERVAL_S}s, memory limit ${MAX_MEMORY_MB}MB)"

while true; do
    sleep 15

    # Check FFmpeg
    if ! kill -0 "${FFMPEG_PID}" 2>/dev/null; then
        log "WARN: FFmpeg died, restarting..."
        sleep 3
        start_ffmpeg || { log "FFmpeg restart failed, retrying in 10s"; sleep 10; continue; }
    fi

    # Check Chromium
    if ! kill -0 "${CHROME_PID}" 2>/dev/null; then
        log "WARN: Chromium died, restarting..."
        sleep 3
        start_chrome || { log "Chrome restart failed, retrying in 10s"; sleep 10; continue; }
    fi

    # Memory watchdog — check Chromium RSS
    CHROME_MEM=$(ps -o rss= -p "${CHROME_PID}" 2>/dev/null || echo "0")
    CHROME_MEM_MB=$((CHROME_MEM / 1024))
    if [ "${CHROME_MEM_MB}" -gt "${MAX_MEMORY_MB}" ]; then
        log "WARN: Chromium using ${CHROME_MEM_MB}MB (limit ${MAX_MEMORY_MB}MB), recycling..."
        kill "${CHROME_PID}" 2>/dev/null || true
        wait "${CHROME_PID}" 2>/dev/null || true
        sleep 2
        start_chrome
        LAST_RECYCLE=$(date +%s)
    fi

    # Scheduled recycle
    NOW=$(date +%s)
    ELAPSED=$((NOW - LAST_RECYCLE))
    if [ "${ELAPSED}" -ge "${RECYCLE_INTERVAL_S}" ]; then
        log "Scheduled Chromium recycle (${ELAPSED}s elapsed)"
        kill "${CHROME_PID}" 2>/dev/null || true
        wait "${CHROME_PID}" 2>/dev/null || true
        sleep 2
        start_chrome
        LAST_RECYCLE=$(date +%s)
    fi
done
