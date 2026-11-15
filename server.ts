import type { HostApi } from "./host.js";
import { record, summarize, validRates, type Rates } from "./model.js";
export default function plugin(zcc: HostApi) {
  let tail: Promise<unknown> = Promise.resolve();
  zcc.rpc.method("threads", async () =>
    (await zcc.sdk.threads.list({ limit: 100, archived: false })).map((t) => ({
      id: t.id,
      title: t.title || t.titleFallback || t.id,
    })),
  );
  zcc.rpc.method("rates", () => zcc.storage.kv.get<Rates>("rates"));
  zcc.rpc.method("saveRates", (input) => {
    const rates = validRates(input);
    const next = tail
      .catch(() => {})
      .then(() => zcc.storage.kv.set("rates", rates));
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
      zcc.storage.kv.get<Rates>("rates"),
    ]);
    const rates = stored ? validRates(stored) : null;
    return {
      title: thread.title || thread.titleFallback || thread.id,
      rates,
      ...summarize(rows, rates),
    };
  });
}
