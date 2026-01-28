import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type OutreachStatus = 'not_contacted' | 'request_sent' | 'connected' | 'replied' | 'meeting_scheduled'

export type Contact = {
  id: string
  name: string
  linkedin_url: string | null
  title: string | null
  company_id: string | null
  product_interest: 'ai_lab' | 'climate' | 'both' | null
  email: string | null
  firmographic_score: number
  title_score: number
  engagement_score: number
  total_score: number
  status: 'hot' | 'sql' | 'mql' | 'nurture'
  outreach_status: OutreachStatus
  assigned_to: string | null
  connection_note_type: string | null
  notes: string | null
  last_contact_date: string | null
  created_at: string
  updated_at: string
  // From view joins
  company_name?: string
  employee_count?: number
  industry?: string
  engagement_count?: number
  last_engagement?: string
  engaged_with_authors?: string[]
}

export type Company = {
  id: string
  name: string
  linkedin_url: string | null
  website: string | null
  employee_count: number | null
  industry: string | null
  funding_stage: string | null
  has_ai_sustainability_signals: boolean
  created_at: string
}

export type Engagement = {
  id: string
  contact_id: string
  signal_type: 'post_like' | 'post_comment' | 'post_share' | 'profile_view' | 'content_posted'
  source_url: string | null
  source_author: string | null
  source_topic: string | null
  points_awarded: number | null
  observed_at: string
}

export const OUTREACH_STATUS_LABELS: Record<OutreachStatus, string> = {
  not_contacted: 'Not Contacted',
  request_sent: 'Request Sent',
  connected: 'Connected',
  replied: 'Replied',
  meeting_scheduled: 'Meeting Set',
}
