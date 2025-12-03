Prompt-Trail

                      ┌──────────────────────────────────────────┐
                      │               User Webpage               │
                      │ (ChatGPT / Claude DOM with messages)     │
                      └──────────────────────────────────────────┘
                                        ▲
                                        │  (DOM scanning, inject ⭐ buttons)
                                        │
                           CONTENT SCRIPT (React app injection)
                                        │
                      ┌─────────────────┴──────────────────┐
                      │                                  │
          Inject Sidebar UI (React)              Attach ⭐ to messages
                      │                                  │
                      ▼                                  ▼
   ┌─────────────────────────────────┐      ┌────────────────────────────┐
   │  Sidebar React App (PromptTrail)│      │  Star Button Click Handler │
   └─────────────────────────────────┘      └────────────────────────────┘
                      │                                  │
                      │        Send bookmark objects     │
                      └───────────────┬──────────────────┘
                                      ▼
                         chrome.storage.sync (persistent)
                                      │
                 ┌────────────────────┴────────────────────┐
                 │                                         │
   Sidebar loads & listens                     Background service worker
   for storage updates                         (optional: sync, messaging)
                 │                                         │
                 ▼                                         ▼
   ┌───────────────────────────┐            ┌──────────────────────────┐
   │ Live bookmark list updates │            │  Future: shortcuts, sync │
   │ Jump-to-message scrolling  │            │  cross-tab coordination   │
   └───────────────────────────┘            └──────────────────────────┘





1. Content Script Runs on GPT Sites

The content script automatically loads on:

https://chat.openai.com/*

https://claude.ai/*

The content script performs the following actions:

Injects the PromptTrail sidebar (a React root mounted into the page)

Scans the DOM for chat messages

Attaches a bookmark button (⭐) to each message

2. User Interacts with the Bookmark Button

When the user clicks the ⭐ button:

The content script extracts metadata from the message:

message ID

text snippet

timestamp

optional reasoning chain

It creates a Bookmark object:

{
  "id": "unique-id",
  "snippet": "text…",
  "createdAt": 1720000000,
  "scrollLocator": "dom-identifier"
}


The bookmark is saved to chrome.storage.sync.

3. chrome.storage.sync as the Single Source of Truth

Using chrome.storage.sync provides the following benefits:

Automatically syncs bookmarks across Chrome sessions

The sidebar UI updates in real time as storage changes

No manual state-sharing is needed between content scripts and the sidebar

Provides a lightweight mechanism for persistence built into Chrome

4. Sidebar React App Reacts to Changes

The sidebar UI:

Loads existing bookmarks from storage on initialization

Subscribes to the chrome.storage.onChanged event

Automatically re-renders when bookmarks are added or removed

Displays:

a list of bookmarks

delete buttons

"jump to message" buttons

5. Jump to Message

When the user selects a bookmark:

The content script locates the corresponding DOM node using the stored identifier

Scrolls to the message smoothly

Optionally applies a highlight animation

This allows users to quickly navigate back through their reasoning trail.

6. Background Script (Service Worker)

In the MVP:

The background script remains mostly idle

Logs installation events

Can mediate communication across tabs if needed

Potential future responsibilities:

Keyboard shortcuts (e.g., Cmd/Ctrl + Shift + B)

Multi-tab bookmark synchronization

Automated bookmark pruning or cleanup logic
