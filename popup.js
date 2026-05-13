const STORAGE_KEY = "prCommentOrder";

const buttons = {
  newest: document.getElementById("newest"),
  oldest: document.getElementById("oldest"),
};

function render(order) {
  buttons.newest.classList.toggle("active", order === "newest");
  buttons.oldest.classList.toggle("active", order === "oldest");
}

async function init() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  render(stored[STORAGE_KEY] || "newest");
}

for (const [order, btn] of Object.entries(buttons)) {
  btn.addEventListener("click", () => {
    chrome.storage.local.set({ [STORAGE_KEY]: order });
    render(order);
  });
}

init();
