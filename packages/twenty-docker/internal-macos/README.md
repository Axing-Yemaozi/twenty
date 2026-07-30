# Twenty on macOS through Cloudflare Tunnel

This directory is a standalone runtime bundle for a managed macOS host. The
host runs only versioned container images and these deployment files; it does
not need the Twenty source tree, Node.js, Yarn, Caddy, an inbound port, or a
private certificate authority.

The configured public origin is `https://crm.clawspace.world`. Cloudflare
terminates HTTPS and the `cloudflared` container forwards traffic to
`http://server:3000` on the private Compose network. PostgreSQL, Redis, and the
Twenty server publish no host ports.

## Build and install the runtime

Build the production image on the development machine using the platform of the
backend Mac:

```bash
docker build \
  --platform linux/arm64 \
  --target twenty \
  --build-arg APP_VERSION=2026.7.30 \
  --tag crm-twenty:2026.07.30 \
  --file packages/twenty-docker/twenty/Dockerfile \
  .
```

Copy only this runtime directory to the backend Mac. When building directly on
that Mac, a suitable destination is `~/CRM-runtime`:

```bash
rsync -a packages/twenty-docker/internal-macos/ ~/CRM-runtime/
cd ~/CRM-runtime
scripts/prepare-environment.sh
```

Save the remotely managed Tunnel token in `secrets/cloudflared-token` with mode
`600`. Do not put it in `.env`, Compose, the image, a shell command argument, or
the desktop application.

Then start and verify the stack:

```bash
scripts/start.sh
scripts/compose.sh ps
scripts/compose.sh logs --tail=200 server worker cloudflared
scripts/check-server.sh
launchd/install.sh
```

The Cloudflare Tunnel Public Hostname must map `crm.clawspace.world` to
`http://server:3000`. Do not add Cloudflare Access unless the desktop client is
later designed for the additional authentication layer.

## Operations

```bash
scripts/compose.sh ps
scripts/compose.sh logs --tail=200 server worker cloudflared
scripts/check-server.sh
scripts/backup.sh
```

Restore is destructive and therefore requires an explicit confirmation:

```bash
scripts/restore.sh /absolute/path/to/backup-directory --confirm
```

Backups contain PostgreSQL, local file storage, `.env`, the Compose definition,
and checksums. They contain the Twenty encryption keys but not the Tunnel token,
which can be rotated in Cloudflare. Copy backups to an encrypted external disk
or managed share; the default runtime-local directory does not protect against
loss of the Mac.

All services use `restart: always`. The included LaunchAgents wait for Docker
Desktop and check the stack every five minutes, then run backups nightly at
02:00 after the service account logs in. Configure Docker Desktop to start at
login, disable sleep while connected to power, and enable restart after power
failure.
