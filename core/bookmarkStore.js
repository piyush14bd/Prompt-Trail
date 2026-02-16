// core/bookmark.js

const STORAGE_KEY = "prompttrail_bookmarks_v2";

let bookmarks = [];
let listeners = [];

/***********************************************************
 * Utilities
 ***********************************************************/
function getConversationId() {
  const m = location.pathname.match(/\/c\/([a-zA-Z0-9-]+)/);
  return m ? m[1] : "unknown";
}

function notify() {
  listeners.forEach((fn) => fn(bookmarks));
}

/***********************************************************
 * Public API
 ***********************************************************/

export function subscribe(fn) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function getBookmarks() {
  return bookmarks;
}

export function addBookmark(bookmark) {
  bookmarks.push(bookmark);
  persist();
}

export function updateBookmark(id, updates) {
  const index = bookmarks.findIndex((b) => b.id === id);
  if (index === -1) return;

  bookmarks[index] = { ...bookmarks[index], ...updates };
  persist();
}

export function deleteBookmark(id) {
  bookmarks = bookmarks.filter((b) => b.id !== id);
  persist();
}

/***********************************************************
 * Storage
 ***********************************************************/

export function loadBookmarks() {
  const convoId = getConversationId();

  if (!chrome?.storage?.sync) {
    notify();
    return;
  }

  chrome.storage.sync.get(STORAGE_KEY, (data) => {
    const all = data[STORAGE_KEY] || {};
    bookmarks = all[convoId] || [];
    notify();
  });
}

function persist() {
  const convoId = getConversationId();

  if (!chrome?.storage?.sync) {
    notify();
    return;
  }

  chrome.storage.sync.get(STORAGE_KEY, (data) => {
    const all = data[STORAGE_KEY] || {};
    all[convoId] = bookmarks;

    chrome.storage.sync.set({ [STORAGE_KEY]: all }, () => {
      notify();
    });
  });
}
