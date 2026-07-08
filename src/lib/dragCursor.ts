let activeDragCursorLocks = 0

export function startDragCursor() {
  activeDragCursorLocks += 1
  document.documentElement.dataset.dragCursor = 'true'
}

export function stopDragCursor() {
  activeDragCursorLocks = Math.max(0, activeDragCursorLocks - 1)
  if (activeDragCursorLocks === 0) {
    delete document.documentElement.dataset.dragCursor
  }
}

