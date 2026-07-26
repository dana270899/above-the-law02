export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: { facingMode: 'user' },
  audio: false,
}

export type CameraFailure =
  | 'unsupported'
  | 'insecure'
  | 'denied'
  | 'missing'
  | 'busy'
  | 'unavailable'

export class CameraAccessError extends Error {
  constructor(public readonly reason: CameraFailure, message: string) {
    super(message)
    this.name = 'CameraAccessError'
  }
}

export async function requestCameraStream(): Promise<MediaStream> {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    throw new CameraAccessError(
      'insecure',
      'Camera access requires HTTPS or a localhost address.',
    )
  }

  const mediaDevices = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined
  if (!mediaDevices?.getUserMedia) {
    throw new CameraAccessError(
      'unsupported',
      'This browser does not support camera access.',
    )
  }

  try {
    return await mediaDevices.getUserMedia(CAMERA_CONSTRAINTS)
  } catch (error) {
    const name = error instanceof DOMException ? error.name : ''
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new CameraAccessError(
        'denied',
        'Camera access was blocked. Use the site controls beside the address bar to allow the camera, then try again.',
      )
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      throw new CameraAccessError(
        'missing',
        'No camera was found. Connect the exhibition camera, then try again.',
      )
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      throw new CameraAccessError(
        'busy',
        'The camera is unavailable or being used by another application. Close other camera apps, then try again.',
      )
    }
    throw new CameraAccessError(
      'unavailable',
      'The camera could not be started. Check the connection and system camera settings, then try again.',
    )
  }
}

export function stopCameraStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop())
}
