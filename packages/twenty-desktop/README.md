# Twenty Desktop

Electron host for a managed Twenty instance published through an HTTPS domain.
The renderer is the existing frontend served by the configured Twenty server;
this package does not duplicate the React application or its network layer.

## Development

Build and start against a local frontend during development:

```bash
TWENTY_DESKTOP_SERVER_URL=http://127.0.0.1:3001 npx nx start twenty-desktop
```

Non-loopback HTTP URLs are always rejected. `TWENTY_DESKTOP_SERVER_URL` is
available only in development.

## Packaging

```bash
TWENTY_DESKTOP_PRODUCTION_URL=https://crm.your-company.com \
  npx nx run twenty-desktop:package:mac

TWENTY_DESKTOP_PRODUCTION_URL=https://crm.your-company.com \
  npx nx run twenty-desktop:package:win
```

Replace the example hostname with the final Cloudflare public hostname. The
packaging targets reject a missing URL, a non-HTTPS URL, a URL containing a
port, path, credentials, a query or a hash, an IP address, and the `example.com`
placeholder. tsup compiles the validated origin into the Electron main bundle,
so packaged applications do not read either desktop URL environment variable
at runtime.

macOS packages must be built on macOS. Windows NSIS packages should be built on
Windows or cross-built on macOS, then validated on a Windows machine or CI
runner. Signing credentials are intentionally not stored in the repository.

The app intentionally exposes no Node.js preload bridge. It uses a sandboxed,
context-isolated renderer and allows in-app navigation only to the configured
server origin. It switches to a local retry page when navigation fails and
automatically retries the configured server every ten seconds until the
connection recovers.

The first launch uses the operating system network configuration. If the
configured server cannot load within twenty seconds, the app relaunches once
with a domain-scoped direct connection and Cloudflare DNS-over-HTTPS. This
fallback avoids pinning Cloudflare IP addresses and does not disable TLS or
renderer web security.
