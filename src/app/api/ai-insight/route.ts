import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, xColumn, yColumn, correlation, rSquared, tags, sampleDescription, dataType } = body

    if (!prompt || !xColumn || !yColumn) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // API 키 확인
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API 키가 설정되지 않았습니다. 환경 변수 GEMINI_API_KEY를 확인해주세요.' },
        { status: 500 }
      )
    }

    // Gemini 클라이언트 생성
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const systemPrompt = `당신은 지구화학 데이터 분석 전문가입니다. 주어진 변수 간의 상관관계를 분석하고, 지질학적/지구화학적 의미를 설명해주세요.

다음 형식으로 응답해주세요:
1. **핵심 해석** (한 문단): 이 관계의 핵심적인 지질학적 의미
2. **가능한 원인** (2-3개): 이 상관관계가 나타나는 가능한 지질학적 과정
3. **추가 분석 제안** (선택적): 더 깊은 이해를 위해 추천하는 추가 분석

전문적이지만 이해하기 쉽게 설명해주세요. 한국어로 응답해주세요.`

    const userPrompt = `
다음 지구화학 데이터 분석 결과를 해석해주세요:

${prompt}

${tags?.includes('non-linear') ? `
⚠️ 주의: 이 변수 쌍에서 비선형 관계가 감지되었습니다.
피어슨(선형) 상관계수보다 스피어만(순위) 상관계수가 더 높습니다.
이는 로그 스케일 관계, 지수 관계, 또는 임계값 효과를 나타낼 수 있습니다.
` : ''}

${tags?.includes('log-scale') ? '💡 로그 스케일 변환 시 더 강한 선형 관계를 보일 것으로 예상됩니다.' : ''}
`

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000
      }
    })

    const interpretation = result.response.text()

    return NextResponse.json({
      success: true,
      interpretation,
      metadata: {
        xColumn,
        yColumn,
        correlation,
        rSquared,
        tags,
        model: 'gemini-2.0-flash',
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('AI Insight API Error:', error)

    // Gemini API 키 오류 처리
    if (error instanceof Error && error.message.includes('API key')) {
      return NextResponse.json(
        { error: 'Gemini API 키가 설정되지 않았습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'AI 해석 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
