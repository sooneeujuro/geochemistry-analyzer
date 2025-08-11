import { NextRequest, NextResponse } from 'next/server'

// 스마트 컬럼 필터링 함수
function filterSimilarColumns(columns: string[]): { 
  filteredColumns: string[], 
  filterReasons: string[] 
} {
  const filteredColumns: string[] = []
  const filterReasons: string[] = []
  const usedBaseNames = new Set<string>()

  // 지구화학 원소/화합물 패턴 매칭
  const geochemPatterns = [
    // 주요 원소
    /^(SiO2|Al2O3|Fe2O3|FeO|MgO|CaO|Na2O|K2O|TiO2|P2O5|MnO|Cr2O3)([_%\-\s]*(wt|weight|percent|pct|ppm|ppb|mg|kg|g).*)?$/i,
    // 미량원소
    /^(Ba|Sr|Rb|Cs|Li|Be|Sc|V|Cr|Co|Ni|Cu|Zn|Ga|Pb|Th|U|Nb|Ta|Zr|Hf|Y)([_%\-\s]*(wt|weight|percent|pct|ppm|ppb|mg|kg|g).*)?$/i,
    // 희토류 원소
    /^(La|Ce|Pr|Nd|Sm|Eu|Gd|Tb|Dy|Ho|Er|Tm|Yb|Lu)([_%\-\s]*(wt|weight|percent|pct|ppm|ppb|mg|kg|g).*)?$/i,
    // 일반 원소
    /^([A-Z][a-z]?)([_%\-\s]*(wt|weight|percent|pct|ppm|ppb|mg|kg|g).*)?$/i
  ]

  // 기본 이름 추출 함수
  function extractBaseName(column: string): string {
    const cleanColumn = column.trim()
    
    // 지구화학 패턴에서 기본 이름 추출
    for (const pattern of geochemPatterns) {
      const match = cleanColumn.match(pattern)
      if (match) {
        return match[1].toUpperCase() // 기본 원소/화합물 이름을 대문자로 정규화
      }
    }
    
    // 일반적인 접미사 제거
    const suffixPattern = /^([^_%\-\s]+)([_%\-\s]*(wt|weight|percent|pct|ppm|ppb|mg|kg|g|ratio|norm|normalized).*)?$/i
    const suffixMatch = cleanColumn.match(suffixPattern)
    if (suffixMatch) {
      return suffixMatch[1].toUpperCase()
    }
    
    return cleanColumn.toUpperCase()
  }

  // 컬럼 우선순위 결정 함수 (더 짧고 표준적인 이름 선호)
  function getColumnPriority(column: string): number {
    const cleanColumn = column.toLowerCase()
    let priority = 0
    
    // 짧은 이름일수록 높은 우선순위
    priority += Math.max(0, 20 - column.length)
    
    // 표준 단위 선호도
    if (cleanColumn.includes('wt%') || cleanColumn.includes('weight')) priority += 10
    if (cleanColumn.includes('ppm')) priority += 8
    if (cleanColumn.includes('percent')) priority += 7
    if (cleanColumn.includes('pct')) priority += 6
    
    // 특수 문자가 적을수록 높은 우선순위
    const specialChars = (column.match(/[_%\-\s]/g) || []).length
    priority += Math.max(0, 10 - specialChars * 2)
    
    return priority
  }

  // 컬럼들을 기본 이름별로 그룹화
  const columnGroups = new Map<string, string[]>()
  columns.forEach(column => {
    const baseName = extractBaseName(column)
    if (!columnGroups.has(baseName)) {
      columnGroups.set(baseName, [])
    }
    columnGroups.get(baseName)!.push(column)
  })

  // 각 그룹에서 최적의 컬럼 선택
  columnGroups.forEach((groupColumns, baseName) => {
    if (groupColumns.length === 1) {
      // 중복이 없는 경우 그대로 추가
      filteredColumns.push(groupColumns[0])
    } else {
      // 중복이 있는 경우 우선순위에 따라 최적의 컬럼 선택
      const sortedColumns = groupColumns.sort((a, b) => 
        getColumnPriority(b) - getColumnPriority(a)
      )
      
      const selectedColumn = sortedColumns[0]
      const rejectedColumns = sortedColumns.slice(1)
      
      filteredColumns.push(selectedColumn)
      
      // 걸러진 이유 설명
      if (rejectedColumns.length > 0) {
        const reason = `📋 ${baseName} 관련 컬럼들: [${groupColumns.join(', ')}] → "${selectedColumn}" 선택 (중복 제거)`
        filterReasons.push(reason)
      }
    }
  })

  return { filteredColumns, filterReasons }
}

interface AIRecommendationRequest {
  columns: string[]
  sampleDescription?: string
  provider: 'openai' | 'google'
  maxRecommendations?: number
}

interface AIRecommendation {
  xColumn: string
  yColumn: string
  reason: string
  confidence: number
  isRatio?: boolean
  ratioName?: string
}

export async function POST(request: NextRequest) {
  let requestBody: any = null
  try {
    requestBody = await request.json()
    const body: AIRecommendationRequest = requestBody
    const { columns, sampleDescription, provider, maxRecommendations = 10 } = body

    // 입력 검증
    if (!columns || columns.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 columns are required' },
        { status: 400 }
      )
    }

    if (!['openai', 'google'].includes(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider. Must be "openai" or "google"' },
        { status: 400 }
      )
    }

    // 스마트 컬럼 필터링
    const { filteredColumns, filterReasons } = filterSimilarColumns(columns)
    if (filteredColumns.length < 2) {
      return NextResponse.json(
        { error: 'After filtering, at least 2 columns are required' },
        { status: 400 }
      )
    }

    // 서버 환경변수에서 API 키 가져오기 (안전함)
    const openaiKey = process.env.OPENAI_API_KEY
    const googleKey = process.env.GOOGLE_AI_API_KEY

    if (provider === 'openai' && !openaiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured on server' },
        { status: 500 }
      )
    }

    if (provider === 'google' && !googleKey) {
      return NextResponse.json(
        { error: 'Google AI API key not configured on server' },
        { status: 500 }
      )
    }

    // AI 추천 요청
    let recommendations: AIRecommendation[] = []

    if (provider === 'openai') {
      recommendations = await getOpenAIRecommendations({
        columns: filteredColumns,
        sampleDescription,
        maxRecommendations,
        apiKey: openaiKey!
      })
    } else {
      recommendations = await getGoogleAIRecommendations({
        columns: filteredColumns,
        sampleDescription,
        maxRecommendations,
        apiKey: googleKey!
      })
    }

    return NextResponse.json({
      success: true,
      recommendations,
      provider,
      timestamp: new Date().toISOString(),
      columnFiltering: {
        originalCount: columns.length,
        filteredCount: filteredColumns.length,
        filterReasons: filterReasons
      }
    })

  } catch (error) {
    console.error('AI API Error:', error instanceof Error ? error.message : 'Unknown error')
    
    return NextResponse.json(
      { error: 'AI service temporarily unavailable' },
      { status: 500 }
    )
  }
}

// OpenAI API 호출
async function getOpenAIRecommendations({
  columns,
  sampleDescription,
  maxRecommendations,
  apiKey
}: {
  columns: string[]
  sampleDescription?: string
  maxRecommendations: number
  apiKey: string
}): Promise<AIRecommendation[]> {
  const prompt = `As a geochemistry expert, recommend ${Math.min(maxRecommendations, 10)} scientifically meaningful correlations from these variables:

Variables: ${columns.join(', ')}
${sampleDescription ? `Context: ${sampleDescription}` : ''}

Include BOTH:
1. Element vs Element correlations (SiO2-K2O, Rb-Sr, etc.)
2. Element RATIOS (La/Sm, Rb/Sr, Zr/Hf, etc.) for geochemical indices

Focus on:
- Major/trace element correlations
- Geochemical ratios (REE, HFSE, LILE patterns)
- Mineral chemistry relationships
- Petrogenetic indicators

For ratios, use isRatio:true and provide ratioName.

JSON format:
{
  "recommendations": [
    {
      "xColumn": "La", 
      "yColumn": "Sm",
      "reason": "REE fractionation indicator",
      "confidence": 0.9,
      "isRatio": true,
      "ratioName": "La/Sm"
    },
    {
      "xColumn": "SiO2", 
      "yColumn": "K2O",
      "reason": "igneous differentiation",
      "confidence": 0.85
    }
  ]
}`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.3,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.choices[0].message.content

  try {
    const parsed = JSON.parse(content)
    return parsed.recommendations || []
  } catch {
    console.error('Failed to parse OpenAI response:', content)
    
    // 실제 컬럼 기반 스마트 폴백 (상관관계 + 비율)
    const fallbackPairs = []
    
    // 일반 상관관계
    const commonPairs = [
      ['SiO2', 'Al2O3'], ['SiO2', 'K2O'], ['Al2O3', 'CaO'], 
      ['MgO', 'FeO'], ['Rb', 'Sr'], ['Zr', 'Hf'], ['Y', 'Ho'],
      ['TiO2', 'V'], ['Cr', 'Ni'], ['Ba', 'Rb']
    ]
    
    // 지구화학 비율
    const commonRatios = [
      ['La', 'Sm', 'La/Sm'], ['Rb', 'Sr', 'Rb/Sr'], ['Zr', 'Hf', 'Zr/Hf'],
      ['K2O', 'Na2O', 'K2O/Na2O'], ['Y', 'Ho', 'Y/Ho'], ['Nb', 'Ta', 'Nb/Ta'],
      ['Ba', 'Rb', 'Ba/Rb'], ['Sr', 'Y', 'Sr/Y']
    ]
    
    // 상관관계 추가
    for (const [x, y] of commonPairs) {
      if (columns.includes(x) && columns.includes(y) && fallbackPairs.length < 2) {
        fallbackPairs.push({
          xColumn: x,
          yColumn: y,
          reason: `${x}-${y} geochemical correlation`,
          confidence: 0.7
        })
      }
    }
    
    // 비율 추가
    for (const [x, y, ratioName] of commonRatios) {
      if (columns.includes(x) && columns.includes(y) && fallbackPairs.length < 5) {
        fallbackPairs.push({
          xColumn: x,
          yColumn: y,
          reason: `${ratioName} geochemical ratio`,
          confidence: 0.8,
          isRatio: true,
          ratioName: ratioName
        })
      }
    }
    
    return fallbackPairs
  }
}

// Google AI API 호출
async function getGoogleAIRecommendations({
  columns,
  sampleDescription,
  maxRecommendations,
  apiKey
}: {
  columns: string[]
  sampleDescription?: string
  maxRecommendations: number
  apiKey: string
}): Promise<AIRecommendation[]> {
  const prompt = `Geochemistry expert: Recommend ${Math.min(maxRecommendations, 10)} correlations from: ${columns.join(', ')}

${sampleDescription ? `Sample: ${sampleDescription}` : ''}

Include both element correlations AND ratios (La/Sm, Rb/Sr, etc.). For ratios, set isRatio:true.

JSON:
{"recommendations": [
  {"xColumn": "La", "yColumn": "Sm", "reason": "REE ratio", "confidence": 0.9, "isRatio": true, "ratioName": "La/Sm"},
  {"xColumn": "SiO2", "yColumn": "K2O", "reason": "differentiation", "confidence": 0.8}
]}`

  const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Google AI API Error:', response.status, errorText)
    throw new Error(`Google AI API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  
  // Google AI 응답 구조 확인
  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
    console.error('Invalid Google AI response structure')
    throw new Error('Invalid Google AI response structure')
  }
  
  const content = data.candidates[0].content.parts[0].text

  try {
    const parsed = JSON.parse(content)
    return parsed.recommendations || []
  } catch (error) {
    console.error('Failed to parse Google AI JSON response')
    
    // 실제 컬럼 기반 스마트 폴백 (상관관계 + 비율)
    const fallbackPairs = []
    
    // 일반 상관관계
    const commonPairs = [
      ['SiO2', 'Al2O3'], ['SiO2', 'K2O'], ['Al2O3', 'CaO'], 
      ['MgO', 'FeO'], ['Rb', 'Sr'], ['Zr', 'Hf'], ['Y', 'Ho'],
      ['TiO2', 'V'], ['Cr', 'Ni'], ['Ba', 'Rb']
    ]
    
    // 지구화학 비율
    const commonRatios = [
      ['La', 'Sm', 'La/Sm'], ['Rb', 'Sr', 'Rb/Sr'], ['Zr', 'Hf', 'Zr/Hf'],
      ['K2O', 'Na2O', 'K2O/Na2O'], ['Y', 'Ho', 'Y/Ho'], ['Nb', 'Ta', 'Nb/Ta'],
      ['Ba', 'Rb', 'Ba/Rb'], ['Sr', 'Y', 'Sr/Y']
    ]
    
    // 상관관계 추가
    for (const [x, y] of commonPairs) {
      if (columns.includes(x) && columns.includes(y) && fallbackPairs.length < 2) {
        fallbackPairs.push({
          xColumn: x,
          yColumn: y,
          reason: `${x}-${y} geochemical correlation`,
          confidence: 0.7
        })
      }
    }
    
    // 비율 추가
    for (const [x, y, ratioName] of commonRatios) {
      if (columns.includes(x) && columns.includes(y) && fallbackPairs.length < 5) {
        fallbackPairs.push({
          xColumn: x,
          yColumn: y,
          reason: `${ratioName} geochemical ratio`,
          confidence: 0.8,
          isRatio: true,
          ratioName: ratioName
        })
      }
    }
    
    return fallbackPairs
  }
}

// GET 요청 처리 (API 상태 확인용)
export async function GET() {
  return NextResponse.json({
    status: 'AI Recommendations API is running',
    providers: ['openai', 'google'],
    timestamp: new Date().toISOString()
  })
} 