import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// AI 해석 결과 타입
export interface AIInsightResult {
  title: string
  summary: string
  mechanism: string
  geological_meaning: string
  warning?: string
}

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
      sampleData // { min, max, median, outliers }
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

    // Gemini 클라이언트 생성
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      systemInstruction: `You are an expert Geochemist and Data Scientist specializing in hydrothermal systems, mantle geochemistry, and volatile isotope analysis.
Your goal is to interpret statistical relationships between geochemical variables and provide scientific insights.

When analyzing data:
1. Think in terms of geological processes: Mixing (binary/ternary), Fractional Crystallization, Degassing (Rayleigh/Batch), or Water-Rock Interaction.
2. Identify end-members if applicable (e.g., Seawater, Mantle, Sediment, Atmosphere).
3. Be skeptical: If a correlation is high but geologically nonsensical, point it out as a potential artifact or coincidence.
4. Use academic terminology but keep explanations concise and clear for researchers.
5. Always respond in Korean (한국어로 응답하세요).`
    })

    // 관계 타입 결정
    const isNonLinear = tags?.includes('non-linear')
    const relationshipType = isNonLinear ? 'Non-linear (Spearman > Pearson)' : 'Linear'

    // 샘플 데이터 포맷팅
    let sampleDataText = ''
    if (sampleData) {
      sampleDataText = `
## Representative Sample Points
- Minimum: X=${sampleData.min?.x?.toFixed(4)}, Y=${sampleData.min?.y?.toFixed(4)}
- Maximum: X=${sampleData.max?.x?.toFixed(4)}, Y=${sampleData.max?.y?.toFixed(4)}
- Median: X=${sampleData.median?.x?.toFixed(4)}, Y=${sampleData.median?.y?.toFixed(4)}
${sampleData.outliers?.length > 0 ? `- Outliers: ${sampleData.outliers.map((o: any) => `(${o.x?.toFixed(4)}, ${o.y?.toFixed(4)})`).join(', ')}` : ''}`
    }

    const userPrompt = `## Data Context
- **Dataset Type:** ${sampleDescription || 'Geochemical Analysis Data'}
- **X-axis Variable:** ${xColumn}
- **Y-axis Variable:** ${yColumn}
- **Sample Count:** ${dataCount || 'N/A'}
- **Pearson Correlation (R):** ${pearsonCorr?.toFixed(4) || 'N/A'}
- **Spearman Rank Correlation (ρ):** ${spearmanCorr?.toFixed(4) || 'N/A'}
- **R-squared:** ${rSquared?.toFixed(4) || 'N/A'}
- **Relationship Type:** ${relationshipType}
${sampleDataText}

## Task
Analyze the relationship between **${xColumn}** and **${yColumn}**.

1. **Mechanism:** What geological process best explains this trend? (e.g., Conservative mixing, microbial oxidation, mantle input, degassing, water-rock interaction?)
2. **Implication:** What does this tell us about the reservoir characteristics, source, or environment?
3. **Anomalies:** Are there any considerations about outliers or data quality?

응답은 반드시 다음 JSON 형식으로만 하세요. 설명이나 다른 텍스트 없이 순수 JSON만 출력하세요:
{"title":"제목","summary":"요약","mechanism":"메커니즘","geological_meaning":"의미","warning":null}`

    console.log('Gemini 요청 시작:', { xColumn, yColumn, pearsonCorr })

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1500
      }
    })

    // 응답 검증
    if (!result.response) {
      console.error('Gemini 응답 없음')
      return NextResponse.json({
        success: true,
        interpretation: {
          title: `${xColumn} vs ${yColumn} 분석`,
          summary: 'Gemini로부터 응답을 받지 못했습니다.',
          mechanism: '잠시 후 다시 시도해주세요.',
          geological_meaning: '',
          warning: 'API 응답 없음'
        }
      })
    }

    const responseText = result.response.text()
    console.log('Gemini 원본 응답 길이:', responseText?.length)
    console.log('Gemini 원본 응답:', responseText?.slice(0, 500))

    // 빈 응답 체크
    if (!responseText || responseText.trim() === '') {
      console.error('Gemini 빈 응답')
      return NextResponse.json({
        success: true,
        interpretation: {
          title: `${xColumn} vs ${yColumn} 분석`,
          summary: 'Gemini로부터 빈 응답을 받았습니다.',
          mechanism: '잠시 후 다시 시도해주세요.',
          geological_meaning: '',
          warning: 'API 빈 응답'
        }
      })
    }

    // JSON 파싱 시도 (여러 방법)
    let parsedResult: AIInsightResult
    try {
      // 방법 1: 직접 파싱
      parsedResult = JSON.parse(responseText)
    } catch {
      try {
        // 방법 2: ```json ... ``` 블록에서 추출
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/)
        if (jsonMatch) {
          parsedResult = JSON.parse(jsonMatch[1])
        } else {
          // 방법 3: { } 블록 찾기
          const braceMatch = responseText.match(/\{[\s\S]*\}/)
          if (braceMatch) {
            parsedResult = JSON.parse(braceMatch[0])
          } else {
            throw new Error('No JSON found')
          }
        }
      } catch {
        // 모든 파싱 실패 시 텍스트로 구조화
        console.log('JSON 파싱 실패, 원본:', responseText)
        parsedResult = {
          title: `${xColumn} vs ${yColumn} 분석`,
          summary: '아래 AI 응답을 참고하세요.',
          mechanism: responseText,
          geological_meaning: '',
          warning: undefined
        }
      }
    }

    return NextResponse.json({
      success: true,
      interpretation: parsedResult,
      metadata: {
        xColumn,
        yColumn,
        pearsonCorr,
        spearmanCorr,
        rSquared,
        tags,
        model: 'gemini-2.5-pro',
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('AI Insight API Error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    if (errorMessage.includes('API key')) {
      return NextResponse.json(
        { error: 'Gemini API 키가 설정되지 않았습니다.' },
        { status: 500 }
      )
    }

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
