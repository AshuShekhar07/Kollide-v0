import { ChevronLeft, Sparkles } from 'lucide-react'
import StepHeader from '../../components/StepHeader'
import AboutEditor from '../../components/AboutEditor'
import { Button } from '../../components/ui'
import type { StepProps } from './Onboarding'

export default function AboutStep({ data, reload, onNext, onBack }: StepProps) {
  return (
    <div className="space-y-6">
      <StepHeader icon={Sparkles} title="About you">
        Help people get a feel for you before you meet. Answer up to 3 questions if you like.
      </StepHeader>
      <AboutEditor
        uid={data.profile.id}
        bio={data.profile.bio}
        submitLabel="Continue"
        onSaved={async () => {
          await reload()
          onNext()
        }}
        secondary={
          onBack && (
            <Button type="button" variant="secondary" onClick={onBack}>
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
          )
        }
      />
    </div>
  )
}
