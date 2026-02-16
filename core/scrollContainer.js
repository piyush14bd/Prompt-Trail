// core/scrollContainer.js

export function findMessageContainer(el) {
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
  
  export function findScrollContainer() {
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
  
  export function elementCenterYRelativeToContainer(container, el) {
    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
  
    const elCenterViewportY = elRect.top + elRect.height / 2;
    const containerViewportTop = containerRect.top;
  
    const distanceInViewport = elCenterViewportY - containerViewportTop;
  
    return container.scrollTop + distanceInViewport;
  }
  