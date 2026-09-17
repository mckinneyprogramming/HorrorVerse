import { mountApp } from "./app";
import { registerPwa } from "./pwa";
import "./styles.css";

registerPwa();

const root = document.getElementById("app");
if (!root) {
  throw new Error("HorrorVerse root element was not found.");
}

mountApp(root);
