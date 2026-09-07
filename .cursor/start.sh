#!/usr/bin/env bash
# Per-boot runtime initialization for the Chrono Cloud Agent environment.
# Brings up the Docker daemon and the local Supabase stack that the app and the
# database tests depend on. Safe to run repeatedly.
set -euo pipefail

cd "$(dirname "$0")/.."

# 1. Docker daemon. The VM has no init system, so start dockerd ourselves.
#    fuse-overlayfs is the storage driver that works in this nested VM.
if ! sudo docker info >/dev/null 2>&1; then
  sudo bash -c 'nohup dockerd --storage-driver=fuse-overlayfs >/var/log/dockerd.log 2>&1 &'
  for _ in $(seq 1 60); do
    sudo docker info >/dev/null 2>&1 && break
    sleep 1
  done
fi

# Let the (non-root) agent user talk to Docker without a re-login.
sudo chmod 666 /var/run/docker.sock

# 2. Docker 29 programs its bridge/NAT rules through the nftables backend, but
#    the kernel also evaluates the legacy iptables FORWARD chain, whose default
#    policy is DROP. That silently drops container<->container traffic and makes
#    Supabase's services time out reaching Postgres. Allow forwarding there.
sudo iptables-legacy -P FORWARD ACCEPT || true

# 3. Local Supabase stack (Postgres + Auth + REST + Studio + ...). Idempotent:
#    reuses the existing db volume, or applies migrations + seed on first boot.
supabase --workdir backend start
