Prompt-Trail

Debugging Challenge: Injecting UI into ChatGPT

While building PromptTrail, a major early challenge was reliably injecting UI elements into ChatGPT. This section documents what went wrong, why it happened, how it was diagnosed, and how it was fixed.

Problem Summary

The Chrome extension worked correctly on Claude, but initially failed to display any injected UI on ChatGPT, even though:

The content script was running

No JavaScript errors were thrown

The same logic worked on other sites

This created the false impression that ChatGPT might be blocking extensions, which turned out not to be the case.

Initial Observation (Proof)

The content script clearly executed on ChatGPT, confirmed by console logs:

[PromptTrail] Content script running | frame: https://chatgpt.com/...
[PromptTrail] Injected ✅ | frame: https://chatgpt.com/...


However, checking the DOM immediately afterward returned:

document.getElementById("prompttrail-phase1")
// null


This proved an important contradiction:

The extension did inject

The injected element did not persist in the visible DOM

The Misunderstanding

The initial assumption was:

“If JavaScript runs and appends an element to the DOM, the element should remain visible.”

This assumption is valid for traditional multi-page websites, but not for modern Single Page Applications (SPAs) like ChatGPT.

What ChatGPT Is Actually Doing (Simplified Explanation)

ChatGPT is a Single Page Application (SPA) built with React and Next.js.

Instead of loading new HTML pages, ChatGPT:

Loads a minimal shell

Uses JavaScript to render the UI

Frequently destroys and rebuilds large portions of the DOM

Repeats this process during navigation, hydration, and state updates

As a result:

DOM elements injected by external scripts can be silently removed

No error is thrown

The extension appears to “fail” even though it technically ran

In simple terms:

The extension added a UI element, but ChatGPT rebuilt the page immediately afterward and erased it.

Additional Complication: Multiple Frames

Another factor was that ChatGPT renders parts of its UI across multiple document contexts (frames).

By default, Chrome injects content scripts only into the top-level document. However:

ChatGPT’s visible UI may live in a different frame

The extension may run in one document while the UI exists in another

This explains why:

document.getElementById(...)


returned null even after a successful injection log.

Technical Root Causes

Aggressive DOM re-rendering

React frequently replaces DOM nodes

Injected elements are not part of React’s state and are removed

Frame isolation

UI rendered in a different document context

Content script initially ran in the wrong frame

Timing issues

Injection happened before ChatGPT finished hydrating the UI

The Fix (How It Was Solved)

The solution involved three key changes:

1. Inject into all frames
"all_frames": true


This ensured the content script ran in every document context, including the one hosting the visible UI.

2. Observe DOM changes

A MutationObserver was added to detect when ChatGPT rebuilt the DOM and re-inject the UI if needed.

const observer = new MutationObserver(() => injectOnce());
observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});

3. Defensive injection logic

Before injecting, the script checks whether the UI already exists to avoid duplicates:

if (document.getElementById(ID)) return;


This made the injection idempotent and resilient.

Final Result

After applying these fixes:

The extension successfully injected UI on ChatGPT and Claude

The UI persisted across SPA re-renders

The extension did not rely on brittle timing assumptions

No platform-specific blocking was involved

Key Takeaway

ChatGPT does not block Chrome extensions.
It aggressively rebuilds its UI.

To work reliably on modern SPAs, browser extensions must be:

Frame-aware

Lifecycle-aware

Resilient to DOM replacement

This lesson directly informed the architecture of PromptTrail and influenced how all subsequent UI features were implemented.