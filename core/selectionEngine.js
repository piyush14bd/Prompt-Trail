// core/selectionEngine.js

import { findMessageContainer } from "./scrollContainer.js";

/***********************************************************
 * Helpers
 ***********************************************************/
function getTextOffsetIn(rootEl, node, nodeOffset) {
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null);
  let offset = 0;

  while (walker.nextNode()) {
    const t = walker.currentNode;
    if (t === node) return offset + nodeOffset;
    offset += t.textContent.length;
  }

  return -1;
}

export function rangeFromOffsets(rootEl, start, end) {
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null);
  let offset = 0;

  let startNode = null;
  let endNode = null;
  let startOffset = 0;
  let endOffset = 0;

  while (walker.nextNode()) {
    const t = walker.currentNode;
    const len = t.textContent.length;

    if (!startNode && offset + len >= start) {
      startNode = t;
      startOffset = Math.max(0, start - offset);
    }

    if (startNode && offset + len >= end) {
      endNode = t;
      endOffset = Math.max(0, end - offset);
      break;
    }

    offset += len;
  }

  if (!startNode || !endNode) return null;

  const r = document.createRange();
  r.setStart(startNode, startOffset);
  r.setEnd(endNode, endOffset);

  return r;
}

export function getSelectionPayload() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;

  const range = sel.getRangeAt(0);
  const selectedText = sel.toString().trim();
  if (!selectedText) return null;

  const startEl =
    range.startContainer.nodeType === Node.TEXT_NODE
      ? range.startContainer.parentElement
      : range.startContainer;

  if (!startEl) return null;

  const messageEl = findMessageContainer(startEl);
  if (!messageEl) return null;

  const startAbs = getTextOffsetIn(
    messageEl,
    range.startContainer,
    range.startOffset
  );

  const endAbs = getTextOffsetIn(
    messageEl,
    range.endContainer,
    range.endOffset
  );

  if (startAbs < 0 || endAbs < 0 || endAbs <= startAbs) return null;

  return {
    messageId: messageEl.getAttribute("data-message-id"),
    role: messageEl.getAttribute("data-message-author-role"),
    startAbs,
    endAbs,
    selectedText,
  };
}

/***********************************************************
 * Selection lifecycle
 ***********************************************************/
let selectionListeners = [];

export function subscribeToSelection(fn) {
  selectionListeners.push(fn);
  return () => {
    selectionListeners = selectionListeners.filter((l) => l !== fn);
  };
}

function notifySelection(payload) {
  selectionListeners.forEach((fn) => fn(payload));
}

let selectionTimer;

function handleSelectionChange() {
  clearTimeout(selectionTimer);

  selectionTimer = setTimeout(() => {
    const sel = window.getSelection();

    if (!sel || sel.isCollapsed || sel.toString().trim() === "") {
      notifySelection(null);
      return;
    }

    const payload = getSelectionPayload();
    notifySelection(payload || null);
  }, 80);
}

export function initSelectionEngine() {
  document.addEventListener("selectionchange", handleSelectionChange);
  document.addEventListener("mouseup", handleSelectionChange);
}
