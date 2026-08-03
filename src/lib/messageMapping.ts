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
 */
export function messageDataToBossProps(
  data: MessageNodeData,
  onAdvance?: () => void,
  resolvedPhotoUrl?: string,
): BossMessageProps {
  const photoUrl = resolvedPhotoUrl || data.photoUrl || undefined
  switch (data.messageType) {
    case 'photo':
      return {
        type: 'photo',
        text: data.content || undefined,
        photoUrl,
        buttonLabel: data.buttonLabel || 'Open',
        onButtonClick: onAdvance,
      }
    case 'voice':
      // The legacy `data.subtitle` field is intentionally NOT forwarded:
      // subtitles for voice messages now live only in the scheduled
      // bottom-of-desktop overlay (`data.subtitles`). The data field is
      // preserved on the node so nothing is lost.
      return {
        type: 'voice',
        duration: data.voiceDuration,
        photoUrl,
      }
    case 'link':
      return {
        type: 'link',
        text: data.content,
        buttonLabel: data.buttonLabel || 'Open',
        onButtonClick: onAdvance,
        photoUrl,
      }
    case 'text':
    default:
      return { type: 'text', text: data.content, photoUrl }
  }
}
