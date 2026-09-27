import AboutEditor from '../../components/AboutEditor'
import { Button } from '../../components/ui'
import type { StepProps } from './Onboarding'

export default function AboutStep({ data, reload, onNext, onBack }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">About you</h1>
        <p className="mt-1 text-neutral-600">
          Help people get a feel for you before you meet. Answer up to 3 questions if you like.
        </p>
      </div>
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
              Back
            </Button>
          )
        }
      />
    </div>
  )
}
