import { useState } from "react";
import { definePluginApp, useRpc } from "@zana-ai/zcc-plugin-sdk/app";
import type { PluginThreadPanelProps } from "@zana-ai/zcc-plugin-sdk/app";
import { Frame, Notice, control, useData, usePage } from "./ui.js";
import type { Rates, summarize } from "./model.js";
type Spend = ReturnType<typeof summarize> & {
  title: string;
  rates: Rates | null;
};
export function SpendView({ threadId }: { threadId: string }) {
  const { data, error, pending, reload } = useData<Spend>("spend", {
    threadId,
  });
  usePage("Burn", threadId);
  return (
    <>
      <button style={control} onClick={reload}>
        Refresh spend
      </button>
      <Notice pending={pending} error={error} />
      {data && (
        <>
          <h3>{data.title}</h3>
          <p style={{ fontSize: 30, margin: "12px 0" }}>
            {data.cost === null
              ? "Estimate unavailable"
              : `$${data.cost.toFixed(4)}`}
          </p>
          <p>
            {data.sessions} provider sessions · {data.input.toLocaleString()}{" "}
            input tokens ({data.cached.toLocaleString()} cached) ·{" "}
            {data.output.toLocaleString()} output tokens
          </p>
          {!data.sessions && (
            <p>
              This provider has not reported usable token totals in the current
              history window.
            </p>
          )}
          {!data.rates && (
            <p>Configure USD rates below to calculate an estimate.</p>
          )}
          {data.fraction !== null && (
            <>
              <progress
                aria-label="Budget used"
                max={1}
                value={Math.min(1, data.fraction)}
                style={{ width: "100%" }}
              />
              <p>
                {Math.round(data.fraction * 100)}% of $
                {data.rates!.budget.toFixed(2)} budget
              </p>
            </>
          )}
          {data.warning !== "none" && (
            <p role="alert">
              {data.warning === "reached"
                ? "Budget reached"
                : "80% warning — approaching budget"}
            </p>
          )}
          {data.partial && (
            <p>
              Partial history: totals cover provider sessions visible in the
              last 500 events.
            </p>
          )}
          {data.malformed > 0 && (
            <p>{data.malformed} incomplete usage reports excluded.</p>
          )}
          <p style={{ opacity: 0.7 }}>
            Estimate from reported cumulative session tokens and your configured
            blended rates. Actual billing, model changes and unseen child
            sessions may differ. Cached input is included in input totals and
            priced once.
          </p>
        </>
      )}
    </>
  );
}
export function RateForm({ saved }: { saved: () => void }) {
  const rpc = useRpc();
  const { data, pending, error } = useData<Rates | null>("rates", {});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <section>
      <h3>Rates & budget</h3>
      <p>
        USD per million tokens. Use rates appropriate for the thread’s model
        mix. A zero budget disables warnings.
      </p>
      <Notice pending={pending} error={error} />
      {!pending && !error && (
        <form
          key={JSON.stringify(data)}
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setSaving(true);
            setMessage("");
            try {
              await rpc.call(
                "saveRates",
                Object.fromEntries(
                  ["input", "cached", "output", "budget"].map((k) => [
                    k,
                    Number(form.get(k)),
                  ]),
                ),
              );
              setMessage("Rates saved");
              saved();
            } catch (cause) {
              setMessage(
                String(cause instanceof Error ? cause.message : cause),
              );
            } finally {
              setSaving(false);
            }
          }}
        >
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {(["input", "cached", "output", "budget"] as const).map((k) => (
              <label key={k} style={{ display: "grid", gap: 6 }}>
                {k === "budget"
                  ? "Thread budget (USD)"
                  : k === "cached"
                    ? "Cached input"
                    : k === "input"
                      ? "Input"
                      : "Output"}
                <input
                  style={{ ...control, width: 150 }}
                  aria-label={k}
                  name={k}
                  type="number"
                  required
                  min={0}
                  max={1000000}
                  step="any"
                  defaultValue={data?.[k] ?? ""}
                />
              </label>
            ))}
          </div>
          <button
            disabled={saving}
            style={{ ...control, marginTop: 12 }}
            type="submit"
          >
            {saving ? "Saving…" : "Save rates"}
          </button>
        </form>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
export function Panel({ threadId }: { threadId?: string }) {
  const { data, error, pending } = useData<
    Array<{ id: string; title: string }>
  >("threads", {});
  const [chosen, setChosen] = useState("");
  const [revision, setRevision] = useState(0);
  const id = threadId || chosen;
  usePage("Burn", id || undefined);
  return (
    <Frame title="Burn">
      {!threadId && (
        <>
          <label>
            Thread{" "}
            <select
              style={control}
              aria-label="Thread"
              value={chosen}
              onChange={(e) => setChosen(e.target.value)}
            >
              <option value="">Choose a thread</option>
              {data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
          <Notice pending={pending} error={error} />
          {data?.length === 0 && <p>No threads yet.</p>}
        </>
      )}
      {id ? (
        <SpendView key={id + revision} threadId={id} />
      ) : (
        <p>Choose a thread to estimate spend.</p>
      )}
      <hr style={{ opacity: 0.2, margin: "24px 0" }} />
      <RateForm saved={() => setRevision((x) => x + 1)} />
    </Frame>
  );
}
export default definePluginApp((app) => {
  app.slots.navPanel({
    id: "main",
    title: "Burn",
    icon: "Flame",
    placement: "extensions",
    component: Panel,
  });
  app.slots.threadPanelAction({
    id: "spend",
    title: "Burn",
    icon: "Flame",
    component: (p: PluginThreadPanelProps) => <Panel threadId={p.threadId} />,
  });
});
