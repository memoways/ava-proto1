import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initPostHog } from "./services/posthogService";

initPostHog();

createRoot(document.getElementById("root")!).render(<App />);
