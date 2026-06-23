import {
  InteractiveWinScreen,
  type HotspotArea,
} from './InteractiveWinScreen'

/* ═══════════════════════════════════════════════
   KIPPAH CUTTING win screen.

   Player drags scissors across the hotspot to "cut";
   that triggers the reaction media (gif or video).

   TODO — fill in the real values once the asset
   files land. Same fields as Graffiti.tsx.
════════════════════════════════════════════════ */

const HOTSPOT: HotspotArea = {
  x: 30,
  y: 40,
  width: 40,
  height: 25,
}

const MEDIA_SRC: string | undefined = undefined
const MEDIA_KIND: 'image' | 'video' = 'image'

export interface KippahCuttingProps {
  className?: string
  src?: string
  blobId?: string
  onComplete?: () => void
  debug?: boolean
}

export function KippahCutting(props: KippahCuttingProps = {}) {
  return (
    <InteractiveWinScreen
      variant="kippah-cutting"
      interaction={{ kind: 'drag', area: HOTSPOT }}
      mediaSrc={MEDIA_SRC}
      mediaKind={MEDIA_KIND}
      {...props}
    />
  )
}
