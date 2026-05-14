import { describe, expect, it } from 'vitest';
import { parseUsageCsv } from '../csvParser';

const HEADER =
  'Date,Cloud Agent ID,Automation ID,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Requests';

function row(parts: string[]): string {
  return parts.map((p) => `"${p.replace(/"/g, '""')}"`).join(',');
}

describe('parseUsageCsv', () => {
  it('parses a normal Included row with numeric Requests', () => {
    const csv = [
      HEADER,
      row([
        '2026-05-13T09:33:42.386Z',
        '',
        '',
        'Included',
        'claude-opus-4-7-thinking-max',
        'No',
        '791490',
        '499887',
        '19954940',
        '232369',
        '21478686',
        '1',
      ]),
    ].join('\n');

    const { rows, failures, rowsSeen } = parseUsageCsv(csv);
    expect(failures).toHaveLength(0);
    expect(rowsSeen).toBe(1);
    expect(rows).toHaveLength(1);
    const r = rows[0]!;
    expect(r.kind).toBe('Included');
    expect(r.model).toBe('claude-opus-4-7-thinking-max');
    expect(r.maxMode).toBe(false);
    expect(r.tokens.cacheRead).toBe(19954940);
    expect(r.tokens.total).toBe(21478686);
    expect(r.requests).toEqual({ kind: 'units', value: 1 });
    expect(r.dateISO).toBe('2026-05-13T09:33:42.386Z');
  });

  it('parses fractional Requests values (Max Mode quota units)', () => {
    const csv = [
      HEADER,
      row([
        '2026-03-24T09:51:28.195Z',
        'bc-d78b7b31-c4a1-461d-a2aa-9a1e870bdac2',
        '',
        'Included',
        'claude-4.6-opus-high-thinking',
        'Yes',
        '290479',
        '70868',
        '3837013',
        '46434',
        '4244794',
        '141.5',
      ]),
    ].join('\n');

    const { rows } = parseUsageCsv(csv);
    expect(rows[0]!.requests).toEqual({ kind: 'units', value: 141.5 });
    expect(rows[0]!.maxMode).toBe(true);
  });

  it('treats "Free" Requests as a discriminated free variant', () => {
    const csv = [
      HEADER,
      row([
        '2026-05-12T06:42:04.874Z',
        '',
        '',
        'Included',
        'claude-opus-4-7-thinking-max',
        'No',
        '',
        '',
        '',
        '',
        '',
        'Free',
      ]),
    ].join('\n');

    const { rows } = parseUsageCsv(csv);
    expect(rows[0]!.requests).toEqual({ kind: 'free' });
    expect(rows[0]!.tokens).toEqual({
      inputWithCacheWrite: 0,
      inputWithoutCacheWrite: 0,
      cacheRead: 0,
      output: 0,
      total: 0,
    });
  });

  it('treats "-" Requests as errored variant', () => {
    const csv = [
      HEADER,
      row([
        '2026-05-13T01:42:25.617Z',
        '',
        '',
        'Errored, No Charge',
        'claude-opus-4-7-thinking-max',
        'No',
        '74113',
        '14',
        '425122',
        '2098',
        '501347',
        '-',
      ]),
    ].join('\n');

    const { rows, failures } = parseUsageCsv(csv);
    expect(failures).toHaveLength(0);
    expect(rows[0]!.kind).toBe('Errored, No Charge');
    expect(rows[0]!.requests).toEqual({ kind: 'errored' });
  });

  it('handles the literal comma inside "Errored, No Charge" Kind via CSV quoting', () => {
    const csv = [
      HEADER,
      row([
        '2026-05-11T02:21:38.222Z',
        '',
        '',
        'Errored, No Charge',
        'claude-opus-4-7-thinking-max',
        'No',
        '167',
        '1',
        '181601',
        '150',
        '181919',
        '-',
      ]),
    ].join('\n');

    const { rows, failures } = parseUsageCsv(csv);
    expect(failures).toHaveLength(0);
    expect(rows[0]!.kind).toBe('Errored, No Charge');
  });

  it('flags rows with unknown Kind into failures, never throws', () => {
    const csv = [
      HEADER,
      row([
        '2026-05-13T09:33:42.386Z',
        '',
        '',
        'Mystery',
        'claude-x',
        'No',
        '0',
        '0',
        '0',
        '0',
        '0',
        '1',
      ]),
    ].join('\n');

    const { rows, failures } = parseUsageCsv(csv);
    expect(rows).toHaveLength(0);
    expect(failures).toHaveLength(1);
    expect(failures[0]!.reason).toMatch(/unknown Kind/);
  });

  it('throws on missing required header columns', () => {
    const wrongHeader = 'Date,Model,Output Tokens';
    const csv = [wrongHeader, '"x","y","1"'].join('\n');
    expect(() => parseUsageCsv(csv)).toThrowError(/missing expected columns/);
  });

  it('keeps both rows when one is valid and one fails', () => {
    const csv = [
      HEADER,
      row([
        '2026-05-13T09:33:42.386Z',
        '',
        '',
        'Included',
        'claude-x',
        'No',
        '0',
        '0',
        '0',
        '0',
        '0',
        '1',
      ]),
      row(['not-a-date', '', '', 'Included', 'claude-x', 'No', '0', '0', '0', '0', '0', '1']),
    ].join('\n');

    const { rows, failures, rowsSeen } = parseUsageCsv(csv);
    expect(rowsSeen).toBe(2);
    expect(rows).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0]!.reason).toMatch(/invalid Date/);
  });
});
