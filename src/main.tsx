// 应用入口：样式在 ./styles.css（Tailwind v4 + design token），路由见 ./router.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";
import "./note-preview.css";
import "./desktop.css";

const router = getRouter();

function reportFatalReactError(
  _error: unknown,
  errorInfo: { componentStack?: string },
) {
  window.__MUSE_PREVIEW_ERROR_CAPTURE__?.reportError(new Error("Application rendering failed"), {
    kind: "react-error-boundary",
    severity: "fatal",
  });
  console.error("Application rendering failed", errorInfo.componentStack);
}

ReactDOM.createRoot(document.getElementById("root")!, {
  onCaughtError: reportFatalReactError,
  onUncaughtError: reportFatalReactError,
}).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
