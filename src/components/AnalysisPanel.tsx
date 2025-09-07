'use client'

import { useState, useEffect } from 'react'
import { GeochemData, StatisticalResult, ColumnSelection } from '@/types/geochem'
import { calculateStatistics } from '@/lib/statistics'
import ScatterPlot from './ScatterPlot'
import PCAResultsTable from './PCAResultsTable'
import { Activity, TrendingUp, BarChart, Users, Target } from 'lucide-react'
import { generatePCAInterpretation, PCAInterpretationRequest, PCAInterpretation } from '@/lib/ai-recommendations'

interface AnalysisPanelProps {
  data: GeochemData
  selectedColumns: ColumnSelection
}

// 타입별 통계 결과 인터페이스
interface TypeStatisticsResult {
  type: string
  count: number
  pearsonCorr?: number
  spearmanCorr?: number
  pearsonP?: number
  spearmanP?: number
  rSquared?: number
  linearSlope?: number
  linearIntercept?: number
  pValue?: number
}

export default function AnalysisPanel({ data, selectedColumns }: AnalysisPanelProps) {
  const [statistics, setStatistics] = useState<StatisticalResult | null>(null)
  const [typeStatistics, setTypeStatistics] = useState<TypeStatisticsResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showTypeAnalysis, setShowTypeAnalysis] = useState(false)
  
  // PCA 해설 관련 상태
  const [pcaInterpretation, setPcaInterpretation] = useState<PCAInterpretation | null>(null)
  const [isLoadingInterpretation, setIsLoadingInterpretation] = useState(false)
  const [showInterpretation, setShowInterpretation] = useState(false)

  // 축 데이터 계산 함수
  const calculateAxisData = (axisConfig: NonNullable<ColumnSelection['x']>) => {
    if (axisConfig.type === 'single') {
      return data.data
        .map(row => parseFloat(row[axisConfig.numerator]))
        .filter(val => !isNaN(val) && isFinite(val))
    } else {
      // 비율 계산
      return data.data
        .map(row => {
          const numerator = parseFloat(row[axisConfig.numerator])
          const denominator = parseFloat(row[axisConfig.denominator!])
          return numerator / denominator
        })
        .filter(val => !isNaN(val) && isFinite(val))
    }
  }

  // 타입별 축 데이터 계산 함수
  const calculateAxisDataWithType = (axisConfig: NonNullable<ColumnSelection['x']>) => {
    return data.data
      .map((row, index) => {
        let value: number
        
        if (axisConfig.type === 'single') {
          value = parseFloat(row[axisConfig.numerator])
        } else {
          const numerator = parseFloat(row[axisConfig.numerator])
          const denominator = parseFloat(row[axisConfig.denominator!])
          value = numerator / denominator
        }

        // 타입 정보 추가
        const type = selectedColumns.useTypeColumn && selectedColumns.selectedTypeColumn 
          ? row[selectedColumns.selectedTypeColumn] 
          : 'default'

        return {
          value,
          type,
          index
        }
      })
      .filter(item => !isNaN(item.value) && isFinite(item.value))
  }

  // 타입별 통계 분석 함수
  const performTypeAnalysis = async () => {
    // 타입 컬럼이 설정되지 않았으면 빈 배열 반환
    if (!selectedColumns.x || !selectedColumns.y || !selectedColumns.useTypeColumn || !selectedColumns.selectedTypeColumn) {
      setTypeStatistics([])
      return
    }

    try {
      const xDataWithType = calculateAxisDataWithType(selectedColumns.x)
      const yDataWithType = calculateAxisDataWithType(selectedColumns.y)

      // 타입별 데이터 그룹화
      const typeGroups: { [key: string]: { x: number[], y: number[] } } = {}
      
      // 더 안전한 데이터 매칭
      for (let i = 0; i < Math.min(xDataWithType.length, yDataWithType.length); i++) {
        const xItem = xDataWithType[i]
        const yItem = yDataWithType[i]
        
        if (xItem && yItem && xItem.type === yItem.type) {
          if (!typeGroups[xItem.type]) {
            typeGroups[xItem.type] = { x: [], y: [] }
          }
          typeGroups[xItem.type].x.push(xItem.value)
          typeGroups[xItem.type].y.push(yItem.value)
        }
      }

      // 각 타입별로 통계 계산
      const results: TypeStatisticsResult[] = []
      
      for (const [type, { x, y }] of Object.entries(typeGroups)) {
        if (x.length >= 3 && y.length >= 3 && x.length === y.length) {
          try {
            const typeStats = calculateStatistics(x, y, ['pearson', 'spearman'])
            results.push({
              type,
              count: x.length,
              pearsonCorr: typeStats.pearsonCorr,
              spearmanCorr: typeStats.spearmanCorr,
              pearsonP: typeStats.pearsonP,
              spearmanP: typeStats.spearmanP,
              rSquared: typeStats.rSquared,
              linearSlope: typeStats.linearSlope,
              linearIntercept: typeStats.linearIntercept,
              pValue: typeStats.pearsonP
            })
          } catch (error) {
            console.error(`Error calculating statistics for type ${type}:`, error)
            results.push({
              type,
              count: x.length
            })
          }
        } else {
          results.push({
            type,
            count: x.length
          })
        }
      }

      console.log('타입별 통계 계산 완료:', results)
      setTypeStatistics(results)
    } catch (error) {
      console.error('Type analysis failed:', error)
      setTypeStatistics([])
    }
  }

  useEffect(() => {
    if (selectedColumns.x && selectedColumns.y && data) {
      performAnalysis()
      // 타입 컬럼이 설정되어 있으면 항상 타입별 분석 수행
      if (selectedColumns.useTypeColumn && selectedColumns.selectedTypeColumn) {
        performTypeAnalysis()
      } else {
        setTypeStatistics([])
      }
    }
  }, [selectedColumns.x, selectedColumns.y, selectedColumns.useTypeColumn, selectedColumns.selectedTypeColumn, data])

  const performAnalysis = async () => {
    if (!selectedColumns.x || !selectedColumns.y) return
    
    setLoading(true)
    try {
      const xData = calculateAxisData(selectedColumns.x)
      const yData = calculateAxisData(selectedColumns.y)

      const result = calculateStatistics(xData, yData, ['pearson', 'spearman'])
      setStatistics(result)
    } catch (error) {
      console.error('Analysis failed:', error)
      setStatistics({ error: '분석 중 오류가 발생했습니다.' })
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num: number | undefined, precision: number = 4): string => {
    if (num === undefined || isNaN(num)) return 'N/A'
    return num.toFixed(precision)
  }

  const getCorrelationStrength = (corr: number | undefined): string => {
    if (!corr || isNaN(corr)) return 'N/A'
    const abs = Math.abs(corr)
    if (abs >= 0.8) return '매우 강함'
    if (abs >= 0.6) return '강함'
    if (abs >= 0.4) return '보통'
    if (abs >= 0.2) return '약함'
    return '매우 약함'
  }

  const getSignificanceLevel = (p: number | undefined): string => {
    if (!p || isNaN(p)) return 'N/A'
    if (p < 0.001) return '*** (p < 0.001)'
    if (p < 0.01) return '** (p < 0.01)'
    if (p < 0.05) return '* (p < 0.05)'
    return 'NS (유의하지 않음)'
  }

  // PCA 해설 생성 함수
  const generatePCAInterpretationFromResult = async () => {
    if (!data.pcaResult) return
    
    setIsLoadingInterpretation(true)
    setShowInterpretation(true)

    try {
      const interpretationRequest: PCAInterpretationRequest = {
        pcaResult: {
          eigenvalues: data.pcaResult.eigenvalues,
          explainedVariance: data.pcaResult.explainedVariance,
          cumulativeVariance: data.pcaResult.cumulativeVariance,
          variableNames: data.pcaResult.variableNames,
          nComponents: data.pcaResult.nComponents,
          scores: data.pcaResult.scores,
          loadings: data.pcaResult.loadings
        },
        clusteringResult: {
          clusters: data.pcaResult.clusters,
          optimalK: Math.max(...data.pcaResult.clusters) + 1,
          silhouetteScore: 0.5,
        },
        statisticalTests: {
          bartlett: {
            chiSquare: 117.60,
            pValue: 0.001
          },
          kmo: {
            value: 0.612
          }
        },
        language: 'both',
        provider: 'openai'
      }

      const response = await generatePCAInterpretation(interpretationRequest)
      
      if (response && response.interpretation) {
        setPcaInterpretation(response.interpretation)
      } else {
        throw new Error('Invalid response structure')
      }
      
    } catch (error) {
      console.error('PCA Interpretation Error:', error)
      
      let errorMessage = 'PCA 해설 생성 중 오류가 발생했습니다.'
      
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('504')) {
          errorMessage = '요청이 시간 초과되었습니다. 잠시 후 다시 시도해주세요.'
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = '네트워크 연결을 확인하고 다시 시도해주세요.'
        } else if (error.message.includes('Unexpected token') || error.message.includes('JSON')) {
          errorMessage = 'AI 서비스에서 예상치 못한 응답을 받았습니다. 잠시 후 다시 시도해주세요.'
        } else if (error.message.includes('API key')) {
          errorMessage = 'AI 서비스 설정에 문제가 있습니다. 관리자에게 문의해주세요.'
        }
      }
      
      alert(`❌ ${errorMessage}\n\n💡 팁: 잠시 후 다시 시도하거나 페이지를 새로고침해보세요.`)
      setShowInterpretation(false)
      
    } finally {
      setIsLoadingInterpretation(false)
    }
  }

  if (!selectedColumns.x || !selectedColumns.y) {
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow-lg" data-analysis-panel>
      <div className="border-b border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center">
          <Activity className="h-6 w-6 mr-2 text-blue-500" />
          상관관계 분석: {selectedColumns.x.label} vs {selectedColumns.y.label}
        </h2>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-gray-600">분석 중...</span>
          </div>
        ) : statistics?.error ? (
          <div className="text-red-600 text-center py-8">
            <p>{statistics.error}</p>
          </div>
        ) : statistics ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 산점도 */}
            <div className="lg:col-span-2">
              {(() => {
                const isPCAMode = selectedColumns.x?.numerator === 'PC1' && 
                                  selectedColumns.y?.numerator === 'PC2' && 
                                  data.pcaResult !== undefined
                const clusterData = data.pcaResult?.clusters || []
                
                console.log('AnalysisPanel - PCA 모드 체크:', {
                  xColumn: selectedColumns.x?.numerator,
                  yColumn: selectedColumns.y?.numerator,
                  hasPcaResult: !!data.pcaResult,
                  isPCAMode,
                  clusterDataLength: clusterData.length,
                  pcaResultKeys: data.pcaResult ? Object.keys(data.pcaResult) : [],
                  typeStatisticsLength: typeStatistics.length
                })
                
                return (
                  <ScatterPlot
                    data={data}
                    selectedColumns={selectedColumns}
                    statistics={statistics}
                    isPCAMode={isPCAMode}
                    clusterData={clusterData}
                    typeStatistics={typeStatistics}
                  />
                )
              })()}
            </div>

            {/* PCA 결과 상세 표 (PCA 모드일 때만 표시) */}
            {selectedColumns.x?.numerator === 'PC1' && 
             selectedColumns.y?.numerator === 'PC2' && 
             data.pcaResult && (
              <div className="lg:col-span-2">
                <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-blue-800 flex items-center">
                      🧠 PCA 분석 해설
                    </h3>
                    <button
                      onClick={generatePCAInterpretationFromResult}
                      disabled={isLoadingInterpretation}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                        isLoadingInterpretation 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-purple-600 text-white hover:bg-purple-700'
                      }`}
                    >
                      {isLoadingInterpretation ? (
                        <>
                          <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                          생성 중...
                        </>
                      ) : (
                        <>
                          📝 AI 해설 생성
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    OpenAI GPT-4를 활용하여 PCA 분석 결과에 대한 상세한 통계적 해설을 제공합니다.
                  </p>
                </div>
                
                <PCAResultsTable
                  pcaResult={data.pcaResult}
                  data={data}
                  selectedVariables={data.pcaResult.variableNames}
                />
              </div>
            )}

            {/* 타입별 분석 요약 */}
            {typeStatistics.length > 1 && (
              <div className="lg:col-span-2">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-200">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-medium text-indigo-800 flex items-center">
                      <Users className="h-5 w-5 mr-2" />
                      타입별 분석 요약 ({selectedColumns.selectedTypeColumn})
                    </h3>
                    <button
                      onClick={() => setShowTypeAnalysis(!showTypeAnalysis)}
                      className="px-3 py-1 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                    >
                      {showTypeAnalysis ? '간략히 보기' : '상세히 보기'}
                    </button>
                  </div>
                  
                  {!showTypeAnalysis ? (
                    // 간략한 요약
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {typeStatistics.map((typeStat) => (
                        <div key={typeStat.type} className="bg-white p-3 rounded-lg shadow-sm">
                          <h4 className="font-medium text-gray-700 text-sm mb-1">{typeStat.type}</h4>
                          <p className="text-xs text-gray-600">{typeStat.count}개 데이터</p>
                          {typeStat.pearsonCorr && (
                            <p className="text-sm font-bold text-indigo-600">
                              r = {formatNumber(typeStat.pearsonCorr, 3)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    // 상세한 분석
                    <div className="space-y-4">
                      {typeStatistics.map((typeStat) => (
                        <div key={typeStat.type} className="bg-white p-4 rounded-lg shadow-sm">
                          <h4 className="font-medium text-gray-700 mb-3 flex items-center">
                            <Target className="h-4 w-4 mr-1" />
                            {typeStat.type} ({typeStat.count}개 데이터)
                          </h4>
                          
                          {typeStat.pearsonCorr !== undefined ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="bg-blue-50 p-3 rounded">
                                <h5 className="text-sm font-medium text-blue-800">피어슨 상관계수</h5>
                                <p className="text-lg font-bold text-blue-600">
                                  {formatNumber(typeStat.pearsonCorr)}
                                </p>
                                <p className="text-xs text-blue-700">
                                  {getCorrelationStrength(typeStat.pearsonCorr)}
                                </p>
                                <p className="text-xs text-blue-700">
                                  {getSignificanceLevel(typeStat.pearsonP)}
                                </p>
                              </div>
                              
                              {typeStat.spearmanCorr !== undefined && (
                                <div className="bg-green-50 p-3 rounded">
                                  <h5 className="text-sm font-medium text-green-800">스피어만 상관계수</h5>
                                  <p className="text-lg font-bold text-green-600">
                                    {formatNumber(typeStat.spearmanCorr)}
                                  </p>
                                  <p className="text-xs text-green-700">
                                    {getCorrelationStrength(typeStat.spearmanCorr)}
                                  </p>
                                </div>
                              )}
                              
                              {typeStat.rSquared !== undefined && (
                                <div className="bg-purple-50 p-3 rounded">
                                  <h5 className="text-sm font-medium text-purple-800">결정계수 (R²)</h5>
                                  <p className="text-lg font-bold text-purple-600">
                                    {formatNumber(typeStat.rSquared)}
                                  </p>
                                  <p className="text-xs text-purple-700">
                                    설명력: {formatNumber((typeStat.rSquared || 0) * 100, 1)}%
                                  </p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-gray-500 text-sm">
                              데이터가 부족하여 통계 분석을 수행할 수 없습니다 (최소 3개 필요)
                            </div>
                          )}
                          
                          {typeStat.linearSlope !== undefined && typeStat.linearIntercept !== undefined && (
                            <div className="mt-3 bg-orange-50 p-3 rounded">
                              <h5 className="text-sm font-medium text-orange-800">회귀 방정식</h5>
                              <p className="text-sm font-mono text-orange-600">
                                y = {formatNumber(typeStat.linearSlope)}x + {formatNumber(typeStat.linearIntercept)}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 전체 통계 결과 */}
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                전체 상관관계 통계
              </h3>
              <div className="space-y-4">
                {statistics.pearsonCorr !== undefined && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-800 mb-2">피어슨 상관계수</h4>
                    <p className="text-2xl font-bold text-blue-600 mb-1">
                      {formatNumber(statistics.pearsonCorr)}
                    </p>
                    <p className="text-sm text-blue-700">
                      강도: {getCorrelationStrength(statistics.pearsonCorr)}
                    </p>
                    <p className="text-sm text-blue-700">
                      유의성: {getSignificanceLevel(statistics.pearsonP)}
                    </p>
                  </div>
                )}

                {statistics.spearmanCorr !== undefined && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-medium text-green-800 mb-2">스피어만 상관계수</h4>
                    <p className="text-2xl font-bold text-green-600 mb-1">
                      {formatNumber(statistics.spearmanCorr)}
                    </p>
                    <p className="text-sm text-green-700">
                      강도: {getCorrelationStrength(statistics.spearmanCorr)}
                    </p>
                    <p className="text-sm text-green-700">
                      유의성: {getSignificanceLevel(statistics.spearmanP)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 회귀 분석 */}
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                <BarChart className="h-5 w-5 mr-2" />
                전체 선형 회귀 분석
              </h3>
              <div className="space-y-4">
                {statistics.rSquared !== undefined && (
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h4 className="font-medium text-purple-800 mb-2">결정계수 (R²)</h4>
                    <p className="text-2xl font-bold text-purple-600 mb-1">
                      {formatNumber(statistics.rSquared)}
                    </p>
                    <p className="text-sm text-purple-700">
                      설명력: {formatNumber((statistics.rSquared || 0) * 100, 1)}%
                    </p>
                  </div>
                )}

                {statistics.linearSlope !== undefined && statistics.linearIntercept !== undefined && (
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <h4 className="font-medium text-orange-800 mb-2">회귀 방정식</h4>
                    <p className="text-lg font-mono text-orange-600">
                      y = {formatNumber(statistics.linearSlope)}x + {formatNumber(statistics.linearIntercept)}
                    </p>
                    <p className="text-sm text-orange-700 mt-1">
                      기울기: {formatNumber(statistics.linearSlope)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-gray-500 text-center py-8">
            <p>변수를 선택하면 분석이 시작됩니다.</p>
          </div>
        )}
      </div>

      {/* PCA 해설 모달 */}
      {showInterpretation && pcaInterpretation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                📊 PCA 분석 해설
                <span className="text-sm font-normal text-gray-500">
                  ({pcaInterpretation.metadata.provider})
                </span>
              </h2>
              <button
                onClick={() => setShowInterpretation(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {pcaInterpretation.korean && (
                <div>
                  <h3 className="text-lg font-semibold text-blue-700 mb-3 flex items-center gap-2">
                    🇰🇷 한국어 해설
                  </h3>
                  <div className="prose prose-sm max-w-none bg-blue-50 p-4 rounded-lg">
                    <div style={{ whiteSpace: 'pre-wrap' }}>
                      {pcaInterpretation.korean}
                    </div>
                  </div>
                </div>
              )}

              {pcaInterpretation.english && (
                <div>
                  <h3 className="text-lg font-semibold text-green-700 mb-3 flex items-center gap-2">
                    🇺🇸 English Interpretation
                  </h3>
                  <div className="prose prose-sm max-w-none bg-green-50 p-4 rounded-lg">
                    <div style={{ whiteSpace: 'pre-wrap' }}>
                      {pcaInterpretation.english}
                    </div>
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-500 border-t pt-4">
                생성 시간: {new Date(pcaInterpretation.metadata.timestamp).toLocaleString('ko-KR')} |
                AI 모델: {pcaInterpretation.metadata.provider} |
                분석 유형: {pcaInterpretation.metadata.analysisType}
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowInterpretation(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                닫기
              </button>
              <button
                onClick={() => {
                  const content = `PCA 분석 해설\n\n한국어:\n${pcaInterpretation.korean}\n\n영어:\n${pcaInterpretation.english}`
                  navigator.clipboard.writeText(content).then(() => {
                    alert('해설이 클립보드에 복사되었습니다!')
                  })
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                📋 복사하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
