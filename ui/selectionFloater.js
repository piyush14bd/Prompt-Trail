// ui/selectionFloater.js

import { subscribeToSelection } from "../core/selectionEngine.js";
import { addBookmark } from "../core/bookmark.js";
import { defaultDescFromText } from "../core/utils.js";

let selectionFloaterEl = null;

/***********************************************************
 * Public API
 ***********************************************************/
export function initSelectionFloater() {
  subscribeToSelection(handleSelectionChange);

  // Dismiss on outside click
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!selectionFloaterEl) return;
      if (selectionFloaterEl.contains(e.target)) return;
      hideSelectionFloater();
    },
    true
  );
}

/***********************************************************
 * Internal
 ***********************************************************/
function handleSelectionChange(payload) {
  if (!payload) {
    hideSelectionFloater();
    return;
  }

  showSelectionFloater(payload);
}

function showSelectionFloater(payload) {
  hideSelectionFloater();

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (!rect || rect.width === 0) return;

  const btn = document.createElement("button");
  selectionFloaterEl = btn;

  const scrollY = window.scrollY;
  const scrollX = window.scrollX;

  const top = rect.top + scrollY - 40;
  const left = rect.right + scrollX - 24;

  btn.textContent = "🔖";
  btn.title = "Bookmark selection";

  Object.assign(btn.style, {
    position: "fixed",
    top: `${Math.max(8, top)}px`,
    left: `${Math.max(8, left)}px`,
    zIndex: "2147483647",
    padding: "6px 8px",
    borderRadius: "8px",
    border: "1px solid rgba(0,0,0,0.15)",
    background: "#fff",
    cursor: "pointer",
    fontSize: "14px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  });

  btn.addEventListener("click", (e) => {
    e.stopPropagation();

    const defaultDesc = defaultDescFromText(payload.selectedText);
    const desc = window.prompt("Bookmark description:", defaultDesc);
    if (!desc) {
      hideSelectionFloater();
      return;
    }

    addBookmark({
      id: crypto?.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()) + Math.random(),
      messageId: payload.messageId,
      role: payload.role,
      startAbs: payload.startAbs,
      endAbs: payload.endAbs,
      preview: defaultDesc,
      desc: desc.trim().split(/\s+/).slice(0, 10).join(" "),
      createdAt: Date.now(),
    });

    hideSelectionFloater();
    window.getSelection().removeAllRanges();
  });

  document.body.appendChild(btn);
}

function hideSelectionFloater() {
  if (selectionFloaterEl) {
    selectionFloaterEl.remove();
    selectionFloaterEl = null;
  }
}
