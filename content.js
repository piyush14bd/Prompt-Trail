(() => {
  /***********************************************************
   * Phase 0: Minimal stable badge
   ***********************************************************/
  const BADGE_ID = "prompttrail-badge";
  const BTN_CLASS = "prompttrail-bookmark-btn";
  const BLOCK_SELECTOR = "p, li, h1, h2, h3, h4, blockquote, pre";

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
   * Helpers
   ***********************************************************/
  function findMessageContainer(el) {
    let current = el;
    while (current) {
      if (
        current.nodeType === Node.ELEMENT_NODE &&
        current.hasAttribute &&
        current.hasAttribute("data-message-id")
      ) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  }

  function getBlockIndex(messageEl, blockEl) {
    const blocks = Array.from(messageEl.querySelectorAll(BLOCK_SELECTOR));
    return blocks.indexOf(blockEl);
  }

  function removeButtonFrom(blockEl) {
    if (!blockEl) return;
    const btn = blockEl.querySelector(`.${BTN_CLASS}`);
    if (btn) btn.remove();
  }

  function ensureButtonOn(blockEl) {
    if (!blockEl) return;
    if (blockEl.querySelector(`.${BTN_CLASS}`)) return;
  
    // Ensure positioning context
    if (!blockEl.style.position || blockEl.style.position === "static") {
      blockEl.style.position = "relative";
    }
  
    const btn = document.createElement("button");
    btn.className = BTN_CLASS;
    btn.textContent = "🔖 Bookmark";
  
    btn.style.position = "absolute";
    btn.style.zIndex = "2147483647";
    btn.style.fontSize = "12px";
    btn.style.lineHeight = "1";
    btn.style.padding = "6px 8px";
    btn.style.borderRadius = "8px";
    btn.style.border = "1px solid rgba(0,0,0,0.12)";
    btn.style.background = "rgba(255,255,255,0.95)";
    btn.style.cursor = "pointer";
    btn.style.opacity = "0.95";
    btn.style.pointerEvents = "auto";
    btn.style.color = "#111";
  
    // --- NEW: position near selection ---
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const blockRect = blockEl.getBoundingClientRect();
  
      // Position relative to block
      let top = rect.top - blockRect.top - 32;
      let left = rect.right - blockRect.left + 8;
  
      // Clamp inside block
      top = Math.max(4, top);
      left = Math.min(
        blockEl.clientWidth - 100,
        Math.max(4, left)
      );
  
      btn.style.top = `${top}px`;
      btn.style.left = `${left}px`;
    } else {
      // Fallback (should rarely happen)
      btn.style.top = "6px";
      btn.style.right = "6px";
    }
  
    // Subtle hover feedback
    btn.addEventListener("mouseenter", () => (btn.style.opacity = "1"));
    btn.addEventListener("mouseleave", () => (btn.style.opacity = "0.9"));
  
    blockEl.appendChild(btn);
  }
  

  /***********************************************************
   * Selection + Hover State
   ***********************************************************/
  let activeBlock = null;
  let selectedBlock = null;

  // Track which block owns the current selection
  document.addEventListener("selectionchange", () => {
    const sel = window.getSelection();

    if (!sel || sel.isCollapsed) {
      selectedBlock = null;
      if (activeBlock) {
        removeButtonFrom(activeBlock);
        activeBlock = null;
      }
      return;
    }

    const range = sel.getRangeAt(0);
    const startNode = range.startContainer;

    const elementNode =
      startNode.nodeType === Node.TEXT_NODE
        ? startNode.parentElement
        : startNode;

    const blockEl = elementNode
      ? elementNode.closest(BLOCK_SELECTOR)
      : null;

    selectedBlock = blockEl;
  });

  /***********************************************************
   * Hover logic (delegated, selection-scoped)
   ***********************************************************/
  document.addEventListener(
    "mouseover",
    (e) => {
      const target = e.target;
      const blockEl =
        target && target.closest ? target.closest(BLOCK_SELECTOR) : null;

      // Not over any block
      if (!blockEl) {
        if (activeBlock) {
          removeButtonFrom(activeBlock);
          activeBlock = null;
        }
        return;
      }

      // Only show if hover === selected block
      if (blockEl !== selectedBlock) {
        if (activeBlock) {
          removeButtonFrom(activeBlock);
          activeBlock = null;
        }
        return;
      }

      // Hovering the selected block
      if (activeBlock !== blockEl) {
        removeButtonFrom(activeBlock);
        activeBlock = blockEl;

        const messageEl = findMessageContainer(blockEl);
        if (!messageEl) return;

        ensureButtonOn(blockEl);
      }
    },
    true
  );

  document.addEventListener(
    "mouseout",
    (e) => {
      if (!activeBlock) return;

      const to = e.relatedTarget;
      if (to && activeBlock.contains(to)) return;

      removeButtonFrom(activeBlock);
      activeBlock = null;
    },
    true
  );

  /***********************************************************
   * Click logic (delegated)
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
        blockTag: blockEl.tagName,
        preview: (blockEl.innerText || "").trim().slice(0, 160),
        createdAt: Date.now(),
      };

      console.log("[PromptTrail] Bookmark saved:", bookmark);

      // Visual confirmation
      const prev = blockEl.style.outline;
      blockEl.style.outline = "2px solid #ffcc00";
      setTimeout(() => (blockEl.style.outline = prev || ""), 800);
    },
    true
  );
})();
