import { createServerFn } from '@tanstack/react-start'

export const listFeedbackResponses = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { supabaseAdmin } = await import(
      '@/integrations/supabase/client.server'
    )
    const { data, error } = await supabaseAdmin
      .from('feedback_responses')
      .select('id, nps_score, feedback_text, created_at')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return { responses: data ?? [] }
  }
)
