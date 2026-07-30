// tsup replaces this expression with a string literal at build time. Packaged
// applications never read the production address from the runtime environment.
const DEFAULT_SERVER_URL =
  process.env.TWENTY_DESKTOP_PRODUCTION_URL ?? 'https://crm.example.com';

const isLoopbackHostname = (hostname: string) =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';

type ResolveServerUrlOptions = {
  allowInsecureLoopback: boolean;
};

export const resolveServerUrl = (
  configuredUrl: string | undefined,
  options: ResolveServerUrlOptions,
) => {
  const serverUrl = new URL(configuredUrl?.trim() || DEFAULT_SERVER_URL);

  const isSecure = serverUrl.protocol === 'https:';
  const isAllowedDevelopmentUrl =
    options.allowInsecureLoopback &&
    serverUrl.protocol === 'http:' &&
    isLoopbackHostname(serverUrl.hostname);

  if (!isSecure && !isAllowedDevelopmentUrl) {
    throw new Error('The Twenty desktop server URL must use HTTPS.');
  }

  if (serverUrl.username || serverUrl.password) {
    throw new Error(
      'The Twenty desktop server URL must not contain credentials.',
    );
  }

  if (serverUrl.search || serverUrl.hash) {
    throw new Error(
      'The Twenty desktop server URL must not contain a query or hash.',
    );
  }

  if (serverUrl.pathname !== '/') {
    throw new Error(
      'The Twenty desktop server URL must contain only an origin.',
    );
  }

  return serverUrl;
};
