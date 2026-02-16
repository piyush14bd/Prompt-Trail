// core/utils.js

/***********************************************************
 * Conversation
 ***********************************************************/
export function getConversationId() {
    const m = location.pathname.match(/\/c\/([a-zA-Z0-9-]+)/);
    return m ? m[1] : "unknown";
  }
  
  /***********************************************************
   * Text helpers
   ***********************************************************/
  export function defaultDescFromText(text) {
    const words = (text || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  
    return words.slice(0, 10).join(" ");
  }
  
  export function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  
  /***********************************************************
   * DOM helpers
   ***********************************************************/
  export function createElement(tag, styles = {}, attributes = {}) {
    const el = document.createElement(tag);
  
    Object.assign(el.style, styles);
  
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === "textContent") {
        el.textContent = value;
      } else if (key === "innerHTML") {
        el.innerHTML = value;
      } else {
        el.setAttribute(key, value);
      }
    });
  
    return el;
  }
  
  /***********************************************************
   * Debounce
   ***********************************************************/
  export function debounce(fn, delay = 100) {
    let timer;
  
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }
  