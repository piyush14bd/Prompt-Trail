(() => {
  /***********************************************************
   * Phase 0: Stable injection
   ***********************************************************/
  const ID = "prompttrail-phase1";

  function makeBox() {
    const box = document.createElement("div");
    box.id = ID;
    box.textContent = "Hello PromptTrail 👋";
    box.style.position = "fixed";
    box.style.top = "16px";
    box.style.right = "16px";
    box.style.zIndex = "2147483647";
    box.style.background = "white";
    box.style.border = "1px solid #ddd";
    box.style.borderRadius = "10px";
    box.style.padding = "10px 12px";
    box.style.fontFamily =
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    box.style.fontSize = "13px";
    box.style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)";
    box.style.color = "#111";
    return box;
  }

  function injectOnce() {
    if (document.getElementById(ID)) return;
    document.documentElement.appendChild(makeBox());
  }

  injectOnce();
  new MutationObserver(injectOnce).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  /***********************************************************
   * Helpers: DOM anchoring
   ***********************************************************/
  function findMessageContainer(node) {
    let current = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
    while (current) {
      if (
        current.nodeType === Node.ELEMENT_NODE &&
        current.hasAttribute("data-message-id")
      ) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  }

  const BLOCK_SELECTOR =
    "p, li, h1, h2, h3, h4, blockquote, pre";

  function findBlockAnchor(node) {
    let current = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
    while (current) {
      if (
        current.nodeType === Node.ELEMENT_NODE &&
        current.matches(BLOCK_SELECTOR)
      ) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  }

  function findMessageById(messageId) {
    return document.querySelector(
      `[data-message-id="${CSS.escape(messageId)}"]`
    );
  }

  /***********************************************************
   * Bookmark candidate (temporary)
   ***********************************************************/
  let lastBookmarkCandidate = null;

  /***********************************************************
   * Step 1: Selection → message + block anchor
   ***********************************************************/
  document.addEventListener("mouseup", () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    const range = selection.getRangeAt(0);
    const startNode = range.startContainer;

    const messageEl = findMessageContainer(startNode);
    if (!messageEl) return;

    const blockEl = findBlockAnchor(startNode);
    if (!blockEl) return;

    const messageId = messageEl.getAttribute("data-message-id");
    const role = messageEl.getAttribute("data-message-author-role");

    const blocks = Array.from(
      messageEl.querySelectorAll(BLOCK_SELECTOR)
    );
    const blockIndex = blocks.indexOf(blockEl);
    if (blockIndex === -1) return;

    lastBookmarkCandidate = {
      messageId,
      role,
      blockIndex,
      blockTag: blockEl.tagName,
      selectedText,
    };

    console.log(
      "[PromptTrail] Bookmark candidate (block-level):",
      lastBookmarkCandidate
    );
  });

  /***********************************************************
   * Step 2: Jump to bookmarked block (reliable)
   ***********************************************************/
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "b") return;
      if (!lastBookmarkCandidate) return;

      e.preventDefault();
      e.stopPropagation();

      const {
        messageId,
        blockIndex,
      } = lastBookmarkCandidate;

      const messageEl = findMessageById(messageId);
      if (!messageEl) return;

      const blocks = messageEl.querySelectorAll(BLOCK_SELECTOR);
      const targetBlock = blocks[blockIndex];
      if (!targetBlock) return;

      // Reliable scroll
      targetBlock.scrollIntoView({
        behavior: "auto",
        block: "center",
      });

      // Visual cue
      const prev = targetBlock.style.outline;
      targetBlock.style.outline = "2px solid #ffcc00";

      setTimeout(() => {
        targetBlock.style.outline = prev || "";
      }, 1500);

      console.log("[PromptTrail] Jumped to block-level anchor");
    },
    true
  );
})();
