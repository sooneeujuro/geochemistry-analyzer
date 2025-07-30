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
    console.error('AI Recommendations API Error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('Request body:', requestBody)
    console.error('Environment check:', {
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasGoogleKey: !!process.env.GOOGLE_AI_API_KEY,
      openaiKeyLength: process.env.OPENAI_API_KEY?.length || 0,
      googleKeyLength: process.env.GOOGLE_AI_API_KEY?.length || 0
    })
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
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
  const prompt = `You are a geochemistry expert. Analyze these geochemical variables and recommend the most scientifically meaningful element/oxide ratio combinations for correlation analysis.

Variables: ${columns.join(', ')}
${sampleDescription ? `Sample context: ${sampleDescription}` : ''}

Please recommend ${maxRecommendations} variable pairs that would show geochemically significant correlations, considering:
- Mineral chemistry relationships
- Petrogenetic processes
- Geochemical behavior
- Alteration patterns

For each recommendation, provide:
1. X-axis variable
2. Y-axis variable  
3. Scientific reason (brief)
4. Confidence score (0-1)

Respond in JSON format:
{
  "recommendations": [
    {
      "xColumn": "variable1",
      "yColumn": "variable2", 
      "reason": "Scientific explanation",
      "confidence": 0.9
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
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 2000,
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
    return []
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
  const prompt = `You are a geochemistry expert. Analyze these geochemical variables and recommend the most scientifically meaningful element/oxide ratio combinations for correlation analysis.

Variables: ${columns.join(', ')}
${sampleDescription ? `Sample context: ${sampleDescription}` : ''}

Please recommend ${maxRecommendations} variable pairs that would show geochemically significant correlations. Respond in JSON format with "recommendations" array containing objects with "xColumn", "yColumn", "reason", and "confidence" fields.`

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
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
  console.log('Google AI Response:', JSON.stringify(data, null, 2))
  
  // Google AI 응답 구조 확인
  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
    console.error('Unexpected Google AI response structure:', data)
    throw new Error('Invalid Google AI response structure')
  }
  
  const content = data.candidates[0].content.parts[0].text

  try {
    const parsed = JSON.parse(content)
    return parsed.recommendations || []
  } catch (error) {
    console.error('Failed to parse Google AI response:', content)
    console.error('Parse error:', error)
    return []
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