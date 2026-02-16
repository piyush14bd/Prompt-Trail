// ui/badge.js

import { renderIndexDropdown, toggleIndexDropdown } from "./indexDropdown.js";

const BADGE_ID = "prompttrail-badge";

export function initBadge() {
  injectBadgeOnce();

  new MutationObserver(injectBadgeOnce).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

function injectBadgeOnce() {
  if (document.getElementById(BADGE_ID)) return;

  const badge = document.createElement("div");
  badge.id = BADGE_ID;

  Object.assign(badge.style, {
    position: "fixed",
    top: "16px",
    right: "16px",
    zIndex: "2147483647",
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: "10px",
    padding: "6px 8px",
    fontSize: "12px",
    color: "#111",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
  });

  badge.innerHTML = `
    <span style="white-space:nowrap;font-weight:600;">PromptTrail</span>
    <button id="pt-menu-btn"
      style="
        border:none;
        background:none;
        cursor:pointer;
        font-size:16px;
        line-height:1;
        padding:2px 4px;
      "
      title="Bookmarks"
    >≡</button>
  `;

  document.documentElement.appendChild(badge);

  const menuBtn = badge.querySelector("#pt-menu-btn");
  menuBtn.addEventListener("click", toggleIndexDropdown, true);
}
