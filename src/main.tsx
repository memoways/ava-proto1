import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeAnalyticsFromStoredConsent } from "./services/privacyConsent";

initializeAnalyticsFromStoredConsent();

createRoot(document.getElementById("root")!).render(<App />);
