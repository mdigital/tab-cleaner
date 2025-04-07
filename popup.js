// popup.js
document.addEventListener('DOMContentLoaded', () => {
  const tabContainer = document.getElementById('tabs');
  let draggedTabId = null;
  let sourceWindowId = null;

  function renderTabs() {
    // Clear existing content
    tabContainer.innerHTML = '';

    chrome.windows.getAll({ populate: true }, (windows) => {
      windows.forEach((window, windowIndex) => {
        // Add a heading for each window
        const windowHeader = document.createElement('h4');
        // Only add header and listeners if the window has tabs
        if (window.tabs && window.tabs.length > 0) {
          const windowHeader = document.createElement('h4');
          windowHeader.textContent = `Window ${windowIndex + 1}`;
          windowHeader.className = 'window-header';
          windowHeader.dataset.windowId = window.id; // Store windowId for drop targeting
          tabContainer.appendChild(windowHeader);

          // Add dragover/dragleave/drop listeners to window headers for dropping tabs into them
          addWindowDropListeners(windowHeader, window.id);

          // Iterate through tabs (we already know window.tabs exists and is not empty)
          window.tabs.forEach((tab, tabIndex) => {
            const div = document.createElement('div');
            div.className = 'tab-item';
            div.draggable = true; // Make the tab item draggable
            div.dataset.tabId = tab.id; // Store tabId
            div.dataset.windowId = window.id; // Store windowId
            div.dataset.index = tabIndex; // Store original index

            if (tab.active) {
              div.classList.add('active-tab');
            }

            // Drag and Drop Event Listeners for Tab Items
            div.addEventListener('dragstart', handleDragStart);
            div.addEventListener('dragend', handleDragEnd);
            div.addEventListener('dragover', handleDragOver);
            div.addEventListener('dragleave', handleDragLeave);
            div.addEventListener('drop', handleDrop);

            // --- Tab Content (Icon, Title, Close Button) ---
            if (tab.favIconUrl) {
              const icon = document.createElement('img');
              icon.src = tab.favIconUrl;
              icon.style.width = '16px';
              icon.style.height = '16px';
              icon.style.marginRight = '5px';
              icon.style.verticalAlign = 'middle';
              div.appendChild(icon);
            }

            const title = document.createElement('span');
            title.className = 'tab-title';
            title.textContent = tab.title || tab.url;
            div.appendChild(title);

            const closeBtn = document.createElement('button');
            closeBtn.textContent = 'X';
            closeBtn.addEventListener('click', (event) => {
              event.stopPropagation();
              const tabItem = event.target.closest('.tab-item');
              const windowId = tabItem.dataset.windowId;
              const container = tabItem.parentNode; // Assuming tabContainer

              chrome.tabs.remove(tab.id, () => {
                // Check if the tabItem is still in the DOM before removing
                if (tabItem && tabItem.parentNode === container) {
                    container.removeChild(tabItem);
                }

                // Check if the window section is now empty
                const remainingTabsInWindow = container.querySelectorAll(`.tab-item[data-window-id='${windowId}']`);
                if (remainingTabsInWindow.length === 0) {
                  const windowHeader = container.querySelector(`h4[data-window-id='${windowId}']`);
                  if (windowHeader) {
                    container.removeChild(windowHeader);
                  }
                }
              });
            });
            div.appendChild(closeBtn);

            // Click to switch tab
            div.addEventListener('click', () => {
              chrome.windows.update(window.id, { focused: true });
              chrome.tabs.update(tab.id, { active: true });
            });

            tabContainer.appendChild(div);
          });
        } // End of check for window.tabs.length > 0
      });
    });
  }

  // --- Drag and Drop Handlers ---

  function handleDragStart(e) {
    draggedTabId = parseInt(e.target.dataset.tabId);
    sourceWindowId = parseInt(e.target.dataset.windowId);
    e.dataTransfer.setData('text/plain', draggedTabId); // Necessary for Firefox
    e.target.classList.add('dragging');
    // console.log(`Drag Start: Tab ID ${draggedTabId} from Window ${sourceWindowId}`);
  }

  function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    // Clear any remaining drop indicators
    document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
    document.querySelectorAll('.window-drop-target').forEach(el => el.classList.remove('window-drop-target'));
    draggedTabId = null;
    sourceWindowId = null;
    // console.log("Drag End");
  }

  function handleDragOver(e) {
    e.preventDefault(); // Necessary to allow dropping
    const targetElement = e.target.closest('.tab-item');

    if (targetElement && parseInt(targetElement.dataset.tabId) !== draggedTabId) {
       // Clear previous indicators
       document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
       targetElement.classList.add('drop-target'); // Highlight the tab being hovered over
    }
     // Prevent highlighting the dragged element itself or if no valid target
     else if (!targetElement) {
        document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
     }
  }

 function handleDragLeave(e) {
    // Only remove indicator if leaving the specific element
    const targetElement = e.target.closest('.tab-item');
    if (targetElement) {
        targetElement.classList.remove('drop-target');
    }
 }


  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation(); // Prevent drop from bubbling to window header if nested

    const targetElement = e.target.closest('.tab-item');
    document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target')); // Clean up indicator

    if (targetElement && draggedTabId) {
      const targetTabId = parseInt(targetElement.dataset.tabId);
      const targetWindowId = parseInt(targetElement.dataset.windowId);
      let targetIndex = parseInt(targetElement.dataset.index);

      // Don't drop onto itself
      if (targetTabId === draggedTabId) return;

      // If moving within the same window, adjust index if moving downwards
      if (sourceWindowId === targetWindowId) {
          const sourceIndex = parseInt(document.querySelector(`.tab-item[data-tab-id='${draggedTabId}']`).dataset.index);
          if (sourceIndex < targetIndex) {
             // No index adjustment needed when moving down in the same window with targetIndex logic
          }
      }

      // console.log(`Drop: Moving Tab ${draggedTabId} to Window ${targetWindowId} at Index ${targetIndex}`);
      chrome.tabs.move(draggedTabId, { windowId: targetWindowId, index: targetIndex }, () => {
        // Refresh the list after successful move
        renderTabs();
      });
    }
    // If drop happens not on a tab-item, it might be handled by window header drop listener
  }

  // Add listeners specifically for window headers
  function addWindowDropListeners(headerElement, windowId) {
      headerElement.addEventListener('dragover', (e) => {
          e.preventDefault(); // Allow drop
          e.stopPropagation();
          // Highlight header as potential drop zone (if not already dragging over a tab)
          if (!document.querySelector('.drop-target')) {
             document.querySelectorAll('.window-drop-target').forEach(el => el.classList.remove('window-drop-target')); // Clear others
             headerElement.classList.add('window-drop-target');
          }
      });

      headerElement.addEventListener('dragleave', (e) => {
          e.stopPropagation();
          headerElement.classList.remove('window-drop-target');
      });

      headerElement.addEventListener('drop', (e) => {
          e.preventDefault();
          e.stopPropagation();
          headerElement.classList.remove('window-drop-target'); // Clean up indicator

          if (draggedTabId) {
              const targetWindowId = parseInt(headerElement.dataset.windowId);
              const targetIndex = -1; // Append to the end of the target window

              // console.log(`Drop on Header: Moving Tab ${draggedTabId} to Window ${targetWindowId} at Index ${targetIndex}`);
              chrome.tabs.move(draggedTabId, { windowId: targetWindowId, index: targetIndex }, () => {
                  renderTabs(); // Refresh list
              });
          }
      });
  }

  // Initial rendering
  renderTabs();
});
