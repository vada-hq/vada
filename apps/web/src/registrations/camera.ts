export type CameraProblem = 'denied' | 'unsupported' | 'failed'
export class CameraError extends Error {
  constructor(readonly problem: CameraProblem) {
    super(`Camera ${problem}`)
  }
}

// 뒤쪽 카메라를 고르고 소리는 받지 않는다. 브라우저는 https(또는 localhost)에서만 카메라를 준다.
export async function openCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new CameraError('unsupported')
  try {
    return await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
  } catch (error) {
    const name = typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : ''
    throw new CameraError(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'failed')
  }
}
export const stopCamera = (stream: MediaStream) => { for (const track of stream.getTracks()) track.stop() }
