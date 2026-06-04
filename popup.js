// @ts-check
// STORAGE_KEY and ORDER come from constants.js (loaded first in popup.html).

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
  render(/** @type {string} */ (stored[STORAGE_KEY] || ORDER.NEWEST));
}

for (const [order, btn] of Object.entries(buttons)) {
  btn?.addEventListener("click", () => {
    chrome.storage.local.set({ [STORAGE_KEY]: order });
    render(order);
  });
}

init();
