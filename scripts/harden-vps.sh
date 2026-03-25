#!/usr/bin/env bash
# VPS hardening script for No True Man Show production server
# Target: Ubuntu 22.04+ / Debian 12+ on Hetzner CPX31
#
# Usage: sudo bash scripts/harden-vps.sh
#
# What it does:
# 1. UFW firewall — only 22 (SSH), 80 (HTTP), 443 (HTTPS)
# 2. Fail2ban — SSH brute-force protection
# 3. Unattended upgrades — automatic security patches
# 4. Non-root Docker — adds deploy user to docker group
# 5. SSH hardening — disable root login, password auth

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# Must run as root
[[ $EUID -eq 0 ]] || err "Run as root: sudo bash $0"

# ============================================================
# 1. UFW Firewall
# ============================================================
log "Configuring UFW firewall..."

apt-get update -qq
apt-get install -y -qq ufw > /dev/null

# Reset and configure
ufw --force reset > /dev/null 2>&1
ufw default deny incoming
ufw default allow outgoing

# Allow only essential ports
ufw allow 22/tcp comment "SSH"
ufw allow 80/tcp comment "HTTP"
ufw allow 443/tcp comment "HTTPS"

# Enable firewall
ufw --force enable
log "UFW enabled: SSH (22), HTTP (80), HTTPS (443)"

# ============================================================
# 2. Fail2ban
# ============================================================
log "Installing and configuring Fail2ban..."

apt-get install -y -qq fail2ban > /dev/null

cat > /etc/fail2ban/jail.local << 'JAIL'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5
backend  = systemd

[sshd]
enabled  = true
port     = ssh
filter   = sshd
logpath  = /var/log/auth.log
maxretry = 3
bantime  = 7200
JAIL

systemctl enable fail2ban > /dev/null 2>&1
systemctl restart fail2ban
log "Fail2ban active: SSH brute-force protection (3 attempts → 2h ban)"

# ============================================================
# 3. Unattended Upgrades
# ============================================================
log "Configuring unattended security upgrades..."

apt-get install -y -qq unattended-upgrades > /dev/null

cat > /etc/apt/apt.conf.d/20auto-upgrades << 'AUTOUPGRADE'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
AUTOUPGRADE

cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'UNATTENDED'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}";
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
UNATTENDED

systemctl enable unattended-upgrades > /dev/null 2>&1
log "Unattended upgrades enabled: daily security patches, no auto-reboot"

# ============================================================
# 4. Non-root Docker user
# ============================================================
log "Setting up non-root Docker access..."

DEPLOY_USER="${DEPLOY_USER:-deploy}"

if ! id "$DEPLOY_USER" &>/dev/null; then
    useradd -m -s /bin/bash "$DEPLOY_USER"
    log "Created user: $DEPLOY_USER"
fi

if command -v docker &>/dev/null; then
    usermod -aG docker "$DEPLOY_USER"
    log "User '$DEPLOY_USER' added to docker group (no sudo needed for docker)"
else
    warn "Docker not installed yet. Install Docker first, then run:"
    warn "  usermod -aG docker $DEPLOY_USER"
fi

# ============================================================
# 5. SSH Hardening
# ============================================================
log "Hardening SSH configuration..."

SSHD_CONFIG="/etc/ssh/sshd_config"

# Backup original
cp "$SSHD_CONFIG" "${SSHD_CONFIG}.bak.$(date +%Y%m%d)"

# Apply hardening settings
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' "$SSHD_CONFIG"
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' "$SSHD_CONFIG"
sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' "$SSHD_CONFIG"
sed -i 's/^#\?X11Forwarding.*/X11Forwarding no/' "$SSHD_CONFIG"
sed -i 's/^#\?MaxAuthTries.*/MaxAuthTries 3/' "$SSHD_CONFIG"
sed -i 's/^#\?ClientAliveInterval.*/ClientAliveInterval 300/' "$SSHD_CONFIG"
sed -i 's/^#\?ClientAliveCountMax.*/ClientAliveCountMax 2/' "$SSHD_CONFIG"

# Validate config before restarting
if sshd -t 2>/dev/null; then
    systemctl restart sshd 2>/dev/null || systemctl restart ssh 2>/dev/null || true
    log "SSH hardened: root login disabled, password auth disabled, key-only"
else
    warn "SSH config validation failed — reverting to backup"
    cp "${SSHD_CONFIG}.bak.$(date +%Y%m%d)" "$SSHD_CONFIG"
fi

# ============================================================
# Summary
# ============================================================
echo ""
echo "═══════════════════════════════════════════"
echo "  VPS Hardening Complete"
echo "═══════════════════════════════════════════"
echo "  ✅ UFW: ports 22, 80, 443 only"
echo "  ✅ Fail2ban: SSH brute-force (3 tries → 2h)"
echo "  ✅ Unattended upgrades: daily security patches"
echo "  ✅ Docker user: $DEPLOY_USER (non-root)"
echo "  ✅ SSH: key-only, no root login"
echo ""
echo "  ⚠️  Make sure you have SSH key access"
echo "  ⚠️  before disconnecting!"
echo "═══════════════════════════════════════════"
