export type MiniGameResult = {
  score: number
  started: boolean
}

export type MiniGameTestProps = {
  onClose: (result: MiniGameResult) => void
  onContinue?: (result: MiniGameResult) => void
  onMinimizeChange?: (minimized: boolean) => void
  minimized?: boolean
  draggable?: boolean
}
