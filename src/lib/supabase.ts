import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
  assigned_to: string | null
  connection_note_type: string | null
  notes: string | null
  last_contact_date: string | null
  created_at: string
  updated_at: string
  company_name?: string
  employee_count?: number
  industry?: string
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
