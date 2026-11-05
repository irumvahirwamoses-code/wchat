import { useEffect } from 'react'

// Serve the static homepage.html as the landing page (client/homepage.html -> client/public/homepage.html).
export default function LandingPage() {
  useEffect(() => {
    window.location.replace('/homepage.html')
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground text-sm">
      Loading…
    </div>
  )
}
