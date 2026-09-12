import { createRoot } from "react-dom/client";
import App from "./App";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/manrope";
import "./index.css";
import { registerPwaUpdates } from "@/lib/pwa-update";

registerPwaUpdates();

createRoot(document.getElementById("root")!).render(<App />);
