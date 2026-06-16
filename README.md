# 📊 Customer Feedback Dashboard

A lightweight two-page web app for collecting **Net Promoter Score (NPS)** surveys and visualizing customer satisfaction in real time — built with TanStack Start, Supabase, and shadcn/ui.

---

## Overview

| Page | Route | Purpose |
|---|---|---|
| Survey form | `/` | Anonymous public form — collects a 1–10 NPS score and an optional comment |
| Admin dashboard | `/admin` | Read-only analytics view — aggregate metrics + filterable submission log |

Both pages share a single Supabase table, a consistent design system (OKLCH tokens, CSS gradients), and the same component library.

---

## Features

- **NPS survey** — 1–10 score selector with optional 2000-character comment field
- **Thank-you state** — inline success screen with an option to submit another response
- **Aggregate metrics** — total responses, average score, and calculated NPS (−100 to +100)
- **Submission log** — sortable and filterable table of all responses
  - Filter by type: Promoter (9–10), Passive (7–8), Detractor (1–6)
  - Sort by date or score
- **Client/server separation** — survey inserts use the public Supabase key under RLS; admin reads use the service-role key server-side, keeping it out of the client bundle
- **Semantic design system** — no hardcoded colors; all tokens defined in OKLCH via CSS custom properties

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | TanStack Start v1 (React 19, Vite 7) |
| Data fetching | TanStack Query (`useQuery`, `useMutation`) |
| RPC | `createServerFn` from `@tanstack/react-start` |
| Database | Supabase (with RLS) |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui |
| Icons | lucide-react |
| Toasts | sonner |

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name
npm install
```

### 2. Set up Supabase

Create a project at [supabase.com](https://supabase.com), then run the following migration in the SQL editor:

```sql
CREATE TABLE public.feedback_responses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nps_score     integer NOT NULL,
  feedback_text text    NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Grants
GRANT INSERT ON public.feedback_responses TO anon, authenticated;
GRANT SELECT ON public.feedback_responses TO authenticated;
GRANT ALL    ON public.feedback_responses TO service_role;

-- RLS
ALTER TABLE public.feedback_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit feedback"
  ON public.feedback_responses FOR INSERT
  TO anon, authenticated
  WITH CHECK (nps_score BETWEEN 1 AND 10 AND char_length(coalesce(feedback_text, '')) <= 2000);

CREATE POLICY "Authenticated users can view all responses"
  ON public.feedback_responses FOR SELECT
  TO authenticated
  USING (true);
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Fill in your Supabase project URL and keys:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

> The service role key is only used inside server functions and is never exposed to the client bundle.

### 4. Run the dev server

```bash
npm run dev
```

Visit `http://localhost:3000` for the survey and `http://localhost:3000/admin` for the dashboard.

---

## Project Structure

```
src/
├── lib/
│   ├── utils.ts                    # cn() helper
│   └── feedback.functions.ts       # listFeedbackResponses server fn
├── integrations/supabase/
│   ├── client.ts                   # Browser client (publishable key)
│   └── client.server.ts            # Service-role client (server-only)
├── routes/
│   ├── __root.tsx                  # App shell
│   ├── index.tsx                   # Survey form (/)
│   └── admin.tsx                   # Admin dashboard (/admin)
└── styles.css                      # Design tokens (OKLCH, gradients, shadows)
```

---

## NPS Calculation

| Category | Score range | Formula |
|---|---|---|
| Promoter | 9–10 | — |
| Passive | 7–8 | — |
| Detractor | 1–6 | — |
| **NPS** | — | `round(((promoters − detractors) / total) × 100)` |

NPS ranges from **−100** (all detractors) to **+100** (all promoters).

---

## Possible Enhancements

- Auth-gate the `/admin` route with Supabase Auth
- CSV export and date-range filtering
- Real-time updates via a Supabase channel subscription
- NPS-over-time trend chart (recharts / shadcn chart)
- Pagination for high-volume deployments
