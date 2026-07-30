import { isIP } from 'node:net';

const environmentVariableName = 'TWENTY_DESKTOP_PRODUCTION_URL';
const configuredUrl = process.env[environmentVariableName]?.trim();

const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exit(1);
};

if (!configuredUrl) {
  fail(`${environmentVariableName} is required when packaging Twenty Desktop.`);
}

let productionUrl;

try {
  productionUrl = new URL(configuredUrl);
} catch {
  fail(`${environmentVariableName} must be a valid absolute URL.`);
}

const productionHostname = productionUrl.hostname.replace(/^\[|\]$/g, '');

if (
  productionUrl.protocol !== 'https:' ||
  productionUrl.username ||
  productionUrl.password ||
  productionUrl.pathname !== '/' ||
  productionUrl.search ||
  productionUrl.hash ||
  productionUrl.port ||
  isIP(productionHostname) !== 0 ||
  !productionHostname.includes('.') ||
  productionHostname === 'localhost' ||
  productionHostname.endsWith('.localhost')
) {
  fail(
    `${environmentVariableName} must be a public HTTPS domain origin without credentials, a port, a path, a query, or a hash.`,
  );
}

if (
  productionHostname === 'example.com' ||
  productionHostname.endsWith('.example.com')
) {
  fail(`${environmentVariableName} must not use the example.com placeholder.`);
}

process.stdout.write(`Packaging Twenty Desktop for ${productionUrl.origin}\n`);
