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
  
  const prompt = `As a geochemistry and statistical analysis expert, provide a comprehensive interpretation of the following PCA and clustering analysis results.

**PCA Analysis Results:**
- Variables analyzed: ${pcaResult.variableNames.join(', ')}
- Number of components: ${pcaResult.nComponents}
- Eigenvalues: ${pcaResult.eigenvalues.map((v: number) => v.toFixed(3)).join(', ')}
- Explained variance ratio: ${pcaResult.explainedVariance.map((v: number) => v.toFixed(2) + '%').join(', ')}
- Cumulative explained variance: ${pcaResult.cumulativeVariance.map((v: number) => v.toFixed(2) + '%').join(', ')}
- Total samples: ${pcaResult.scores.length}

**Clustering Analysis Results:**
- Optimal number of clusters: ${clusteringResult.optimalK}
- Silhouette score: ${clusteringResult.silhouetteScore.toFixed(3)}
${clusteringResult.alternativeK ? `- Alternative cluster count: ${clusteringResult.alternativeK} (silhouette: ${clusteringResult.alternativeSilhouette?.toFixed(3)})` : ''}

**Statistical Test Results:**
${statisticalTests?.bartlett ? `- Bartlett's Test of Sphericity: Chi-Square = ${statisticalTests.bartlett.chiSquare.toFixed(2)}, p-value = ${statisticalTests.bartlett.pValue < 0.001 ? '<0.001' : statisticalTests.bartlett.pValue.toFixed(3)}` : ''}
${statisticalTests?.kmo ? `- KMO Test: ${statisticalTests.kmo.value.toFixed(3)}` : ''}

${sampleNames ? `**Sample Information:** ${sampleNames.length} samples analyzed` : ''}

Please provide a detailed interpretation covering:

1. **PCA Analysis Interpretation:**
   - Significance of eigenvalues (Kaiser criterion: >1)
   - Explained variance interpretation (adequacy of dimensionality reduction)
   - Scree plot interpretation and optimal component selection
   - Overall PCA suitability assessment

2. **Clustering Analysis Interpretation:**
   - Optimal cluster number justification
   - Silhouette score evaluation and data separability
   - Cluster visualization implications
   - Geological/geochemical meaning of cluster patterns

3. **Statistical Validation:**
   - Bartlett's test interpretation (data suitability for PCA)
   - KMO test interpretation (sampling adequacy)
   - Overall statistical significance assessment

4. **Conclusions and Recommendations:**
   - Summary of key findings
   - Data quality assessment
   - Suggestions for further analysis or interpretation

${language === 'both' || language === 'korean' ? 'Provide the interpretation in KOREAN first,' : ''}
${language === 'both' || language === 'english' ? `${language === 'both' ? ' then in ENGLISH.' : 'Provide the interpretation in ENGLISH.'}` : ''}

Format your response as valid JSON only:
{
  ${language === 'both' || language === 'korean' ? '"korean": "한국어 해설...",\n  ' : ''}
  ${language === 'both' || language === 'english' ? '"english": "English interpretation..."' : ''}
}`

  // 타임아웃 설정 (60초)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000)

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
        max_tokens: 4000,
        temperature: 0.3,
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
      throw new Error('OpenAI API request timed out after 60 seconds')
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
  
  if (language === 'korean') {
    return `### PCA 및 클러스터링 분석 결과

**PCA 분석 결과:**
- 분석된 변수: ${pcaResult.variableNames.join(', ')}
- 고유값이 1보다 큰 주성분: ${eigenvaluesAboveOne}개
- 총 설명 분산: ${totalVariance.toFixed(1)}%
- ${totalVariance >= 70 ? '충분한 설명력을 가진' : '추가 분석이 필요한'} 차원 축소 결과

**클러스터링 분석 결과:**
- 최적 클러스터 수: ${clusteringResult.optimalK}개
- 실루엣 점수: ${clusteringResult.silhouetteScore.toFixed(3)}
- ${clusteringResult.silhouetteScore > 0.3 ? '양호한' : '개선이 필요한'} 클러스터 분리도

**통계적 검정:**
${statisticalTests?.bartlett ? `- Bartlett 검정: ${statisticalTests.bartlett.pValue < 0.05 ? 'PCA에 적합한 데이터' : 'PCA 적합성 검토 필요'}` : ''}
${statisticalTests?.kmo ? `- KMO 검정: ${statisticalTests.kmo.value.toFixed(3)} (${statisticalTests.kmo.value > 0.6 ? '적합' : '부적합'})` : ''}

이 분석은 지구화학 데이터의 주요 변동성과 그룹 특성을 파악하는 데 유용한 결과를 제공합니다.`
  } else {
    return `### PCA and Clustering Analysis Results

**PCA Analysis:**
- Variables analyzed: ${pcaResult.variableNames.join(', ')}
- Components with eigenvalues >1: ${eigenvaluesAboveOne}
- Total explained variance: ${totalVariance.toFixed(1)}%
- Dimensionality reduction shows ${totalVariance >= 70 ? 'adequate' : 'limited'} explanatory power

**Clustering Analysis:**
- Optimal clusters: ${clusteringResult.optimalK}
- Silhouette score: ${clusteringResult.silhouetteScore.toFixed(3)}
- Cluster separation is ${clusteringResult.silhouetteScore > 0.3 ? 'good' : 'moderate'}

**Statistical Tests:**
${statisticalTests?.bartlett ? `- Bartlett's test: Data is ${statisticalTests.bartlett.pValue < 0.05 ? 'suitable' : 'questionable'} for PCA` : ''}
${statisticalTests?.kmo ? `- KMO test: ${statisticalTests.kmo.value.toFixed(3)} (${statisticalTests.kmo.value > 0.6 ? 'adequate' : 'inadequate'})` : ''}

This analysis provides valuable insights into the main variability patterns and group characteristics of the geochemical data.`
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