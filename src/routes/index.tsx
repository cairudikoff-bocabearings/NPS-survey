import { createFileRoute } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { MessageCircleHeart, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Share your feedback' },
      {
        name: 'description',
        content: "Tell us how we're doing — it takes less than a minute.",
      },
      { property: 'og:title', content: 'Share your feedback' },
      {
        property: 'og:description',
        content: "Tell us how we're doing — it takes less than a minute.",
      },
    ],
  }),
  component: Index,
})

function Index() {
  const [score, setScore] = useState<number | null>(null)
  const [text, setText] = useState('')
  const [done, setDone] = useState(false)

  const submit = useMutation({
    mutationFn: async () => {
      if (score === null) throw new Error('Please select a score from 1 to 10.')
      const { error } = await supabase
        .from('feedback_responses')
        .insert({ nps_score: score, feedback_text: text.trim() })
      if (error) throw error
    },
    onSuccess: () => {
      setDone(true)
      toast.success('Thank you for your feedback!')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (done) {
    return (
      <main
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'var(--gradient-soft)' }}
      >
        <div
          className="max-w-md w-full text-center bg-card rounded-3xl p-10"
          style={{ boxShadow: 'var(--shadow-soft)' }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: 'var(--gradient-sky)' }}
          >
            <CheckCircle2 className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-3">
            Thanks so much!
          </h1>
          <p className="text-muted-foreground mb-8">
            Your feedback helps us get better every day.
          </p>
          <Button
            variant="ghost"
            onClick={() => {
              setDone(false)
              setScore(null)
              setText('')
            }}
          >
            Submit another response
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main
      className="min-h-screen px-4 py-12 md:py-20"
      style={{ background: 'var(--gradient-soft)' }}
    >
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <MessageCircleHeart className="h-5 w-5 text-primary" />
          <span className="font-medium tracking-wide uppercase text-xs">
            Customer Feedback
          </span>
        </div>

        <div
          className="bg-card rounded-3xl p-8 md:p-12"
          style={{ boxShadow: 'var(--shadow-soft)' }}
        >
          <h1 className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
            How likely are you to recommend us?
          </h1>
          <p className="mt-3 text-muted-foreground">
            On a scale of 1 to 10, where 10 means you'd absolutely recommend us
            to a friend.
          </p>

          <div className="mt-8">
            <div className="grid grid-cols-10 gap-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                const isSelected = score === n
                return (
                  <button
                    key={n}
                    onClick={() => setScore(n)}
                    className={[
                      'aspect-square rounded-xl text-sm md:text-base font-medium transition-all border',
                      isSelected
                        ? 'border-transparent text-primary-foreground scale-105'
                        : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-secondary',
                    ].join(' ')}
                    style={
                      isSelected
                        ? {
                            background: 'var(--gradient-sky)',
                            boxShadow: 'var(--shadow-card)',
                          }
                        : undefined
                    }
                  >
                    {n}
                  </button>
                )
              })}
            </div>
            <div className="grid grid-cols-10 gap-2 mt-2">
              <span className="col-span-3 text-xs text-muted-foreground">
                Not at all likely
              </span>
              <span className="col-span-4" />
              <span className="col-span-3 text-xs text-muted-foreground text-right">
                Very likely
              </span>
            </div>
          </div>

          <div className="mt-8 space-y-2">
            <Label htmlFor="feedback" className="text-base">
              Anything you'd like to share?
            </Label>
            <Textarea
              id="feedback"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              placeholder="Tell us what's working, what isn't, or what you'd love to see..."
              className="min-h-32 rounded-xl resize-none"
            />
            <p className="text-right text-xs text-muted-foreground">
              {text.length}/2000
            </p>
          </div>

          <Button
            onClick={() => submit.mutate()}
            disabled={submit.isPending || score === null}
            className="mt-6 w-full h-12 rounded-xl text-base font-medium text-primary-foreground border-0"
            style={{
              background: 'var(--gradient-sky)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            {submit.isPending ? 'Sending...' : 'Send feedback'}
          </Button>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Your response is anonymous and helps shape what we build next.
          </p>
        </div>
      </div>
    </main>
  )
}
