import { NextRequest, NextResponse } from 'next/server'

interface PCAInterpretationRequest {
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

interface PCAInterpretation {
  korean: string
  english: string
  metadata: {
    provider: string
    timestamp: string
    analysisType: 'comprehensive_pca_interpretation'
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: PCAInterpretationRequest = await request.json()
    const { 
      pcaResult, 
      clusteringResult, 
      statisticalTests, 
      sampleNames,
      language = 'both',
      provider = 'openai' 
    } = body

    // 입력 검증
    if (!pcaResult || !clusteringResult) {
      return NextResponse.json(
        { 
          error: 'PCA result and clustering result are required',
          success: false 
        },
        { status: 400 }
      )
    }

    // 서버 환경변수에서 API 키 가져오기
    const openaiKey = process.env.OPENAI_API_KEY
    const googleKey = process.env.GOOGLE_AI_API_KEY

    if (provider === 'openai' && !openaiKey) {
      return NextResponse.json(
        { 
          error: 'OpenAI API key not configured on server',
          success: false 
        },
        { status: 500 }
      )
    }

    if (provider === 'google' && !googleKey) {
      return NextResponse.json(
        { 
          error: 'Google AI API key not configured on server',
          success: false 
        },
        { status: 500 }
      )
    }

    let interpretation: PCAInterpretation

    try {
      if (provider === 'openai') {
        interpretation = await getOpenAIInterpretation({
          pcaResult,
          clusteringResult,
          statisticalTests,
          sampleNames,
          language,
          apiKey: openaiKey!
        })
      } else {
        interpretation = await getGoogleAIInterpretation({
          pcaResult,
          clusteringResult,
          statisticalTests,
          sampleNames,
          language,
          apiKey: googleKey!
        })
      }

      return NextResponse.json({
        success: true,
        interpretation,
        timestamp: new Date().toISOString()
      })

    } catch (apiError) {
      console.error('AI API Error:', apiError)
      
      // API 호출 실패 시 폴백 해설 제공
      const fallbackInterpretation: PCAInterpretation = {
        korean: generateFallbackInterpretation(pcaResult, clusteringResult, statisticalTests, 'korean'),
        english: generateFallbackInterpretation(pcaResult, clusteringResult, statisticalTests, 'english'),
        metadata: {
          provider: `${provider}-fallback`,
          timestamp: new Date().toISOString(),
          analysisType: 'comprehensive_pca_interpretation'
        }
      }

      return NextResponse.json({
        success: true,
        interpretation: fallbackInterpretation,
        timestamp: new Date().toISOString(),
        note: 'AI service unavailable, showing basic interpretation'
      })
    }

  } catch (error) {
    console.error('PCA Interpretation API Error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error occurred',
        success: false,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// OpenAI API를 사용한 PCA 해설 생성
async function getOpenAIInterpretation({
  pcaResult,
  clusteringResult,
  statisticalTests,
  sampleNames,
  language,
  apiKey
}: {
  pcaResult: any
  clusteringResult: any
  statisticalTests?: any
  sampleNames?: string[]
  language: string
  apiKey: string
}): Promise<PCAInterpretation> {
  
  const prompt = `Geochemistry PCA Analysis Expert: Provide concise interpretation.

**Data Summary:**
Variables: ${pcaResult.variableNames.join(', ')}
Components: ${pcaResult.nComponents}
Eigenvalues: ${pcaResult.eigenvalues.map((v: number) => v.toFixed(2)).join(', ')}
Explained Variance: ${pcaResult.explainedVariance.map((v: number) => v.toFixed(1) + '%').join(', ')}
Clusters: ${clusteringResult.optimalK} (silhouette: ${clusteringResult.silhouetteScore.toFixed(2)})
${statisticalTests?.bartlett ? `Bartlett p=${statisticalTests.bartlett.pValue < 0.001 ? '<0.001' : statisticalTests.bartlett.pValue.toFixed(3)}` : ''}
${statisticalTests?.kmo ? `KMO=${statisticalTests.kmo.value.toFixed(2)}` : ''}

**Brief Interpretation Needed:**
1. PCA suitability (eigenvalues >1, explained variance adequacy)
2. Optimal components selection reasoning  
3. Clustering validity (silhouette score meaning)
4. Key geological/geochemical insights
5. Data quality assessment

${language === 'both' ? 'Provide in KOREAN and ENGLISH.' : language === 'korean' ? 'Provide in KOREAN only.' : 'Provide in ENGLISH only.'}

**Respond in JSON format only:**
{
  ${language === 'both' || language === 'korean' ? '"korean": "간결한 한국어 해설...",\n  ' : ''}
  ${language === 'both' || language === 'english' ? '"english": "Concise English interpretation..."' : ''}
}`

  // 타임아웃 설정 (45초로 단축)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 45000)

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,  // 4000에서 1500으로 감소
        temperature: 0.2,  // 0.3에서 0.2로 감소 (더 일관된 응답)
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid OpenAI API response structure')
    }
    
    const content = data.choices[0].message.content

    try {
      const parsed = JSON.parse(content)
      return {
        korean: parsed.korean || '',
        english: parsed.english || '',
        metadata: {
          provider: 'openai',
          timestamp: new Date().toISOString(),
          analysisType: 'comprehensive_pca_interpretation'
        }
      }
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content)
      console.error('Parse error:', parseError)
      
      // JSON 파싱 실패 시, 원본 텍스트를 적절한 언어에 할당
      const fallbackText = content || 'AI 해설 생성 중 오류가 발생했습니다.'
      
      return {
        korean: language === 'korean' || language === 'both' ? fallbackText : '',
        english: language === 'english' || language === 'both' ? fallbackText : '',
        metadata: {
          provider: 'openai-parsed',
          timestamp: new Date().toISOString(),
          analysisType: 'comprehensive_pca_interpretation'
        }
      }
    }

  } catch (error) {
    clearTimeout(timeoutId)
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OpenAI API request timed out after 45 seconds')
    }
    
    throw error
  }
}

// Google AI API를 사용한 PCA 해설 생성
async function getGoogleAIInterpretation({
  pcaResult,
  clusteringResult,
  statisticalTests,
  sampleNames,
  language,
  apiKey
}: {
  pcaResult: any
  clusteringResult: any
  statisticalTests?: any
  sampleNames?: string[]
  language: string
  apiKey: string
}): Promise<PCAInterpretation> {
  
  const prompt = `Geochemistry expert: Interpret PCA/clustering results.

Data: ${pcaResult.variableNames.join(', ')}
PCA: ${pcaResult.nComponents} components, eigenvalues: ${pcaResult.eigenvalues.map((v: number) => v.toFixed(2)).join(', ')}
Variance: ${pcaResult.explainedVariance.map((v: number) => v.toFixed(1) + '%').join(', ')}
Clusters: ${clusteringResult.optimalK} (silhouette: ${clusteringResult.silhouetteScore.toFixed(2)})
${statisticalTests?.bartlett ? `Bartlett p=${statisticalTests.bartlett.pValue.toFixed(3)}` : ''}
${statisticalTests?.kmo ? `KMO=${statisticalTests.kmo.value.toFixed(2)}` : ''}

Provide comprehensive interpretation in ${language === 'both' ? 'both Korean and English' : language}.

JSON format:
{
  ${language === 'both' || language === 'korean' ? '"korean": "한국어 해설...",\n  ' : ''}
  ${language === 'both' || language === 'english' ? '"english": "English interpretation..."' : ''}
}`

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
    throw new Error(`Google AI API error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.candidates[0].content.parts[0].text

  try {
    const parsed = JSON.parse(content)
    return {
      korean: parsed.korean || '',
      english: parsed.english || '',
      metadata: {
        provider: 'google',
        timestamp: new Date().toISOString(),
        analysisType: 'comprehensive_pca_interpretation'
      }
    }
  } catch (parseError) {
    console.error('Failed to parse Google AI response:', content)
    
    return {
      korean: generateFallbackInterpretation(pcaResult, clusteringResult, statisticalTests, 'korean'),
      english: generateFallbackInterpretation(pcaResult, clusteringResult, statisticalTests, 'english'),
      metadata: {
        provider: 'google-fallback',
        timestamp: new Date().toISOString(),
        analysisType: 'comprehensive_pca_interpretation'
      }
    }
  }
}

// AI API 실패 시 기본 해설 생성
function generateFallbackInterpretation(
  pcaResult: any, 
  clusteringResult: any, 
  statisticalTests: any, 
  language: 'korean' | 'english'
): string {
  const eigenvaluesAboveOne = pcaResult.eigenvalues.filter((v: number) => v > 1).length
  const totalVariance = pcaResult.cumulativeVariance[pcaResult.cumulativeVariance.length - 1]
  const pc1Var = pcaResult.explainedVariance[0]
  const pc2Var = pcaResult.explainedVariance[1] || 0
  
  if (language === 'korean') {
    return `### 📊 PCA 분석 요약

**🔍 주성분 분석:**
• 변수: ${pcaResult.variableNames.join(', ')}
• 유효 주성분: ${eigenvaluesAboveOne}개 (고유값 >1)
• PC1 설명력: ${pc1Var.toFixed(1)}%, PC2: ${pc2Var.toFixed(1)}%
• 총 설명분산: ${totalVariance.toFixed(1)}% ${totalVariance >= 70 ? '✅ 충분' : '⚠️ 보통'}

**🎯 클러스터링:**
• 최적 클러스터: ${clusteringResult.optimalK}개
• 실루엣 점수: ${clusteringResult.silhouetteScore.toFixed(2)} ${clusteringResult.silhouetteScore > 0.3 ? '✅ 양호' : '⚠️ 개선필요'}

**📈 해석:**
${eigenvaluesAboveOne >= 2 ? '주성분 분석이 적절히 수행되었으며' : '주성분 수를 재검토할 필요가 있고'}, ${clusteringResult.silhouetteScore > 0.3 ? '클러스터 구분이 명확합니다' : '클러스터 분리도 개선이 필요합니다'}.

*AI 서비스 일시 중단으로 기본 해석을 제공합니다.*`
  } else {
    return `### 📊 PCA Analysis Summary

**🔍 Principal Components:**
• Variables: ${pcaResult.variableNames.join(', ')}
• Valid components: ${eigenvaluesAboveOne} (eigenvalues >1)
• PC1 variance: ${pc1Var.toFixed(1)}%, PC2: ${pc2Var.toFixed(1)}%
• Total explained: ${totalVariance.toFixed(1)}% ${totalVariance >= 70 ? '✅ Adequate' : '⚠️ Moderate'}

**🎯 Clustering:**
• Optimal clusters: ${clusteringResult.optimalK}
• Silhouette score: ${clusteringResult.silhouetteScore.toFixed(2)} ${clusteringResult.silhouetteScore > 0.3 ? '✅ Good' : '⚠️ Needs improvement'}

**📈 Interpretation:**
The PCA ${eigenvaluesAboveOne >= 2 ? 'performed adequately' : 'may need component review'} and clustering ${clusteringResult.silhouetteScore > 0.3 ? 'shows clear separation' : 'requires separation improvement'}.

*Basic interpretation provided due to temporary AI service unavailability.*`
  }
}

// GET 요청 처리 (API 상태 확인용)
export async function GET() {
  return NextResponse.json({
    status: 'PCA Interpretation API is running',
    providers: ['openai', 'google'],
    languages: ['korean', 'english', 'both'],
    timestamp: new Date().toISOString()
  })
} 