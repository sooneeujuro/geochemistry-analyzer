import { NextRequest, NextResponse } from 'next/server'

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
        columns,
        sampleDescription,
        maxRecommendations,
        apiKey: openaiKey!
      })
    } else {
      recommendations = await getGoogleAIRecommendations({
        columns,
        sampleDescription,
        maxRecommendations,
        apiKey: googleKey!
      })
    }

    return NextResponse.json({
      success: true,
      recommendations,
      provider,
      timestamp: new Date().toISOString()
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
  const prompt = `As a geochemistry expert, analyze these variables and recommend ${Math.min(maxRecommendations, 8)} scientifically meaningful pairs for correlation analysis:

Variables: ${columns.join(', ')}
${sampleDescription ? `Context: ${sampleDescription}` : ''}

Focus on:
- Major/trace element correlations (SiO2-K2O, Rb-Sr, etc.)
- Mineral chemistry relationships (Al2O3-CaO, MgO-FeO)
- Petrogenetic processes (differentiation, alteration)
- REE patterns if present

Return JSON only:
{
  "recommendations": [
    {
      "xColumn": "element1", 
      "yColumn": "element2",
      "reason": "specific geochemical significance",
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
    
    // 실제 컬럼 기반 스마트 폴백
    const fallbackPairs = []
    const commonPairs = [
      ['SiO2', 'Al2O3'], ['SiO2', 'K2O'], ['Al2O3', 'CaO'], 
      ['MgO', 'FeO'], ['Rb', 'Sr'], ['Zr', 'Hf'], ['Y', 'Ho'],
      ['TiO2', 'V'], ['Cr', 'Ni'], ['Ba', 'Rb']
    ]
    
    for (const [x, y] of commonPairs) {
      if (columns.includes(x) && columns.includes(y) && fallbackPairs.length < 3) {
        fallbackPairs.push({
          xColumn: x,
          yColumn: y,
          reason: `${x}-${y} geochemical correlation`,
          confidence: 0.7
        })
      }
    }
    
    return fallbackPairs.length > 0 ? fallbackPairs : []
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
  const prompt = `Geochemistry expert: Recommend ${Math.min(maxRecommendations, 8)} scientifically meaningful variable pairs from: ${columns.join(', ')}

${sampleDescription ? `Sample: ${sampleDescription}` : ''}

Consider major elements (SiO2, Al2O3, etc.), trace elements, REE patterns, and mineral chemistry. 

JSON format:
{"recommendations": [{"xColumn": "actual_variable", "yColumn": "actual_variable", "reason": "geochemical significance", "confidence": 0.8}]}`

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
    
    // 실제 컬럼 기반 스마트 폴백
    const fallbackPairs = []
    const commonPairs = [
      ['SiO2', 'Al2O3'], ['SiO2', 'K2O'], ['Al2O3', 'CaO'], 
      ['MgO', 'FeO'], ['Rb', 'Sr'], ['Zr', 'Hf'], ['Y', 'Ho'],
      ['TiO2', 'V'], ['Cr', 'Ni'], ['Ba', 'Rb']
    ]
    
    for (const [x, y] of commonPairs) {
      if (columns.includes(x) && columns.includes(y) && fallbackPairs.length < 3) {
        fallbackPairs.push({
          xColumn: x,
          yColumn: y,
          reason: `${x}-${y} geochemical correlation`,
          confidence: 0.7
        })
      }
    }
    
    return fallbackPairs.length > 0 ? fallbackPairs : []
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