import { Compass } from 'lucide-react'
import { LinkButton, EmptyState } from '../components/ui'

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4">
      <EmptyState
        icon={Compass}
        title="Page not found"
        action={
          <LinkButton to="/">
            Back to home
          </LinkButton>
        }
      >
        This path didn't collide with anything.
      </EmptyState>
    </main>
  )
}
