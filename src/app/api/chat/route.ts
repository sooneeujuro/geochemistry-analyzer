import { NextRequest, NextResponse } from 'next/server'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatConfig {
  model: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo'
  temperature: number
  maxTokens: number
  systemPrompt: string
}

interface ChatRequest {
  messages: ChatMessage[]
  config: ChatConfig
  apiKey?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json()
    const { messages, config, apiKey } = body

    // 입력 검증
    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: '메시지가 필요합니다.' },
        { status: 400 }
      )
    }

    // API 키 우선순위: 클라이언트 제공 > 환경변수
    const finalApiKey = apiKey || process.env.OPENAI_API_KEY
    
    if (!finalApiKey || !finalApiKey.startsWith('sk-')) {
      return NextResponse.json(
        { error: '유효한 OpenAI API 키가 필요합니다. 설정에서 API 키를 입력하거나 서버 환경변수를 확인해주세요.' },
        { status: 400 }
      )
    }

    // OpenAI API 호출
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${finalApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        stream: false, // 스트리밍 비활성화 (간단한 구현을 위해)
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      
      // OpenAI API 에러 처리
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'API 키가 유효하지 않습니다. 다시 확인해주세요.' },
          { status: 401 }
        )
      } else if (response.status === 429) {
        return NextResponse.json(
          { error: 'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' },
          { status: 429 }
        )
      } else if (response.status === 400) {
        return NextResponse.json(
          { error: `잘못된 요청: ${errorData.error?.message || '알 수 없는 오류'}` },
          { status: 400 }
        )
      } else {
        return NextResponse.json(
          { error: `OpenAI API 오류 (${response.status}): ${errorData.error?.message || '서버 오류'}` },
          { status: response.status }
        )
      }
    }

    const data = await response.json()

    // 응답 검증
    if (!data.choices || data.choices.length === 0) {
      return NextResponse.json(
        { error: 'OpenAI API에서 응답을 받지 못했습니다.' },
        { status: 500 }
      )
    }

    const assistantMessage = data.choices[0].message.content

    return NextResponse.json({
      success: true,
      content: assistantMessage,
      model: config.model,
      usage: data.usage,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Chat API Error:', error)
    
    // 네트워크 오류 처리
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { error: '네트워크 연결 오류입니다. 인터넷 연결을 확인해주세요.' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// OPTIONS 메서드 처리 (CORS 지원)
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}