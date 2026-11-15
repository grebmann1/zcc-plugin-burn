import { expect, it } from "vitest";
import {
  record,
  summarize,
  validRates,
  type Rates,
  type Row,
} from "./model.js";
const rates: Rates = { input: 10, cached: 1, output: 20, budget: 0.1 };
const row = (
  seq: number,
  input: number,
  cached: number,
  output: number,
  session = "provider",
): Row => ({
  seq,
  type: "thread/tokenUsage/updated",
  payload: {
    providerThreadId: session,
    tokenUsage: {
      total: {
        inputTokens: input,
        cachedInputTokens: cached,
        outputTokens: output,
      },
      last: { inputTokens: 9000000 },
    },
  },
});
it("replaces cumulative reports and prices cached input exactly once", () => {
  const result = summarize(
    [
      row(3, 10000, 2000, 1000),
      row(1, 4000, 1000, 500),
      row(4, 10000, 2000, 1000),
    ],
    rates,
  );
  expect(result).toMatchObject({
    input: 10000,
    cached: 2000,
    output: 1000,
    sessions: 1,
    cost: 0.102,
    warning: "reached",
  });
  expect(result.fraction).toBeCloseTo(1.02);
});
it("keeps separate provider sessions and handles reset cumulative totals", () => {
  expect(
    summarize(
      [row(1, 100, 0, 10), row(2, 20, 0, 2), row(3, 10, 0, 1, "resumed")],
      rates,
    ),
  ).toMatchObject({ input: 30, output: 3, sessions: 2 });
});
it("never turns unknown or malformed usage into a zero dollar estimate", () => {
  expect(summarize([], rates).cost).toBeNull();
  expect(summarize([row(1, 10, 0, 1)], null).cost).toBeNull();
  const bads = [
    null,
    { providerThreadId: "", tokenUsage: {} },
    {
      providerThreadId: "x",
      tokenUsage: {
        total: { inputTokens: -1, cachedInputTokens: 0, outputTokens: 2 },
      },
    },
    {
      providerThreadId: "x",
      tokenUsage: {
        total: { inputTokens: 1, cachedInputTokens: 2, outputTokens: 1 },
      },
    },
  ];
  expect(
    summarize(
      bads.map((payload, i) => ({
        seq: i + 1,
        type: "thread/tokenUsage/updated",
        payload,
      })),
      rates,
    ).malformed,
  ).toBe(4);
  expect(
    summarize([{ seq: 1, type: "turn/started", payload: {} }], rates).malformed,
  ).toBe(0);
});
it("uses inclusive budget thresholds and can disable warnings", () => {
  const rows = [row(1, 10000, 0, 0)];
  expect(summarize(rows, { ...rates, budget: 0.125 }).warning).toBe(
    "approaching",
  );
  expect(summarize(rows, { ...rates, budget: 1 }).warning).toBe("none");
  expect(summarize(rows, { ...rates, budget: 0 }).fraction).toBeNull();
  expect(summarize([row(40, 1, 0, 0)], rates).partial).toBe(true);
  expect(
    summarize(
      Array.from({ length: 500 }, (_, i) => row(i + 1, 1, 0, 0)),
      rates,
    ).partial,
  ).toBe(true);
});
it("validates bounded manual rates", () => {
  expect(validRates(rates)).toEqual(rates);
  for (const value of [
    null,
    [],
    {},
    { ...rates, input: NaN },
    { ...rates, input: Infinity },
    { ...rates, input: -1 },
    { ...rates, budget: 1000001 },
    { ...rates, cached: 11 },
  ])
    expect(() => validRates(value)).toThrow();
  expect(record([])).toEqual({});
});
