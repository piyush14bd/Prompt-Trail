// (() => {
//     const ID = "prompttrail-phase1";
  
//     const log = (...args) =>
//       console.log("[PromptTrail]", ...args, "| frame:", window.location.href);
  
//     function makeBox() {
//       const box = document.createElement("div");
//       box.id = ID;
//       box.textContent = "Hello PromptTrail 👋";
  
//       box.style.position = "fixed";
//       box.style.top = "16px";
//       box.style.right = "16px";
//       box.style.zIndex = "2147483647";
//       box.style.background = "white";
//       box.style.border = "1px solid #ddd";
//       box.style.borderRadius = "10px";
//       box.style.padding = "10px 12px";
//       box.style.fontFamily =
//         'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
//       box.style.fontSize = "13px";
//       box.style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)";
//       box.style.color = "#111";
  
//       return box;
//     }
  
//     function injectOnce() {
//       try {
//         // Already injected in THIS frame/document
//         if (document.getElementById(ID)) return true;
  
//         // Inject into <html> to survive body re-renders
//         const root = document.documentElement;
//         if (!root) return false;
  
//         root.appendChild(makeBox());
//         log("Injected ✅");
//         return true;
//       } catch (err) {
//         console.error("[PromptTrail] Injection error:", err);
//         return false;
//       }
//     }
  
//     log("Content script running");
//     injectOnce();
  
//     // Retry for SPA hydration
//     let attempts = 0;
//     const maxAttempts = 40; // ~20s
//     const interval = setInterval(() => {
//       attempts += 1;
//       const ok = injectOnce();
//       if (ok || attempts >= maxAttempts) clearInterval(interval);
//     }, 500);
  
//     // Observe DOM changes
//     const observer = new MutationObserver(() => injectOnce());
//     observer.observe(document.documentElement, { childList: true, subtree: true });

//     // document.addEventListener("mouseup", () => {
//     //   const selection = window.getSelection();
    
//     //   if (!selection || selection.isCollapsed) {
//     //     return; // no text selected
//     //   }
    
//     //   const selectedText = selection.toString().trim();
//     //   if (!selectedText) return;
    
//     //   console.log("[PromptTrail] Selected text:", selectedText);
//     // });


//     function findMessageContainer(node) {
//       let current = node;
    
//       while (current) {
//         if (
//           current.nodeType === Node.ELEMENT_NODE &&
//           current.hasAttribute &&
//           current.hasAttribute("data-message-author-role")
//         ) {
//           return current;
//         }
    
//         current = current.parentNode;
//       }
    
//       return null;
//     }
    


//     document.addEventListener("mouseup", () => {
//       const selection = window.getSelection();
//       if (!selection || selection.isCollapsed) return;
    
//       const selectedText = selection.toString().trim();
//       if (!selectedText) return;
    
//       const range = selection.getRangeAt(0);
//       const startNode = range.startContainer;
    
//       const messageEl = findMessageContainer(startNode);
    
//       if (!messageEl) {
//         console.log("[PromptTrail] Selection not inside a message");
//         return;
//       }
    
//       const messageId = messageEl.getAttribute("data-message-id");
//       const role = messageEl.getAttribute("data-message-author-role");
    
//       console.log("[PromptTrail] Bookmark candidate:", {
//         role,
//         messageId,
//         selectedText,
//       });
//     });
    
    
//   })();
  
(() => {
  /***********************************************************
   * Phase 0: Stable injection
   ***********************************************************/
  const ID = "prompttrail-phase1";

  const log = (...args) =>
    console.log("[PromptTrail]", ...args, "| frame:", window.location.href);

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
    try {
      if (document.getElementById(ID)) return true;

      const root = document.documentElement;
      if (!root) return false;

      root.appendChild(makeBox());
      log("Injected ✅");
      return true;
    } catch (err) {
      console.error("[PromptTrail] Injection error:", err);
      return false;
    }
  }

  log("Content script running");
  injectOnce();

  let attempts = 0;
  const maxAttempts = 40;
  const interval = setInterval(() => {
    attempts += 1;
    const ok = injectOnce();
    if (ok || attempts >= maxAttempts) clearInterval(interval);
  }, 500);

  const observer = new MutationObserver(() => injectOnce());
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  /***********************************************************
   * Helpers: DOM reasoning
   ***********************************************************/
  function findMessageContainer(node) {
    let current = node;
    while (current) {
      if (
        current.nodeType === Node.ELEMENT_NODE &&
        current.hasAttribute &&
        current.hasAttribute("data-message-author-role")
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
   * Helpers: precise range reconstruction
   ***********************************************************/
  function highlightTextRange(messageEl, start, end) {
    const walker = document.createTreeWalker(
      messageEl,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentOffset = 0;
    let startNode = null;
    let endNode = null;
    let startOffset = 0;
    let endOffset = 0;

    while (walker.nextNode()) {
      const textNode = walker.currentNode;
      const textLength = textNode.textContent.length;

      if (
        !startNode &&
        currentOffset + textLength >= start
      ) {
        startNode = textNode;
        startOffset = start - currentOffset;
      }

      if (
        startNode &&
        currentOffset + textLength >= end
      ) {
        endNode = textNode;
        endOffset = end - currentOffset;
        break;
      }

      currentOffset += textLength;
    }

    if (!startNode || !endNode) {
      console.log("[PromptTrail] Could not reconstruct range");
      return;
    }

    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);


    // temporary highlight
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    // optional visual reinforcement on the message container
    const prevOutline = messageEl.style.outline;
    messageEl.style.outline = "2px solid #ffcc00";

    setTimeout(() => {
      selection.removeAllRanges();
      messageEl.style.outline = prevOutline || "";
    }, 1500);

  }

  function scrollToMessage(messageEl) {
    messageEl.scrollIntoView({
      behavior: "auto",
      block: "start",
    });
  }

  /***********************************************************
   * Bookmark candidate (temporary)
   ***********************************************************/
  let lastBookmarkCandidate = null;

  /***********************************************************
   * Step 1: Selection → exact text offsets
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

    const messageId = messageEl.getAttribute("data-message-id");
    const role = messageEl.getAttribute("data-message-author-role");

    const messageText = messageEl.innerText;
    const startOffset = messageText.indexOf(selectedText);
    const endOffset =
      startOffset !== -1 ? startOffset + selectedText.length : -1;

    lastBookmarkCandidate = {
      messageId,
      role,
      selectedText,
      startOffset,
      endOffset,
    };

    console.log(
      "[PromptTrail] Bookmark candidate (exact):",
      lastBookmarkCandidate
    );
  });

  /***********************************************************
   * Step 2: Press "b" → jump to exact text
   ***********************************************************/
  document.addEventListener("keydown", (e) => {
    if (e.key !== "b") return;
    if (!lastBookmarkCandidate) return;

    const {
      messageId,
      startOffset,
      endOffset,
    } = lastBookmarkCandidate;

    const messageEl = findMessageById(messageId);
    if (!messageEl) return;

    scrollToMessage(messageEl);
    highlightTextRange(messageEl, startOffset, endOffset);

    console.log("[PromptTrail] Jumped to exact text");
  });
})();
