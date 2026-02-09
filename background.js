
chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: () => {
      // confirm we are running
      console.log("Focus Reader triggered");
      // dispatch a custom event or call a function attached to window if avoiding message passing complexity
      window.postMessage({ type: "FOCUS_READER_TOGGLE" }, "*");
    }
  });
});
