import { NextRequest, NextResponse } from 'next/server'
import { ChatMessage, ChatSession } from '@/types/geochem'

// Supabase 환경변수 체크
const hasSupabaseConfig = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// 조건부 Supabase import
const getSupabase = async () => {
  if (!hasSupabaseConfig) {
    return null
  }
  const { supabase } = await import('@/lib/supabase')
  return supabase
}

// 채팅 세션 저장
export async function POST(request: NextRequest) {
  try {
    console.log('[POST] 채팅 세션 저장 시작')
    const supabase = await getSupabase()
    
    if (!supabase) {
      console.log('[POST] Supabase 설정 없음')
      return NextResponse.json(
        { error: 'Supabase가 설정되지 않았습니다. 로컬 저장만 사용하세요.' },
        { status: 503 }
      )
    }
    console.log('[POST] Supabase 연결 성공')

    const body = await request.json()
    console.log('[POST] 요청 데이터:', { session_id: body.session_id, messageCount: body.messages?.length })
    
    const { session_id, messages }: ChatSession = body

    if (!session_id || !messages) {
      console.log('[POST] 필수 데이터 누락:', { session_id: !!session_id, messages: !!messages })
      return NextResponse.json(
        { error: 'session_id와 messages가 필요합니다.' },
        { status: 400 }
      )
    }

    // Date 객체를 string으로 변환 (JSON 호환성)
    const processedMessages = messages.map(msg => ({
      ...msg,
      timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp
    }))

    // 기존 세션 확인
    const { data: existingSession } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('session_id', session_id)
      .single()

    if (existingSession) {
      // 기존 세션 업데이트
      const { data, error } = await supabase
        .from('chat_sessions')
        .update({
          messages: processedMessages,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', session_id)
        .select()

      if (error) {
        console.error('세션 업데이트 에러:', error)
        return NextResponse.json(
          { error: '세션 업데이트에 실패했습니다.' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true, data })
    } else {
      // 새 세션 생성
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          session_id: session_id,
          messages: processedMessages,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()

      if (error) {
        console.error('세션 생성 에러:', error)
        return NextResponse.json(
          { error: '세션 생성에 실패했습니다.' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true, data })
    }
  } catch (error) {
    console.error('Chat session API 에러:', error)
    return NextResponse.json(
      { error: '서버 에러가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 채팅 세션 불러오기
export async function GET(request: NextRequest) {
  try {
    console.log('[GET] 채팅 세션 조회 시작')
    const supabase = await getSupabase()
    
    if (!supabase) {
      console.log('[GET] Supabase 설정 없음')
      return NextResponse.json(
        { error: 'Supabase가 설정되지 않았습니다. 로컬 저장만 사용하세요.' },
        { status: 503 }
      )
    }
    console.log('[GET] Supabase 연결 성공')

    const { searchParams } = new URL(request.url)
    const session_id = searchParams.get('session_id')
    console.log('[GET] 요청된 session_id:', session_id)

    if (!session_id) {
      console.log('[GET] session_id 누락')
      return NextResponse.json(
        { error: 'session_id가 필요합니다.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('session_id', session_id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // 세션이 없는 경우
        return NextResponse.json({ 
          success: true, 
          data: null,
          message: '세션을 찾을 수 없습니다.'
        })
      }
      
      console.error('세션 불러오기 에러:', error)
      return NextResponse.json(
        { error: '세션 불러오기에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Chat session GET 에러:', error)
    return NextResponse.json(
      { error: '서버 에러가 발생했습니다.' },
      { status: 500 }
    )
  }
}