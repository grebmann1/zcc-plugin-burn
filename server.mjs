// model.ts
var record = (x) => x !== null && typeof x === "object" && !Array.isArray(x) ? x : {};
function validRates(input) {
  const p = record(input);
  const result = {};
  for (const k of ["input", "cached", "output", "budget"]) {
    const n = p[k];
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1e6)
      throw new Error(
        "Rates and budget must be finite numbers between 0 and 1,000,000"
      );
    result[k] = n;
  }
  if (result.cached > result.input)
    throw new Error("Cached input rate must not exceed input rate");
  return result;
}
function count(x) {
  return typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : null;
}
function summarize(rows, rates) {
  const sessions = /* @__PURE__ */ new Map();
  let malformed = 0;
  for (const row of [...rows].sort((a, b) => a.seq - b.seq)) {
    if (row.type !== "thread/tokenUsage/updated") continue;
    const p = record(row.payload);
    const t = record(record(p.tokenUsage).total);
    const input = count(t.inputTokens), cached = count(t.cachedInputTokens), output = count(t.outputTokens);
    if (input === null || cached === null || output === null || cached > input || typeof p.providerThreadId !== "string" || !p.providerThreadId) {
      malformed++;
      continue;
    }
    sessions.set(p.providerThreadId, { input, cached, output, seq: row.seq });
  }
  const totals = [...sessions.values()].reduce(
    (a, s) => ({
      input: a.input + s.input,
      cached: a.cached + s.cached,
      output: a.output + s.output
    }),
    { input: 0, cached: 0, output: 0 }
  );
  const cost = rates && sessions.size ? ((totals.input - totals.cached) * rates.input + totals.cached * rates.cached + totals.output * rates.output) / 1e6 : null;
  const fraction = cost !== null && rates && rates.budget > 0 ? cost / rates.budget : null;
  return {
    ...totals,
    cost,
    fraction,
    warning: fraction === null ? "none" : fraction >= 1 ? "reached" : fraction >= 0.8 ? "approaching" : "none",
    sessions: sessions.size,
    malformed,
    partial: rows.length >= 500 || rows.length > 0 && Math.min(...rows.map((r) => r.seq)) > 1
  };
}

// server.ts
function plugin(zcc) {
  let tail = Promise.resolve();
  zcc.rpc.method(
    "threads",
    async () => (await zcc.sdk.threads.list({ limit: 100, archived: false })).map((t) => ({
      id: t.id,
      title: t.title || t.titleFallback || t.id
    }))
  );
  zcc.rpc.method("rates", () => zcc.storage.kv.get("rates"));
  zcc.rpc.method("saveRates", (input) => {
    const rates = validRates(input);
    const next = tail.catch(() => {
    }).then(() => zcc.storage.kv.set("rates", rates));
    tail = next;
    return next.then(() => rates);
  });
  zcc.rpc.method("spend", async (input) => {
    const id = record(input).threadId;
    if (typeof id !== "string" || !id.trim() || id.length > 200)
      throw new Error("A thread is required");
    const thread = await zcc.sdk.threads.get({ threadId: id });
    if (!thread) throw new Error("Thread not found");
    const [rows, stored] = await Promise.all([
      zcc.sdk.threads.events.list({ threadId: id, limit: 500, order: "asc" }),
      zcc.storage.kv.get("rates")
    ]);
    const rates = stored ? validRates(stored) : null;
    return {
      title: thread.title || thread.titleFallback || thread.id,
      rates,
      ...summarize(rows, rates)
    };
  });
}
export {
  plugin as default
};
