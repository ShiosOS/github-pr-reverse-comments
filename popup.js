// @ts-check
// STORAGE_KEY, ORDER, and normalizeOrder come from constants.js (loaded
// first in popup.html).

const buttons = {
  [ORDER.NEWEST]: document.getElementById("newest"),
  [ORDER.OLDEST]: document.getElementById("oldest"),
};

/** @param {string} order */
function render(order) {
  buttons[ORDER.NEWEST]?.classList.toggle("active", order === ORDER.NEWEST);
  buttons[ORDER.OLDEST]?.classList.toggle("active", order === ORDER.OLDEST);
}

async function init() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  render(normalizeOrder(stored[STORAGE_KEY]));
}

for (const [order, btn] of Object.entries(buttons)) {
  btn?.addEventListener("click", () => {
    chrome.storage.local.set({ [STORAGE_KEY]: order });
    render(order);
  });
}

// Keep the popup in step with the in-page toggle button: both write the
// same storage key, so a change from either side re-renders here.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[STORAGE_KEY]) return;
  render(normalizeOrder(changes[STORAGE_KEY].newValue));
});

init();
