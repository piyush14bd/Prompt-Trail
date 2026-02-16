// ui/indexDropdown.js

import { getBookmarks, deleteBookmark, subscribe } from "../core/bookmarkStore.js";
import { highlightRangeInMessage } from "./scrollRail.js";
import { findScrollContainer, elementCenterYRelativeToContainer } from "../core/scrollContainer.js";
import { escapeHtml } from "../core/utils.js";

const INDEX_DROPDOWN_ID = "prompttrail-index-dropdown";
const BADGE_ID = "prompttrail-badge";

export function toggleIndexDropdown(e) {
  e?.stopPropagation();
  document.removeEventListener("pointerdown", onOutsideIndexClick, true);

  const existing = document.getElementById(INDEX_DROPDOWN_ID);
  if (existing) {
    existing.remove();
    return;
  }

  renderIndexDropdown();
}

export function renderIndexDropdown() {
  const badge = document.getElementById(BADGE_ID);
  if (!badge) return;

  const rect = badge.getBoundingClientRect();

  const dropdown = document.createElement("div");
  dropdown.id = INDEX_DROPDOWN_ID;

  Object.assign(dropdown.style, {
    position: "fixed",
    top: `${rect.bottom + 6}px`,
    right: `${window.innerWidth - rect.right}px`,
    width: "320px",
    maxHeight: "420px",
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: "10px",
    boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
    zIndex: "2147483647",
    overflow: "hidden",
    fontSize: "13px",
    color: "#111",
  });

  dropdown.innerHTML = `
    <div style="padding:12px 14px;font-weight:600;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
      <span>📚 Bookmarks</span>
      <button id="pt-index-close" style="border:none;background:none;cursor:pointer;">✖</button>
    </div>
    <div id="pt-index-list" style="flex:1;overflow:auto;padding:8px;max-height:360px;background:#fff;color:#111;"></div>
  `;

  document.body.appendChild(dropdown);
  dropdown.querySelector("#pt-index-close").onclick = () => dropdown.remove();

  renderIndexList();

  setTimeout(() => {
    document.addEventListener("pointerdown", onOutsideIndexClick, true);
  }, 0);
}

function onOutsideIndexClick(e) {
  const dd = document.getElementById(INDEX_DROPDOWN_ID);
  const badge = document.getElementById(BADGE_ID);
  if (!dd) return;

  const path = e.composedPath ? e.composedPath() : (e.path || []);
  const clickedInside =
    dd.contains(e.target) ||
    badge.contains(e.target) ||
    path.includes(dd) ||
    path.includes(badge);

  if (clickedInside) return;

  dd.remove();
  document.removeEventListener("pointerdown", onOutsideIndexClick, true);
}

function renderIndexList() {
  const list = document.getElementById("pt-index-list");
  if (!list) return;

  list.innerHTML = "";

  const bookmarks = getBookmarks();

  if (!bookmarks.length) {
    list.innerHTML = `<div style="opacity:0.6;padding:8px;">No bookmarks yet</div>`;
    return;
  }

  const container = findScrollContainer();

  const sorted = [...bookmarks].sort((a, b) => {
    const elA = document.querySelector(`[data-message-id="${CSS.escape(a.messageId)}"]`);
    const elB = document.querySelector(`[data-message-id="${CSS.escape(b.messageId)}"]`);
    if (!elA || !elB) return 0;

    const posA = elementCenterYRelativeToContainer(container, elA);
    const posB = elementCenterYRelativeToContainer(container, elB);
    return posA - posB;
  });

  sorted.forEach((b) => {
    const row = document.createElement("div");

    Object.assign(row.style, {
      padding: "10px",
      marginBottom: "6px",
      borderRadius: "8px",
      background: "#f7f7f7",
      cursor: "pointer",
      color: "#111",
    });

    row.innerHTML = `
      <div style="font-weight:600;margin-bottom:6px;color:#111;">
        ${escapeHtml(b.desc || b.preview || "Bookmark")}
      </div>
      <div style="font-size:12px;opacity:0.7;display:flex;justify-content:space-between;align-items:center;">
        <span>${escapeHtml(b.role || "")}</span>
        <button data-del style="border:none;background:none;cursor:pointer;font-size:14px;">🗑️</button>
      </div>
    `;

    row.addEventListener("mouseenter", () => (row.style.background = "#eaeaea"));
    row.addEventListener("mouseleave", () => (row.style.background = "#f7f7f7"));

    row.addEventListener("click", (e) => {
      if (e.target?.dataset?.del) return;

      highlightRangeInMessage(b.messageId, b.startAbs, b.endAbs);
      document.getElementById(INDEX_DROPDOWN_ID)?.remove();
    });

    row.querySelector("[data-del]").onclick = (e) => {
      e.stopPropagation();
      deleteBookmark(b.id);
      renderIndexList();
    };

    list.appendChild(row);
  });
}

// keep dropdown in sync with store
subscribe(() => {
  if (document.getElementById(INDEX_DROPDOWN_ID)) {
    renderIndexList();
  }
});
