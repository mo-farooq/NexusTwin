/**
 * NexusTwin Focus Mode Slide-in Inspector Dock
 *
 * Slides in from the right edge over the 3D canvas when an asset is selected,
 * displaying detailed FSM telemetry, 4-tier slotting matrix, or station ETA queue.
 */

import React from "react";
import { useTwinStore } from "../../store/useTwinStore";
import { RightPanels } from "../panels/RightPanels";

export function InspectorDock() {
  const selectedBotId = useTwinStore((s) => s.selectedBotId);
  const selectedRackId = useTwinStore((s) => s.selectedRackId);
  const selectedStationId = useTwinStore((s) => s.selectedStationId);
  const selectBot = useTwinStore((s) => s.selectBot);
  const selectRack = useTwinStore((s) => s.selectRack);
  const selectStation = useTwinStore((s) => s.selectStation);

  const isOpen = Boolean(selectedBotId || selectedRackId || selectedStationId);

  const handleClose = () => {
    selectBot(null);
    selectRack(null);
    selectStation(null);
  };

  return (
    <div className={`insp-dock ${isOpen ? "on" : ""}`} id="inspDock">
      <button
        className="close insp-x"
        id="inspX"
        title="Close Inspector (Esc)"
        onClick={handleClose}
      >
        <svg width="12" height="12" viewBox="0 0 24 24">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      <RightPanels asDock />
    </div>
  );
}
