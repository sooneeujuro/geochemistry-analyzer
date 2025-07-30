'use client'

import { useState, useEffect, useMemo } from 'react'
import { GeochemData, ScanResult, ScanOptions, ScanSummary } from '@/types/geochem'
import { calculateStatistics } from '@/lib/statistics'
import { getAIRecommendations, estimateAPICost, AIRecommendation } from '@/lib/ai-recommendations'
import ScanResultCard from './ScanResultCard'
import { Play, Settings, Download, Filter, TrendingUp, AlertCircle, ChevronLeft, ChevronRight, RotateCcw, Brain, Key, DollarSign } from 'lucide-react'

interface ScanModeProps {
  data: GeochemData
  onResultSelect: (xColumn: string, yColumn: string) => void
  selectedTypeColumn?: string
  scanResults?: ScanResult[]
  scanSummary?: ScanSummary | null
  onScanComplete?: (results: ScanResult[], summary: ScanSummary | null) => void
  onStartNewScan?: () => void
}

export default function ScanMode({ 
  data, 
  onResultSelect, 
  selectedTypeColumn,
  scanResults: externalScanResults = [],
  scanSummary: externalScanSummary = null,
  onScanComplete,
  onStartNewScan
}: ScanModeProps) {
  const [isScanning, setIsScanning] = useState(false)
  
  // 외부에서 받은 스캔 결과를 사용하거나, 없으면 빈 배열 사용
  const scanResults = externalScanResults
  const scanSummary = externalScanSummary
  const [showOptions, setShowOptions] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [resultsPerPage] = useState(20) // 페이지당 결과 수
  const [scanOptions, setScanOptions] = useState<ScanOptions>({
    statMethods: ['pearson'],
    threshold: 0.5,
    pThreshold: 0.05,
    excludeColumns: [],
    includeTypeColumn: !!selectedTypeColumn,
    selectedTypeColumn: selectedTypeColumn,
    useAIRecommendations: false,
    aiProvider: 'google',
    openaiApiKey: '',
    googleApiKey: '',
    sampleDescription: '',
    aiRecommendationsOnly: false
  })
  
  // AI 관련 상태
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendation[]>([])
  const [isLoadingAI, setIsLoadingAI] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // 의미없는 컬럼들 자동 감지 (ID, 번호 등)
  const autoExcludeColumns = useMemo(() => {
    return data.numericColumns.filter(col => {
      const lowerCol = col.toLowerCase()
      return (
        lowerCol.includes('id') ||
        lowerCol.includes('번호') ||
        lowerCol.includes('number') ||
        lowerCol.includes('no.') ||
        lowerCol.includes('index') ||
        lowerCol === 'seq' ||
        lowerCol === 'sequence'
      )
    })
  }, [data.numericColumns])

  // 실제 분석할 컬럼들
  const analysisColumns = useMemo(() => {
    const excludeList = [...scanOptions.excludeColumns, ...autoExcludeColumns]
    return data.numericColumns.filter(col => !excludeList.includes(col))
  }, [data.numericColumns, scanOptions.excludeColumns, autoExcludeColumns])

  // 전체 조합 수 계산
  const totalCombinations = useMemo(() => {
    const n = analysisColumns.length
    return n > 1 ? (n * (n - 1)) / 2 : 0
  }, [analysisColumns])

  // 유의미한 결과와 전체 결과 분리
  const significantResults = useMemo(() => 
    scanResults.filter(r => r.isSignificant), [scanResults])
  
  const allResults = useMemo(() => scanResults, [scanResults])

  // 페이지네이션된 결과
  const paginatedResults = useMemo(() => {
    const startIndex = (currentPage - 1) * resultsPerPage
    const endIndex = startIndex + resultsPerPage
    return allResults.slice(startIndex, endIndex)
  }, [allResults, currentPage, resultsPerPage])

  const totalPages = Math.ceil(allResults.length / resultsPerPage)

  const startNewScan = () => {
    // 새 스캔 시작 - 결과 초기화
    if (onStartNewScan) {
      onStartNewScan()
    }
  }

  // AI 추천 받기
  const getAIRecommendationsList = async () => {
    const apiKey = scanOptions.aiProvider === 'openai' ? scanOptions.openaiApiKey : scanOptions.googleApiKey
    
    if (!apiKey?.trim()) {
      setAiError(`${scanOptions.aiProvider === 'openai' ? 'OpenAI' : 'Google AI'} API 키를 입력해주세요.`)
      return
    }

    setIsLoadingAI(true)
    setAiError(null)

    try {
      const recommendations = await getAIRecommendations({
        numericColumns: analysisColumns,
        sampleDescription: scanOptions.sampleDescription,
        rockTypes: data.typeColumn ? Array.from(new Set(data.data.map(row => row[data.typeColumn!]))) : undefined,
        apiKey,
        provider: scanOptions.aiProvider!
      })

      setAiRecommendations(recommendations)
      setAiError(null)
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AI 추천을 받는데 실패했습니다.')
    } finally {
      setIsLoadingAI(false)
    }
  }

  // 예상 비용 계산
  const estimatedCost = useMemo(() => {
    return estimateAPICost(analysisColumns.length, scanOptions.aiProvider || 'google')
  }, [analysisColumns.length, scanOptions.aiProvider])

  const performScan = async () => {
    if (analysisColumns.length < 2) {
      alert('분석할 수치 컬럼이 최소 2개 이상 필요합니다.')
      return
    }

    // AI 추천만 사용하는 경우, 추천이 있는지 확인
    if (scanOptions.aiRecommendationsOnly && aiRecommendations.length === 0) {
      alert('AI 추천을 먼저 받아주세요.')
      return
    }

    setIsScanning(true)
    setCurrentPage(1) // 페이지 초기화
    const startTime = Date.now()
    const results: ScanResult[] = []

    try {
      // 조합 생성: AI 추천만 사용 또는 모든 조합
      let combinations: Array<{xColumn: string, yColumn: string, aiRecommended?: boolean, aiReason?: string, aiConfidence?: number}> = []
      
      if (scanOptions.aiRecommendationsOnly && aiRecommendations.length > 0) {
        // AI 추천 조합만 사용
        combinations = aiRecommendations.map(rec => ({
          xColumn: rec.xColumn,
          yColumn: rec.yColumn,
          aiRecommended: true,
          aiReason: rec.reason,
          aiConfidence: rec.confidence
        }))
      } else {
        // 모든 조합 생성
        for (let i = 0; i < analysisColumns.length; i++) {
          for (let j = i + 1; j < analysisColumns.length; j++) {
            const xColumn = analysisColumns[i]
            const yColumn = analysisColumns[j]
            
            // AI 추천이 있는지 확인
            const aiRec = aiRecommendations.find(rec => 
              (rec.xColumn === xColumn && rec.yColumn === yColumn) ||
              (rec.xColumn === yColumn && rec.yColumn === xColumn)
            )
            
            combinations.push({
              xColumn,
              yColumn,
              aiRecommended: !!aiRec,
              aiReason: aiRec?.reason,
              aiConfidence: aiRec?.confidence
            })
          }
        }
      }

      // 각 조합 분석
      for (const combination of combinations) {
        const { xColumn, yColumn, aiRecommended, aiReason, aiConfidence } = combination

        // 데이터 추출
        const validData = data.data
          .map(row => ({
            x: parseFloat(row[xColumn]),
            y: parseFloat(row[yColumn]),
            type: scanOptions.includeTypeColumn && scanOptions.selectedTypeColumn 
              ? row[scanOptions.selectedTypeColumn] 
              : 'default'
          }))
          .filter(point => !isNaN(point.x) && !isNaN(point.y) && isFinite(point.x) && isFinite(point.y))

        if (validData.length < 3) continue

        const xData = validData.map(d => d.x)
        const yData = validData.map(d => d.y)

        // 통계 계산
        const statistics = calculateStatistics(xData, yData, scanOptions.statMethods)

        // 유의성 판단
        let isSignificant = false
        for (const method of scanOptions.statMethods) {
          const corrKey = `${method}Corr` as keyof typeof statistics
          const pKey = `${method}P` as keyof typeof statistics
          
          if (statistics[corrKey] && statistics[pKey]) {
            const corr = Math.abs(statistics[corrKey] as number)
            const p = statistics[pKey] as number
            if (corr >= scanOptions.threshold && p <= scanOptions.pThreshold) {
              isSignificant = true
              break
            }
          }
        }

        results.push({
          id: `${xColumn}_${yColumn}`,
          xColumn,
          yColumn,
          xLabel: xColumn,
          yLabel: yColumn,
          statistics,
          isSignificant,
          chartData: validData,
          dataCount: validData.length,
          aiRecommended,
          aiReason,
          aiConfidence
        })
      }

      // 결과 정렬 (유의미한 것들을 상관계수 순으로)
      results.sort((a, b) => {
        if (a.isSignificant && !b.isSignificant) return -1
        if (!a.isSignificant && b.isSignificant) return 1
        
        const aPearson = Math.abs(a.statistics.pearsonCorr || 0)
        const bPearson = Math.abs(b.statistics.pearsonCorr || 0)
        return bPearson - aPearson
      })

      const executionTime = Date.now() - startTime
      const significantResultsCount = results.filter(r => r.isSignificant).length

      const summary: ScanSummary = {
        totalCombinations: results.length,
        significantCombinations: significantResultsCount,
        topResults: results.filter(r => r.isSignificant).slice(0, 10),
        executionTime,
        fileName: data.metadata.fileName,
        scanOptions,
        aiRecommendationsUsed: scanOptions.useAIRecommendations,
        aiRecommendationsCount: aiRecommendations.length
      }
      
      // 상위 컴포넌트로 결과 전달
      if (onScanComplete) {
        onScanComplete(results, summary)
      }

    } catch (error) {
      console.error('Scan failed:', error)
      alert('스캔 중 오류가 발생했습니다.')
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 스캔 옵션 및 제어 */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">스캔 설정</h2>
            {scanResults.length > 0 && (
              <p className="text-sm text-green-600 mt-1">
                ✓ 스캔 완료됨 ({scanSummary?.executionTime ? (scanSummary.executionTime / 1000).toFixed(1) : '?'}초 소요)
              </p>
            )}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowOptions(!showOptions)}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md flex items-center"
            >
              <Settings className="h-4 w-4 mr-1" />
              고급 설정
            </button>
          </div>
        </div>

        {/* 스캔 통계 요약 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{totalCombinations}</div>
            <div className="text-sm text-gray-600">총 조합 수</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{significantResults.length}</div>
            <div className="text-sm text-gray-600">유의미한 조합</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{analysisColumns.length}</div>
            <div className="text-sm text-gray-600">분석 대상 컬럼</div>
          </div>
        </div>

        {/* 자동 제외된 컬럼들 표시 */}
        {autoExcludeColumns.length > 0 && (
          <div className="bg-yellow-50 p-4 rounded-lg mb-4">
            <div className="flex items-center mb-2">
              <Filter className="h-4 w-4 text-yellow-600 mr-2" />
              <span className="text-sm font-medium text-yellow-800">자동 제외된 컬럼</span>
            </div>
            <div className="text-sm text-yellow-700">
              {autoExcludeColumns.join(', ')} (ID, 번호 등 식별자로 판단됨)
            </div>
          </div>
        )}

        {scanResults.length > 0 ? (
          // 스캔 결과가 있는 경우 - 새 스캔 시작 버튼
          <button
            onClick={startNewScan}
            disabled={isScanning}
            className="w-full px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center font-medium"
          >
            <RotateCcw className="h-5 w-5 mr-2" />
            새 스캔 시작
          </button>
        ) : (
          // 스캔 결과가 없는 경우 - 일반 스캔 시작 버튼
          <button
            onClick={performScan}
            disabled={isScanning || analysisColumns.length < 2}
            className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center font-medium"
          >
            {isScanning ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                스캔 진행 중...
              </>
            ) : (
              <>
                <Play className="h-5 w-5 mr-2" />
                전체 스캔 시작
              </>
            )}
          </button>
        )}
      </div>

      {/* 고급 설정 패널 */}
      {showOptions && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-medium text-gray-800 mb-6">고급 설정</h3>
          
          {/* 임계값 설정 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                상관계수 임계값
              </label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={scanOptions.threshold}
                onChange={(e) => setScanOptions({
                  ...scanOptions,
                  threshold: parseFloat(e.target.value)
                })}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                P-value 임계값
              </label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={scanOptions.pThreshold}
                onChange={(e) => setScanOptions({
                  ...scanOptions,
                  pThreshold: parseFloat(e.target.value)
                })}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          {/* AI 스마트 추천 설정 */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center mb-4">
              <Brain className="h-5 w-5 text-blue-600 mr-2" />
              <h4 className="text-md font-medium text-gray-800">AI 스마트 추천</h4>
            </div>
            
            <div className="space-y-4">
              {/* AI 제공자 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  AI 제공자
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="aiProvider"
                      value="google"
                      checked={scanOptions.aiProvider === 'google'}
                      onChange={(e) => setScanOptions({
                        ...scanOptions,
                        aiProvider: e.target.value as 'google'
                      })}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm">Google AI (Gemini) - 저렴함</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="aiProvider"
                      value="openai"
                      checked={scanOptions.aiProvider === 'openai'}
                      onChange={(e) => setScanOptions({
                        ...scanOptions,
                        aiProvider: e.target.value as 'openai'
                      })}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm">OpenAI (GPT-4) - 고품질</span>
                  </label>
                </div>
              </div>

              {/* API 키 입력 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Key className="h-4 w-4 inline mr-1" />
                  {scanOptions.aiProvider === 'openai' ? 'OpenAI API 키' : 'Google AI API 키'}
                </label>
                <input
                  type="password"
                  placeholder={scanOptions.aiProvider === 'openai' ? 'sk-...' : 'AIza...'}
                  value={scanOptions.aiProvider === 'openai' ? scanOptions.openaiApiKey || '' : scanOptions.googleApiKey || ''}
                  onChange={(e) => setScanOptions({
                    ...scanOptions,
                    [scanOptions.aiProvider === 'openai' ? 'openaiApiKey' : 'googleApiKey']: e.target.value
                  })}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {scanOptions.aiProvider === 'openai' 
                    ? 'OpenAI API 키가 필요합니다. platform.openai.com에서 발급받으세요.'
                    : 'Google AI Studio에서 발급받은 API 키가 필요합니다. aistudio.google.com'
                  }
                </p>
              </div>

              {/* 샘플 설명 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  샘플 설명 (선택사항)
                </label>
                <input
                  type="text"
                  placeholder="예: 화강암 샘플, 현무암 분석 데이터"
                  value={scanOptions.sampleDescription || ''}
                  onChange={(e) => setScanOptions({
                    ...scanOptions,
                    sampleDescription: e.target.value
                  })}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                />
              </div>

              {/* AI 추천 받기 버튼 */}
              <div className="flex items-center justify-between">
                <button
                  onClick={getAIRecommendationsList}
                  disabled={isLoadingAI || !(scanOptions.aiProvider === 'openai' ? scanOptions.openaiApiKey?.trim() : scanOptions.googleApiKey?.trim())}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center text-sm"
                >
                  {isLoadingAI ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      AI 분석 중...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      AI 추천 받기
                    </>
                  )}
                </button>
                
                <div className="flex items-center text-xs text-gray-600">
                  <DollarSign className="h-3 w-3 mr-1" />
                  예상 비용: ~${estimatedCost.cost}
                </div>
              </div>

              {/* AI 에러 표시 */}
              {aiError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-center">
                    <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                    <span className="text-sm text-red-800">{aiError}</span>
                  </div>
                </div>
              )}

              {/* AI 추천 결과 */}
              {aiRecommendations.length > 0 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-green-800">
                      AI 추천 완료 ({aiRecommendations.length}개 조합)
                    </span>
                    <label className="flex items-center text-sm">
                      <input
                        type="checkbox"
                        checked={scanOptions.aiRecommendationsOnly || false}
                        onChange={(e) => setScanOptions({
                          ...scanOptions,
                          aiRecommendationsOnly: e.target.checked
                        })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                      />
                      추천 조합만 스캔
                    </label>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {aiRecommendations.map((rec, idx) => (
                      <div key={idx} className="text-xs text-green-700 flex items-center justify-between">
                        <span>{rec.xColumn} vs {rec.yColumn}</span>
                        <span className="font-medium">신뢰도: {rec.confidence}/10</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 스캔 결과 */}
      {!isScanning && scanResults.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800">스캔 결과</h2>
            {scanSummary && (
              <div className="text-sm text-gray-600">
                실행 시간: {(scanSummary.executionTime / 1000).toFixed(1)}초
              </div>
            )}
          </div>

          {/* 유의미한 결과들 */}
          {significantResults.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center mb-4">
                <TrendingUp className="h-5 w-5 text-green-600 mr-2" />
                <h3 className="text-lg font-medium text-gray-800">
                  유의미한 상관관계 ({significantResults.length}개)
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {significantResults.slice(0, 6).map((result) => (
                  <ScanResultCard
                    key={result.id}
                    result={result}
                    onSelect={onResultSelect}
                    includeTypeColumn={scanOptions.includeTypeColumn}
                    selectedTypeColumn={scanOptions.selectedTypeColumn}
                    compact={true}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 전체 결과 표시 */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-800">
                전체 결과 ({allResults.length}개)
              </h3>
              {totalPages > 1 && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-2 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm text-gray-600">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {paginatedResults.map((result) => (
                <ScanResultCard
                  key={result.id}
                  result={result}
                  onSelect={onResultSelect}
                  includeTypeColumn={scanOptions.includeTypeColumn}
                  selectedTypeColumn={scanOptions.selectedTypeColumn}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 