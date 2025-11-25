'use client'

import { useState, useEffect } from 'react'
import { GeochemData, ColumnSelection } from '@/types/geochem'
import {
  performSmartInsight,
  SmartInsightResult,
  InsightCandidate,
  InsightTag,
  ColumnClassification,
  classifyColumns
} from '@/lib/smart-insight'

// AI 해석 결과 타입
interface AIInsightResult {
  title: string
  summary: string
  mechanism: string
  geological_meaning: string
  warning?: string | null
}
import {
  Brain,
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  ChevronRight,
  X,
  Loader2,
  BarChart3,
  Zap,
  Eye,
  MessageSquare,
  Scale
} from 'lucide-react'

interface SmartInsightProps {
  data: GeochemData
  selectedTypeColumn?: string
  onSelectPair: (xColumn: string, yColumn: string) => void
  onDataUpdate?: (data: GeochemData) => void  // PCA 결과 반영
  onModeChange?: (mode: 'analysis' | 'scan') => void  // 분석 모드로 전환
  cachedResult?: SmartInsightResult | null
  onResultChange?: (result: SmartInsightResult | null) => void
}

export default function SmartInsight({
  data,
  selectedTypeColumn,
  onSelectPair,
  onDataUpdate,
  onModeChange,
  cachedResult,
  onResultChange
}: SmartInsightProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<SmartInsightResult | null>(cachedResult || null)
  const [selectedCandidate, setSelectedCandidate] = useState<InsightCandidate | null>(null)
  const [aiInterpretation, setAiInterpretation] = useState<AIInsightResult | null>(null)
  const [isLoadingAI, setIsLoadingAI] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [sampleDescription, setSampleDescription] = useState('')
  const [columnClassification, setColumnClassification] = useState<ColumnClassification | null>(null)
  const [isClassifying, setIsClassifying] = useState(false)
  const [isRunningPCA, setIsRunningPCA] = useState(false)

  // 샘플 데이터 추출 (min, max, median, outliers)
  const extractSampleData = (chartData: Array<{ x: number; y: number }>) => {
    if (!chartData || chartData.length === 0) return null

    // X 기준 정렬
    const sortedByX = [...chartData].sort((a, b) => a.x - b.x)
    const sortedByY = [...chartData].sort((a, b) => a.y - b.y)

    const min = sortedByX[0]
    const max = sortedByX[sortedByX.length - 1]
    const medianIdx = Math.floor(sortedByX.length / 2)
    const median = sortedByX[medianIdx]

    // 이상치 찾기: 선형 회귀에서 가장 멀리 떨어진 점들
    const n = chartData.length
    const sumX = chartData.reduce((s, p) => s + p.x, 0)
    const sumY = chartData.reduce((s, p) => s + p.y, 0)
    const meanX = sumX / n
    const meanY = sumY / n

    // 간단한 선형 회귀
    let num = 0, den = 0
    chartData.forEach(p => {
      num += (p.x - meanX) * (p.y - meanY)
      den += (p.x - meanX) ** 2
    })
    const slope = den !== 0 ? num / den : 0
    const intercept = meanY - slope * meanX

    // 잔차(residual) 계산
    const residuals = chartData.map(p => ({
      ...p,
      residual: Math.abs(p.y - (slope * p.x + intercept))
    }))

    // 잔차가 큰 상위 3개를 이상치로
    const outliers = residuals
      .sort((a, b) => b.residual - a.residual)
      .slice(0, 3)
      .map(p => ({ x: p.x, y: p.y }))

    return { min, max, median, outliers }
  }

  // PCA 분석 실행
  const runPCAAnalysis = async (variables: string[]) => {
    if (variables.length < 2) {
      alert('최소 2개 이상의 변수가 필요합니다.')
      return
    }

    setIsRunningPCA(true)

    try {
      // PCA 분석 실행
      const { performPCA } = await import('@/lib/statistics')
      const pcaResult = performPCA(data.data, variables, 2) // 2 주성분 계산

      // PC1, PC2와 클러스터 정보를 데이터에 추가
      const enhancedData = data.data.map((row: Record<string, any>, index: number) => {
        const scores = pcaResult.scores[index]
        return {
          ...row,
          PC1: scores ? scores[0] : 0,
          PC2: scores ? scores[1] : 0,
          PCA_Cluster: pcaResult.clusters[index] || 0
        }
      })

      // 업데이트된 데이터 생성
      const updatedData: GeochemData = {
        ...data,
        data: enhancedData,
        numericColumns: [...data.numericColumns.filter(col => col !== 'PC1' && col !== 'PC2'), 'PC1', 'PC2'],
        pcaResult: pcaResult
      }

      // 부모 컴포넌트에 데이터 업데이트
      if (onDataUpdate) {
        onDataUpdate(updatedData)
      }

      // PC1 vs PC2를 분석 패널에서 선택하도록 전환
      onSelectPair('PC1', 'PC2')

      // 분석 모드로 전환
      if (onModeChange) {
        onModeChange('analysis')
      }

      // PCA 결과 정보 표시
      const varianceInfo = `PC1: ${pcaResult.explainedVariance[0]?.toFixed(1)}%, PC2: ${pcaResult.explainedVariance[1]?.toFixed(1)}%`
      const clusterInfo = `발견된 군집 수: ${Math.max(...pcaResult.clusters) + 1}개`

      alert(`🎉 PCA 분석 완료!\n\n✅ 선택 변수: ${variables.join(', ')}\n📊 설명 분산: ${varianceInfo}\n🎯 ${clusterInfo}\n\n💡 PC1 vs PC2 그래프가 분석 패널에 표시됩니다.`)

    } catch (error) {
      alert(`❌ PCA 분석 중 오류가 발생했습니다:\n${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsRunningPCA(false)
    }
  }

  // 캐시된 결과가 변경되면 동기화
  useEffect(() => {
    if (cachedResult) {
      setScanResult(cachedResult)
    }
  }, [cachedResult])

  // 스캔 실행
  const handleScan = async () => {
    setIsScanning(true)
    setScanResult(null)

    try {
      // 1. 먼저 컬럼 분류 실행 (처음이거나 캐시가 없을 때)
      let classification = columnClassification
      if (!classification) {
        setIsClassifying(true)
        console.log('컬럼 분류 시작:', data.numericColumns.length, '개 컬럼')
        classification = await classifyColumns(data.numericColumns)
        setColumnClassification(classification)
        setIsClassifying(false)
        console.log('컬럼 분류 완료:', classification)
      }

      // 2. Smart Insight 분석 실행 (컬럼 분류 결과 포함)
      const result = await performSmartInsight(data, {
        correlationThreshold: 0.5,
        pValueThreshold: 0.05,
        maxResults: 20,
        includeTypeColumn: !!selectedTypeColumn,
        selectedTypeColumn,
        columnClassification: classification || undefined
      })

      setScanResult(result)
      // 부모 컴포넌트에 결과 전달 (캐싱용)
      onResultChange?.(result)
    } catch (error) {
      console.error('Smart Insight scan failed:', error)
    } finally {
      setIsScanning(false)
      setIsClassifying(false)
    }
  }

  // AI 해석 요청
  const requestAIInterpretation = async (candidate: InsightCandidate) => {
    setSelectedCandidate(candidate)
    setAiInterpretation(null)
    setIsLoadingAI(true)
    setShowModal(true)

    try {
      // 샘플 데이터 추출
      const sampleData = extractSampleData(candidate.chartData)

      const requestBody = {
        xColumn: candidate.xColumn,
        yColumn: candidate.yColumn,
        pearsonCorr: candidate.pearsonCorr,
        spearmanCorr: candidate.spearmanCorr,
        rSquared: candidate.rSquared,
        dataCount: candidate.dataCount,
        tags: candidate.tags,
        sampleDescription: sampleDescription || 'Geochemical Analysis Data',
        sampleData
      }

      console.log('AI 해석 요청:', requestBody)

      const response = await fetch('/api/ai-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()
      console.log('AI 해석 응답:', result)

      if (result.success) {
        setAiInterpretation(result.interpretation)
      } else {
        setAiInterpretation({
          title: '오류 발생',
          summary: result.error || 'AI 해석을 가져오는 중 오류가 발생했습니다.',
          mechanism: '',
          geological_meaning: '',
          warning: null
        })
      }
    } catch (error) {
      setAiInterpretation({
        title: '오류 발생',
        summary: 'AI 해석을 가져오는 중 오류가 발생했습니다.',
        mechanism: '',
        geological_meaning: '',
        warning: null
      })
    } finally {
      setIsLoadingAI(false)
    }
  }

  // 태그 렌더링
  const renderTag = (tag: InsightTag) => {
    const tagConfig: Record<InsightTag, { label: string; color: string; icon: React.ReactNode }> = {
      'non-linear': {
        label: '비선형',
        color: 'bg-purple-100 text-purple-700 border-purple-300',
        icon: <Scale className="w-3 h-3" />
      },
      'strong-positive': {
        label: '강한 양의 상관',
        color: 'bg-green-100 text-green-700 border-green-300',
        icon: <TrendingUp className="w-3 h-3" />
      },
      'strong-negative': {
        label: '강한 음의 상관',
        color: 'bg-red-100 text-red-700 border-red-300',
        icon: <TrendingDown className="w-3 h-3" />
      },
      'moderate': {
        label: '중간 상관',
        color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
        icon: <BarChart3 className="w-3 h-3" />
      },
      'duplicate': {
        label: '중복 의심',
        color: 'bg-gray-100 text-gray-700 border-gray-300',
        icon: <AlertTriangle className="w-3 h-3" />
      },
      'pca-recommend': {
        label: 'PCA 추천',
        color: 'bg-blue-100 text-blue-700 border-blue-300',
        icon: <Brain className="w-3 h-3" />
      },
      'log-scale': {
        label: '로그 스케일 추천',
        color: 'bg-orange-100 text-orange-700 border-orange-300',
        icon: <Lightbulb className="w-3 h-3" />
      }
    }

    const config = tagConfig[tag]
    return (
      <span
        key={tag}
        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${config.color}`}
      >
        {config.icon}
        {config.label}
      </span>
    )
  }

  // 상관계수 색상
  const getCorrelationColor = (corr: number) => {
    const absCorr = Math.abs(corr)
    if (absCorr >= 0.8) return corr > 0 ? 'text-green-600' : 'text-red-600'
    if (absCorr >= 0.6) return corr > 0 ? 'text-green-500' : 'text-red-500'
    if (absCorr >= 0.4) return 'text-yellow-600'
    return 'text-gray-500'
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">AI Smart Insight</h2>
              <p className="text-purple-200 text-sm">통계적으로 유의미한 패턴을 자동 분석합니다</p>
            </div>
          </div>

          <button
            onClick={handleScan}
            disabled={isScanning}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-purple-700 rounded-lg font-medium hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {isClassifying ? '컬럼 분류 중...' : '분석 중...'}
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                스마트 스캔
              </>
            )}
          </button>
        </div>
      </div>

      {/* 샘플 설명 입력 */}
      <div className="px-6 py-3 bg-purple-50 border-b">
        <label htmlFor="sample-description" className="block text-sm font-medium text-purple-800 mb-1">
          샘플 설명 (AI 해석 품질 향상)
        </label>
        <input
          type="text"
          id="sample-description"
          name="sample-description"
          value={sampleDescription}
          onChange={(e) => setSampleDescription(e.target.value)}
          placeholder="예: 해저 열수 퇴적물, 화강암 풍화토, 하천 퇴적물 등"
          className="w-full px-3 py-2 text-sm border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
        />
      </div>

      {/* 결과 영역 */}
      <div className="p-6">
        {!scanResult && !isScanning && (
          <div className="text-center py-12">
            <Sparkles className="w-16 h-16 text-purple-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              스마트 스캔을 시작하세요
            </h3>
            <p className="text-gray-500 max-w-md mx-auto">
              모든 변수 조합을 분석하여 통계적으로 유의미한 상관관계를 찾고,
              비선형 관계와 PCA 추천 변수를 자동으로 탐지합니다.
            </p>
          </div>
        )}

        {isScanning && (
          <div className="text-center py-12">
            <Loader2 className="w-16 h-16 text-purple-500 mx-auto mb-4 animate-spin" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              데이터 분석 중...
            </h3>
            <p className="text-gray-500">
              {data.numericColumns.length}개 변수의 모든 조합을 분석하고 있습니다
            </p>
          </div>
        )}

        {scanResult && (
          <div className="space-y-6">
            {/* 요약 통계 */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-800">
                  {scanResult.totalPairsAnalyzed}
                </div>
                <div className="text-sm text-gray-500">분석된 조합</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {scanResult.filteredCount}
                </div>
                <div className="text-sm text-purple-600">유의미한 관계</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {scanResult.candidates.filter(c => c.tags.includes('non-linear')).length}
                </div>
                <div className="text-sm text-orange-600">비선형 관계</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {scanResult.pcaRecommendations.length}
                </div>
                <div className="text-sm text-blue-600">PCA 추천</div>
              </div>
            </div>

            {/* PCA 추천 */}
            {scanResult.pcaRecommendations.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-800 flex items-center gap-2 mb-3">
                  <Brain className="w-5 h-5" />
                  PCA 분석 추천
                </h3>
                {scanResult.pcaRecommendations.map((rec, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-3 mb-2 last:mb-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-800">{rec.variable}</span>
                        <span className="text-gray-500 ml-2">
                          → {rec.correlatedVariables.length}개 변수와 높은 상관관계
                        </span>
                      </div>
                      <button
                        onClick={() => runPCAAnalysis([rec.variable, ...rec.correlatedVariables].slice(0, 8))}
                        disabled={isRunningPCA}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isRunningPCA ? '분석 중...' : '🚀 PCA 실행'}
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{rec.reason}</p>
                  </div>
                ))}
              </div>
            )}

            {/* 결과 리스트 */}
            <div>
              <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                Top {Math.min(scanResult.candidates.length, 10)} 흥미로운 관계
              </h3>

              <div className="space-y-3">
                {scanResult.candidates.slice(0, 10).map((candidate, idx) => (
                  <div
                    key={candidate.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-purple-600 bg-purple-100 px-2 py-0.5 rounded">
                            #{idx + 1}
                          </span>
                          <h4 className="font-medium text-gray-800">
                            {candidate.xColumn} × {candidate.yColumn}
                          </h4>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {candidate.tags.map(tag => renderTag(tag))}
                        </div>

                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Pearson r:</span>
                            <span className={`ml-1 font-medium ${getCorrelationColor(candidate.pearsonCorr)}`}>
                              {candidate.pearsonCorr.toFixed(3)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Spearman ρ:</span>
                            <span className={`ml-1 font-medium ${getCorrelationColor(candidate.spearmanCorr)}`}>
                              {candidate.spearmanCorr.toFixed(3)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">R²:</span>
                            <span className="ml-1 font-medium text-gray-700">
                              {candidate.rSquared.toFixed(3)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">n =</span>
                            <span className="ml-1 font-medium text-gray-700">
                              {candidate.dataCount}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        <button
                          onClick={() => onSelectPair(candidate.xColumn, candidate.yColumn)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                        >
                          <Eye className="w-4 h-4" />
                          그래프 보기
                        </button>
                        <button
                          onClick={() => requestAIInterpretation(candidate)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                        >
                          <MessageSquare className="w-4 h-4" />
                          AI 해석
                        </button>
                      </div>
                    </div>

                    {/* 비선형 관계 안내 */}
                    {candidate.tags.includes('non-linear') && (
                      <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded-lg text-sm">
                        <div className="flex items-start gap-2">
                          <Lightbulb className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium text-orange-800">비선형 관계 감지:</span>
                            <span className="text-orange-700 ml-1">
                              스피어만 상관계수({candidate.spearmanCorr.toFixed(2)})가
                              피어슨({candidate.pearsonCorr.toFixed(2)})보다 높습니다.
                              로그 스케일 변환을 시도해보세요.
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 분석 시간 */}
            <div className="text-center text-sm text-gray-500">
              분석 완료: {scanResult.executionTime}ms
            </div>
          </div>
        )}
      </div>

      {/* AI 해석 모달 */}
      {showModal && selectedCandidate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Brain className="w-5 h-5" />
                AI 지질학적 해석
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-white hover:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {/* 변수 정보 */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">X축:</span>
                    <span className="ml-2 font-medium">{selectedCandidate.xColumn}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Y축:</span>
                    <span className="ml-2 font-medium">{selectedCandidate.yColumn}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">상관계수:</span>
                    <span className={`ml-2 font-medium ${getCorrelationColor(selectedCandidate.pearsonCorr)}`}>
                      {selectedCandidate.pearsonCorr.toFixed(4)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">R²:</span>
                    <span className="ml-2 font-medium">{selectedCandidate.rSquared.toFixed(4)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {selectedCandidate.tags.map(tag => renderTag(tag))}
                </div>
              </div>

              {/* AI 해석 */}
              {isLoadingAI ? (
                <div className="text-center py-8">
                  <Loader2 className="w-12 h-12 text-purple-500 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-600">AI가 지질학적 해석을 생성하고 있습니다...</p>
                  <p className="text-gray-400 text-sm mt-2">Gemini 2.5 Pro 분석 중...</p>
                </div>
              ) : aiInterpretation ? (
                <div className="space-y-4">
                  {/* 제목 */}
                  <div className="bg-gradient-to-r from-purple-100 to-indigo-100 rounded-lg p-4">
                    <h4 className="text-lg font-bold text-purple-800 flex items-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      {aiInterpretation.title}
                    </h4>
                    <p className="text-gray-700 mt-2">{aiInterpretation.summary}</p>
                  </div>

                  {/* 메커니즘 */}
                  {aiInterpretation.mechanism && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h5 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        지질학적 메커니즘
                      </h5>
                      <p className="text-gray-700">{aiInterpretation.mechanism}</p>
                    </div>
                  )}

                  {/* 지질학적 의미 */}
                  {aiInterpretation.geological_meaning && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h5 className="font-medium text-green-800 mb-2 flex items-center gap-2">
                        <Brain className="w-4 h-4" />
                        깊은 통찰
                      </h5>
                      <p className="text-gray-700">{aiInterpretation.geological_meaning}</p>
                    </div>
                  )}

                  {/* 주의사항 */}
                  {aiInterpretation.warning && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h5 className="font-medium text-yellow-800 mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        주의사항
                      </h5>
                      <p className="text-gray-700">{aiInterpretation.warning}</p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="border-t px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                닫기
              </button>
              <button
                onClick={() => onSelectPair(selectedCandidate.xColumn, selectedCandidate.yColumn)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                그래프 보기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
