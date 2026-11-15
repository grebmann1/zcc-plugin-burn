# Burn for Zana

Optional Zana Command Center plugin, version 0.1.0. This is a focused first release inspired by [Burn for BB](https://github.com/kalindudc/burn/tree/f51a739b54aba1eef8cfcee5879348124b33fab6), not full upstream feature parity. The researched original source is preserved on the [`upstream/bb`](https://github.com/grebmann1/zcc-plugin-burn/tree/upstream/bb/source) branch.

Select a thread to estimate USD spend from cumulative token reports. Configure blended input, cached-input and output rates per million tokens, plus a common per-thread warning budget. Warnings appear in the panel at 80% and 100%.

## Install

Requires a current Zana 2.6.1 build with the thread-list and project-file SDK APIs. In **Plugins → Install**, paste:

```text
https://github.com/grebmann1/zcc-plugin-burn.git
```

Or run:

```sh
zcc plugin install 'git:https://github.com/grebmann1/zcc-plugin-burn.git@v0.1.0'
```

The repository includes compiled `app.js` and `server.mjs` entries and editable TypeScript sources. No global tools or paid analysis model are required. Plugins execute with full server trust after installation. This plugin sends no telemetry or document/trace content to an external service.

## Use

Open **Plugins → Pages → Burn** or the thread’s **Burn** side-panel action. Use the refresh control to reload recorded data. Installation is optional; this repository does not change Zana core.

## Limits

Estimates use the latest cumulative report per provider-session ID visible in a 500-event history window. Repeated snapshots are replaced, cached tokens are charged once, and unknown usage stays unknown. Totals can include provider-session context predating the thread and can omit unseen child sessions. Model/rate changes, context resets and actual billing may differ. No transcript scraping, background notifications, automatic stopping or per-prompt billing attribution. Rates are manual, local to this plugin, and apply across threads. Provider Usage remains the account quota view.

## Develop and verify

```sh
npm ci
npm run check
```

`check` runs TypeScript, meaningful parser/model/server/UI tests with an enforced 80% minimum for statements, branches, functions and lines, and rebuilds the committed artifacts. Build scripts use Zana’s shared React/SDK runtime instead of shipping another React instance. CI repeats these checks and rejects stale compiled artifacts. SDK ambient types are vendored; the small `types/current-host.d.ts` and `host.ts` additions reflect APIs in the current source host that the CLI facade has not yet incorporated.

Use an isolated built-Electron profile for installation, file access and reload checks; see `LIVE_TEST.md`. The Agent Traces repository contains the cross-plugin integration runner and expects sibling `agent-traces`, `office-viewer` and `burn` checkouts. No test changes your active Zana profile.

## Attribution

Upstream: [https://github.com/kalindudc/burn](https://github.com/kalindudc/burn/tree/f51a739b54aba1eef8cfcee5879348124b33fab6), researched revision `f51a739b54aba1eef8cfcee5879348124b33fab6`. See `UPSTREAM.md`, `upstream-source.json` and `LICENSE.upstream`. Zana adaptation: MIT, Guillaume Rebmann. This repository is independently maintained and is not an official BB or Zana release.
