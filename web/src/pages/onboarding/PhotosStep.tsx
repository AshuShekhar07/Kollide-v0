import { Camera, ChevronLeft } from 'lucide-react'
import StepHeader from '../../components/StepHeader'
import { useState } from 'react'
import PhotoEditor, { MAX_PHOTOS, MIN_PHOTOS } from '../../components/PhotoEditor'
import { Button } from '../../components/ui'
import type { StepProps } from './Onboarding'

export default function PhotosStep({ data, reload, onNext, onBack }: StepProps) {
  const photos = data.photos
  const [busy, setBusy] = useState(false)

  return (
    <div className="space-y-6">
      <StepHeader icon={Camera} title="Add your photos">
        Add {MIN_PHOTOS}–{MAX_PHOTOS} clear photos of yourself. The first one is your main photo. Our team compares
          them with your verification video.
      </StepHeader>

      <PhotoEditor uid={data.profile.id} photos={photos} reload={reload} onBusyChange={setBusy} />

      <div className="flex gap-3">
        {onBack && (
          <Button variant="secondary" onClick={onBack} disabled={busy}>
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
        )}
        <Button className="flex-1" onClick={onNext} disabled={photos.length < MIN_PHOTOS || busy}>
          {photos.length < MIN_PHOTOS ? `Add ${MIN_PHOTOS - photos.length} more` : 'Continue'}
        </Button>
      </div>
    </div>
  )
}
