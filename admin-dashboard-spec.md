# Customer Feedback App — Technical Specification

A two-page web app that collects NPS (Net Promoter Score) survey responses from anonymous visitors and surfaces them in a read-only analytics dashboard.

- **Survey page** (`/`) — public form; writes to the database.
- **Admin dashboard** (`/admin`) — public read-only dashboard; reads from the database.

Both pages share the same data store, design tokens, and component library. A developer should be able to rebuild the entire app from this document.

---

## 1. Stack & Conventions

| Layer            | Choice                                                              |
|------------------|---------------------------------------------------------------------|
| Framework        | TanStack Start v1 (React 19, Vite 7), file-based routing            |
| Data fetching    | TanStack Query (`useQuery`, `useMutation`)                          |
| RPC              | `createServerFn` from `@tanstack/react-start`                       |
| Database / Auth  | Supabase (Lovable Cloud)                                            |
| Styling          | Tailwind CSS v4 via `@import "tailwindcss"` in `src/styles.css`     |
| Components       | shadcn/ui (`Button`, `Textarea`, `Label`, `Table*`, `Badge`, `Select*`) |
| Icons            | `lucide-react`                                                      |
| Toasts           | `sonner`                                                            |
| Utilities        | `cn` from `src/lib/utils.ts`                                        |

**Rules followed throughout:**
- Never hard-code colors; only semantic Tailwind tokens (`bg-card`, `text-foreground`, etc.) or CSS variables (`var(--gradient-sky)`).
- All gradients and shadows come from CSS custom properties in `src/styles.css`.
- Server-only modules (`client.server.ts`) are dynamically imported *inside* server-function handlers to keep them out of client bundles.

---

## 2. Data Model

### Table: `public.feedback_responses`

| Column          | Type                          | Constraints / Default              |
|-----------------|-------------------------------|------------------------------------|
| `id`            | `uuid`                        | PK, `default gen_random_uuid()`    |
| `nps_score`     | `integer`                     | NOT NULL; app enforces 1–10        |
| `feedback_text` | `text`                        | NOT NULL, `default ''`; max 2000   |
| `created_at`    | `timestamp with time zone`    | NOT NULL, `default now()`          |

### RLS policies
- **INSERT** — `Anyone can submit feedback` → roles `{anon, authenticated}`; check `nps_score BETWEEN 1 AND 10 AND char_length(coalesce(feedback_text,'')) <= 2000`.
- **SELECT** — `Authenticated users can view all responses` → roles `{authenticated}`; using `true`.
- **UPDATE / DELETE** — denied (no policies).

### GRANTs (must accompany CREATE TABLE)
```sql
GRANT INSERT ON public.feedback_responses TO anon, authenticated;
GRANT SELECT ON public.feedback_responses TO authenticated;
GRANT ALL    ON public.feedback_responses TO service_role;
```

The admin page is currently public and bypasses the SELECT policy by reading through a server function backed by the service-role client.

---

## 3. File Map

```
src/
├── lib/
│   ├── utils.ts                       # cn() helper
│   └── feedback.functions.ts          # listFeedbackResponses server fn
├── integrations/supabase/
│   ├── client.ts                      # browser client (publishable key)
│   └── client.server.ts               # service-role client (server-only)
├── routes/
│   ├── __root.tsx                     # app shell (unchanged)
│   ├── index.tsx                      # survey form (/)
│   └── admin.tsx                      # admin dashboard (/admin)
└── styles.css                         # design tokens
```

---

## 4. Design System

Defined in `src/styles.css`. All colors in OKLCH.

### Core CSS variables (light theme `:root`)
```
--radius: 0.875rem
--background:  oklch(0.985 0.015 230)
--foreground:  oklch(0.25  0.06  245)
--card:        oklch(1 0 0)
--primary:     oklch(0.6   0.15  235)
--primary-foreground: oklch(0.99 0.01 230)
--secondary:   oklch(0.95  0.03  235)
--muted-foreground: oklch(0.48 0.05 240)
--destructive: oklch(0.6   0.22  25)
--border:      oklch(0.9   0.02  230)
--ring:        oklch(0.6   0.15  235)
```

### Gradients & shadows
```
--gradient-sky:  linear-gradient(135deg, oklch(0.65 0.16 235), oklch(0.45 0.14 250));
--gradient-deep: linear-gradient(135deg, oklch(0.25 0.08 245), oklch(0.15 0.05 250));
--gradient-soft: linear-gradient(180deg, oklch(0.99 0.01 230), oklch(0.94 0.035 235));
--shadow-soft:   0 10px 40px -12px oklch(0.3  0.12 245 / 0.25);
--shadow-card:   0 4px 20px -8px  oklch(0.25 0.10 245 / 0.18);
```

Token usage map:
- Page background → `var(--gradient-soft)`
- Primary CTAs and stat-icon chips → `var(--gradient-sky)`
- Big hero card → `var(--shadow-soft)`
- Stat cards / data card / submit button → `var(--shadow-card)`

Radius scale derived from `--radius`: `rounded-xl` ≈ 14px, `rounded-2xl` ≈ 18px, `rounded-3xl` ≈ 22px.

---

## 5. Survey Page (`/`) — Client Side

### 5.1 Purpose
Collect anonymous NPS responses: a 1–10 score (required) and an optional 2000-char comment. On success, show a thank-you state with an option to submit another.

### 5.2 Route definition
`src/routes/index.tsx`
```ts
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Share your feedback" },
      { name: "description", content: "Tell us how we're doing — it takes less than a minute." },
      { property: "og:title", content: "Share your feedback" },
      { property: "og:description", content: "Tell us how we're doing — it takes less than a minute." },
    ],
  }),
  component: Index,
});
```

### 5.3 State
```ts
const [score, setScore] = useState<number | null>(null);
const [text,  setText]  = useState("");
const [done,  setDone]  = useState(false);
```

### 5.4 Submission (mutation)
Uses the **browser** Supabase client (publishable key) so the insert is governed by the public RLS INSERT policy.

```ts
const submit = useMutation({
  mutationFn: async () => {
    if (score === null) throw new Error("Please select a score from 1 to 10.");
    const { error } = await supabase
      .from("feedback_responses")
      .insert({ nps_score: score, feedback_text: text.trim() });
    if (error) throw error;
  },
  onSuccess: () => { setDone(true); toast.success("Thank you for your feedback!"); },
  onError:   (e: Error) => toast.error(e.message),
});
```

Validation:
- Score is required (guard before insert).
- Textarea `maxLength={2000}`; trimmed before insert.
- Server-side check constraint enforces the same bounds (defense in depth).

### 5.5 Layout

**Container**
- `<main>` — `min-h-screen px-4 py-12 md:py-20` with inline style `background: var(--gradient-soft)`.
- Inner wrapper: `max-w-2xl mx-auto`.

**Eyebrow row**
- `flex items-center gap-2 text-sm text-muted-foreground mb-8`.
- `MessageCircleHeart` icon (`h-5 w-5 text-primary`) + label `Customer Feedback` (`font-medium tracking-wide uppercase text-xs`).

**Hero card**
- `bg-card rounded-3xl p-8 md:p-12` with `boxShadow: var(--shadow-soft)`.
- `h1` — "How likely are you to recommend us?" (`text-3xl md:text-4xl font-semibold text-foreground tracking-tight`).
- Sub-copy `p` — "On a scale of 1 to 10, where 10 means you'd absolutely recommend us to a friend." (`mt-3 text-muted-foreground`).

**Score grid (1–10)**
- `grid grid-cols-10 gap-2` (10 buttons).
- Each button: `aspect-square rounded-xl text-sm md:text-base font-medium transition-all border`.
- Unselected: `border-border bg-background text-foreground hover:border-primary/50 hover:bg-secondary`.
- Selected: `border-transparent text-primary-foreground scale-105`, plus inline `background: var(--gradient-sky); boxShadow: var(--shadow-card)`.
- Caption row (`grid grid-cols-10 gap-2 mt-2`): 3-col left "Not at all likely" + 3-col right "Very likely" (text-xs muted).

**Free-text feedback**
- `Label` for `feedback` (`text-base`) — "Anything you'd like to share?"
- `Textarea`: `min-h-32 rounded-xl resize-none`, `maxLength={2000}`, placeholder `"Tell us what's working, what isn't, or what you'd love to see..."`.
- Char counter `text-right text-xs text-muted-foreground mt-1` → `{text.length}/2000`.

**Submit button**
- `Button` full width: `mt-6 w-full h-12 rounded-xl text-base font-medium text-primary-foreground border-0`.
- Inline: `background: var(--gradient-sky); boxShadow: var(--shadow-card)`.
- Disabled while pending or when `score === null`.
- Label: `Sending...` (pending) or `Send feedback`.

**Footer line**
- Centered muted text: "Your response is anonymous and helps shape what we build next."

### 5.6 Success state (`done === true`)
- Full-screen flex-center page with same `--gradient-soft` background.
- Card: `max-w-md w-full text-center bg-card rounded-3xl p-10` + `--shadow-soft`.
- Circular icon container `w-16 h-16 rounded-full` with `--gradient-sky`; `CheckCircle2` icon `h-8 w-8 text-primary-foreground`.
- `h1` "Thanks so much!" + paragraph "Your feedback helps us get better every day."
- Ghost `Button` "Submit another response" → resets `done`, `score`, `text`.

### 5.7 Icons used
`MessageCircleHeart`, `CheckCircle2`.

---

## 6. Admin Dashboard (`/admin`) — Data Side

### 6.1 Purpose
Public read-only view of all collected feedback. Surfaces aggregate metrics (Total responses, Average score, NPS) and a filterable/sortable submission log.

### 6.2 Server function
`src/lib/feedback.functions.ts`
```ts
import { createServerFn } from "@tanstack/react-start";

export const listFeedbackResponses = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("feedback_responses")
      .select("id, nps_score, feedback_text, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { responses: data ?? [] };
  });
```
- Returns `{ responses: Array<{ id, nps_score, feedback_text, created_at }> }`.
- Sorted newest-first server-side; client re-sorts as needed.
- `supabaseAdmin` imported *inside* the handler to avoid leaking server-only code into the client bundle.

### 6.3 Route definition
`src/routes/admin.tsx`
```ts
export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Feedback dashboard" }] }),
  component: AdminPage,
});
```

### 6.4 Data fetching
```ts
const fetchResponses = useServerFn(listFeedbackResponses);
const { data, isLoading, error } = useQuery({
  queryKey: ["feedback-responses"],
  queryFn: () => fetchResponses(),
});
const responses = data?.responses ?? [];
```
After a future authoring change, invalidate `["feedback-responses"]` to refresh.

### 6.5 Derived metrics (inline)
| Metric            | Formula                                                                         |
|-------------------|----------------------------------------------------------------------------------|
| Total responses   | `responses.length`                                                              |
| Average score     | `sum(nps_score) / length`, `.toFixed(1)`; shows `—` when empty                  |
| Promoters         | `nps_score >= 9`                                                                |
| Detractors        | `nps_score <= 6`                                                                |
| NPS               | `round(((promoters - detractors) / total) * 100)`, range −100…+100; `—` if empty |

### 6.6 Category helper
```ts
function scoreCategory(score: number) {
  if (score >= 9) return { label: "Promoter",  className: "bg-primary/10 text-primary border-primary/20" };
  if (score >= 7) return { label: "Passive",   className: "bg-secondary text-secondary-foreground" };
  return            { label: "Detractor", className: "bg-destructive/10 text-destructive" };
}
```

### 6.7 Filtering & sorting
```ts
const [filter, setFilter] = useState<"all"|"promoter"|"passive"|"detractor">("all");
const [sort,   setSort]   = useState<"newest"|"oldest"|"score-desc"|"score-asc">("newest");
```
Single `useMemo` over `[responses, filter, sort]`:
- Filter:
  - `all` → no filter
  - `promoter` → score ≥ 9
  - `passive` → 7 ≤ score ≤ 8
  - `detractor` → score ≤ 6
- Sort:
  - `newest` / `oldest` → by `created_at`
  - `score-desc` / `score-asc` → by `nps_score`

### 6.8 Layout

**Page wrapper**
- `<main>` `min-h-screen` with inline `background: var(--gradient-soft)`.

**Top header bar**
- `border-b border-border bg-card/60 backdrop-blur`.
- Inner: `max-w-6xl mx-auto px-6 py-4 flex items-center justify-between`.
- Left: `h1` "Feedback dashboard" (`text-lg font-semibold`) + `p` "All survey responses" (`text-xs text-muted-foreground`).
- Right: ghost `Button` `asChild` → TanStack `Link to="/"` with `ExternalLink` icon + "View survey".

**Body container**
- `max-w-6xl mx-auto px-6 py-8 space-y-6`.

**Stat cards row** — `grid grid-cols-1 md:grid-cols-3 gap-4`, three `StatCard` items:
| Icon            | Label            | Value                                     |
|-----------------|------------------|-------------------------------------------|
| `Inbox`         | Total responses  | `responses.length`                        |
| `TrendingUp`    | Average score    | `avg`                                     |
| `MessageSquare` | NPS              | `nps` (or `—` when no responses)          |

`StatCard` markup:
- Outer: `bg-card rounded-2xl p-5 flex items-center gap-4`, `boxShadow: var(--shadow-card)`.
- Icon chip: `h-11 w-11 rounded-xl flex items-center justify-center text-primary-foreground`, `background: var(--gradient-sky)`.
- Text: uppercase label (`text-xs text-muted-foreground uppercase tracking-wide`); value (`text-2xl font-semibold text-foreground`).

**Submission log card**
- Outer: `bg-card rounded-2xl overflow-hidden`, `boxShadow: var(--shadow-card)`.
- Toolbar (`flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border`):
  - Left: `Submission log` + `(visible.length)` (count in muted weight).
  - Right (gap-2):
    - Filter `Select` (`w-[150px]`): All types / Promoters (9–10) / Passives (7–8) / Detractors (1–6).
    - Sort `Select` (`w-[160px]`): Newest first / Oldest first / Score: high to low / Score: low to high.

States:
- Loading → `p-10 text-center text-muted-foreground` "Loading responses..."
- Error   → `p-10 text-center text-destructive` "Failed to load responses."
- Empty   → centered `Inbox` icon `h-10 w-10 text-muted-foreground/60` + message:
  - `responses.length === 0` → "No feedback yet. Share your survey link to start collecting responses."
  - Otherwise → "No responses match the selected filter."

Table (shadcn `Table`):
| Column     | Width  | Cell                                                                                  |
|------------|--------|---------------------------------------------------------------------------------------|
| Submitted  | `w-32` | `new Date(created_at).toLocaleString()` (`text-sm text-muted-foreground whitespace-nowrap`) |
| Score      | `w-20` | `nps_score` (`font-semibold text-foreground`)                                         |
| Type       | `w-28` | shadcn `Badge variant="secondary"` with class from `scoreCategory()`                  |
| Feedback   | flex   | `feedback_text.trim()` or italic muted `No comment`; `text-sm text-foreground max-w-xl` |

### 6.9 Icons used
`Inbox`, `TrendingUp`, `MessageSquare`, `ExternalLink`.

---

## 7. Client / Server Boundary Summary

| Concern                                 | Side    | Client used                                          |
|-----------------------------------------|---------|------------------------------------------------------|
| Insert from survey form                 | Browser | `supabase` (publishable key) — RLS INSERT policy     |
| Read all responses for admin            | Server  | `supabaseAdmin` (service role) — bypasses RLS        |
| Page navigation between `/` and `/admin`| Browser | TanStack `Link`                                      |

> The admin server function is currently **public**. If the dashboard should be restricted, place it under `src/routes/_authenticated/admin.tsx`, switch the server function to `.middleware([requireSupabaseAuth])` + `context.supabase`, and gate calls from the component layer.

---

## 8. Step-by-Step Rebuild

1. **Provision DB**: run the table + GRANT + RLS migration in §2.
2. **Create utilities & integrations** if not present: `src/lib/utils.ts` (`cn`), `src/integrations/supabase/client.ts`, `src/integrations/supabase/client.server.ts`.
3. **Set design tokens** in `src/styles.css` per §4.
4. **Build the survey page** (`src/routes/index.tsx`) per §5 — score grid, textarea, mutation, success state.
5. **Build the server function** (`src/lib/feedback.functions.ts`) per §6.2.
6. **Build the admin route** (`src/routes/admin.tsx`) per §6.3–§6.8 — fetching, metrics, filter/sort memo, layout.
7. **Verify**:
   - Submit a 1–10 score with and without text → success toast, thank-you screen, row appears at `/admin` after refetch.
   - Empty / error / loading states all render.
   - Filter and sort selectors update `(visible.length)` and rows.
   - Stat cards recompute as new rows arrive.
   - Color, gradients, and shadows match tokens; no raw hex values in components.

---

## 9. Possible Enhancements (out of scope)

- Auth-gate the admin route (`_authenticated/admin.tsx`) and switch the server fn to user-scoped reads.
- CSV export and date-range filter.
- Real-time updates via a Supabase channel on `feedback_responses`.
- Pagination once row volume grows.
- NPS-over-time chart using shadcn `chart` / recharts.
