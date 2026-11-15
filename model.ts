export const record = (x: unknown): Record<string, unknown> =>
  x !== null && typeof x === "object" && !Array.isArray(x)
    ? (x as Record<string, unknown>)
    : {};
export type Rates = {
  input: number;
  cached: number;
  output: number;
  budget: number;
};
export type Row = { seq: number; type: string; payload: unknown };
export function validRates(input: unknown): Rates {
  const p = record(input);
  const result = {} as Rates;
  for (const k of ["input", "cached", "output", "budget"] as const) {
    const n = p[k];
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1000000)
      throw new Error(
        "Rates and budget must be finite numbers between 0 and 1,000,000",
      );
    result[k] = n;
  }
  if (result.cached > result.input)
    throw new Error("Cached input rate must not exceed input rate");
  return result;
}
function count(x: unknown): number | null {
  return typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : null;
}
export function summarize(rows: Row[], rates: Rates | null) {
  const sessions = new Map<
    string,
    { input: number; cached: number; output: number; seq: number }
  >();
  let malformed = 0;
  for (const row of [...rows].sort((a, b) => a.seq - b.seq)) {
    if (row.type !== "thread/tokenUsage/updated") continue;
    const p = record(row.payload);
    const t = record(record(p.tokenUsage).total);
    const input = count(t.inputTokens),
      cached = count(t.cachedInputTokens),
      output = count(t.outputTokens);
    if (
      input === null ||
      cached === null ||
      output === null ||
      cached > input ||
      typeof p.providerThreadId !== "string" ||
      !p.providerThreadId
    ) {
      malformed++;
      continue;
    }
    // Each event is a cumulative provider-session total. Replace snapshots; never add `last`.
    sessions.set(p.providerThreadId, { input, cached, output, seq: row.seq });
  }
  const totals = [...sessions.values()].reduce(
    (a, s) => ({
      input: a.input + s.input,
      cached: a.cached + s.cached,
      output: a.output + s.output,
    }),
    { input: 0, cached: 0, output: 0 },
  );
  const cost =
    rates && sessions.size
      ? ((totals.input - totals.cached) * rates.input +
          totals.cached * rates.cached +
          totals.output * rates.output) /
        1000000
      : null;
  const fraction =
    cost !== null && rates && rates.budget > 0 ? cost / rates.budget : null;
  return {
    ...totals,
    cost,
    fraction,
    warning:
      fraction === null
        ? "none"
        : fraction >= 1
          ? "reached"
          : fraction >= 0.8
            ? "approaching"
            : "none",
    sessions: sessions.size,
    malformed,
    partial:
      rows.length >= 500 ||
      (rows.length > 0 && Math.min(...rows.map((r) => r.seq)) > 1),
  };
}
