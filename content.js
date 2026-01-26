(() => {
  /***********************************************************
   * Constants
   ***********************************************************/
  const BADGE_ID = "prompttrail-badge";
  const BTN_CLASS = "prompttrail-bookmark-btn";
  const RAIL_ID = "prompttrail-scroll-rail";
  const BLOCK_SELECTOR = "p, li, h1, h2, h3, h4, blockquote, pre";

  const STORAGE_KEY = "prompttrail_bookmarks_v1"; // { [convoId]: Bookmark[] }

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
   * Helpers (stable)
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

  function getBlockIndex(messageEl, blockEl) {
    const blocks = Array.from(messageEl.querySelectorAll(BLOCK_SELECTOR));
    return blocks.indexOf(blockEl);
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
   * Render bookmark markers (PIXEL-ACCURATE)
   ***********************************************************/
  function renderBookmarkMarkers() {
    const rail = document.getElementById(RAIL_ID);
    if (!rail) return;

    rail.innerHTML = "";

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

      const blocks = messageEl.querySelectorAll(BLOCK_SELECTOR);
      const targetBlock = blocks[bookmark.blockIndex] || messageEl;

      const posInContent = elementCenterYRelativeToContainer(container, targetBlock);
      const percent = Math.max(0, Math.min(1, posInContent / scrollRange));

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

      marker.dataset.messageId = bookmark.messageId;
      marker.dataset.blockIndex = String(bookmark.blockIndex);

      rail.appendChild(marker);
    });
  }

  /***********************************************************
   * Keep markers synced with layout (THIS WAS MISSING)
   ***********************************************************/
  let debounceTimer = null;
  function scheduleRender() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(renderBookmarkMarkers, 120);
  }

  window.addEventListener("resize", scheduleRender, { passive: true });
  window.addEventListener("orientationchange", scheduleRender, { passive: true });

  // attach scroll listener to the real scroll container
  let lastContainer = null;
  setInterval(() => {
    const c = findScrollContainer();
    if (c !== lastContainer) {
      if (lastContainer) {
        // we can't easily remove the previous listener reference here,
        // but switching containers is rare; acceptable for now.
      }
      lastContainer = c;
      c.addEventListener("scroll", scheduleRender, { passive: true });
      scheduleRender();
    }
  }, 800);

  // rerender when new messages load / DOM changes
  new MutationObserver(scheduleRender).observe(document.body, {
    childList: true,
    subtree: true,
  });

  /***********************************************************
   * Marker click → precise jump (stable)
   ***********************************************************/
  document.addEventListener(
    "click",
    (e) => {
      const marker = e.target.closest(`#${RAIL_ID} > div`);
      if (!marker) return;

      e.preventDefault();
      e.stopPropagation();

      const messageId = marker.dataset.messageId;
      const blockIndex = Number(marker.dataset.blockIndex);

      const messageEl = document.querySelector(
        `[data-message-id="${CSS.escape(messageId)}"]`
      );
      if (!messageEl) return;

      const blocks = messageEl.querySelectorAll(BLOCK_SELECTOR);
      const targetBlock = blocks[blockIndex] || messageEl;

      const container = findScrollContainer();
      const posInContent = elementCenterYRelativeToContainer(container, targetBlock);
      const targetScrollTop = posInContent - container.clientHeight / 2;

      if (
        container === document.scrollingElement ||
        container === document.documentElement
      ) {
        window.scrollTo({ top: targetScrollTop, behavior: "auto" });
      } else {
        container.scrollTo({ top: targetScrollTop, behavior: "auto" });
      }

      const prev = targetBlock.style.outline;
      targetBlock.style.outline = "2px solid #ff9800";
      setTimeout(() => (targetBlock.style.outline = prev || ""), 800);
    },
    true
  );

  /***********************************************************
   * Storage: load/save WITHOUT touching UI logic
   ***********************************************************/
  function loadBookmarks() {
    const convoId = getConversationId();

    // If storage isn't available (or permission missing), just run in-memory.
    if (!chrome?.storage?.sync) {
      console.warn("[PromptTrail] chrome.storage.sync not available; using memory only.");
      scheduleRender();
      return;
    }

    chrome.storage.sync.get(STORAGE_KEY, (data) => {
      const all = data[STORAGE_KEY] || {};
      bookmarks = all[convoId] || [];
      renderBookmarkMarkers(); // immediate
      scheduleRender();        // and resync
    });
  }

  function persistBookmarks() {
    const convoId = getConversationId();
    if (!chrome?.storage?.sync) return;

    chrome.storage.sync.get(STORAGE_KEY, (data) => {
      const all = data[STORAGE_KEY] || {};
      all[convoId] = bookmarks;
      chrome.storage.sync.set({ [STORAGE_KEY]: all }, () => {
        // keep markers always correct after persistence too
        renderBookmarkMarkers();
        scheduleRender();
      });
    });
  }

  loadBookmarks();

  /***********************************************************
   * Selection-scoped bookmark button (UNCHANGED)
   ***********************************************************/
  let activeBlock = null;
  let selectedBlock = null;

  document.addEventListener("selectionchange", () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      selectedBlock = null;
      if (activeBlock) {
        removeButton(activeBlock);
        activeBlock = null;
      }
      return;
    }

    const range = sel.getRangeAt(0);
    const startNode = range.startContainer;
    const el =
      startNode.nodeType === Node.TEXT_NODE
        ? startNode.parentElement
        : startNode;

    selectedBlock = el ? el.closest(BLOCK_SELECTOR) : null;
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

  document.addEventListener(
    "mouseover",
    (e) => {
      const blockEl =
        e.target && e.target.closest
          ? e.target.closest(BLOCK_SELECTOR)
          : null;

      if (!blockEl || blockEl !== selectedBlock) {
        if (activeBlock) {
          removeButton(activeBlock);
          activeBlock = null;
        }
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
   * Bookmark button click → add bookmark + persist + render
   ***********************************************************/
  document.addEventListener(
    "click",
    (e) => {
      const btn =
        e.target && e.target.closest
          ? e.target.closest(`.${BTN_CLASS}`)
          : null;
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();

      const blockEl = btn.parentElement;
      const messageEl = findMessageContainer(blockEl);
      if (!messageEl) return;

      const bookmark = {
        messageId: messageEl.getAttribute("data-message-id"),
        role: messageEl.getAttribute("data-message-author-role"),
        blockIndex: getBlockIndex(messageEl, blockEl),
        createdAt: Date.now(),
      };

      // avoid duplicates (same messageId + blockIndex)
      const exists = bookmarks.some(
        (b) => b.messageId === bookmark.messageId && b.blockIndex === bookmark.blockIndex
      );
      if (!exists) {
        bookmarks.push(bookmark);
        persistBookmarks();
      }

      renderBookmarkMarkers();
      scheduleRender();

      console.log("[PromptTrail] Bookmark saved:", bookmark);

      const prev = blockEl.style.outline;
      blockEl.style.outline = "2px solid #ffcc00";
      setTimeout(() => (blockEl.style.outline = prev || ""), 800);
    },
    true
  );
})();
