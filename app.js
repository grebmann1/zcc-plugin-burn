// host:react
var m = globalThis.__bbPluginRuntime?.react;
if (!m) throw new Error("Open this plugin in Zana");
var { useState, useEffect, useCallback, useRef, createElement, Fragment } = m;

// host:@zana-ai/zcc-plugin-sdk/app
var m2 = globalThis.__bbPluginRuntime?.pluginSdkApp;
if (!m2) throw new Error("Open this plugin in Zana");
var { definePluginApp, useRpc, useComposer, useZccNavigate } = m2;

// host:react/jsx-runtime
var m3 = globalThis.__bbPluginRuntime?.jsxRuntime;
if (!m3) throw new Error("Open this plugin in Zana");
var { jsx, jsxs, Fragment: Fragment2 } = m3;

// ui.tsx
var box = {
  height: "100%",
  overflow: "auto",
  padding: 24,
  boxSizing: "border-box",
  color: "var(--text-primary,inherit)",
  fontFamily: "inherit"
};
var control = {
  background: "var(--bg-elevated,#27292d)",
  color: "inherit",
  border: "1px solid var(--border-default,#555)",
  borderRadius: 7,
  padding: "8px 12px",
  font: "inherit"
};
function Frame({
  title,
  children
}) {
  return /* @__PURE__ */ jsxs("main", { style: box, children: [
    /* @__PURE__ */ jsx("h2", { style: { marginTop: 0 }, children: title }),
    children
  ] });
}
function usePage(title, resourceId) {
  const nav = useZccNavigate();
  useEffect(() => {
    nav.setPageContext?.({
      title,
      resourceId,
      view: resourceId ? "detail" : "list"
    });
    return () => nav.setPageContext?.(null);
  }, [nav.setPageContext, title, resourceId]);
}
function useData(method, args) {
  const rpc = useRpc();
  const key = JSON.stringify(args);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [revision, refresh] = useState(0);
  useEffect(() => {
    let alive = true;
    setPending(true);
    setData(null);
    setError("");
    void rpc.call(method, JSON.parse(key)).then(
      (value) => {
        if (alive) setData(value);
      },
      (cause) => {
        if (alive)
          setError(String(cause instanceof Error ? cause.message : cause));
      }
    ).finally(() => {
      if (alive) setPending(false);
    });
    return () => {
      alive = false;
    };
  }, [rpc, method, key, revision]);
  const reload = useCallback(() => refresh((x) => x + 1), []);
  return { data, error, pending, reload };
}
function Notice({
  pending,
  error
}) {
  return /* @__PURE__ */ jsxs(Fragment2, { children: [
    pending && /* @__PURE__ */ jsx("p", { role: "status", children: "Loading\u2026" }),
    error && /* @__PURE__ */ jsx("p", { role: "alert", children: error })
  ] });
}

// app.tsx
function SpendView({ threadId }) {
  const { data, error, pending, reload } = useData("spend", {
    threadId
  });
  usePage("Burn", threadId);
  return /* @__PURE__ */ jsxs(Fragment2, { children: [
    /* @__PURE__ */ jsx("button", { style: control, onClick: reload, children: "Refresh spend" }),
    /* @__PURE__ */ jsx(Notice, { pending, error }),
    data && /* @__PURE__ */ jsxs(Fragment2, { children: [
      /* @__PURE__ */ jsx("h3", { children: data.title }),
      /* @__PURE__ */ jsx("p", { style: { fontSize: 30, margin: "12px 0" }, children: data.cost === null ? "Estimate unavailable" : `$${data.cost.toFixed(4)}` }),
      /* @__PURE__ */ jsxs("p", { children: [
        data.sessions,
        " provider sessions \xB7 ",
        data.input.toLocaleString(),
        " ",
        "input tokens (",
        data.cached.toLocaleString(),
        " cached) \xB7",
        " ",
        data.output.toLocaleString(),
        " output tokens"
      ] }),
      !data.sessions && /* @__PURE__ */ jsx("p", { children: "This provider has not reported usable token totals in the current history window." }),
      !data.rates && /* @__PURE__ */ jsx("p", { children: "Configure USD rates below to calculate an estimate." }),
      data.fraction !== null && /* @__PURE__ */ jsxs(Fragment2, { children: [
        /* @__PURE__ */ jsx(
          "progress",
          {
            "aria-label": "Budget used",
            max: 1,
            value: Math.min(1, data.fraction),
            style: { width: "100%" }
          }
        ),
        /* @__PURE__ */ jsxs("p", { children: [
          Math.round(data.fraction * 100),
          "% of $",
          data.rates.budget.toFixed(2),
          " budget"
        ] })
      ] }),
      data.warning !== "none" && /* @__PURE__ */ jsx("p", { role: "alert", children: data.warning === "reached" ? "Budget reached" : "80% warning \u2014 approaching budget" }),
      data.partial && /* @__PURE__ */ jsx("p", { children: "Partial history: totals cover provider sessions visible in the last 500 events." }),
      data.malformed > 0 && /* @__PURE__ */ jsxs("p", { children: [
        data.malformed,
        " incomplete usage reports excluded."
      ] }),
      /* @__PURE__ */ jsx("p", { style: { opacity: 0.7 }, children: "Estimate from reported cumulative session tokens and your configured blended rates. Actual billing, model changes and unseen child sessions may differ. Cached input is included in input totals and priced once." })
    ] })
  ] });
}
function RateForm({ saved }) {
  const rpc = useRpc();
  const { data, pending, error } = useData("rates", {});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  return /* @__PURE__ */ jsxs("section", { children: [
    /* @__PURE__ */ jsx("h3", { children: "Rates & budget" }),
    /* @__PURE__ */ jsx("p", { children: "USD per million tokens. Use rates appropriate for the thread\u2019s model mix. A zero budget disables warnings." }),
    /* @__PURE__ */ jsx(Notice, { pending, error }),
    !pending && !error && /* @__PURE__ */ jsxs(
      "form",
      {
        onSubmit: async (e) => {
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
                  Number(form.get(k))
                ])
              )
            );
            setMessage("Rates saved");
            saved();
          } catch (cause) {
            setMessage(
              String(cause instanceof Error ? cause.message : cause)
            );
          } finally {
            setSaving(false);
          }
        },
        children: [
          /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: 12, flexWrap: "wrap" }, children: ["input", "cached", "output", "budget"].map((k) => /* @__PURE__ */ jsxs("label", { style: { display: "grid", gap: 6 }, children: [
            k === "budget" ? "Thread budget (USD)" : k === "cached" ? "Cached input" : k === "input" ? "Input" : "Output",
            /* @__PURE__ */ jsx(
              "input",
              {
                style: { ...control, width: 150 },
                "aria-label": k,
                name: k,
                type: "number",
                required: true,
                min: 0,
                max: 1e6,
                step: "any",
                defaultValue: data?.[k] ?? ""
              }
            )
          ] }, k)) }),
          /* @__PURE__ */ jsx(
            "button",
            {
              disabled: saving,
              style: { ...control, marginTop: 12 },
              type: "submit",
              children: saving ? "Saving\u2026" : "Save rates"
            }
          )
        ]
      },
      JSON.stringify(data)
    ),
    message && /* @__PURE__ */ jsx("p", { role: "status", children: message })
  ] });
}
function Panel({ threadId }) {
  const { data, error, pending } = useData("threads", {});
  const [chosen, setChosen] = useState("");
  const [revision, setRevision] = useState(0);
  const id = threadId || chosen;
  usePage("Burn", id || void 0);
  return /* @__PURE__ */ jsxs(Frame, { title: "Burn", children: [
    !threadId && /* @__PURE__ */ jsxs(Fragment2, { children: [
      /* @__PURE__ */ jsxs("label", { children: [
        "Thread",
        " ",
        /* @__PURE__ */ jsxs(
          "select",
          {
            style: control,
            "aria-label": "Thread",
            value: chosen,
            onChange: (e) => setChosen(e.target.value),
            children: [
              /* @__PURE__ */ jsx("option", { value: "", children: "Choose a thread" }),
              data?.map((t) => /* @__PURE__ */ jsx("option", { value: t.id, children: t.title }, t.id))
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsx(Notice, { pending, error }),
      data?.length === 0 && /* @__PURE__ */ jsx("p", { children: "No threads yet." })
    ] }),
    id ? /* @__PURE__ */ jsx(SpendView, { threadId: id }, id + revision) : /* @__PURE__ */ jsx("p", { children: "Choose a thread to estimate spend." }),
    /* @__PURE__ */ jsx("hr", { style: { opacity: 0.2, margin: "24px 0" } }),
    /* @__PURE__ */ jsx(RateForm, { saved: () => setRevision((x) => x + 1) })
  ] });
}
var app_default = definePluginApp((app) => {
  app.slots.navPanel({
    id: "main",
    title: "Burn",
    icon: "Flame",
    placement: "extensions",
    component: Panel
  });
  app.slots.threadPanelAction({
    id: "spend",
    title: "Burn",
    icon: "Flame",
    component: (p) => /* @__PURE__ */ jsx(Panel, { threadId: p.threadId })
  });
});
export {
  Panel,
  RateForm,
  SpendView,
  app_default as default
};
