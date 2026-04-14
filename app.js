/**
 * Shopping List App
 *
 * Features:
 *  - Multiple store categories with emoji icons
 *  - Persistent storage via localStorage
 *  - Autocomplete suggestions from previously entered items
 *  - Keyboard navigation for suggestions (↑ ↓ Enter Escape)
 *  - Check off, delete, bulk-remove checked, and clear-all actions
 */

// ─── Data ────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "grocery",   label: "Grocery",        icon: "🛒", examples: ["apples", "bread", "milk", "eggs", "butter", "cheese", "yogurt", "chicken", "pasta", "rice"] },
  { id: "hardware",  label: "Hardware",        icon: "🔨", examples: ["screws", "drill bits", "sandpaper", "paint", "caulk", "nails", "duct tape", "wood glue", "light bulbs"] },
  { id: "pharmacy",  label: "Pharmacy",        icon: "💊", examples: ["ibuprofen", "bandages", "vitamins", "sunscreen", "cold medicine", "antacids", "shampoo", "toothpaste"] },
  { id: "electronics", label: "Electronics",  icon: "🖥️", examples: ["USB cable", "batteries", "HDMI cable", "phone case", "earbuds", "power strip"] },
  { id: "clothing",  label: "Clothing",        icon: "👗", examples: ["socks", "t-shirt", "jeans", "jacket", "underwear", "sneakers", "belt"] },
  { id: "pet",       label: "Pet Store",       icon: "🐾", examples: ["dog food", "cat litter", "treats", "flea collar", "dog toys", "fish food"] },
  { id: "office",    label: "Office",          icon: "📚", examples: ["printer paper", "pens", "sticky notes", "folders", "staples", "tape", "scissors"] },
  { id: "sporting",  label: "Sporting Goods",  icon: "🏋️", examples: ["protein powder", "water bottle", "resistance bands", "yoga mat", "running shoes"] },
  { id: "homegoods", label: "Home Goods",      icon: "🏠", examples: ["towels", "bed sheets", "laundry detergent", "dish soap", "trash bags", "candles", "pillow"] },
  { id: "specialty", label: "Specialty Food",  icon: "🍴", examples: ["olive oil", "hot sauce", "specialty cheese", "craft beer", "wine", "kombucha"] },
];

// Initialise or load persisted state
function loadState() {
  try {
    const raw = localStorage.getItem("shoppingListState");
    if (raw) return JSON.parse(raw);
  } catch (_) { /* ignore */ }
  return null;
}

function buildDefaultState() {
  const lists = {};
  const history = {};
  CATEGORIES.forEach(cat => {
    lists[cat.id] = [];   // [{id, name, checked}]
    history[cat.id] = []; // past item names (unique, ordered by recency)
  });
  return { lists, history, activeCategory: CATEGORIES[0].id };
}

let state = loadState() || buildDefaultState();

// Ensure any new categories added later are present in state
CATEGORIES.forEach(cat => {
  if (!state.lists[cat.id])   state.lists[cat.id]   = [];
  if (!state.history[cat.id]) state.history[cat.id] = [];
});

function saveState() {
  try {
    localStorage.setItem("shoppingListState", JSON.stringify(state));
  } catch (_) { /* quota exceeded or private mode – fail silently */ }
}

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const categoryNav        = document.getElementById("categoryNav");
const currentCategoryTitle = document.getElementById("currentCategoryTitle");
const addForm            = document.getElementById("addForm");
const itemInput          = document.getElementById("itemInput");
const suggestionsList    = document.getElementById("suggestions");
const shoppingList       = document.getElementById("shoppingList");
const emptyState         = document.getElementById("emptyState");
const itemCount          = document.getElementById("itemCount");
const clearCheckedBtn    = document.getElementById("clearCheckedBtn");
const clearAllBtn        = document.getElementById("clearAllBtn");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function activeCategory() {
  return CATEGORIES.find(c => c.id === state.activeCategory);
}

function activeList() {
  return state.lists[state.activeCategory];
}

function activeHistory() {
  return state.history[state.activeCategory];
}

/** Add a name to the history for the current category (deduplicated, newest first). */
function recordHistory(name) {
  const hist = activeHistory();
  const lower = name.toLowerCase();
  const idx = hist.findIndex(h => h.toLowerCase() === lower);
  if (idx !== -1) hist.splice(idx, 1);
  hist.unshift(name);
  // Keep the history list manageable
  if (hist.length > 200) hist.length = 200;
}

/** Return history entries that start with the given prefix (case-insensitive). */
function getSuggestions(prefix) {
  if (!prefix) return [];
  const lower = prefix.toLowerCase();
  const hist = activeHistory();

  // First pass: items already in the history
  const fromHistory = hist.filter(h => h.toLowerCase().startsWith(lower));

  // Second pass: built-in examples that aren't already in history
  const cat = activeCategory();
  const inHistory = new Set(hist.map(h => h.toLowerCase()));
  const fromExamples = cat.examples.filter(
    e => e.toLowerCase().startsWith(lower) && !inHistory.has(e.toLowerCase())
  );

  const merged = [...fromHistory, ...fromExamples];
  // Deduplicate (case-insensitive) while preserving order
  const seen = new Set();
  return merged.filter(item => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function renderCategoryNav() {
  categoryNav.innerHTML = "";
  CATEGORIES.forEach(cat => {
    const count = state.lists[cat.id].filter(i => !i.checked).length;
    const btn = document.createElement("button");
    btn.className = "category-tab";
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", cat.id === state.activeCategory ? "true" : "false");
    btn.dataset.catId = cat.id;
    btn.innerHTML = `${cat.icon} ${cat.label}${count > 0 ? ` <span class="badge">${count}</span>` : ""}`;
    btn.addEventListener("click", () => selectCategory(cat.id));
    categoryNav.appendChild(btn);
  });
}

function renderList() {
  const list = activeList();
  const cat  = activeCategory();

  currentCategoryTitle.textContent = `${cat.icon} ${cat.label}`;

  shoppingList.innerHTML = "";

  if (list.length === 0) {
    emptyState.hidden = false;
    itemCount.textContent = "";
  } else {
    emptyState.hidden = true;
    const total     = list.length;
    const remaining = list.filter(i => !i.checked).length;
    itemCount.textContent = remaining === total
      ? `${total} item${total !== 1 ? "s" : ""}`
      : `${remaining} of ${total} remaining`;

    list.forEach(item => {
      const li = document.createElement("li");
      li.className = "list-item" + (item.checked ? " checked" : "");
      li.dataset.id = item.id;

      const checkbox = document.createElement("input");
      checkbox.type    = "checkbox";
      checkbox.checked = item.checked;
      checkbox.setAttribute("aria-label", `Mark ${item.name} as ${item.checked ? "not done" : "done"}`);
      checkbox.addEventListener("change", () => toggleItem(item.id));

      const span = document.createElement("span");
      span.className = "item-name";
      span.textContent = item.name;

      const delBtn = document.createElement("button");
      delBtn.className = "delete-btn";
      delBtn.setAttribute("aria-label", `Delete ${item.name}`);
      delBtn.textContent = "✕";
      delBtn.addEventListener("click", () => deleteItem(item.id));

      li.appendChild(checkbox);
      li.appendChild(span);
      li.appendChild(delBtn);
      shoppingList.appendChild(li);
    });
  }
}

function render() {
  renderCategoryNav();
  renderList();
}

// ─── Autocomplete ─────────────────────────────────────────────────────────────

let selectedSuggestionIndex = -1;

function openSuggestions(items) {
  suggestionsList.innerHTML = "";
  if (items.length === 0) {
    closeSuggestions();
    return;
  }
  items.forEach((name, idx) => {
    const li = document.createElement("li");
    li.textContent = name;
    li.setAttribute("role", "option");
    li.dataset.idx = idx;
    li.addEventListener("mousedown", e => {
      // mousedown fires before blur, so we can pick the value
      e.preventDefault();
      applySuggestion(name);
    });
    suggestionsList.appendChild(li);
  });
  suggestionsList.classList.add("open");
  itemInput.setAttribute("aria-expanded", "true");
  selectedSuggestionIndex = -1;
}

function closeSuggestions() {
  suggestionsList.classList.remove("open");
  suggestionsList.innerHTML = "";
  itemInput.setAttribute("aria-expanded", "false");
  selectedSuggestionIndex = -1;
}

function applySuggestion(name) {
  itemInput.value = name;
  closeSuggestions();
  itemInput.focus();
}

function highlightSuggestion(index) {
  const items = suggestionsList.querySelectorAll("li");
  items.forEach((li, i) => {
    li.setAttribute("aria-selected", i === index ? "true" : "false");
  });
  selectedSuggestionIndex = index;
}

itemInput.addEventListener("input", () => {
  const val = itemInput.value.trim();
  openSuggestions(getSuggestions(val));
});

itemInput.addEventListener("keydown", e => {
  const items = suggestionsList.querySelectorAll("li");
  if (!suggestionsList.classList.contains("open")) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    const next = Math.min(selectedSuggestionIndex + 1, items.length - 1);
    highlightSuggestion(next);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    const prev = Math.max(selectedSuggestionIndex - 1, -1);
    highlightSuggestion(prev);
  } else if (e.key === "Enter" && selectedSuggestionIndex >= 0) {
    e.preventDefault();
    applySuggestion(items[selectedSuggestionIndex].textContent);
  } else if (e.key === "Escape") {
    closeSuggestions();
  }
});

itemInput.addEventListener("blur", () => {
  // Small delay so mousedown on a suggestion fires first
  setTimeout(closeSuggestions, 150);
});

// ─── Actions ──────────────────────────────────────────────────────────────────

function selectCategory(id) {
  state.activeCategory = id;
  saveState();
  closeSuggestions();
  itemInput.value = "";
  render();
  itemInput.focus();
}

function addItem(name) {
  const trimmed = name.trim();
  if (!trimmed) return;

  // Avoid exact duplicates (case-insensitive) in the current list
  const exists = activeList().some(i => i.name.toLowerCase() === trimmed.toLowerCase());
  if (exists) {
    itemInput.select();
    return;
  }

  activeList().unshift({ id: uid(), name: trimmed, checked: false });
  recordHistory(trimmed);
  saveState();
  render();
}

function toggleItem(id) {
  const item = activeList().find(i => i.id === id);
  if (item) {
    item.checked = !item.checked;
    saveState();
    render();
  }
}

function deleteItem(id) {
  state.lists[state.activeCategory] = activeList().filter(i => i.id !== id);
  saveState();
  render();
}

function clearChecked() {
  state.lists[state.activeCategory] = activeList().filter(i => !i.checked);
  saveState();
  render();
}

function clearAll() {
  if (activeList().length === 0) return;
  if (!confirm(`Clear all items from the ${activeCategory().label} list?`)) return;
  state.lists[state.activeCategory] = [];
  saveState();
  render();
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

addForm.addEventListener("submit", e => {
  e.preventDefault();
  const val = itemInput.value.trim();
  if (!val) return;
  closeSuggestions();
  addItem(val);
  itemInput.value = "";
  itemInput.focus();
});

clearCheckedBtn.addEventListener("click", clearChecked);
clearAllBtn.addEventListener("click", clearAll);

// ─── Bootstrap ────────────────────────────────────────────────────────────────

render();
itemInput.focus();
