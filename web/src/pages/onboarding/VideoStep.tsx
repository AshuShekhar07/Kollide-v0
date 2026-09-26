import { useEffect, useRef, useState } from 'react'
import { Button, ErrorText } from '../../components/ui'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import type { StepProps } from './Onboarding'

// Prompts run on a fixed timeline. Stopping is allowed once the last head
// turn has been shown (7.5s, above the required 5s minimum); recording
// auto-stops at 10s.
const PROMPTS = [
  { at: 0, text: 'Look straight at the camera' },
  { at: 2500, text: 'Slowly turn your head to the left' },
  { at: 5000, text: 'Now slowly turn to the right' },
  { at: 7500, text: 'Great, look back at the camera' },
]
const MIN_MS = 7500
const MAX_MS = 10000
const MAX_VIDEOS = 2

type Phase = 'intro' | 'camera' | 'recording' | 'preview' | 'uploading'

function pickMimeType(): string | undefined {
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
  return candidates.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t))
}

function cameraError(e: unknown): string {
  const name = (e as { name?: string })?.name
  if (name === 'NotAllowedError') return 'Camera access was blocked. Allow camera access for this site in your browser settings, then try again.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return "We couldn't find a front camera on this device."
  if (name === 'NotReadableError') return 'Your camera is being used by another app. Close it and try again.'
  return "We couldn't start your camera. Try a different browser, like Chrome or Safari."
}

export default function VideoStep({ data, reload }: StepProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [elapsed, setElapsed] = useState(0)
  const [recording, setRecording] = useState<{ blob: Blob; url: string; mime: string } | null>(null)
  const [error, setError] = useState('')

  const liveVideo = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const startedAt = useRef(0)
  const timer = useRef<number | null>(null)

  const latest = data.videos[0]
  const rejected = data.profile.verification_status === 'rejected'
  const outOfAttempts = data.videos.length >= MAX_VIDEOS

  function stopCamera() {
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
  }

  function clearTimer() {
    if (timer.current !== null) window.clearInterval(timer.current)
    timer.current = null
  }

  useEffect(
    () => () => {
      clearTimer()
      stopCamera()
    },
    [],
  )

  useEffect(() => () => {
    if (recording) URL.revokeObjectURL(recording.url)
  }, [recording])

  async function openCamera() {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia || !pickMimeType()) {
      return setError("Your browser can't record video. Please use an up-to-date Chrome or Safari.")
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      setPhase('camera')
    } catch (e) {
      setError(cameraError(e))
    }
  }

  // Attach the stream once the <video> element is on screen.
  useEffect(() => {
    if ((phase === 'camera' || phase === 'recording') && liveVideo.current && stream.current) {
      liveVideo.current.srcObject = stream.current
      liveVideo.current.play().catch(() => {})
    }
  }, [phase])

  function startRecording() {
    if (!stream.current) return
    const mime = pickMimeType()!
    const chunks: Blob[] = []
    const rec = new MediaRecorder(stream.current, { mimeType: mime, videoBitsPerSecond: 1_000_000 })
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    rec.onstop = () => {
      clearTimer()
      const duration = Date.now() - startedAt.current
      stopCamera()
      if (duration < MIN_MS - 250) {
        setPhase('intro')
        return setError('That recording was too short. Please follow all the prompts.')
      }
      const baseMime = mime.split(';')[0]
      const blob = new Blob(chunks, { type: baseMime })
      setRecording({ blob, url: URL.createObjectURL(blob), mime: baseMime })
      setPhase('preview')
    }
    recorder.current = rec
    startedAt.current = Date.now()
    setElapsed(0)
    rec.start(250)
    setPhase('recording')
    timer.current = window.setInterval(() => {
      const ms = Date.now() - startedAt.current
      setElapsed(ms)
      if (ms >= MAX_MS && rec.state === 'recording') rec.stop()
    }, 100)
  }

  function stopRecording() {
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }

  function retake() {
    setRecording(null)
    setPhase('intro')
  }

  async function submit() {
    if (!recording) return
    setError('')
    setPhase('uploading')
    const ext = recording.mime === 'video/mp4' ? 'mp4' : 'webm'
    const path = `${data.profile.id}/${crypto.randomUUID()}.${ext}`
    const up = await supabase.storage
      .from('verification-videos')
      .upload(path, recording.blob, { contentType: recording.mime })
    if (up.error) {
      setPhase('preview')
      return setError('Upload failed. Check your connection and try again.')
    }
    const { error } = await supabase.rpc('submit_verification', { p_storage_path: path })
    if (error) {
      setPhase('preview')
      return setError(friendlyError(error))
    }
    // Profile is now `pending`; the onboarding route redirects into the app.
    await reload()
  }

  if (rejected && outOfAttempts) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-neutral-900">We couldn't verify your profile</h1>
        {latest?.reject_reason && <p className="text-neutral-700">Reason: {latest.reject_reason}</p>}
        <p className="text-neutral-600">
          You've used your one resubmission. If you think this is a mistake, reply to the email we sent you.
        </p>
      </div>
    )
  }

  const prompt = [...PROMPTS].reverse().find((p) => elapsed >= p.at)?.text ?? PROMPTS[0].text
  const secondsLeft = Math.max(0, Math.ceil((MAX_MS - elapsed) / 1000))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">
          {rejected ? 'Record a new verification video' : 'Verify it’s really you'}
        </h1>
        {rejected && latest?.reject_reason && (
          <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Your last video wasn't approved: {latest.reject_reason}. You can try once more.
          </p>
        )}
        <p className="mt-1 text-neutral-600">
          Record a 10-second selfie video. Our team checks it against your photos, usually within 24 hours. It's
          deleted 48 hours after approval and never shown on your profile.
        </p>
      </div>

      {phase === 'intro' && (
        <>
          <ol className="space-y-2 rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-700">
            <li>1. Find good light and remove sunglasses or masks.</li>
            <li>2. Hold your phone at face height.</li>
            <li>3. Follow the prompts: look straight, turn left, turn right.</li>
          </ol>
          <Button className="w-full" onClick={openCamera}>
            Open camera
          </Button>
        </>
      )}

      {(phase === 'camera' || phase === 'recording') && (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-3xl bg-black">
            <video ref={liveVideo} muted playsInline className="aspect-[3/4] w-full -scale-x-100 object-cover" />
            {phase === 'recording' && (
              <>
                <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3 text-white">
                  <span className="flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-sm">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" /> REC
                  </span>
                  <span className="rounded-full bg-black/50 px-3 py-1 font-mono text-sm">{secondsLeft}s</span>
                </div>
                <p className="absolute inset-x-3 bottom-3 rounded-2xl bg-black/60 px-4 py-3 text-center text-lg font-semibold text-white" aria-live="assertive">
                  {prompt}
                </p>
              </>
            )}
          </div>
          {phase === 'camera' ? (
            <Button className="w-full" onClick={startRecording}>
              Start recording
            </Button>
          ) : (
            <Button className="w-full" variant="secondary" onClick={stopRecording} disabled={elapsed < MIN_MS}>
              {elapsed < MIN_MS ? 'Keep following the prompts…' : 'Stop recording'}
            </Button>
          )}
        </div>
      )}

      {(phase === 'preview' || phase === 'uploading') && recording && (
        <div className="space-y-4">
          <video src={recording.url} controls playsInline className="aspect-[3/4] w-full rounded-3xl bg-black object-cover" />
          <p className="text-sm text-neutral-600">Check that your face is clearly visible throughout.</p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={retake} disabled={phase === 'uploading'}>
              Retake
            </Button>
            <Button className="flex-1" onClick={submit} loading={phase === 'uploading'}>
              Submit for review
            </Button>
          </div>
        </div>
      )}

      <ErrorText>{error}</ErrorText>
    </div>
  )
}
