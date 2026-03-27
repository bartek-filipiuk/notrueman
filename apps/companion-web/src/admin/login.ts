/**
 * Admin login page — password input, JWT auth, redirect to dashboard.
 */

/** Resolve API base URL: ?apiUrl= param overrides, fallback to relative (proxy) */
export function getApiBase(): string {
  const params = new URLSearchParams(window.location.search);
  const override = params.get("apiUrl");
  if (override) {
    // Strip trailing slash
    return override.replace(/\/+$/, "");
  }
  return "";
}

const API_BASE = `${getApiBase()}/api/admin`;

export function getStoredToken(): string | null {
  return localStorage.getItem("nts_admin_token");
}

export function storeToken(token: string): void {
  localStorage.setItem("nts_admin_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("nts_admin_token");
}

export async function loginWithPassword(password: string): Promise<string> {
  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  if (res.status === 429) {
    throw new Error("Too many login attempts. Wait 1 minute.");
  }
  if (res.status === 401) {
    throw new Error("Invalid password.");
  }
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status}`);
  }

  const data = (await res.json()) as { token: string };
  storeToken(data.token);
  return data.token;
}

export function renderLoginPage(container: HTMLElement): void {
  container.innerHTML = `
    <div class="admin-login">
      <div class="login-card">
        <h1 class="login-title">NTS Admin</h1>
        <p class="login-subtitle">No True Man Show — Control Panel</p>
        <form id="login-form" class="login-form">
          <input
            type="password"
            id="login-password"
            class="login-input"
            placeholder="Enter admin password"
            autocomplete="current-password"
            required
          />
          <button type="submit" class="login-button">Login</button>
          <div id="login-error" class="login-error" hidden></div>
        </form>
      </div>
    </div>
  `;

  const form = container.querySelector("#login-form") as HTMLFormElement;
  const input = container.querySelector("#login-password") as HTMLInputElement;
  const errorEl = container.querySelector("#login-error") as HTMLDivElement;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;

    try {
      await loginWithPassword(input.value);
      window.location.hash = "#/admin/dashboard";
      window.location.reload();
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : "Login failed";
      errorEl.hidden = false;
    }
  });
}
