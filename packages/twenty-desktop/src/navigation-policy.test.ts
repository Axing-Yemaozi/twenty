import { describe, expect, it } from 'vitest';

import { classifyNavigation } from './navigation-policy';

const SERVER_ORIGIN = 'https://crm.company.test';

describe('classifyNavigation', () => {
  it('keeps only the configured server origin inside the app', () => {
    expect(
      classifyNavigation(
        'https://crm.company.test/settings/profile',
        SERVER_ORIGIN,
      ),
    ).toBe('internal');
    expect(
      classifyNavigation('https://other.company.test', SERVER_ORIGIN),
    ).toBe('external');
  });

  it('opens supported external protocols outside the app', () => {
    expect(classifyNavigation('https://example.com', SERVER_ORIGIN)).toBe(
      'external',
    );
    expect(classifyNavigation('mailto:user@example.com', SERVER_ORIGIN)).toBe(
      'external',
    );
    expect(classifyNavigation('tel:+12025550123', SERVER_ORIGIN)).toBe(
      'external',
    );
  });

  it('blocks insecure and executable protocols', () => {
    expect(classifyNavigation('http://example.com', SERVER_ORIGIN)).toBe(
      'blocked',
    );
    expect(classifyNavigation('file:///etc/passwd', SERVER_ORIGIN)).toBe(
      'blocked',
    );
    expect(classifyNavigation('javascript:alert(1)', SERVER_ORIGIN)).toBe(
      'blocked',
    );
    expect(classifyNavigation('not a url', SERVER_ORIGIN)).toBe('blocked');
  });
});
