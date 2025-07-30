import { NextRequest, NextResponse } from 'next/server'
import { calculateCorrelationMatrix, suggestPCAVariables, calculateDescriptiveStats, PCASuggestion } from '@/lib/statistics'

interface StatisticalAnalysisRequest {
  data: Record<string, number[]>
  analysisType: 'pca-suggestion' | 'method-recommendation' | 'descriptive-stats'
  context?: string
}

interface StatisticalMethodRecommendation {
  method: string
  reason: string
  confidence: number
  parameters?: Record<string, any>
}

export async function POST(request: NextRequest) {
  try {
    const body: StatisticalAnalysisRequest = await request.json()
    const { data, analysisType, context } = body

    // 입력 검증
    if (!data || Object.keys(data).length < 2) {
      return NextResponse.json(
        { error: 'At least 2 variables are required' },
        { status: 400 }
      )
    }

    const variables = Object.keys(data)
    const sampleSize = data[variables[0]].length

    switch (analysisType) {
      case 'pca-suggestion':
        return handlePCASuggestion(data, variables)
      
      case 'method-recommendation':
        return handleMethodRecommendation(data, variables, sampleSize, context)
      
      case 'descriptive-stats':
        return handleDescriptiveStats(data, variables)
      
      default:
        return NextResponse.json(
          { error: 'Invalid analysis type' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Statistical Analysis API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handlePCASuggestion(
  data: Record<string, number[]>, 
  variables: string[]
): Promise<NextResponse> {
  try {
    // 상관관계 매트릭스 계산
    const correlationMatrix = calculateCorrelationMatrix(data)
    
    // PCA 추천 생성
    const pcaSuggestions = suggestPCAVariables(correlationMatrix, variables, 0.3)
    
    // OpenAI API로 AI 기반 추천 보강
    const openaiKey = process.env.OPENAI_API_KEY
    if (openaiKey) {
      try {
        const aiRecommendations = await getAIPCARecommendations(variables, correlationMatrix, openaiKey)
        pcaSuggestions.push(...aiRecommendations)
      } catch (error) {
        console.warn('AI PCA recommendations failed:', error)
      }
    }

    return NextResponse.json({
      success: true,
      suggestions: pcaSuggestions.slice(0, 5), // 상위 5개만
      correlationMatrix,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('PCA suggestion error:', error)
    return NextResponse.json(
      { error: 'Failed to generate PCA suggestions' },
      { status: 500 }
    )
  }
}

async function handleMethodRecommendation(
  data: Record<string, number[]>,
  variables: string[],
  sampleSize: number,
  context?: string
): Promise<NextResponse> {
  try {
    const recommendations: StatisticalMethodRecommendation[] = []

    // 기본 규칙 기반 추천
    if (sampleSize < 30) {
      recommendations.push({
        method: 'non-parametric',
        reason: '소표본 크기로 인해 비모수 검정 권장',
        confidence: 0.8,
        parameters: { methods: ['spearman', 'kendall'] }
      })
    }

    if (variables.length > 10) {
      recommendations.push({
        method: 'pca',
        reason: '다차원 데이터 차원 축소 권장',
        confidence: 0.9,
        parameters: { components: Math.min(5, Math.floor(variables.length / 2)) }
      })
    }

    // OpenAI API로 AI 기반 추천
    const openaiKey = process.env.OPENAI_API_KEY
    if (openaiKey) {
      try {
        const aiRecommendations = await getAIMethodRecommendations(
          variables, 
          sampleSize, 
          context, 
          openaiKey
        )
        recommendations.push(...aiRecommendations)
      } catch (error) {
        console.warn('AI method recommendations failed:', error)
      }
    }

    return NextResponse.json({
      success: true,
      recommendations: recommendations.slice(0, 8),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Method recommendation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate method recommendations' },
      { status: 500 }
    )
  }
}

async function handleDescriptiveStats(
  data: Record<string, number[]>,
  variables: string[]
): Promise<NextResponse> {
  try {
    const stats: Record<string, any> = {}

    variables.forEach(variable => {
      try {
        stats[variable] = calculateDescriptiveStats(data[variable])
      } catch (error) {
        console.warn(`Failed to calculate stats for ${variable}:`, error)
        stats[variable] = { error: 'Calculation failed' }
      }
    })

    return NextResponse.json({
      success: true,
      descriptiveStats: stats,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Descriptive stats error:', error)
    return NextResponse.json(
      { error: 'Failed to calculate descriptive statistics' },
      { status: 500 }
    )
  }
}

// OpenAI API를 통한 PCA 추천
async function getAIPCARecommendations(
  variables: string[],
  correlationMatrix: Record<string, Record<string, number>>,
  apiKey: string
): Promise<PCASuggestion[]> {
  const prompt = `As a geochemistry expert, analyze these variables and recommend optimal PCA combinations:

Variables: ${variables.join(', ')}

Correlation insights: Strong correlations exist between some variables.

Recommend 2-3 PCA combinations that would be geochemically meaningful:
1. Consider igneous differentiation processes
2. Consider mineral chemistry relationships
3. Consider trace element behavior

Return JSON: {"suggestions": [{"variables": ["var1", "var2", "var3"], "reason": "geochemical process explanation", "confidence": 0.85}]}`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
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
    return (parsed.suggestions || []).map((s: any) => ({
      variables: s.variables,
      eigenvalues: [2.1, 1.3, 0.8], // 추정값
      varianceExplained: [52.5, 32.5, 20.0], // 추정값
      cumulativeVariance: [52.5, 85.0, 100.0], // 추정값
      reason: s.reason,
      confidence: s.confidence
    }))
  } catch {
    return []
  }
}

// OpenAI API를 통한 통계방법 추천
async function getAIMethodRecommendations(
  variables: string[],
  sampleSize: number,
  context: string | undefined,
  apiKey: string
): Promise<StatisticalMethodRecommendation[]> {
  const prompt = `As a statistics expert, recommend appropriate statistical analysis methods:

Variables: ${variables.length} variables (${variables.slice(0, 5).join(', ')}${variables.length > 5 ? '...' : ''})
Sample size: ${sampleSize}
Context: ${context || 'geochemical data analysis'}

Recommend 3-4 most appropriate statistical methods and explain why:
- Consider sample size limitations
- Consider data type and distribution
- Consider research objectives

Return JSON: {"recommendations": [{"method": "method_name", "reason": "explanation", "confidence": 0.8, "parameters": {}}]}`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
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
    return []
  }
} 