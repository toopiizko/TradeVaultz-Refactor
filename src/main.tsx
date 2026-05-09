import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker only in production-like contexts (not in Lovable preview/iframe)
if ("serviceWorker" in navigator) {
  const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
  const isPreview =
    location.hostname.includes("id-preview--") ||
    location.hostname.includes("lovableproject.com");
  if (inIframe || isPreview) {
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
  } else {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }
}
