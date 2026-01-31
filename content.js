(() => {
  /***********************************************************
   * Constants
   ***********************************************************/
  const BADGE_ID = "prompttrail-badge";
  const BTN_CLASS = "prompttrail-bookmark-btn";
  const RAIL_ID = "prompttrail-scroll-rail";
  const BLOCK_SELECTOR = "p, li, h1, h2, h3, h4, blockquote, pre";
  const STORAGE_KEY = "prompttrail_bookmarks_v2"; // { [convoId]: Bookmark[] }

  /***********************************************************
   * Conversation id (ChatGPT URL: /c/<id>)
   ***********************************************************/
  function getConversationId() {
    const m = location.pathname.match(/\/c\/([a-zA-Z0-9-]+)/);
    return m ? m[1] : "unknown";
  }

  /***********************************************************
   * In-memory bookmarks (mirrors storage)
   ***********************************************************/
  let bookmarks = [];

  /***********************************************************
   * Debug badge
   ***********************************************************/
  function injectBadgeOnce() {
    if (document.getElementById(BADGE_ID)) return;

    const badge = document.createElement("div");
    badge.id = BADGE_ID;
    badge.textContent = "PromptTrail active";
    badge.style.position = "fixed";
    badge.style.top = "16px";
    badge.style.right = "16px";
    badge.style.zIndex = "2147483647";
    badge.style.background = "white";
    badge.style.border = "1px solid #ddd";
    badge.style.borderRadius = "8px";
    badge.style.padding = "6px 10px";
    badge.style.fontSize = "12px";
    badge.style.color = "#111";
    badge.style.pointerEvents = "none";
    document.documentElement.appendChild(badge);
  }

  injectBadgeOnce();
  new MutationObserver(injectBadgeOnce).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  /***********************************************************
   * Scrollbar overlay rail
   ***********************************************************/
  function ensureScrollRail() {
    if (document.getElementById(RAIL_ID)) return;

    const rail = document.createElement("div");
    rail.id = RAIL_ID;
    rail.style.position = "fixed";
    rail.style.top = "0";
    rail.style.right = "2px";
    rail.style.height = "100vh";
    rail.style.width = "4px";
    rail.style.zIndex = "2147483646";
    rail.style.pointerEvents = "auto";
    rail.style.background = "rgba(0,0,0,0.03)";
    document.documentElement.appendChild(rail);
  }
  ensureScrollRail();

  /***********************************************************
   * Helpers (DOM + scroll container)
   ***********************************************************/
  function findMessageContainer(el) {
    let cur = el;
    while (cur) {
      if (
        cur.nodeType === Node.ELEMENT_NODE &&
        cur.hasAttribute("data-message-id")
      ) {
        return cur;
      }
      cur = cur.parentNode;
    }
    return null;
  }

  function findScrollContainer() {
    const messages = document.querySelectorAll("[data-message-id]");
    if (messages.length === 0) {
      return document.scrollingElement || document.documentElement;
    }

    let el = messages[0];
    while (el) {
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      if (
        (overflowY === "auto" || overflowY === "scroll") &&
        el.scrollHeight > el.clientHeight
      ) {
        return el;
      }
      el = el.parentElement;
    }

    return document.scrollingElement || document.documentElement;
  }

  function elementCenterYRelativeToContainer(container, el) {
    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const elCenterViewportY = elRect.top + elRect.height / 2;
    const containerViewportTop = containerRect.top;
    const distanceInViewport = elCenterViewportY - containerViewportTop;
    return container.scrollTop + distanceInViewport;
  }

  /***********************************************************
   * Selection → precise offsets within message
   * We store offsets across ALL text nodes inside the message.
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

  function rangeFromOffsets(rootEl, start, end) {
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null);
    let offset = 0;

    let startNode = null,
      endNode = null,
      startOffset = 0,
      endOffset = 0;

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

  function getSelectionPayload() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;

    const range = sel.getRangeAt(0);
    const selectedText = sel.toString().trim();
    if (!selectedText) return null;

    // Find a reasonable element to start walking up
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

  function defaultDescFromText(text) {
    const words = (text || "").trim().split(/\s+/).filter(Boolean);
    return words.slice(0, 10).join(" ");
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /***********************************************************
   * Marker tooltip + delete + edit (FIXED)
   ***********************************************************/
  let markerTooltip = null;

  function hideMarkerTooltip() {
    if (markerTooltip) {
      markerTooltip.remove();
      markerTooltip = null;
    }
  }

  function positionTooltipNearMarker(marker, tooltip) {
    const rect = marker.getBoundingClientRect();
    const tooltipHeight = tooltip.offsetHeight || 100;
    const margin = 10;

    // Prefer above
    let top = rect.top - tooltipHeight - margin;

    // If not enough space above, flip below
    if (top < margin) {
      top = rect.bottom + margin;
    }

    // Clamp to viewport
    top = Math.min(
      window.innerHeight - tooltipHeight - margin,
      Math.max(margin, top)
    );

    tooltip.style.top = `${top}px`;
    tooltip.style.right = `12px`;
  }

  function deleteBookmark(bookmark) {
    bookmarks = bookmarks.filter((b) =>
      bookmark.id
        ? b.id !== bookmark.id
        : !(
            b.messageId === bookmark.messageId &&
            b.startAbs === bookmark.startAbs &&
            b.endAbs === bookmark.endAbs
          )
    );

    persistBookmarks(() => {
      renderBookmarkMarkers();
      scheduleRender();
    });
  }

  function showMarkerTooltip(marker, bookmark) {
    if (markerTooltip) return;
    hideMarkerTooltip();

    const tooltip = document.createElement("div");
    tooltip.style.position = "fixed";
    tooltip.style.zIndex = "2147483647";
    tooltip.style.maxWidth = "260px";
    tooltip.style.padding = "8px 10px";
    tooltip.style.borderRadius = "10px";
    tooltip.style.background = "rgba(0,0,0,0.88)";
    tooltip.style.color = "#fff";
    tooltip.style.fontSize = "12px";
    tooltip.style.lineHeight = "1.35";
    tooltip.style.boxShadow = "0 6px 16px rgba(0,0,0,0.25)";
    tooltip.style.pointerEvents = "auto";

    tooltip.innerHTML = `
      <div id="pt-desc-view" style="margin-bottom:8px;">
        ${escapeHtml(bookmark.desc || bookmark.preview || "Bookmark")}
      </div>

      <input id="pt-desc-edit"
        style="
          display:none;
          width:100%;
          box-sizing:border-box;
          padding:4px 6px;
          font-size:12px;
          border-radius:6px;
          border:1px solid #555;
          outline:none;
          background:#111;
          color:#fff;
        "
      />

      <div style="display:flex; gap:10px; align-items:center;">
        <button id="pt-edit"
          style="background:none;border:none;color:#9fd1ff;cursor:pointer;font-size:12px;">
          ✏️ Edit
        </button>

        <button id="pt-delete"
          style="background:none;border:none;color:#ffb4b4;cursor:pointer;font-size:12px;">
          🗑️ Delete
        </button>
      </div>
    `;

    document.body.appendChild(tooltip);

    tooltip.addEventListener("mousedown", (e) => {
      e.stopPropagation();
    });
    
    setTimeout(() => {
      const onOutsideClick = (e) => {
        if (!tooltip.contains(e.target)) {
          hideMarkerTooltip();
          document.removeEventListener("mousedown", onOutsideClick, true);
        }
      };
      document.addEventListener("mousedown", onOutsideClick, true);
    }, 0);
    

    markerTooltip = tooltip;

    positionTooltipNearMarker(marker, tooltip);

    // Keep tooltip alive while hovering it
    // tooltip.addEventListener("mouseleave", hideMarkerTooltip);

    // Wire up controls (FIXED: must be inside function)
    const view = tooltip.querySelector("#pt-desc-view");
    const input = tooltip.querySelector("#pt-desc-edit");
    const editBtn = tooltip.querySelector("#pt-edit");
    const deleteBtn = tooltip.querySelector("#pt-delete");

    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      input.value = bookmark.desc || bookmark.preview || "";
      view.style.display = "none";
      input.style.display = "block";
      input.focus();
    });

    function saveEdit() {
      const newDesc = input.value.trim().split(/\s+/).slice(0, 10).join(" ");
      if (newDesc) {
        bookmark.desc = newDesc;
        persistBookmarks(() => {
          renderBookmarkMarkers();
          scheduleRender();
        });
      }
      hideMarkerTooltip();
    }

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") saveEdit();
      if (e.key === "Escape") hideMarkerTooltip();
    });

    input.addEventListener("blur", saveEdit);

    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteBookmark(bookmark);
      hideMarkerTooltip();
    });
  }

  /***********************************************************
   * Storage: load/save
   ***********************************************************/
  function loadBookmarks() {
    const convoId = getConversationId();
    if (!chrome?.storage?.sync) {
      console.warn(
        "[PromptTrail] chrome.storage.sync not available; using memory only."
      );
      return;
    }

    chrome.storage.sync.get(STORAGE_KEY, (data) => {
      const all = data[STORAGE_KEY] || {};
      bookmarks = all[convoId] || [];
      renderBookmarkMarkers();
      scheduleRender();
    });
  }

  function persistBookmarks(cb) {
    const convoId = getConversationId();
    if (!chrome?.storage?.sync) {
      cb?.();
      return;
    }

    chrome.storage.sync.get(STORAGE_KEY, (data) => {
      const all = data[STORAGE_KEY] || {};
      all[convoId] = bookmarks;
      chrome.storage.sync.set({ [STORAGE_KEY]: all }, () => cb?.());
    });
  }

  loadBookmarks();

  /***********************************************************
   * Render markers (pixel-accurate using saved range mid-point)
   ***********************************************************/
  function renderBookmarkMarkers() {
    const rail = document.getElementById(RAIL_ID);
    if (!rail) return;

    rail.innerHTML = "";

    const container = findScrollContainer();
    const scrollRange = Math.max(1, container.scrollHeight - container.clientHeight);

    bookmarks.forEach((bookmark) => {
      const messageEl = document.querySelector(
        `[data-message-id="${CSS.escape(bookmark.messageId)}"]`
      );
      if (!messageEl) return;

      const r = rangeFromOffsets(messageEl, bookmark.startAbs, bookmark.endAbs);
      let targetEl = messageEl;

      if (r) {
        const rect = r.getBoundingClientRect();
        if (rect && rect.height > 0) {
          const fake = { getBoundingClientRect: () => rect };
          const pos = elementCenterYRelativeToContainer(container, fake);
          const percent = Math.max(0, Math.min(1, pos / scrollRange));
          appendMarker(rail, percent, bookmark);
          return;
        }
      }

      const posInContent = elementCenterYRelativeToContainer(container, targetEl);
      const percent = Math.max(0, Math.min(1, posInContent / scrollRange));
      appendMarker(rail, percent, bookmark);
    });
  }

  function appendMarker(rail, percent, bookmark) {
    const marker = document.createElement("div");
    marker.style.position = "absolute";
    marker.style.top = `${percent * 100}%`;
    marker.style.left = "0";
    marker.style.width = "100%";
    marker.style.height = "3px";
    marker.style.background = "#ff9800";
    marker.style.borderRadius = "2px";
    marker.style.cursor = "pointer";
    marker.style.pointerEvents = "auto";

    marker.dataset.id = bookmark.id || "";
    marker.dataset.messageId = bookmark.messageId;
    marker.dataset.startAbs = String(bookmark.startAbs);
    marker.dataset.endAbs = String(bookmark.endAbs);

    marker.addEventListener("mouseenter", () => showMarkerTooltip(marker, bookmark));
    // marker.addEventListener("mouseleave", () => {
    //   setTimeout(() => {
    //     const onClickOutside = (e) => {
    //       if (!tooltip.contains(e.target)) {
    //         hideMarkerTooltip();
    //         document.removeEventListener("mousedown", onClickOutside, true);
    //       }
    //     };
    //     document.addEventListener("mousedown", onClickOutside, true);
    //   }, 0);
    // });

    rail.appendChild(marker);
  }

  /***********************************************************
   * Keep markers synced with layout
   ***********************************************************/
  let debounceTimer = null;
  function scheduleRender() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(renderBookmarkMarkers, 120);
  }

  window.addEventListener("resize", scheduleRender, { passive: true });
  window.addEventListener("orientationchange", scheduleRender, { passive: true });

  let lastContainer = null;
  setInterval(() => {
    const c = findScrollContainer();
    if (c !== lastContainer) {
      lastContainer = c;
      c.addEventListener("scroll", scheduleRender, { passive: true });
      scheduleRender();
    }
  }, 800);

  new MutationObserver(scheduleRender).observe(document.body, {
    childList: true,
    subtree: true,
  });

  /***********************************************************
   * Marker click → jump + highlight exact selection
   ***********************************************************/
  function highlightRangeInMessage(messageEl, startAbs, endAbs) {
    function tryJump(attempt = 0) {
      const r = rangeFromOffsets(messageEl, startAbs, endAbs);
      if (!r) return;

      const rect = r.getBoundingClientRect();
      if ((rect.height === 0 || rect.top === 0) && attempt < 3) {
        setTimeout(() => tryJump(attempt + 1), 80);
        return;
      }

      const container = findScrollContainer();
      const containerRect = container.getBoundingClientRect();

      const rectCenterViewportY = rect.top + rect.height / 2;
      const rectCenterInContainer =
        container.scrollTop + (rectCenterViewportY - containerRect.top);

      const targetScrollTop = rectCenterInContainer - container.clientHeight / 2;

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

    tryJump();
  }

  document.addEventListener(
    "click",
    (e) => {
      const marker = e.target.closest(`#${RAIL_ID} > div`);
      if (!marker) return;

      e.preventDefault();
      e.stopPropagation();

      const messageId = marker.dataset.messageId;
      const startAbs = Number(marker.dataset.startAbs);
      const endAbs = Number(marker.dataset.endAbs);

      const messageEl = document.querySelector(
        `[data-message-id="${CSS.escape(messageId)}"]`
      );
      if (!messageEl) return;

      highlightRangeInMessage(messageEl, startAbs, endAbs);
    },
    true
  );

  /***********************************************************
   * Selection-scoped bookmark button (hover only when selection exists)
   ***********************************************************/
  let activeBlock = null;
  let selectionPayload = null;

  document.addEventListener("selectionchange", () => {
    selectionPayload = getSelectionPayload();

    if (!selectionPayload) {
      if (activeBlock) removeButton(activeBlock);
      activeBlock = null;
    }
  });

  function removeButton(blockEl) {
    const btn = blockEl?.querySelector(`.${BTN_CLASS}`);
    if (btn) btn.remove();
  }

  function showButton(blockEl) {
    if (!blockEl || blockEl.querySelector(`.${BTN_CLASS}`)) return;

    if (!blockEl.style.position || blockEl.style.position === "static") {
      blockEl.style.position = "relative";
    }

    const btn = document.createElement("button");
    btn.className = BTN_CLASS;
    btn.textContent = "🔖 Bookmark";
    btn.style.position = "absolute";
    btn.style.top = "6px";
    btn.style.right = "6px";
    btn.style.zIndex = "2147483647";
    btn.style.fontSize = "12px";
    btn.style.padding = "6px 8px";
    btn.style.borderRadius = "8px";
    btn.style.border = "1px solid rgba(0,0,0,0.12)";
    btn.style.background = "rgba(255,255,255,0.95)";
    btn.style.cursor = "pointer";
    btn.style.pointerEvents = "auto";
    btn.style.color = "#111";
    blockEl.appendChild(btn);
  }

  function getHoveredBlockFromEvent(e) {
    return e.target && e.target.closest ? e.target.closest(BLOCK_SELECTOR) : null;
  }

  document.addEventListener(
    "mouseover",
    (e) => {
      if (!selectionPayload) return;

      const blockEl = getHoveredBlockFromEvent(e);
      if (!blockEl) {
        if (activeBlock) removeButton(activeBlock);
        activeBlock = null;
        return;
      }

      const msg = findMessageContainer(blockEl);
      if (!msg || msg.getAttribute("data-message-id") !== selectionPayload.messageId) {
        if (activeBlock) removeButton(activeBlock);
        activeBlock = null;
        return;
      }

      if (activeBlock !== blockEl) {
        removeButton(activeBlock);
        activeBlock = blockEl;
        showButton(blockEl);
      }
    },
    true
  );

  document.addEventListener(
    "mouseout",
    (e) => {
      if (!activeBlock) return;
      if (e.relatedTarget && activeBlock.contains(e.relatedTarget)) return;
      removeButton(activeBlock);
      activeBlock = null;
    },
    true
  );

  /***********************************************************
   * Save bookmark: prompt for description (default from selection)
   ***********************************************************/
  function promptDescription(defaultText) {
    const d = window.prompt("Bookmark description:", defaultText);
    if (d == null) return null;
    return d.trim();
  }

  document.addEventListener(
    "click",
    (e) => {
      const btn =
        e.target && e.target.closest ? e.target.closest(`.${BTN_CLASS}`) : null;
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();

      if (!selectionPayload) return;

      const messageEl = document.querySelector(
        `[data-message-id="${CSS.escape(selectionPayload.messageId)}"]`
      );
      if (!messageEl) return;

      const defaultDesc = defaultDescFromText(selectionPayload.selectedText);
      const desc = promptDescription(defaultDesc);
      if (desc === null) return;

      const descWords = desc.split(/\s+/).filter(Boolean).slice(0, 10).join(" ");

      const exists = bookmarks.some(
        (b) =>
          b.messageId === selectionPayload.messageId &&
          b.startAbs === selectionPayload.startAbs &&
          b.endAbs === selectionPayload.endAbs
      );
      if (exists) return;

      const bookmark = {
        id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(),
        messageId: selectionPayload.messageId,
        role: selectionPayload.role,
        startAbs: selectionPayload.startAbs,
        endAbs: selectionPayload.endAbs,
        preview: defaultDescFromText(selectionPayload.selectedText),
        desc: descWords,
        createdAt: Date.now(),
      };

      bookmarks.push(bookmark);
      persistBookmarks(() => {
        renderBookmarkMarkers();
        scheduleRender();
      });

      const prev = btn.style.outline;
      btn.style.outline = "2px solid #ffcc00";
      setTimeout(() => (btn.style.outline = prev || ""), 500);
    },
    true
  );
})();
