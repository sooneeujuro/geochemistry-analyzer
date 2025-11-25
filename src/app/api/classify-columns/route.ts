import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Vercel 함수 타임아웃
export const maxDuration = 60

// 컬럼 분류 결과 타입
export interface ColumnClassification {
  group_map: Record<string, string>  // 컬럼명 -> 그룹ID
  composition_pairs: [string, string][]  // 구성 관계에 있는 컬럼 쌍들
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { columns } = body

    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid columns array' },
        { status: 400 }
      )
    }

    // API 키 확인
    if (!process.env.GEMINI_API_KEY) {
      // API 키 없으면 기본 규칙 기반 분류 사용
      return NextResponse.json({
        success: true,
        classification: fallbackClassification(columns),
        method: 'rule-based'
      })
    }

    // Gemini 클라이언트 생성
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

    const systemInstruction = `You are a Geochemical Data Cleaner specializing in identifying related variables.
I will give you a list of column names from geochemical datasets.
Group them by their fundamental chemical or physical entity.

Rules:
1. Group distinct units of the same element together (e.g., 'Mg (ppm)', 'Mg (wt%)', 'MgO' -> Group: 'Magnesium').
2. Group isotopic notations of the same element together ONLY IF they represent concentration (e.g., 'He (ccSTP)' and '4He (ccSTP)' -> Group: 'Helium').
   BUT keep ratios distinct (e.g., '3He/4He' is distinct from 'He concentration').
3. Detect compositional parts: If A is 'He/Ar' and B is 'He', mark them as 'Compositionally Related'.
4. Temperature, depth, location columns should each have unique groups.
5. Normalized and raw values of the same measurement should be in the same group.

Respond ONLY with valid JSON, no other text.`

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',  // 빠른 응답을 위해 flash 사용
      systemInstruction
    })

    const userPrompt = `Classify these geochemical column names:
${JSON.stringify(columns, null, 2)}

Output JSON format:
{
  "group_map": {
    "column_name": "group_id",
    ...
  },
  "composition_pairs": [
    ["ratio_column", "component_column"],
    ...
  ]
}`

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.1,  // 일관된 분류를 위해 낮은 temperature
        maxOutputTokens: 8000
      }
    })

    const responseText = result.response.text()
    console.log('Column classification response:', responseText?.substring(0, 500))

    // 빈 응답 체크
    if (!responseText || responseText.trim() === '') {
      return NextResponse.json({
        success: true,
        classification: fallbackClassification(columns),
        method: 'rule-based-fallback'
      })
    }

    // JSON 파싱
    let classification: ColumnClassification
    try {
      classification = JSON.parse(responseText)
    } catch {
      // JSON 블록 추출 시도
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        classification = JSON.parse(jsonMatch[0])
      } else {
        // 파싱 실패 시 규칙 기반 분류 사용
        return NextResponse.json({
          success: true,
          classification: fallbackClassification(columns),
          method: 'rule-based-fallback'
        })
      }
    }

    // 유효성 검사
    if (!classification.group_map) {
      classification.group_map = {}
    }
    if (!classification.composition_pairs) {
      classification.composition_pairs = []
    }

    return NextResponse.json({
      success: true,
      classification,
      method: 'ai'
    })

  } catch (error) {
    console.error('Column classification error:', error)
    return NextResponse.json(
      { error: `컬럼 분류 중 오류: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

/**
 * 규칙 기반 컬럼 분류 (API 키 없거나 AI 실패 시 폴백)
 */
function fallbackClassification(columns: string[]): ColumnClassification {
  const group_map: Record<string, string> = {}
  const composition_pairs: [string, string][] = []

  // 원소/화합물 패턴
  const elementPattern = /^([A-Z][a-z]?\d*(?:O\d*)?|[A-Z][a-z]?\/[A-Z][a-z]?)/i

  // 단위 제거 패턴
  const unitPattern = /\s*\([^)]+\)\s*$/

  for (const col of columns) {
    // 단위 제거하고 기본 성분 추출
    const baseComponent = col.replace(unitPattern, '').trim()

    // 원소/화합물 추출
    const match = baseComponent.match(elementPattern)
    if (match) {
      const element = match[1].toUpperCase()
      group_map[col] = element
    } else {
      // 매칭 안 되면 컬럼명 자체를 그룹으로
      group_map[col] = baseComponent.toUpperCase()
    }
  }

  // 비율 컬럼과 구성 성분 찾기
  for (const col of columns) {
    if (col.includes('/')) {
      const parts = col.split('/').map(p => p.replace(unitPattern, '').trim())
      for (const part of parts) {
        // 해당 성분을 포함하는 다른 컬럼 찾기
        for (const otherCol of columns) {
          if (otherCol !== col) {
            const otherBase = otherCol.replace(unitPattern, '').trim()
            if (otherBase.toUpperCase().startsWith(part.toUpperCase())) {
              composition_pairs.push([col, otherCol])
            }
          }
        }
      }
    }
  }

  return { group_map, composition_pairs }
}
