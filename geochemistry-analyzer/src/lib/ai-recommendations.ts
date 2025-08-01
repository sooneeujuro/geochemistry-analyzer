export interface AIRecommendation {
  xColumn: string
  yColumn: string
  reason: string
  confidence: number
  geochemicalSignificance: string
}

export interface AIRecommendationRequest {
  numericColumns: string[]
  sampleDescription?: string
  rockTypes?: string[]
  apiKey: string
  provider: 'openai' | 'google'
}

// OpenAI API 호출
export async function getOpenAIRecommendations(
  request: AIRecommendationRequest
): Promise<AIRecommendation[]> {
  const prompt = `
당신은 지구화학 데이터 분석 전문가입니다. 다음 지구화학 원소 데이터 컬럼들을 분석하여 가장 유의미한 상관관계를 가질 수 있는 조합들을 추천해주세요.

**분석할 컬럼들:**
${request.numericColumns.join(', ')}

${request.sampleDescription ? `**샘플 설명:** ${request.sampleDescription}` : ''}
${request.rockTypes ? `**암석 타입:** ${request.rockTypes.join(', ')}` : ''}

**요청사항:**
1. 지구화학적으로 의미있는 상관관계를 가질 가능성이 높은 조합 10-15개를 추천해주세요
2. 각 조합에 대해 지구화학적 의미와 신뢰도(1-10)를 설명해주세요
3. 다음 JSON 형식으로 응답해주세요:

{
  "recommendations": [
    {
      "xColumn": "SiO2",
      "yColumn": "Al2O3", 
      "reason": "규산염 광물의 주성분으로 강한 양의 상관관계 예상",
      "confidence": 9,
      "geochemicalSignificance": "마그마 분화과정에서 장석의 결정분화 지시"
    }
  ]
}

중요한 지구화학 관계들:
- SiO2 vs 알칼리원소 (분화지수)
- MgO vs FeO (올리빈-휘석 관계)
- Al2O3 vs CaO (사장석 관계)
- 알칼리비율 (K2O/Na2O)
- 호환/불호환 원소 관계
`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${request.apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2000
    })
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(`OpenAI API 오류: ${errorData.error?.message || response.statusText}`)
  }

  const data = await response.json()
  const content = data.choices[0]?.message?.content

  if (!content) {
    throw new Error('AI 응답을 받을 수 없습니다.')
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('AI 응답 형식이 올바르지 않습니다.')
  }

  const parsed = JSON.parse(jsonMatch[0])
  return parsed.recommendations || []
}

// Google Cloud AI (Gemini) API 호출
export async function getGoogleAIRecommendations(
  request: AIRecommendationRequest
): Promise<AIRecommendation[]> {
  const prompt = `
당신은 지구화학 데이터 분석 전문가입니다. 다음 지구화학 원소 데이터 컬럼들을 분석하여 가장 유의미한 상관관계를 가질 수 있는 조합들을 추천해주세요.

**분석할 컬럼들:**
${request.numericColumns.join(', ')}

${request.sampleDescription ? `**샘플 설명:** ${request.sampleDescription}` : ''}
${request.rockTypes ? `**암석 타입:** ${request.rockTypes.join(', ')}` : ''}

**요청사항:**
지구화학적으로 의미있는 상관관계를 가질 가능성이 높은 조합 10-15개를 추천하고, JSON 형식으로 응답해주세요:

{
  "recommendations": [
    {
      "xColumn": "SiO2",
      "yColumn": "Al2O3", 
      "reason": "규산염 광물의 주성분으로 강한 양의 상관관계 예상",
      "confidence": 9,
      "geochemicalSignificance": "마그마 분화과정에서 장석의 결정분화 지시"
    }
  ]
}
`

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${request.apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2000,
      }
    })
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(`Google AI API 오류: ${errorData.error?.message || response.statusText}`)
  }

  const data = await response.json()
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!content) {
    throw new Error('Google AI 응답을 받을 수 없습니다.')
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('AI 응답 형식이 올바르지 않습니다.')
  }

  const parsed = JSON.parse(jsonMatch[0])
  return parsed.recommendations || []
}

// 통합 AI 추천 함수
export async function getAIRecommendations(
  request: AIRecommendationRequest
): Promise<AIRecommendation[]> {
  if (!request.apiKey) {
    throw new Error('API 키가 필요합니다.')
  }

  try {
    if (request.provider === 'openai') {
      return await getOpenAIRecommendations(request)
    } else if (request.provider === 'google') {
      return await getGoogleAIRecommendations(request)
    } else {
      throw new Error('지원하지 않는 AI 제공자입니다.')
    }
  } catch (error) {
    console.error('AI 추천 오류:', error)
    throw error
  }
}

export function estimateAPICost(numericColumns: number, provider: 'openai' | 'google'): { tokens: number, cost: number } {
  const baseTokens = 500 // 기본 프롬프트
  const columnTokens = numericColumns * 10 // 컬럼당 토큰
  const responseTokens = 800 // 예상 응답 토큰
  
  const totalTokens = baseTokens + columnTokens + responseTokens
  
  let cost = 0
  if (provider === 'openai') {
    // GPT-4 가격: $0.03/1K input tokens, $0.06/1K output tokens
    const inputCost = (baseTokens + columnTokens) / 1000 * 0.03
    const outputCost = responseTokens / 1000 * 0.06
    cost = inputCost + outputCost
  } else if (provider === 'google') {
    // Gemini 가격: $0.000125/1K input tokens, $0.000375/1K output tokens
    const inputCost = (baseTokens + columnTokens) / 1000 * 0.000125
    const outputCost = responseTokens / 1000 * 0.000375
    cost = inputCost + outputCost
  }
  
  return {
    tokens: totalTokens,
    cost: Math.round(cost * 1000) / 1000 // 소수점 3자리
  }
} 

// PCA 해설을 위한 타입 정의
export interface PCAInterpretationRequest {
  pcaResult: {
    eigenvalues: number[]
    explainedVariance: number[]
    cumulativeVariance: number[]
    variableNames: string[]
    nComponents: number
    scores: number[][]
    loadings: number[][]
  }
  clusteringResult: {
    clusters: number[]
    optimalK: number
    silhouetteScore: number
    alternativeK?: number
    alternativeSilhouette?: number
  }
  statisticalTests?: {
    bartlett?: {
      chiSquare: number
      pValue: number
    }
    kmo?: {
      value: number
    }
  }
  sampleNames?: string[]
  language?: 'korean' | 'english' | 'both'
  provider?: 'openai' | 'google'
}

export interface PCAInterpretation {
  korean: string
  english: string
  metadata: {
    provider: string
    timestamp: string
    analysisType: 'comprehensive_pca_interpretation'
  }
}

export interface PCAInterpretationResponse {
  success: boolean
  interpretation: PCAInterpretation
  timestamp: string
}

// PCA 해설 생성 함수
export async function generatePCAInterpretation(
  request: PCAInterpretationRequest
): Promise<PCAInterpretationResponse> {
  try {
    // 타임아웃 설정 (60초로 단축 - 라이트 버전)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)

    const response = await fetch('/api/pca-interpretation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    // 응답 상태 확인
    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`
      
      try {
        const errorData = await response.json()
        errorMessage = errorData.error || errorMessage
      } catch (parseError) {
        // JSON 파싱 실패 시 응답 텍스트 확인
        try {
          const errorText = await response.text()
          if (errorText.includes('504') || errorText.includes('Gateway')) {
            throw new Error('504 Gateway Timeout - AI 서비스 응답 시간 초과')
          } else if (errorText.includes('502') || errorText.includes('Bad Gateway')) {
            throw new Error('502 Bad Gateway - AI 서비스 연결 실패')
          } else {
            errorMessage = errorText.slice(0, 100) // 에러 텍스트 일부만 포함
          }
        } catch (textError) {
          // 텍스트도 읽을 수 없는 경우
        }
      }
      
      throw new Error(errorMessage)
    }

    // 응답 데이터 파싱
    const data: PCAInterpretationResponse = await response.json()
    
    // 응답 구조 검증
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response structure - 응답 형식이 올바르지 않습니다')
    }
    
    if (!data.interpretation) {
      throw new Error('Missing interpretation data - 해설 데이터가 없습니다')
    }
    
    return data
    
  } catch (error) {
    console.error('PCA Interpretation Error:', error)
    
    // 에러 타입별 처리
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('timeout - 요청이 시간 초과되었습니다 (60초)')
      } else if (error.message.includes('504') || error.message.includes('Gateway Timeout')) {
        throw new Error('504 - AI 서비스 응답 시간 초과')
      } else if (error.message.includes('502') || error.message.includes('Bad Gateway')) {
        throw new Error('502 - AI 서비스 연결 실패')
      } else if (error.message.includes('fetch')) {
        throw new Error('network - 네트워크 연결 오류')
      } else if (error.message.includes('JSON') || error.message.includes('Unexpected token')) {
        throw new Error('JSON - 응답 파싱 오류')
      } else if (error.message.includes('API key')) {
        throw new Error('API key - AI 서비스 인증 오류')
      }
    }
    
    throw error
  }
}

// PCA 결과에서 통계적 검정 결과 추출 (추후 statistics.ts에서 구현될 예정)
export function extractStatisticalTests(pcaData: any): {
  bartlett?: { chiSquare: number; pValue: number }
  kmo?: { value: number }
} {
  // 이 함수는 statistics.ts에서 실제 통계 검정이 구현되면 업데이트됩니다
  return {
    // 임시 더미 데이터 - 실제로는 statistics.ts에서 계산된 값을 사용
    bartlett: {
      chiSquare: 117.60,
      pValue: 0.0
    },
    kmo: {
      value: 0.612
    }
  }
} 