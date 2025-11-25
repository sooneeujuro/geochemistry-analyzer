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
      sampleData  // { min, max, median, outliers }
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

    // 시스템 프롬프트: AI의 역할을 "지구화학 박사"로 세팅
    const systemInstruction = `You are an expert Geochemist and Data Scientist specializing in hydrothermal systems, mantle geochemistry, and volatile isotope analysis.
Your goal is to interpret statistical relationships between geochemical variables and provide scientific insights.

When analyzing data:
1. Think in terms of geological processes: Mixing (binary/ternary), Fractional Crystallization, Degassing (Rayleigh/Batch), or Water-Rock Interaction.
2. Identify end-members if applicable (e.g., Seawater, Mantle, Sediment, Atmosphere).
3. Be skeptical: If a correlation is high but geologically nonsensical, point it out as a potential artifact or coincidence.
4. Use academic terminology but keep explanations concise and clear for researchers.
5. Always respond in Korean (한국어로 응답하세요).`

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      systemInstruction
    })

    // 관계 유형 판단
    const isNonLinear = tags?.includes('non-linear')
    const relationshipType = isNonLinear
      ? 'Non-linear (Spearman > Pearson)'
      : 'Linear'

    // 샘플 데이터 포맷팅 (Min, Max, Median, Outliers)
    let sampleDataText = ''
    if (sampleData) {
      const formatPoint = (p: { x: number; y: number } | null) =>
        p ? `(${p.x?.toFixed(4)}, ${p.y?.toFixed(4)})` : 'N/A'

      sampleDataText = `
## Representative Sample Points (토큰 효율을 위해 핵심 데이터만 제공)
- **Minimum:** ${formatPoint(sampleData.min)}
- **Maximum:** ${formatPoint(sampleData.max)}
- **Median:** ${formatPoint(sampleData.median)}
${sampleData.outliers?.length > 0
  ? `- **Outliers (추세선에서 가장 먼 점들):** ${sampleData.outliers.map(formatPoint).join(', ')}`
  : ''}`
    }

    // 유저 프롬프트: 데이터 컨텍스트 + 태스크 + JSON 출력 형식
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

1. **Mechanism:** What geological process best explains this trend?
   (e.g., Conservative mixing, microbial oxidation, mantle input, degassing, water-rock interaction?)
2. **Implication:** What does this tell us about the reservoir characteristics, source, or environment?
3. **Anomalies:** Are there any samples that deviate significantly? Why might that be?

## Output Format (Strict JSON)
응답은 반드시 아래 JSON 형식으로만 해주세요. 다른 텍스트 없이 순수 JSON만 출력하세요:
{
  "title": "이 관계를 설명하는 짧은 과학적 제목",
  "summary": "발견한 내용을 한 문장으로 요약",
  "mechanism": "이 상관관계를 설명하는 지질학적 과정 (예: 탈가스에 의한 분별작용)",
  "geological_meaning": "근원지나 환경에 대한 깊은 통찰",
  "warning": "잠재적 데이터 아티팩트나 주의사항 (없으면 null)"
}`

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 16000  // 2.5-pro thinking에 충분한 토큰 확보
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

    // JSON 파싱 시도 (여러 방법)
    let interpretation
    try {
      // 방법 1: 직접 파싱
      interpretation = JSON.parse(responseText)
    } catch {
      try {
        // 방법 2: ```json ... ``` 블록에서 추출
        const jsonCodeBlock = responseText.match(/```json\s*([\s\S]*?)\s*```/)
        if (jsonCodeBlock) {
          interpretation = JSON.parse(jsonCodeBlock[1])
        } else {
          // 방법 3: { } 블록 찾기
          const jsonMatch = responseText.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            interpretation = JSON.parse(jsonMatch[0])
          } else {
            throw new Error('No JSON found')
          }
        }
      } catch {
        // 모든 파싱 실패 시 텍스트로 구조화
        console.log('JSON 파싱 실패, 원본:', responseText)
        interpretation = {
          title: `${xColumn} vs ${yColumn} 분석`,
          summary: '아래 AI 응답을 참고하세요.',
          mechanism: responseText,
          geological_meaning: '',
          warning: 'JSON 파싱 실패'
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
        model: 'gemini-2.5-pro',
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
