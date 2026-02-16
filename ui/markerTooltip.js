// ui/markerTooltip.js

import { updateBookmarkDesc, deleteBookmark, subscribe, getBookmarkById } from "../core/bookmarkStore.js";
import { escapeHtml } from "../core/utils.js";

let markerTooltipEl = null;
let activeBookmarkId = null;
let lastAnchorEl = null;

export function hideMarkerTooltip() {
  if (markerTooltipEl) {
    markerTooltipEl.remove();
    markerTooltipEl = null;
  }
  activeBookmarkId = null;
  lastAnchorEl = null;
  document.removeEventListener("pointerdown", onOutsidePointerDown, true);
}

export function isMarkerTooltipOpen() {
  return !!markerTooltipEl;
}

export function showMarkerTooltip(anchorEl, bookmark) {
  // If already open for same bookmark, just reposition
  if (markerTooltipEl && activeBookmarkId === bookmark.id) {
    lastAnchorEl = anchorEl;
    positionTooltipNearAnchor(anchorEl, markerTooltipEl);
    return;
  }

  hideMarkerTooltip();

  activeBookmarkId = bookmark.id;
  lastAnchorEl = anchorEl;

  const tooltip = document.createElement("div");
  markerTooltipEl = tooltip;

  Object.assign(tooltip.style, {
    position: "fixed",
    zIndex: "2147483647",
    maxWidth: "320px",
    padding: "8px 10px",
    borderRadius: "10px",
    background: "rgba(0,0,0,0.88)",
    color: "#fff",
    fontSize: "13px",
    lineHeight: "1.35",
    boxShadow: "0 6px 24px rgba(0,0,0,0.25)",
    pointerEvents: "auto",
  });

  tooltip.innerHTML = `
    <div id="pt-desc-view" style="margin-bottom:8px;">
      ${escapeHtml(bookmark.desc || bookmark.preview || "Bookmark")}
    </div>

    <input id="pt-desc-edit" autocomplete="off"
      style="
        display:none;
        width:100%;
        box-sizing:border-box;
        padding:6px 8px;
        font-size:13px;
        border-radius:6px;
        border:1px solid #555;
        outline:none;
        background:#111;
        color:#fff;
      "
    />

    <div style="display:flex; gap:10px; align-items:center;">
      <button id="pt-edit"
        style="background:none;border:none;color:#9fd1ff;cursor:pointer;font-size:13px;padding:2px 4px;">
        ✏️ Edit
      </button>
      <button id="pt-delete"
        style="background:none;border:none;color:#ffb4b4;cursor:pointer;font-size:13px;padding:2px 4px;">
        🗑️ Delete
      </button>
    </div>
  `;

  document.body.appendChild(tooltip);
  positionTooltipNearAnchor(anchorEl, tooltip);

  // IMPORTANT:
  // - Tooltip should NOT close on mouseleave.
  // - It should close only on outside click (pointerdown).
  // - Edit/Delete must work (stopPropagation).
  tooltip.addEventListener("pointerdown", (e) => e.stopPropagation());

  const view = tooltip.querySelector("#pt-desc-view");
  const input = tooltip.querySelector("#pt-desc-edit");
  const editBtn = tooltip.querySelector("#pt-edit");
  const deleteBtn = tooltip.querySelector("#pt-delete");

  let isEditing = false;

  editBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    isEditing = true;
    input.value = bookmark.desc || bookmark.preview || "";
    view.style.display = "none";
    input.style.display = "block";
    input.focus();
    // caret to end
    try {
      input.setSelectionRange(input.value.length, input.value.length);
    } catch {}
  });

  function closeEditOnly() {
    isEditing = false;
    view.style.display = "block";
    input.style.display = "none";
  }

  function saveEdit() {
    if (!isEditing) return;
    const newDesc = (input.value || "").trim().split(/\s+/).slice(0, 10).join(" ");
    if (newDesc) updateBookmarkDesc(bookmark.id, newDesc);
    closeEditOnly();
    hideMarkerTooltip();
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeEditOnly();
      hideMarkerTooltip();
    }
  });

  // Save on blur only if we were editing
  input.addEventListener("blur", () => {
    if (isEditing) saveEdit();
  });

  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    deleteBookmark(bookmark.id);
    hideMarkerTooltip();
  });

  // Outside click closes (always), but allow clicks on anchorEl and tooltip itself
  setTimeout(() => {
    document.addEventListener("pointerdown", onOutsidePointerDown, true);
  }, 0);
}

function onOutsidePointerDown(e) {
  if (!markerTooltipEl) return;

  const path = e.composedPath ? e.composedPath() : [];
  const clickedInsideTooltip =
    markerTooltipEl.contains(e.target) || path.includes(markerTooltipEl);

  const clickedOnAnchor =
    lastAnchorEl &&
    (lastAnchorEl.contains(e.target) || path.includes(lastAnchorEl));

  if (clickedInsideTooltip || clickedOnAnchor) return;

  hideMarkerTooltip();
}

function positionTooltipNearAnchor(anchorEl, tooltipEl) {
  const rect = anchorEl.getBoundingClientRect();
  const tooltipHeight = tooltipEl.offsetHeight || 120;
  const margin = 10;

  // Prefer above; else below
  let top = rect.top - tooltipHeight - margin;
  if (top < margin) top = rect.bottom + margin;

  // Clamp
  top = Math.min(window.innerHeight - tooltipHeight - margin, Math.max(margin, top));

  tooltipEl.style.top = `${top}px`;
  tooltipEl.style.right = `12px`;
}

// If bookmark updated/deleted elsewhere while tooltip is open, update/close it
subscribe(() => {
  if (!markerTooltipEl || !activeBookmarkId) return;

  const b = getBookmarkById(activeBookmarkId);
  if (!b) {
    hideMarkerTooltip();
    return;
  }

  const view = markerTooltipEl.querySelector("#pt-desc-view");
  const input = markerTooltipEl.querySelector("#pt-desc-edit");

  // Only update view text if not actively editing (keep user's input)
  const isEditing = input && input.style.display !== "none";
  if (!isEditing && view) {
    view.innerHTML = escapeHtml(b.desc || b.preview || "Bookmark");
  }

  if (lastAnchorEl) positionTooltipNearAnchor(lastAnchorEl, markerTooltipEl);
});
