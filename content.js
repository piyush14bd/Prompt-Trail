console.log("PromptTrail content.js loaded");

import { initBadge } from "./ui/badge.js";
import { initScrollRail } from "./ui/scrollRail.js";
import { initSelection } from "./core/selectionEngine.js";
import { loadBookmarks } from "./core/bookmarkStore.js";

loadBookmarks();
initBadge();
initScrollRail();
initSelection();
