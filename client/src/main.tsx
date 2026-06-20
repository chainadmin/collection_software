import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerPwaUpdates } from "@/lib/pwa-update";

registerPwaUpdates();

createRoot(document.getElementById("root")!).render(<App />);
