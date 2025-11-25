import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Vercel 함수 타임아웃 늘리기 (최대 60초)
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      xColumn,
      yColumn,
      pearsonCorr,
      spearmanCorr,
      rSquared,
      dataCount,
      tags,
      sampleDescription,
      sampleData
    } = body

    if (!xColumn || !yColumn) {
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

    // Gemini 클라이언트 생성 (2.0-flash: 빠르고 안정적, Vercel Free 10초 제한 내 응답)
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const systemPrompt = `당신은 지구화학 데이터 분석 전문가입니다. 주어진 변수 간의 상관관계를 분석하고, 지질학적/지구화학적 의미를 설명해주세요.

다음 JSON 형식으로만 응답해주세요:
{"title":"제목","summary":"요약","mechanism":"메커니즘","geological_meaning":"지질학적 의미","warning":null}

전문적이지만 이해하기 쉽게 설명해주세요. 한국어로 응답해주세요.`

    // 샘플 데이터 포맷팅
    let sampleDataText = ''
    if (sampleData) {
      sampleDataText = `
대표 샘플 포인트:
- 최소: X=${sampleData.min?.x?.toFixed(4)}, Y=${sampleData.min?.y?.toFixed(4)}
- 최대: X=${sampleData.max?.x?.toFixed(4)}, Y=${sampleData.max?.y?.toFixed(4)}
- 중앙값: X=${sampleData.median?.x?.toFixed(4)}, Y=${sampleData.median?.y?.toFixed(4)}`
    }

    const userPrompt = `다음 지구화학 데이터 분석 결과를 해석해주세요:

데이터셋: ${sampleDescription || '지구화학 분석 데이터'}
X축 변수: ${xColumn}
Y축 변수: ${yColumn}
데이터 수: ${dataCount || 'N/A'}
피어슨 상관계수 (R): ${pearsonCorr?.toFixed(4) || 'N/A'}
스피어만 상관계수 (ρ): ${spearmanCorr?.toFixed(4) || 'N/A'}
R²: ${rSquared?.toFixed(4) || 'N/A'}
${sampleDataText}

${tags?.includes('non-linear') ? `
⚠️ 주의: 이 변수 쌍에서 비선형 관계가 감지되었습니다.
피어슨(선형) 상관계수보다 스피어만(순위) 상관계수가 더 높습니다.
` : ''}

${tags?.includes('log-scale') ? '💡 로그 스케일 변환 시 더 강한 선형 관계를 보일 것으로 예상됩니다.' : ''}`

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

    const responseText = result.response.text()
    console.log('Gemini 응답:', responseText?.substring(0, 500))

    // 빈 응답 체크
    if (!responseText || responseText.trim() === '') {
      return NextResponse.json({
        success: true,
        interpretation: {
          title: `${xColumn} vs ${yColumn} 분석`,
          summary: 'AI가 응답을 생성하지 못했습니다. 다시 시도해주세요.',
          mechanism: '',
          geological_meaning: '',
          warning: 'empty_response'
        }
      })
    }

    // JSON 파싱 시도
    let interpretation
    try {
      interpretation = JSON.parse(responseText)
    } catch {
      // JSON 파싱 실패 시 텍스트에서 JSON 추출 시도
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          interpretation = JSON.parse(jsonMatch[0])
        } catch {
          // 파싱 실패 시 텍스트 그대로 반환
          interpretation = {
            title: `${xColumn} vs ${yColumn} 분석`,
            summary: responseText,
            mechanism: '',
            geological_meaning: '',
            warning: null
          }
        }
      } else {
        interpretation = {
          title: `${xColumn} vs ${yColumn} 분석`,
          summary: responseText,
          mechanism: '',
          geological_meaning: '',
          warning: null
        }
      }
    }

    return NextResponse.json({
      success: true,
      interpretation,
      metadata: {
        xColumn,
        yColumn,
        pearsonCorr,
        spearmanCorr,
        rSquared,
        tags,
        model: 'gemini-2.0-flash',
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('AI Insight API Error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Gemini API 키 오류 처리
    if (errorMessage.includes('API key')) {
      return NextResponse.json(
        { error: 'Gemini API 키가 설정되지 않았습니다.' },
        { status: 500 }
      )
    }

    // 모델을 찾을 수 없는 경우
    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      return NextResponse.json(
        { error: `모델을 찾을 수 없습니다. 상세: ${errorMessage}` },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: `AI 해석 생성 중 오류: ${errorMessage}` },
      { status: 500 }
    )
  }
}
