/**
 * Audio recording, and the codec negotiation Safari forces on us.
 *
 * MediaRecorder's `mimeType` is not a request, it is a demand: pass a type the
 * browser cannot produce and the constructor throws. The types differ by
 * browser and, on Safari, by OS version -- WebM/Opus only arrived in 18.4, and
 * before that Safari records MP4/AAC and nothing else.
 *
 * So we ask the browser what it can do rather than assuming, in preference
 * order, and keep whatever it actually chose. The mime type is stored with the
 * recording because the transcription provider needs to be told what it is
 * being handed, and guessing wrong there means a 400 from a provider that will
 * not say why.
 */
const PREFERRED = [
  "audio/webm;codecs=opus",  // Chrome, Firefox, Safari 18.4+
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",  // Safari before 18.4
  "audio/mp4",
  "audio/ogg;codecs=opus",   // older Firefox
];

export type RecorderHandle = {
  stop(): Promise<{ blob: Blob; mimeType: string; durationMs: number }>;
  cancel(): void;
  readonly mimeType: string;
};

export function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return PREFERRED.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

export function canRecord(): boolean {
  return typeof MediaRecorder !== "undefined"
    && typeof navigator !== "undefined"
    && Boolean(navigator.mediaDevices?.getUserMedia)
    && pickMimeType() !== null;
}

export async function startRecording(): Promise<RecorderHandle> {
  const mimeType = pickMimeType();
  if (!mimeType) throw new Error("This browser cannot record audio.");

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      // Speech, not music. These are the difference between a usable recording
      // of a meeting and forty minutes of room tone with words somewhere in it.
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: Blob[] = [];
  const startedAt = Date.now();

  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  // A timeslice, so a crash mid-recording loses seconds rather than the whole
  // thing. Nothing uploads per chunk yet -- that is the next step for long
  // recordings -- but the data is at least in hand.
  recorder.start(5000);

  const release = () => {
    for (const track of stream.getTracks()) track.stop();
  };

  return {
    mimeType,

    stop() {
      return new Promise((resolve, reject) => {
        recorder.onerror = (e) => { release(); reject(e); };
        recorder.onstop = () => {
          release();
          // The recorder's own type, not our preferred one: what it produced is
          // the fact, and what we asked for is only a hope.
          const type = recorder.mimeType || mimeType;
          resolve({
            blob: new Blob(chunks, { type }),
            mimeType: type.split(";")[0]!.trim(),
            durationMs: Date.now() - startedAt,
          });
        };
        recorder.stop();
      });
    },

    cancel() {
      try { recorder.stop(); } catch { /* already stopped */ }
      release();
    },
  };
}
