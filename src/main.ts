import "./style.css";
import { mount } from "./app";

if (typeof window.noise !== "function") {
  throw new Error("vendor/noise.js must load before the app (see index.html)");
}

const app = document.getElementById("app");
if (!app) throw new Error("#app missing");

mount(app);
