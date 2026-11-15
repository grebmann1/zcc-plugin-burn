import { afterEach, beforeEach, expect, it } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Panel, RateForm, SpendView } from "./app.tsx";
import { rpc, slots } from "./test-runtime.js";
afterEach(cleanup);
beforeEach(() => {
  rpc.call.mockReset();
});
const rates = { input: 10, cached: 1, output: 20, budget: 2 };
const spend = {
  title: "Work",
  cost: 1.8,
  input: 10000,
  cached: 1000,
  output: 20,
  sessions: 1,
  fraction: 0.9,
  warning: "approaching",
  rates,
  partial: true,
  malformed: 1,
};
it("registers both surfaces and uses the owning thread", async () => {
  expect(slots.navPanel).toHaveBeenCalled();
  expect(
    slots.threadPanelAction.mock.calls[0][0].component({ threadId: "t" }),
  ).toBeTruthy();
  rpc.call.mockImplementation(async (method) =>
    method === "spend" ? spend : method === "threads" ? [] : rates,
  );
  render(<Panel threadId="t" />);
  await screen.findByText("$1.8000");
  expect(screen.queryByLabelText("Thread")).toBeNull();
  expect(screen.getByRole("alert").textContent).toContain("80%");
  fireEvent.click(screen.getByText("Refresh spend"));
  expect(rpc.call).toHaveBeenCalledWith("spend", { threadId: "t" });
});
it("selects threads and handles unavailable usage", async () => {
  rpc.call.mockImplementation(async (method) =>
    method === "threads"
      ? [{ id: "t", title: "Thread one" }]
      : method === "rates"
        ? null
        : {
            ...spend,
            cost: null,
            rates: null,
            sessions: 0,
            fraction: null,
            warning: "none",
            partial: false,
            malformed: 0,
          },
  );
  render(<Panel />);
  await screen.findByText("Thread one");
  fireEvent.change(screen.getByLabelText("Thread"), { target: { value: "t" } });
  await screen.findByText("Estimate unavailable");
  expect(
    screen.getByText("Configure USD rates below to calculate an estimate."),
  ).toBeTruthy();
});
it("shows budget reached and empty catalogues", async () => {
  rpc.call.mockResolvedValue({ ...spend, warning: "reached" });
  const view = render(<SpendView threadId="t" />);
  await screen.findByText("Budget reached");
  view.unmount();
  rpc.call.mockResolvedValue(null);
  render(<RateForm saved={() => {}} />);
  await screen.findByLabelText("input");
  cleanup();
  rpc.call.mockImplementation(async (method) =>
    method === "threads" ? [] : null,
  );
  render(<Panel />);
  await screen.findByText("No threads yet.");
});
it("saves numeric rates and refreshes spend after saving", async () => {
  rpc.call.mockImplementation(async (method) =>
    method === "threads"
      ? [{ id: "t", title: "Thread one" }]
      : method === "spend"
        ? spend
        : rates,
  );
  render(<Panel threadId="t" />);
  await screen.findByLabelText("input");
  fireEvent.click(screen.getByText("Save rates"));
  await screen.findByText("Rates saved");
  expect(rpc.call).toHaveBeenCalledWith("saveRates", rates);
  await waitFor(() =>
    expect(
      rpc.call.mock.calls.filter((c) => c[0] === "spend").length,
    ).toBeGreaterThan(1),
  );
});
it("shows rate-save failures, including non-Error failures", async () => {
  rpc.call.mockResolvedValue(rates);
  render(<RateForm saved={() => {}} />);
  await screen.findByLabelText("input");
  rpc.call.mockRejectedValueOnce(new Error("Write denied"));
  fireEvent.click(screen.getByText("Save rates"));
  await screen.findByText("Write denied");
  rpc.call.mockRejectedValueOnce("Offline");
  fireEvent.click(screen.getByText("Save rates"));
  await screen.findByText("Offline");
});
