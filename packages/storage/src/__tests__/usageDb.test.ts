import type { RowWithCost } from '@cu/data';
import { describe, expect, it } from 'vitest';
import { UsageDb } from '../usageDb';

/**
 * Builds a deterministic synthetic row. `seed` makes every observable
 * field unique so two rows with different seeds never dedupe-collide.
 */
function makeRow(seed: number, overrides: Partial<RowWithCost> = {}): RowWithCost {
  const dateISO = `2026-05-${String((seed % 28) + 1).padStart(2, '0')}T${String((seed * 7) % 24).padStart(2, '0')}:00:00.000Z`;
  return {
    id: `row-${seed}`,
    dateISO,
    date: new Date(dateISO),
    cloudAgentId: `agent-${seed}`,
    automationId: '',
    kind: 'Included',
    model: seed % 2 === 0 ? 'claude-4-sonnet-thinking' : 'gpt-5-thinking',
    maxMode: seed % 5 === 0,
    tokens: {
      inputWithCacheWrite: 100 * seed,
      inputWithoutCacheWrite: 200 * seed,
      cacheRead: 50 * seed,
      output: 80 * seed,
      total: 430 * seed,
    },
    requests: { kind: 'units', value: 0.1 * seed },
    cost: 0.05 * seed,
    costEstimated: false,
    ...overrides,
  };
}

describe('UsageDb', () => {
  it('init() is idempotent and applies WAL', () => {
    const db = new UsageDb(':memory:');
    db.init();
    db.init(); // should not throw on re-init
    const { rowCount, batchCount } = db.counts();
    expect(rowCount).toBe(0);
    expect(batchCount).toBe(0);
    db.close();
  });

  it('imports a batch and reports added / skipped correctly', () => {
    const db = new UsageDb(':memory:');
    db.init();

    const rows = [makeRow(1), makeRow(2), makeRow(3)];
    const r = db.importRows(rows, { filename: 'a.csv', fileSha256: 'aaaa' });

    expect(r.added).toBe(3);
    expect(r.skipped).toBe(0);
    expect(r.isDuplicateFile).toBe(false);
    expect(r.dateMin).toBe('2026-05-02');
    expect(r.dateMax).toBe('2026-05-04');

    const counts = db.counts();
    expect(counts.rowCount).toBe(3);
    expect(counts.batchCount).toBe(1);

    db.close();
  });

  it('dedups rows on the natural key when re-imported with a different file', () => {
    const db = new UsageDb(':memory:');
    db.init();

    const r1 = db.importRows([makeRow(1), makeRow(2)], { filename: 'a.csv', fileSha256: 'aaaa' });
    // Same row content, fresh sha → a new batch will be created but the
    // existing rows will skip.
    const r2 = db.importRows([makeRow(1), makeRow(2), makeRow(3)], {
      filename: 'b.csv',
      fileSha256: 'bbbb',
    });

    expect(r1.added).toBe(2);
    expect(r2.added).toBe(1);
    expect(r2.skipped).toBe(2);
    expect(r2.isDuplicateFile).toBe(false);

    expect(db.counts().rowCount).toBe(3);
    expect(db.counts().batchCount).toBe(2);

    db.close();
  });

  it('short-circuits on duplicate file SHA', () => {
    const db = new UsageDb(':memory:');
    db.init();

    const first = db.importRows([makeRow(1), makeRow(2)], { filename: 'a.csv', fileSha256: 'ZZZ' });
    const second = db.importRows([makeRow(1), makeRow(2)], {
      filename: 'a.csv',
      fileSha256: 'ZZZ',
    });

    expect(second.isDuplicateFile).toBe(true);
    expect(second.existingBatchId).toBe(first.batchId);
    expect(second.added).toBe(0);
    // We count all supplied rows as skipped on dup-file path; renderer
    // can use this for "you already imported this file" UX copy.
    expect(second.skipped).toBe(2);

    expect(db.counts().rowCount).toBe(2);
    expect(db.counts().batchCount).toBe(1);

    db.close();
  });

  it("undoBatch removes only that batch's newly-inserted rows", () => {
    const db = new UsageDb(':memory:');
    db.init();

    db.importRows([makeRow(1), makeRow(2)], { filename: 'a.csv', fileSha256: 'a' });
    const second = db.importRows([makeRow(2), makeRow(3), makeRow(4)], {
      filename: 'b.csv',
      fileSha256: 'b',
    });

    // First batch inserted rows 1 + 2; second batch inserted 3 + 4 (and
    // skipped 2). Undoing the second batch should drop rows 3 + 4, not 2.
    expect(db.counts().rowCount).toBe(4);
    const undone = db.undoBatch(second.batchId);
    expect(undone.removedRows).toBe(2);
    expect(db.counts().rowCount).toBe(2);

    // The batch row itself is gone.
    const batches = db.listBatches();
    expect(batches.find((b) => b.id === second.batchId)).toBeUndefined();

    db.close();
  });

  it('byDay query aggregates rows correctly', () => {
    const db = new UsageDb(':memory:');
    db.init();

    const rows: RowWithCost[] = [
      makeRow(1, { dateISO: '2026-05-01T10:00:00.000Z', cost: 1.5 }),
      makeRow(2, { dateISO: '2026-05-01T11:00:00.000Z', cost: 2.5 }),
      makeRow(3, { dateISO: '2026-05-02T10:00:00.000Z', cost: 4 }),
    ];
    db.importRows(rows, { filename: 'a.csv', fileSha256: 'q' });

    const byDay = db.query('byDay');
    expect(byDay).toHaveLength(2);
    expect(byDay[0]).toMatchObject({ day: '2026-05-01', rows: 2, cost: 4 });
    expect(byDay[1]).toMatchObject({ day: '2026-05-02', rows: 1, cost: 4 });

    db.close();
  });

  it('byModel groups cost / tokens by model name', () => {
    const db = new UsageDb(':memory:');
    db.init();

    db.importRows(
      [
        makeRow(1, { model: 'claude-4-opus', cost: 10 }),
        makeRow(2, { model: 'claude-4-opus', cost: 5 }),
        makeRow(3, { model: 'gpt-5', cost: 3 }),
      ],
      { filename: 'a.csv', fileSha256: 's' },
    );

    const byModel = db.query('byModel');
    expect(byModel[0]?.model).toBe('claude-4-opus');
    expect(byModel[0]?.cost).toBe(15);
    expect(byModel[1]?.model).toBe('gpt-5');
    expect(byModel[1]?.cost).toBe(3);

    db.close();
  });

  it('byHourWeekday derives hour / weekday from UTC date', () => {
    const db = new UsageDb(':memory:');
    db.init();

    db.importRows(
      [
        // 2026-05-15 is a Friday in UTC; weekday=5
        makeRow(1, { dateISO: '2026-05-15T03:00:00.000Z' }),
        makeRow(2, { dateISO: '2026-05-15T03:30:00.000Z' }),
      ],
      { filename: 'a.csv', fileSha256: 'h' },
    );

    const cells = db.query('byHourWeekday');
    expect(cells.find((c) => c.hour === 3 && c.weekday === 5)?.rows).toBe(2);

    db.close();
  });

  it('topBurns is sorted by cost desc and respects limit', () => {
    const db = new UsageDb(':memory:');
    db.init();

    db.importRows(
      [
        makeRow(1, { cost: 10 }),
        makeRow(2, { cost: 30 }),
        makeRow(3, { cost: 20 }),
        makeRow(4, { cost: 5 }),
      ],
      { filename: 'a.csv', fileSha256: 't' },
    );

    const top2 = db.query('topBurns', { limit: 2 });
    expect(top2).toHaveLength(2);
    expect(top2[0]?.cost).toBe(30);
    expect(top2[1]?.cost).toBe(20);

    db.close();
  });

  it('byMonth aggregates across calendar months', () => {
    const db = new UsageDb(':memory:');
    db.init();

    db.importRows(
      [
        makeRow(1, { dateISO: '2026-04-15T00:00:00.000Z', cost: 1 }),
        makeRow(2, { dateISO: '2026-04-20T00:00:00.000Z', cost: 2 }),
        makeRow(3, { dateISO: '2026-05-01T00:00:00.000Z', cost: 4 }),
      ],
      { filename: 'a.csv', fileSha256: 'm' },
    );

    const byMonth = db.query('byMonth');
    expect(byMonth).toEqual([
      expect.objectContaining({ month: '2026-04', cost: 3, rows: 2 }),
      expect.objectContaining({ month: '2026-05', cost: 4, rows: 1 }),
    ]);

    db.close();
  });

  it('counts() reflects state correctly across imports + undos', () => {
    const db = new UsageDb(':memory:');
    db.init();

    expect(db.counts().rowCount).toBe(0);
    const a = db.importRows([makeRow(1), makeRow(2)], { filename: 'a.csv', fileSha256: 'a' });
    const b = db.importRows([makeRow(3), makeRow(4)], { filename: 'b.csv', fileSha256: 'b' });
    expect(db.counts().rowCount).toBe(4);
    db.undoBatch(a.batchId);
    expect(db.counts().rowCount).toBe(2);
    db.undoBatch(b.batchId);
    expect(db.counts().rowCount).toBe(0);
    expect(db.counts().batchCount).toBe(0);
    db.close();
  });

  it('previewImport reports adds vs skips without persisting', () => {
    const db = new UsageDb(':memory:');
    db.init();

    db.importRows([makeRow(1), makeRow(2)], { filename: 'a.csv', fileSha256: 'A' });
    const before = db.counts();

    const preview = db.previewImport([makeRow(2), makeRow(3), makeRow(4)], {
      filename: 'b.csv',
      fileSha256: 'B',
    });

    expect(preview.isDuplicateFile).toBe(false);
    expect(preview.wouldAdd).toBe(2);
    expect(preview.wouldSkip).toBe(1);
    expect(preview.dateMin).toBe('2026-05-04');
    expect(preview.dateMax).toBe('2026-05-05');

    const after = db.counts();
    expect(after.rowCount).toBe(before.rowCount);
    expect(after.batchCount).toBe(before.batchCount);

    // And the real importRows agrees with the preview.
    const real = db.importRows([makeRow(2), makeRow(3), makeRow(4)], {
      filename: 'b.csv',
      fileSha256: 'B',
    });
    expect(real.added).toBe(preview.wouldAdd);
    expect(real.skipped).toBe(preview.wouldSkip);

    db.close();
  });

  it('previewImport flags duplicate file SHA without scanning rows', () => {
    const db = new UsageDb(':memory:');
    db.init();

    const first = db.importRows([makeRow(1)], { filename: 'a.csv', fileSha256: 'SAME' });
    const preview = db.previewImport([makeRow(1), makeRow(2)], {
      filename: 'a.csv',
      fileSha256: 'SAME',
    });

    expect(preview.isDuplicateFile).toBe(true);
    expect(preview.existingBatchId).toBe(first.batchId);
    expect(preview.wouldAdd).toBe(0);
    expect(preview.wouldSkip).toBe(2);

    db.close();
  });

  it('allRowsCosted returns sorted rows in serialized shape', () => {
    const db = new UsageDb(':memory:');
    db.init();

    db.importRows(
      [
        makeRow(2, { dateISO: '2026-05-10T00:00:00.000Z', cost: 5 }),
        makeRow(1, { dateISO: '2026-05-01T00:00:00.000Z', cost: 1 }),
      ],
      { filename: 'a.csv', fileSha256: 'X' },
    );

    const rows = db.query('allRowsCosted');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.dateISO).toBe('2026-05-01T00:00:00.000Z');
    expect(rows[1]?.dateISO).toBe('2026-05-10T00:00:00.000Z');
    expect(rows[0]?.tokens).toMatchObject({ total: expect.any(Number) });
    expect(rows[0]?.requests).toEqual({ kind: 'units', value: expect.any(Number) });
    // Serialized form intentionally has no `date` field — renderer rehydrates.
    expect(Object.prototype.hasOwnProperty.call(rows[0], 'date')).toBe(false);

    db.close();
  });
});
