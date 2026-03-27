import { initAdminRouter } from "./router.js";

const root = document.getElementById("admin-root");
if (root) {
  initAdminRouter(root);
}
