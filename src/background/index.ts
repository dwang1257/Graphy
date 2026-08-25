/** The toolbar button toggles the panel in the active LeetCode tab. */
chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) return;
  chrome.tabs.sendMessage(tab.id, { type: "graphy:toggle" }).catch(() => {
    // No content script on this tab - nothing to toggle.
  });
});
