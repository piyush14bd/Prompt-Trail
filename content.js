(() => {
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
        // Already injected in THIS frame/document
        if (document.getElementById(ID)) return true;
  
        // Inject into <html> to survive body re-renders
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
  
    // Retry for SPA hydration
    let attempts = 0;
    const maxAttempts = 40; // ~20s
    const interval = setInterval(() => {
      attempts += 1;
      const ok = injectOnce();
      if (ok || attempts >= maxAttempts) clearInterval(interval);
    }, 500);
  
    // Observe DOM changes
    const observer = new MutationObserver(() => injectOnce());
    observer.observe(document.documentElement, { childList: true, subtree: true });
  })();
  