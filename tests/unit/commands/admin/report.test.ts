import { describe, test, expect } from 'bun:test';
import { escapeCsvField, buildCsv } from '../../../../src/utils/csv';

describe('escapeCsvField', () => {
  test('returns empty string for null and undefined', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  test('returns plain string for simple values', () => {
    expect(escapeCsvField('hello')).toBe('hello');
    expect(escapeCsvField('test123')).toBe('test123');
  });

  test('converts numbers to strings', () => {
    expect(escapeCsvField(42)).toBe('42');
    expect(escapeCsvField(0)).toBe('0');
    expect(escapeCsvField(3.14)).toBe('3.14');
  });

  test('wraps field in quotes when it contains a comma', () => {
    expect(escapeCsvField('hello, world')).toBe('"hello, world"');
  });

  test('wraps field in quotes and escapes inner double quotes', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  test('wraps field in quotes when it contains newlines', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
  });

  test('handles field with both commas and quotes', () => {
    expect(escapeCsvField('a "b", c')).toBe('"a ""b"", c"');
  });

  test('returns empty string as-is (no quotes needed)', () => {
    expect(escapeCsvField('')).toBe('');
  });

  test('sanitizes formula injection with = prefix', () => {
    expect(escapeCsvField('=SUM(A1:A5)')).toBe("\"'=SUM(A1:A5)\"");
    expect(escapeCsvField('=HYPERLINK("https://evil.com")')).toBe("\"'=HYPERLINK(\"\"https://evil.com\"\")\"");
  });

  test('sanitizes formula injection with + prefix', () => {
    expect(escapeCsvField('+1234')).toBe("\"'+1234\"");
  });

  test('sanitizes formula injection with - prefix', () => {
    expect(escapeCsvField('-1234')).toBe("\"'-1234\"");
  });

  test('sanitizes formula injection with @ prefix', () => {
    expect(escapeCsvField('@SUM(A1)')).toBe("\"'@SUM(A1)\"");
  });

  test('sanitizes formula injection with tab prefix', () => {
    expect(escapeCsvField('\tcmd')).toBe("\"'\tcmd\"");
  });

  test('sanitizes formula injection with carriage return prefix', () => {
    expect(escapeCsvField('\rcmd')).toBe("\"'\rcmd\"");
  });

  test('does not sanitize negative numbers (number type)', () => {
    expect(escapeCsvField(-5)).toBe("\"'-5\"");
  });
});

describe('buildCsv', () => {
  test('produces UTF-8 BOM prefix', () => {
    const csv = buildCsv(['A'], []);
    expect(csv.startsWith('\uFEFF')).toBe(true);
  });

  test('generates correct header row', () => {
    const csv = buildCsv(['Name', 'Age', 'City'], []);
    expect(csv).toBe('\uFEFFName,Age,City');
  });

  test('generates header and data rows', () => {
    const csv = buildCsv(
      ['Name', 'Score'],
      [
        ['Alice', 100],
        ['Bob', 85],
      ],
    );
    expect(csv).toBe('\uFEFFName,Score\nAlice,100\nBob,85');
  });

  test('escapes special characters in data rows', () => {
    const csv = buildCsv(
      ['Text'],
      [['hello, "world"']],
    );
    expect(csv).toBe('\uFEFFText\n"hello, ""world"""');
  });

  test('handles null and undefined values in rows', () => {
    const csv = buildCsv(
      ['A', 'B', 'C'],
      [[null, undefined, 'ok']],
    );
    expect(csv).toBe('\uFEFFA,B,C\n,,ok');
  });

  test('handles empty rows array (headers only)', () => {
    const csv = buildCsv(['Col1', 'Col2'], []);
    expect(csv).toBe('\uFEFFCol1,Col2');
  });
});
