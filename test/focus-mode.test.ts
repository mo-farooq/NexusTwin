import { describe, it, expect, beforeEach } from "vitest";
import { useTwinStore } from "../src/store/useTwinStore";

describe("NexusTwin Focus Mode (Progressive Disclosure) State", () => {
  beforeEach(() => {
    // Reset state before each test
    useTwinStore.getState().setViewMode("focus");
    useTwinStore.getState().closeAllFocusPopups();
  });

  it("defaults to focus view mode and toggles to full mode", () => {
    const store = useTwinStore.getState();
    expect(store.viewMode).toBe("focus");

    store.setViewMode("full");
    expect(useTwinStore.getState().viewMode).toBe("full");

    store.setViewMode("focus");
    expect(useTwinStore.getState().viewMode).toBe("focus");
  });

  it("handles collapsible analytics dock accordion tab toggling", () => {
    const store = useTwinStore.getState();
    expect(store.focusDockTab).toBeNull();

    // Open Dispatch Queue tab (0)
    store.setFocusDockTab(0);
    expect(useTwinStore.getState().focusDockTab).toBe(0);

    // Clicking active tab 0 again collapses the dock
    store.setFocusDockTab(0);
    expect(useTwinStore.getState().focusDockTab).toBeNull();

    // Switch to Throughput tab (1)
    store.setFocusDockTab(1);
    expect(useTwinStore.getState().focusDockTab).toBe(1);

    // Switch to Decision Ledger tab ("ledger")
    store.setFocusDockTab("ledger");
    expect(useTwinStore.getState().focusDockTab).toBe("ledger");
  });

  it("handles on-demand floating popovers with toggle and mutual exclusivity", () => {
    const store = useTwinStore.getState();
    expect(store.activePopover).toBeNull();

    // Open Systems popover
    store.setActivePopover("systems");
    expect(useTwinStore.getState().activePopover).toBe("systems");

    // Clicking active popover again toggles it off
    store.setActivePopover("systems");
    expect(useTwinStore.getState().activePopover).toBeNull();

    // Open Incidents popover
    store.setActivePopover("incidents");
    expect(useTwinStore.getState().activePopover).toBe("incidents");
  });

  it("closeAllFocusPopups clears active popovers and analytics dock", () => {
    const store = useTwinStore.getState();
    store.setActivePopover("systems");
    store.setFocusDockTab(2);

    expect(useTwinStore.getState().activePopover).toBe("systems");
    expect(useTwinStore.getState().focusDockTab).toBe(2);

    store.closeAllFocusPopups();

    expect(useTwinStore.getState().activePopover).toBeNull();
    expect(useTwinStore.getState().focusDockTab).toBeNull();
  });
});
