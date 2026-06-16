import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useMemo, useState } from 'react'
import { Inbox, TrendingUp, MessageSquare, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { listFeedbackResponses } from '@/lib/feedback.functions'

export const Route = createFileRoute('/admin')({
  head: () => ({ meta: [{ title: 'Feedback dashboard' }] }),
  component: AdminPage,
})

type FilterType = 'all' | 'promoter' | 'passive' | 'detractor'
type SortType = 'newest' | 'oldest' | 'score-desc' | 'score-asc'

function scoreCategory(score: number) {
  if (score >= 9)
    return {
      label: 'Promoter',
      className: 'bg-primary/10 text-primary border-primary/20',
    }
  if (score >= 7)
    return {
      label: 'Passive',
      className: 'bg-secondary text-secondary-foreground',
    }
  return { label: 'Detractor', className: 'bg-destructive/10 text-destructive' }
}

function AdminPage() {
  const [filter, setFilter] = useState<FilterType>('all')
  const [sort, setSort] = useState<SortType>('newest')

  const fetchResponses = useServerFn(listFeedbackResponses)
  const { data, isLoading, error } = useQuery({
    queryKey: ['feedback-responses'],
    queryFn: () => fetchResponses(),
  })
  const responses = data?.responses ?? []

  const total = responses.length
  const avg =
    total > 0
      ? (responses.reduce((sum, r) => sum + r.nps_score, 0) / total).toFixed(1)
      : '—'
  const promoters = responses.filter((r) => r.nps_score >= 9).length
  const detractors = responses.filter((r) => r.nps_score <= 6).length
  const nps =
    total > 0 ? Math.round(((promoters - detractors) / total) * 100) : '—'

  const visible = useMemo(() => {
    let result = [...responses]
    if (filter === 'promoter') result = result.filter((r) => r.nps_score >= 9)
    else if (filter === 'passive')
      result = result.filter((r) => r.nps_score >= 7 && r.nps_score <= 8)
    else if (filter === 'detractor')
      result = result.filter((r) => r.nps_score <= 6)

    if (sort === 'newest')
      result.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    else if (sort === 'oldest')
      result.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    else if (sort === 'score-desc')
      result.sort((a, b) => b.nps_score - a.nps_score)
    else if (sort === 'score-asc')
      result.sort((a, b) => a.nps_score - b.nps_score)

    return result
  }, [responses, filter, sort])

  const stats = [
    { icon: Inbox, label: 'Total responses', value: String(total) },
    { icon: TrendingUp, label: 'Average score', value: String(avg) },
    { icon: MessageSquare, label: 'NPS', value: String(nps) },
  ]

  return (
    <main
      className="min-h-screen"
      style={{ background: 'var(--gradient-soft)' }}
    >
      <div className="border-b border-border bg-card/60 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              Feedback dashboard
            </h1>
            <p className="text-xs text-muted-foreground">All survey responses</p>
          </div>
          <Button variant="ghost" asChild>
            <Link to="/">
              <ExternalLink className="h-4 w-4" />
              View survey
            </Link>
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="bg-card rounded-2xl p-5 flex items-center gap-4"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <div
                className="h-11 w-11 rounded-xl flex items-center justify-center text-primary-foreground shrink-0"
                style={{ background: 'var(--gradient-sky)' }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  {label}
                </p>
                <p className="text-2xl font-semibold text-foreground">{value}</p>
              </div>
            </div>
          ))}
        </div>

        <div
          className="bg-card rounded-2xl overflow-hidden"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground text-sm">
                Submission log
              </span>
              <span className="text-muted-foreground text-sm font-normal">
                ({visible.length})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={filter}
                onValueChange={(v) => setFilter(v as FilterType)}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="promoter">Promoters (9–10)</SelectItem>
                  <SelectItem value="passive">Passives (7–8)</SelectItem>
                  <SelectItem value="detractor">Detractors (1–6)</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={sort}
                onValueChange={(v) => setSort(v as SortType)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="score-desc">Score: high to low</SelectItem>
                  <SelectItem value="score-asc">Score: low to high</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <p className="p-10 text-center text-muted-foreground">
              Loading responses...
            </p>
          ) : error ? (
            <p className="p-10 text-center text-destructive">
              Failed to load responses.
            </p>
          ) : visible.length === 0 ? (
            <div className="p-10 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                {responses.length === 0
                  ? 'No feedback yet. Share your survey link to start collecting responses.'
                  : 'No responses match the selected filter.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Submitted</TableHead>
                  <TableHead className="w-20">Score</TableHead>
                  <TableHead className="w-28">Type</TableHead>
                  <TableHead>Feedback</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((r) => {
                  const cat = scoreCategory(r.nps_score)
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">
                        {r.nps_score}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cat.className}>
                          {cat.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {r.feedback_text.trim() ? (
                          <span className="text-sm text-foreground max-w-xl block">
                            {r.feedback_text}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">
                            No comment
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </main>
  )
}
