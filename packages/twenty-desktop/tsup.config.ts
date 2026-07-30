import { isIP } from 'node:net';

import { defineConfig } from 'tsup';

const configuredProductionServerUrl =
  process.env.TWENTY_DESKTOP_PRODUCTION_URL?.trim();
const productionServerUrl =
  configuredProductionServerUrl || 'https://crm.example.com';

const parsedProductionServerUrl = new URL(productionServerUrl);
const productionHostname = parsedProductionServerUrl.hostname.replace(
  /^\[|\]$/g,
  '',
);

if (
  parsedProductionServerUrl.protocol !== 'https:' ||
  parsedProductionServerUrl.username ||
  parsedProductionServerUrl.password ||
  parsedProductionServerUrl.pathname !== '/' ||
  parsedProductionServerUrl.search ||
  parsedProductionServerUrl.hash ||
  parsedProductionServerUrl.port ||
  isIP(productionHostname) !== 0 ||
  !productionHostname.includes('.') ||
  productionHostname === 'localhost' ||
  productionHostname.endsWith('.localhost') ||
  (configuredProductionServerUrl &&
    (productionHostname === 'example.com' ||
      productionHostname.endsWith('.example.com')))
) {
  throw new Error(
    'TWENTY_DESKTOP_PRODUCTION_URL must be a public HTTPS domain origin without credentials, a port, a path, a query, or a hash.',
  );
}

export default defineConfig({
  clean: true,
  define: {
    'process.env.TWENTY_DESKTOP_PRODUCTION_URL': JSON.stringify(
      parsedProductionServerUrl.origin,
    ),
  },
  entry: ['src/main.ts'],
  external: ['electron'],
  format: ['cjs'],
  minify: false,
  outDir: 'dist',
  platform: 'node',
  sourcemap: true,
  splitting: false,
  target: 'node22',
});
