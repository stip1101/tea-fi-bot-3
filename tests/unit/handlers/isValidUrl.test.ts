import { describe, test, expect } from 'bun:test';
import { isValidUrl } from '../../../src/utils/url';

describe('isValidUrl', () => {
  describe('valid Twitter URLs', () => {
    test('accepts twitter.com', () => {
      expect(isValidUrl('https://twitter.com/user/status/123')).toBe(true);
    });

    test('accepts x.com', () => {
      expect(isValidUrl('https://x.com/user/status/123')).toBe(true);
    });

    test('accepts mobile.twitter.com', () => {
      expect(isValidUrl('https://mobile.twitter.com/user/status/123')).toBe(true);
    });

    test('accepts http protocol', () => {
      expect(isValidUrl('http://twitter.com/user/status/123')).toBe(true);
    });
  });

  describe('rejects non-Twitter domains', () => {
    test('rejects google.com', () => {
      expect(isValidUrl('https://google.com')).toBe(false);
    });

    test('rejects similar-looking domains', () => {
      expect(isValidUrl('https://nottwitter.com/status/123')).toBe(false);
      expect(isValidUrl('https://twitter.com.evil.com/status/123')).toBe(false);
    });

    test('rejects subdomain spoofing', () => {
      expect(isValidUrl('https://evil.twitter.com.attacker.com')).toBe(false);
    });
  });

  describe('rejects invalid inputs', () => {
    test('rejects empty string', () => {
      expect(isValidUrl('')).toBe(false);
    });

    test('rejects plain text', () => {
      expect(isValidUrl('not a url')).toBe(false);
    });

    test('rejects non-http protocols', () => {
      expect(isValidUrl('ftp://twitter.com/status/123')).toBe(false);
      expect(isValidUrl('javascript:alert(1)')).toBe(false);
    });

    test('rejects IP addresses', () => {
      expect(isValidUrl('http://127.0.0.1')).toBe(false);
      expect(isValidUrl('http://0x7f000001')).toBe(false);
    });

    test('rejects data URIs', () => {
      expect(isValidUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });
  });
});
