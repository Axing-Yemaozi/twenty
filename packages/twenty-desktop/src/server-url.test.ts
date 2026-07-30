import { describe, expect, it } from 'vitest';

import { resolveServerUrl } from './server-url';

describe('resolveServerUrl', () => {
  it('uses the build-time production server by default', () => {
    expect(
      resolveServerUrl(undefined, { allowInsecureLoopback: false }).href,
    ).toBe('https://crm.example.com/');
  });

  it('accepts a configured HTTPS server', () => {
    expect(
      resolveServerUrl('https://crm.company.test/', {
        allowInsecureLoopback: false,
      }).origin,
    ).toBe('https://crm.company.test');
  });

  it('rejects insecure remote servers', () => {
    expect(() =>
      resolveServerUrl('http://crm.company.test', {
        allowInsecureLoopback: true,
      }),
    ).toThrow('must use HTTPS');
  });

  it('allows HTTP loopback only during development', () => {
    expect(
      resolveServerUrl('http://127.0.0.1:3001', {
        allowInsecureLoopback: true,
      }).href,
    ).toBe('http://127.0.0.1:3001/');

    expect(() =>
      resolveServerUrl('http://127.0.0.1:3001', {
        allowInsecureLoopback: false,
      }),
    ).toThrow('must use HTTPS');
  });

  it('rejects embedded credentials and ambiguous suffixes', () => {
    expect(() =>
      resolveServerUrl('https://user:secret@crm.company.test', {
        allowInsecureLoopback: false,
      }),
    ).toThrow('must not contain credentials');

    expect(() =>
      resolveServerUrl('https://crm.company.test/?server=other', {
        allowInsecureLoopback: false,
      }),
    ).toThrow('must not contain a query or hash');

    expect(() =>
      resolveServerUrl('https://crm.company.test/twenty', {
        allowInsecureLoopback: false,
      }),
    ).toThrow('must contain only an origin');
  });
});
