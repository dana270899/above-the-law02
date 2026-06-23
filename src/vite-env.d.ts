/// <reference types="vite/client" />

declare module '*.module.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}

declare module '*?raw' {
  const content: string
  export default content
}

interface ImageDecoderInit {
  data: BufferSource
  type: string
}

interface ImageDecoderDecodeOptions {
  frameIndex?: number
}

interface ImageDecoderDecodeResult {
  image: VideoFrame
}

interface ImageDecoderTrack {
  frameCount: number
}

interface ImageDecoder {
  tracks: {
    ready: Promise<void>
    selectedTrack: ImageDecoderTrack | null
  }
  decode(options?: ImageDecoderDecodeOptions): Promise<ImageDecoderDecodeResult>
}

declare const ImageDecoder:
  | {
      new (init: ImageDecoderInit): ImageDecoder
    }
  | undefined
