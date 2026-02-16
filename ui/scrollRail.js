// ui/scrollRail.js

import { subscribe, getBookmarks } from "../core/bookmarkStore.js";
import { findScrollContainer, elementCenterYRelativeToContainer } from "../core/scrollContainer.js";
import { rangeFromOffsets } from "../core/selectionEngine.js";
import { showMarkerTooltip } from "./markerTooltip.js";

const RAIL_ID = "prompttrail-scroll-rail";

let lastScrollContainer = null;
let debounceTimer = null;

/***********************************************************
 * Public API
 ***********************************************************/
export function initScrollRail() {
  ensureScrollRail();
  attachScrollListener();
  subscribe(renderBookmarkMarkers);

  window.addEventListener("resize", scheduleRender, { passive: true });
  window.addEventListener("orientationchange", scheduleRender, { passive: true });

  new MutationObserver(scheduleRender).observe(document.body, {
    childList: true,
    subtree: true,
  });

  scheduleRender();
}

export function highlightRangeInMessage(messageId, startAbs, endAbs) {
  const messageEl = document.querySelector(
    `[data-message-id="${CSS.escape(messageId)}"]`
  );
  if (!messageEl) return;

  const r = rangeFromOffsets(messageEl, startAbs, endAbs);
  if (!r) return;

  const container = findScrollContainer();
  const containerRect = container.getBoundingClientRect();
  const rect = r.getBoundingClientRect();

  const rectCenterViewportY = rect.top + rect.height / 2;
  const rectCenterInContainer =
    container.scrollTop + (rectCenterViewportY - containerRect.top);

  const targetScrollTop =
    rectCenterInContainer - container.clientHeight / 2;

  if (
    container === document.scrollingElement ||
    container === document.documentElement
  ) {
    window.scrollTo({ top: targetScrollTop, behavior: "auto" });
  } else {
    container.scrollTo({ top: targetScrollTop, behavior: "auto" });
  }

  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(r);

  const prev = messageEl.style.outline;
  messageEl.style.outline = "2px solid #ff9800";
  setTimeout(() => {
    messageEl.style.outline = prev || "";
    sel.removeAllRanges();
  }, 900);
}

/***********************************************************
 * Internal
 ***********************************************************/
function ensureScrollRail() {
  if (document.getElementById(RAIL_ID)) return;

  const rail = document.createElement("div");
  rail.id = RAIL_ID;

  Object.assign(rail.style, {
    position: "fixed",
    top: "0",
    right: "2px",
    height: "100vh",
    width: "6px",
    zIndex: "2147483646",
    pointerEvents: "auto",
    background: "rgba(0,0,0,0.03)",
  });

  document.documentElement.appendChild(rail);
}

function renderBookmarkMarkers() {
  const rail = document.getElementById(RAIL_ID);
  if (!rail) return;

  rail.innerHTML = "";

  const bookmarks = getBookmarks();
  if (!bookmarks.length) return;

  const container = findScrollContainer();
  const scrollRange = Math.max(
    1,
    container.scrollHeight - container.clientHeight
  );

  bookmarks.forEach((bookmark) => {
    const messageEl = document.querySelector(
      `[data-message-id="${CSS.escape(bookmark.messageId)}"]`
    );
    if (!messageEl) return;

    const r = rangeFromOffsets(
      messageEl,
      bookmark.startAbs,
      bookmark.endAbs
    );

    let posPercent = 0;

    if (r) {
      const rect = r.getBoundingClientRect();
      if (rect && rect.height > 0) {
        const fake = { getBoundingClientRect: () => rect };
        const pos = elementCenterYRelativeToContainer(container, fake);
        posPercent = Math.max(0, Math.min(0.995, pos / scrollRange));
      } else {
        const pos = elementCenterYRelativeToContainer(container, messageEl);
        posPercent = Math.max(0, Math.min(0.995, pos / scrollRange));
      }
    } else {
      const pos = elementCenterYRelativeToContainer(container, messageEl);
      posPercent = Math.max(0, Math.min(0.995, pos / scrollRange));
    }

    appendMarker(rail, posPercent, bookmark);
  });
}

function appendMarker(rail, percent, bookmark) {
  const marker = document.createElement("div");

  Object.assign(marker.style, {
    position: "absolute",
    top: `${percent * 100}%`,
    left: "0",
    width: "100%",
    height: "4px",
    background: "#ff9800",
    borderRadius: "2px",
    cursor: "pointer",
    pointerEvents: "auto",
  });

  marker.addEventListener("mouseenter", () => {
    showMarkerTooltip(marker, bookmark);
  });

  marker.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    highlightRangeInMessage(
      bookmark.messageId,
      bookmark.startAbs,
      bookmark.endAbs
    );
  });

  rail.appendChild(marker);
}

function scheduleRender() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(renderBookmarkMarkers, 120);
}

function attachScrollListener() {
  setInterval(() => {
    const container = findScrollContainer();
    if (container !== lastScrollContainer) {
      lastScrollContainer = container;
      container.addEventListener("scroll", scheduleRender, {
        passive: true,
      });
      scheduleRender();
    }
  }, 800);
}
