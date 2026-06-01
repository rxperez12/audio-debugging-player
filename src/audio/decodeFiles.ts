/**
 * Web Audio decode helpers for the audio debugging player.
 *
 * decodeAudioData needs a full ArrayBuffer (not a MediaElement / object URL),
 * so audio files are read via FileReader.readAsArrayBuffer and decoded into
 * AudioBuffers that the SessionPlayer can schedule sample-accurately.
 *
 * .m4a (AAC, user track) and .wav (PCM16, AI track) both decode natively in
 * Chrome / Safari / Edge.
 */

let sharedCtx: AudioContext | null = null;

/** Returns a lazily-created shared AudioContext for the whole app. */
export function getAudioContext(): AudioContext {
  if (!sharedCtx) {
    sharedCtx = new AudioContext();
  }
  return sharedCtx;
}

/** Read a File into an ArrayBuffer. */
export function readArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/** Read + decode an audio File into an AudioBuffer. */
export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  const arrayBuffer = await readArrayBuffer(file);
  // decodeAudioData detaches the buffer; pass a copy so it can be reused if needed.
  return ctx.decodeAudioData(arrayBuffer.slice(0));
}
