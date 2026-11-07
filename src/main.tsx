import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { useTwinStore } from "./store/useTwinStore";

if (typeof window !== "undefined") {
  (window as any).__NEXUS_STORE__ = useTwinStore;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
