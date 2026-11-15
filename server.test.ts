import { expect, it, vi } from "vitest";
import plugin from "./server.js";
import type { HostApi } from "./host.js";
it("persists rates, tolerates a failed write and confines spend reads to the selected thread", async () => {
  const handlers = new Map<string, (v?: unknown) => unknown>();
  let stored: unknown = null;
  const set = vi.fn(async (_k: string, v: unknown) => {
    stored = v;
  });
  const get = vi.fn(async ({ threadId }: { threadId: string }) =>
    threadId === "missing" ? null : { id: threadId, titleFallback: "Work" },
  );
  plugin({
    rpc: {
      method: (n: string, fn: (v?: unknown) => unknown) => handlers.set(n, fn),
    },
    storage: { kv: { get: async () => stored, set } },
    sdk: {
      threads: {
        list: async () => [
          { id: "a", title: "A" },
          { id: "b", titleFallback: "B" },
          { id: "c" },
        ],
        get,
        events: { list: async () => [] },
      },
    },
  } as unknown as HostApi);
  expect(await handlers.get("threads")!()).toEqual([
    { id: "a", title: "A" },
    { id: "b", title: "B" },
    { id: "c", title: "c" },
  ]);
  expect(await handlers.get("rates")!()).toBeNull();
  expect(await handlers.get("spend")!({ threadId: "a" })).toMatchObject({
    rates: null,
    cost: null,
    title: "Work",
  });
  const rates = { input: 10, cached: 1, output: 20, budget: 1 };
  set.mockRejectedValueOnce(new Error("Disk full"));
  await expect(handlers.get("saveRates")!(rates)).rejects.toThrow("Disk full");
  await expect(handlers.get("saveRates")!(rates)).resolves.toEqual(rates);
  expect(await handlers.get("spend")!({ threadId: "a" })).toMatchObject({
    rates,
  });
  for (const value of [
    null,
    {},
    [],
    { threadId: "" },
    { threadId: " " },
    { threadId: "x".repeat(201) },
  ])
    await expect(handlers.get("spend")!(value)).rejects.toThrow("required");
  await expect(handlers.get("spend")!({ threadId: "missing" })).rejects.toThrow(
    "not found",
  );
  get.mockResolvedValueOnce({ id: "a", title: "Title" } as never);
  await expect(
    handlers.get("spend")!({ threadId: "a" }),
  ).resolves.toMatchObject({ title: "Title" });
  get.mockResolvedValueOnce({ id: "a" } as never);
  await expect(
    handlers.get("spend")!({ threadId: "a" }),
  ).resolves.toMatchObject({ title: "a" });
});
