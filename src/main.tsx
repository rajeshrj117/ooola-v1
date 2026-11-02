import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { expireInventoryHolds, reconcileEligibleBookings } from "./services/workflows";

// Release expired holds on startup, periodically while a tab stays open, and when it returns to foreground.
const runWorkflowMaintenance = () => {
  void expireInventoryHolds().catch((error) => console.error("Could not release expired inventory holds", error));
  void reconcileEligibleBookings().catch((error) => console.error("Could not reconcile eligible bookings", error));
};
runWorkflowMaintenance();
window.setInterval(runWorkflowMaintenance, 60_000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') runWorkflowMaintenance(); });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
