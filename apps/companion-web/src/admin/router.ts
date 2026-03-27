/**
 * Simple hash-based router for admin panel.
 * Routes: #/admin/login, #/admin/dashboard, #/admin/logs, #/admin/settings, #/admin/controls
 */

import { getStoredToken, renderLoginPage } from "./login.js";
import { renderDashboard } from "./dashboard.js";
import { renderLogViewer } from "./log-viewer.js";
import { renderSettings } from "./settings.js";
import { renderControls } from "./controls.js";

export function initAdminRouter(container: HTMLElement): void {
  function route(): void {
    // Cleanup previous page
    if ((container as any)._cleanup) {
      (container as any)._cleanup();
      (container as any)._cleanup = null;
    }

    const hash = window.location.hash || "#/admin/login";
    const token = getStoredToken();

    // Redirect to login if no token (except login page)
    if (!token && hash !== "#/admin/login") {
      window.location.hash = "#/admin/login";
      return;
    }

    // Redirect to dashboard if already logged in and on login page
    if (token && hash === "#/admin/login") {
      window.location.hash = "#/admin/dashboard";
      return;
    }

    switch (hash) {
      case "#/admin/login":
        renderLoginPage(container);
        break;
      case "#/admin/dashboard":
        renderDashboard(container);
        break;
      case "#/admin/logs":
        renderLogViewer(container);
        break;
      case "#/admin/settings":
        renderSettings(container);
        break;
      case "#/admin/controls":
        renderControls(container);
        break;
      default:
        renderDashboard(container);
        break;
    }
  }

  window.addEventListener("hashchange", route);
  route();
}
