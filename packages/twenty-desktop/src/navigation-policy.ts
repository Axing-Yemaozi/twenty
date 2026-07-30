export type NavigationDecision = 'internal' | 'external' | 'blocked';

const EXTERNAL_PROTOCOLS = new Set(['https:', 'mailto:', 'tel:']);

export const classifyNavigation = (
  destination: string,
  serverOrigin: string,
): NavigationDecision => {
  let destinationUrl: URL;

  try {
    destinationUrl = new URL(destination);
  } catch {
    return 'blocked';
  }

  if (destinationUrl.origin === serverOrigin) {
    return 'internal';
  }

  return EXTERNAL_PROTOCOLS.has(destinationUrl.protocol)
    ? 'external'
    : 'blocked';
};
