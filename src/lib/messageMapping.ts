import type { MessageNodeData } from '@/types/editor'
import type { BossMessageProps } from '@/components/game/BossMessage/BossMessage'

/**
 * Pure mapper: editor MessageNodeData → BossMessage props.
 * Used by both the editor (preview) and the game runtime.
 *
 * `onAdvance` is the action to take when the player interacts with
 * the message (clicks the link button, etc.). The editor passes
 * nothing here — preview is non-interactive.
 *
 * `onReplayVoice` is voice-specific: tapping the mic icon re-plays
 * the audio clip from the start instead of advancing. The flow
 * advances automatically when the audio finishes. Without this
 * callback the mic falls back to `onAdvance`.
 */
export function messageDataToBossProps(
  data: MessageNodeData,
  onAdvance?: () => void,
  onReplayVoice?: () => void,
): BossMessageProps {
  switch (data.messageType) {
    case 'voice':
      // The legacy `data.subtitle` field is intentionally NOT forwarded:
      // subtitles for voice messages now live only in the scheduled
      // bottom-of-desktop overlay (`data.subtitles`). The data field is
      // preserved on the node so nothing is lost.
      return {
        type: 'voice',
        onPlay: onReplayVoice ?? onAdvance,
        duration: data.voiceDuration,
      }
    case 'link':
      return {
        type: 'link',
        text: data.content,
        buttonLabel: data.buttonLabel || 'Open',
        onButtonClick: onAdvance,
      }
    case 'text':
    default:
      return { type: 'text', text: data.content }
  }
}
