import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 데이터베이스 테이블 타입 정의
export interface GeochemDataRow {
  id?: number
  user_id?: string
  file_name: string
  data: Record<string, any>
  metadata: {
    columns: string[]
    numericColumns: string[]
    typeColumn?: string
    rowCount: number
    columnCount: number
  }
  created_at?: string
} 