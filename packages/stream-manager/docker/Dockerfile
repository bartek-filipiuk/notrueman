# Streamer Docker container for No True Man Show
# Combines Chromium + XVFB + PulseAudio + FFmpeg to capture the Phaser game
# and stream it via RTMP to Twitch/YouTube.
#
# Based on Architecture A (XVFB + x11grab) from research/24-7-ai-livestream-research.md

FROM node:20-slim

# Avoid interactive prompts during install
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Chromium browser
    chromium \
    # Virtual framebuffer (X11 without a monitor)
    xvfb \
    # Video/audio encoder
    ffmpeg \
    # Virtual audio sink
    pulseaudio \
    # Fonts for proper text rendering
    fonts-noto-color-emoji \
    fonts-liberation \
    fonts-dejavu-core \
    # Process management
    procps \
    # Health check utility
    curl \
    # Clean up
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r streamer && useradd -r -g streamer -G audio,video streamer \
    && mkdir -p /home/streamer /tmp/pulse \
    && chown -R streamer:streamer /home/streamer /tmp/pulse

# Environment variables (overridable at runtime)
ENV DISPLAY=:99
ENV PULSE_SERVER=unix:/tmp/pulse/native
# Stream configuration (defaults — override via .env or docker-compose)
ENV STREAM_URL=http://host.docker.internal:5173
ENV RTMP_URL=
ENV RESOLUTION=960x540
ENV FRAMERATE=30
ENV VIDEO_BITRATE=4500k
ENV AUDIO_BITRATE=160k
ENV CHROME_FLAGS=""
# Browser recycling interval (4 hours default)
ENV RECYCLE_INTERVAL_S=14400
# Memory ceiling for Chromium in MB
ENV MAX_MEMORY_MB=2048

# Copy entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# PulseAudio config for virtual sink (no hardware needed)
RUN mkdir -p /etc/pulse && \
    echo '\
load-module module-null-sink sink_name=virtual_out sink_properties=device.description="Virtual_Output"\n\
set-default-sink virtual_out\n\
load-module module-native-protocol-unix auth-anonymous=1 socket=/tmp/pulse/native\n\
' > /etc/pulse/default.pa

USER streamer
WORKDIR /home/streamer

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
    CMD pgrep -x ffmpeg && pgrep -f chromium || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
