import {
  InteractiveWinScreen,
  type HotspotArea,
} from './InteractiveWinScreen'

/* ═══════════════════════════════════════════════
   GRAFFITI win screen.

   Player drags inside the hotspot to "spray" the wall;
   that triggers the reaction media (gif or video).

   TODO — fill in the real values once the asset files
   land:
     - HOTSPOT: the rectangle the player drags over,
       expressed as percentages of the background.
     - MEDIA_SRC: path to the gif/video that plays on
       interaction (drop the file under
       `public/images/win-screens/interactions/`).
     - MEDIA_KIND: 'image' for a gif, 'video' for a
       webm/mp4. Keep `undefined` to skip media until
       the file is in place.
════════════════════════════════════════════════ */

const HOTSPOT: HotspotArea = {
  x: 30,
  y: 30,
  width: 40,
  height: 40,
}

const MEDIA_SRC: string | undefined = undefined
const MEDIA_KIND: 'image' | 'video' = 'image'

export interface GraffitiProps {
  className?: string
  /** Background image override — kept for the legacy per-node data URL. */
  src?: string
  /** IndexedDB blob id for a per-node uploaded background. */
  blobId?: string
  /** Fires after the reaction finishes (or immediately when no media
   *  is configured yet). */
  onComplete?: () => void
  /** Outline the hotspot — useful while tuning coordinates. */
  debug?: boolean
}

export function Graffiti(props: GraffitiProps = {}) {
  return (
    <InteractiveWinScreen
      variant="graffiti"
      interaction={{ kind: 'drag', area: HOTSPOT }}
      mediaSrc={MEDIA_SRC}
      mediaKind={MEDIA_KIND}
      {...props}
    />
  )
}
