'use client'

import { useState, useEffect, useMemo } from 'react'
import { GeochemData, ScanResult, ScanOptions, ScanSummary } from '@/types/geochem'
import { calculateStatistics } from '@/lib/statistics'
import { estimateAPICost } from '@/lib/ai-recommendations'

interface AIRecommendation {
  xColumn: string
  yColumn: string
  reason: string
  confidence: number
  isRatio?: boolean
  ratioName?: string
}
import ScanResultCard from './ScanResultCard'
import PDFReport from './PDFReport'
import { Play, Settings, Download, Filter, TrendingUp, AlertCircle, ChevronLeft, ChevronRight, RotateCcw, Brain, Key, DollarSign, FileText } from 'lucide-react'

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
  const [showPDFReport, setShowPDFReport] = useState(false)
  
  // 고급 통계분석 상태
  const [showAdvancedStats, setShowAdvancedStats] = useState(false)
  const [pcaSuggestions, setPcaSuggestions] = useState<any[]>([])
  const [methodRecommendations, setMethodRecommendations] = useState<any[]>([])
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  
  // 선택된 변수들 관리 (PCA 추천용)
  const [selectedVariables, setSelectedVariables] = useState<Set<string>>(new Set())
  
  // 결과 필터링 및 페이지네이션 관리
  const [filterVariable, setFilterVariable] = useState<string>('')
  const [pageInput, setPageInput] = useState<string>('')
  
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
    sampleDescription: '',
    aiRecommendationsOnly: false
  })

  // API 키는 이제 백엔드에서 안전하게 관리됩니다
  useEffect(() => {
    // 더 이상 localStorage에서 API 키를 로드하지 않습니다
  }, [])
  
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
  
  // 필터링된 결과 계산
  const filteredResults = useMemo(() => {
    if (!filterVariable) return scanResults
    
    return scanResults
      .filter(result => result.xColumn === filterVariable || result.yColumn === filterVariable)
      .sort((a, b) => {
        // 선택된 변수와의 상관관계 강도로 정렬
        const corrA = Math.abs(a.statistics.pearsonCorr || 0)
        const corrB = Math.abs(b.statistics.pearsonCorr || 0)
        return corrB - corrA
      })
  }, [scanResults, filterVariable])
  
  const allResults = useMemo(() => filteredResults, [filteredResults])

  // 고유한 변수들 목록 (필터링용)
  const uniqueVariables = useMemo(() => {
    const variables = new Set<string>()
    scanResults.forEach(result => {
      variables.add(result.xColumn)
      variables.add(result.yColumn)
    })
    return Array.from(variables).sort()
  }, [scanResults])

  // 페이지 입력 핸들러
  const handlePageInputChange = (value: string) => {
    setPageInput(value)
  }

  const handlePageInputSubmit = () => {
    const pageNum = parseInt(pageInput)
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum)
      setPageInput('')
    } else {
      alert(`1부터 ${totalPages}까지의 페이지 번호를 입력해주세요.`)
    }
  }

  // 페이지네이션된 결과
  const paginatedResults = useMemo(() => {
    const startIndex = (currentPage - 1) * resultsPerPage
    const endIndex = startIndex + resultsPerPage
    return allResults.slice(startIndex, endIndex)
  }, [allResults, currentPage, resultsPerPage])

  const totalPages = Math.ceil(allResults.length / resultsPerPage)
  
  // 필터 변경으로 인해 현재 페이지가 총 페이지를 초과하는 경우 조정
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1)
    }
  }, [totalPages, currentPage])

  const startNewScan = () => {
    // 새 스캔 시작 - 결과 초기화
    if (onStartNewScan) {
      onStartNewScan()
    }
  }

  // AI 추천 받기 (백엔드 API 호출)
  const getAIRecommendationsList = async () => {
    setIsLoadingAI(true)
    setAiError(null)

    try {
      // 백엔드 API 호출 (안전함)
      const response = await fetch('/api/ai-recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          columns: analysisColumns,
          sampleDescription: scanOptions.sampleDescription || '',
          provider: scanOptions.aiProvider!,
          maxRecommendations: 10
        })
      })

              if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json()
          } catch {
            errorData = { error: `HTTP ${response.status}: ${response.statusText}` }
          }
          console.error('API Error Details:', {
            status: response.status,
            statusText: response.statusText,
            errorData
          })
          throw new Error(errorData.error || `API 호출 실패: ${response.status}`)
        }

      const result = await response.json()
      setAiRecommendations(result.recommendations || [])
      setAiError(null)
    } catch (error) {
      console.error('AI Recommendations Error:', error)
      setAiError(error instanceof Error ? error.message : 'AI 추천을 받는데 실패했습니다.')
    } finally {
      setIsLoadingAI(false)
    }
  }

  // 고급 통계분석 함수들
  const getAdvancedStatistics = async (analysisType: 'pca-suggestion' | 'method-recommendation') => {
    if (isLoadingStats) return
    
    setIsLoadingStats(true)
    try {
      // 데이터 준비
      const preparedData: Record<string, number[]> = {}
      data.numericColumns.forEach(col => {
        preparedData[col] = data.data.map(row => parseFloat(row[col])).filter(v => !isNaN(v))
      })

      const response = await fetch('/api/statistical-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: preparedData,
          analysisType,
          context: scanOptions.sampleDescription || 'geochemical data analysis'
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const result = await response.json()
      
      if (analysisType === 'pca-suggestion') {
        setPcaSuggestions(result.suggestions || [])
      } else if (analysisType === 'method-recommendation') {
        setMethodRecommendations(result.recommendations || [])
      }

    } catch (error) {
      console.error('Advanced statistics error:', error)
      alert('고급 통계분석 요청 중 오류가 발생했습니다.')
    } finally {
      setIsLoadingStats(false)
    }
  }

  // 변수 선택/해제 함수들
  const toggleVariableSelection = (variable: string) => {
    setSelectedVariables(prev => {
      const newSet = new Set(prev)
      if (newSet.has(variable)) {
        newSet.delete(variable)
      } else {
        newSet.add(variable)
      }
      return newSet
    })
  }

  const clearVariableSelection = () => {
    setSelectedVariables(new Set())
  }

  const selectAllFromSuggestion = (variables: string[]) => {
    setSelectedVariables(new Set(variables))
  }

  // PCA 추천 조합으로 바로 분석 실행
  const runPCAAnalysis = async (variables: string[]) => {
    if (variables.length < 2) {
      alert('최소 2개 이상의 변수가 필요합니다.')
      return
    }

    // 추천된 변수들만 분석하도록 excludeColumns 설정
    const variablesToExclude = data.numericColumns.filter(col => !variables.includes(col))
    
    setScanOptions(prev => ({
      ...prev,
      excludeColumns: variablesToExclude,
      aiRecommendationsOnly: false // PCA 조합은 모든 조합을 분석
    }))

    // 스캔 실행 알림
    alert(`PCA 추천 변수들 (${variables.join(', ')})로 분석을 시작합니다.`)

    // 약간의 딜레이 후 스캔 실행 (상태 업데이트 반영)
    setTimeout(() => {
      performScan()
      
      // 스캔 완료 후 결과 영역으로 자동 스크롤
      setTimeout(() => {
        const resultsSection = document.querySelector('[data-scan-results]')
        if (resultsSection) {
          resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 1000)
    }, 200)
  }

  // 선택된 변수들로 분석 실행
  const runSelectedVariablesAnalysis = async () => {
    const selected = Array.from(selectedVariables)
    
    if (selected.length < 2) {
      alert('최소 2개 이상의 변수를 선택해주세요.')
      return
    }

    if (selected.length > 10) {
      const confirmed = confirm(`${selected.length}개 변수로 ${selected.length * (selected.length - 1) / 2}개 조합을 분석합니다. 계속하시겠습니까?`)
      if (!confirmed) return
    }

    // 선택된 변수들만 분석하도록 excludeColumns 설정
    const variablesToExclude = data.numericColumns.filter(col => !selected.includes(col))
    
    setScanOptions(prev => ({
      ...prev,
      excludeColumns: variablesToExclude,
      aiRecommendationsOnly: false
    }))

    // 선택 상태 초기화
    clearVariableSelection()

    // 스캔 실행 알림
    alert(`선택한 ${selected.length}개 변수 (${selected.join(', ')})로 분석을 시작합니다.`)

    // 약간의 딜레이 후 스캔 실행 (상태 업데이트 반영)
    setTimeout(() => {
      performScan()
      
      // 스캔 완료 후 결과 영역으로 자동 스크롤
      setTimeout(() => {
        const resultsSection = document.querySelector('[data-scan-results]')
        if (resultsSection) {
          resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 1000)
    }, 200)
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
      // 조합 생성: AI 추천만 사용 또는 모든 조합 (비율 포함)
      let combinations: Array<{
        xColumn: string, 
        yColumn: string, 
        aiRecommended?: boolean, 
        aiReason?: string, 
        aiConfidence?: number,
        isRatio?: boolean,
        ratioName?: string
      }> = []
      
      if (scanOptions.aiRecommendationsOnly && aiRecommendations.length > 0) {
        // AI 추천 조합만 사용 (비율 포함)
        combinations = aiRecommendations.map(rec => ({
          xColumn: rec.xColumn,
          yColumn: rec.yColumn,
          aiRecommended: true,
          aiReason: rec.reason,
          aiConfidence: rec.confidence,
          isRatio: rec.isRatio,
          ratioName: rec.ratioName
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
              aiConfidence: aiRec?.confidence,
              isRatio: aiRec?.isRatio,
              ratioName: aiRec?.ratioName
            })
          }
        }
      }

      // 각 조합 분석
      for (const combination of combinations) {
        const { xColumn, yColumn, aiRecommended, aiReason, aiConfidence, isRatio, ratioName } = combination

        // 데이터 추출 (비율 계산 포함)
        const validData = data.data
          .map(row => {
            let x = parseFloat(row[xColumn])
            let y = parseFloat(row[yColumn])
            
            // 비율인 경우 계산
            if (isRatio && ratioName) {
              // x/y 비율 계산
              if (y !== 0) {
                const ratioValue = x / y
                x = ratioValue
                y = 1 // 비율이므로 y축은 고정값
              } else {
                return null // 0으로 나누기 방지
              }
            }
            
            return {
              x,
              y,
              type: scanOptions.includeTypeColumn && scanOptions.selectedTypeColumn 
                ? String(row[scanOptions.selectedTypeColumn]) 
                : 'default'
            }
          })
          .filter((point): point is { x: number; y: number; type: string } => 
            point !== null && !isNaN(point.x) && !isNaN(point.y) && isFinite(point.x) && isFinite(point.y))

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
          id: `${xColumn}_${yColumn}${isRatio ? '_ratio' : ''}`,
          xColumn,
          yColumn,
          xLabel: isRatio && ratioName ? ratioName : xColumn,
          yLabel: isRatio ? 'Values' : yColumn,
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
      <div className="rounded-lg shadow-xl p-6" style={{backgroundColor: 'white', border: '3px solid #74CEF7'}}>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold flex items-center" style={{color: '#0357AF'}}>
              ⚙️ 스캔 설정
            </h2>
            {scanResults.length > 0 && (
              <p className="text-sm mt-1" style={{color: '#0180CC'}}>
                ✅ 스캔 완료됨 ({scanSummary?.executionTime ? (scanSummary.executionTime / 1000).toFixed(1) : '?'}초 소요)
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
          <div className="p-4 rounded-lg shadow-sm border-2" style={{backgroundColor: '#E6FBFA', borderColor: '#74CEF7'}}>
            <div className="text-2xl font-bold" style={{color: '#0357AF'}}>{totalCombinations}</div>
            <div className="text-sm" style={{color: '#0180CC'}}>📊 총 조합 수</div>
          </div>
          <div className="p-4 rounded-lg shadow-sm border-2" style={{backgroundColor: '#9BE8F0', borderColor: '#0180CC'}}>
            <div className="text-2xl font-bold" style={{color: '#0357AF'}}>{significantResults.length}</div>
            <div className="text-sm" style={{color: '#0180CC'}}>✨ 유의미한 조합</div>
          </div>
          <div className="p-4 rounded-lg shadow-sm border-2" style={{backgroundColor: '#74CEF7', borderColor: '#0357AF'}}>
            <div className="text-2xl font-bold text-white">{analysisColumns.length}</div>
            <div className="text-sm text-white opacity-90">🔬 분석 대상 컬럼</div>
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
            className="w-full px-6 py-3 text-white rounded-lg hover:shadow-lg disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center font-medium transition-all"
            style={{
              backgroundColor: isScanning ? '#9CA3AF' : '#E4815A'
            }}
          >
            <RotateCcw className="h-5 w-5 mr-2" />
            🔄 새 스캔 시작
          </button>
        ) : (
          // 스캔 결과가 없는 경우 - 일반 스캔 시작 버튼
          <button
            onClick={performScan}
            disabled={isScanning || analysisColumns.length < 2}
            className="w-full px-6 py-3 text-white rounded-lg hover:shadow-lg disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center font-medium transition-all"
            style={{
              backgroundColor: isScanning || analysisColumns.length < 2 ? '#9CA3AF' : '#0357AF'
            }}
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
                <label className="block text-sm font-medium mb-3" style={{color: '#0357AF'}}>
                  🤖 AI 제공자 선택
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="flex items-start p-4 border-2 rounded-lg cursor-not-allowed opacity-60 transition-all"
                         style={{borderColor: '#74CEF7', backgroundColor: '#E6FBFA'}}>
                    <input
                      type="radio"
                      name="aiProvider"
                      value="google"
                      checked={scanOptions.aiProvider === 'google'}
                      onChange={(e) => setScanOptions({
                        ...scanOptions,
                        aiProvider: e.target.value as 'google'
                      })}
                      className="w-4 h-4 mt-1"
                      disabled
                      style={{accentColor: '#0180CC'}}
                    />
                    <div className="ml-3 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{color: '#0357AF'}}>
                          Google AI (Gemini)
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full text-white font-medium"
                              style={{backgroundColor: '#E4815A'}}>
                          🔧 점검중
                        </span>
                      </div>
                      <div className="text-xs mt-1" style={{color: '#0180CC'}}>
                        일시적으로 사용 불가능
                      </div>
                    </div>
                  </label>
                  
                  <label className="flex items-start p-4 border-2 rounded-lg cursor-pointer hover:shadow-lg transition-all"
                         style={{
                           borderColor: scanOptions.aiProvider === 'openai' ? '#0180CC' : '#74CEF7',
                           backgroundColor: scanOptions.aiProvider === 'openai' ? '#9BE8F0' : '#E6FBFA'
                         }}>
                    <input
                      type="radio"
                      name="aiProvider"
                      value="openai"
                      checked={scanOptions.aiProvider === 'openai'}
                      onChange={(e) => setScanOptions({
                        ...scanOptions,
                        aiProvider: e.target.value as 'openai'
                      })}
                      className="w-4 h-4 mt-1"
                      style={{accentColor: '#0180CC'}}
                    />
                    <div className="ml-3 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{color: '#0357AF'}}>
                          OpenAI (GPT-4)
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full bg-green-500 text-white font-medium">
                          ✅ 정상
                        </span>
                      </div>
                      <div className="text-xs mt-1" style={{color: '#0180CC'}}>
                        고품질 원소 비율 추천
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* 서비스 안내 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <Key className="h-4 w-4 text-blue-600 mr-2" />
                  <span className="text-sm font-medium text-blue-800">
                    🔒 안전한 AI 서비스
                  </span>
                </div>
                <p className="text-xs text-blue-700">
                  API 키는 서버에서 안전하게 관리됩니다. 별도 설정 없이 바로 이용 가능합니다.
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {scanOptions.aiProvider === 'openai' 
                    ? '🤖 OpenAI GPT-4로 고품질 지구화학 분석 제공'
                    : '🧠 Google Gemini로 빠르고 정확한 분석 제공'
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
                  disabled={isLoadingAI}
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

      {/* 고급 통계분석 */}
      {!isScanning && data.numericColumns.length >= 3 && (
        <div className="rounded-lg shadow-xl p-6" style={{backgroundColor: 'white', border: '3px solid #74CEF7'}}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold flex items-center" style={{color: '#0357AF'}}>
              📊 고급 통계분석
            </h3>
            <button
              onClick={() => setShowAdvancedStats(!showAdvancedStats)}
              className="text-sm px-3 py-1 rounded-md transition-all"
              style={{
                backgroundColor: showAdvancedStats ? '#0180CC' : '#74CEF7',
                color: 'white'
              }}
            >
              {showAdvancedStats ? '접기' : '펼치기'}
            </button>
          </div>

          {showAdvancedStats && (
            <div className="space-y-4">
              {/* PCA 추천 */}
              <div className="p-4 rounded-lg" style={{backgroundColor: '#E6FBFA', border: '2px solid #9BE8F0'}}>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-medium flex items-center" style={{color: '#0357AF'}}>
                    🔍 PCA 변수 조합 추천
                  </h4>
                  <button
                    onClick={() => getAdvancedStatistics('pca-suggestion')}
                    disabled={isLoadingStats}
                    className="text-sm px-3 py-1 rounded-md text-white transition-all"
                    style={{
                      backgroundColor: isLoadingStats ? '#9CA3AF' : '#0357AF'
                    }}
                  >
                    {isLoadingStats ? '분석중...' : 'AI 추천'}
                  </button>
                </div>
                
                                {pcaSuggestions.length > 0 && (
                  <div className="space-y-3">
                    {/* 선택 컨트롤 */}
                    <div className="flex justify-between items-center p-3 rounded-md" style={{backgroundColor: '#F0F8FF', border: '1px solid #74CEF7'}}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{color: '#0357AF'}}>
                          변수 선택: {selectedVariables.size}개
                        </span>
                        {selectedVariables.size > 0 && (
                          <span className="text-xs" style={{color: '#0180CC'}}>
                            ({Array.from(selectedVariables).join(', ')})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={clearVariableSelection}
                          disabled={selectedVariables.size === 0}
                          className="text-xs px-2 py-1 rounded-md transition-all"
                          style={{
                            backgroundColor: selectedVariables.size === 0 ? '#E5E7EB' : '#9BE8F0',
                            color: selectedVariables.size === 0 ? '#9CA3AF' : '#0357AF'
                          }}
                        >
                          선택 해제
                        </button>
                        <button
                          onClick={runSelectedVariablesAnalysis}
                          disabled={isScanning || selectedVariables.size < 2}
                          className="text-xs px-3 py-1 rounded-md text-white font-medium transition-all"
                          style={{
                            backgroundColor: isScanning || selectedVariables.size < 2 ? '#9CA3AF' : '#74CEF7',
                            cursor: isScanning || selectedVariables.size < 2 ? 'not-allowed' : 'pointer'
                          }}
                          title="선택한 변수들로 조합 분석 실행"
                        >
                          ☑️ 선택 조합 실행
                        </button>
                      </div>
                    </div>

                    {/* PCA 추천 결과들 */}
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {pcaSuggestions.map((suggestion, idx) => (
                        <div key={idx} className="p-3 rounded-md bg-white border">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium" style={{color: '#0357AF'}}>
                                  추천 조합 #{idx + 1}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full text-white"
                                      style={{backgroundColor: '#0180CC'}}>
                                  신뢰도: {(suggestion.confidence * 100).toFixed(0)}%
                                </span>
                              </div>
                              
                              {/* 변수별 체크박스 */}
                              <div className="flex flex-wrap gap-2 mb-2">
                                {suggestion.variables.map((variable: string) => (
                                  <label key={variable} className="flex items-center gap-1 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={selectedVariables.has(variable)}
                                      onChange={() => toggleVariableSelection(variable)}
                                      className="w-3 h-3 rounded"
                                      style={{accentColor: '#0357AF'}}
                                    />
                                    <span className="text-xs font-medium" style={{color: '#0180CC'}}>
                                      {variable}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => selectAllFromSuggestion(suggestion.variables)}
                                className="text-xs px-2 py-1 rounded-md transition-all"
                                style={{
                                  backgroundColor: '#9BE8F0',
                                  color: '#0357AF'
                                }}
                                title="이 추천의 모든 변수 선택"
                              >
                                📌 전체선택
                              </button>
                              <button
                                onClick={() => runPCAAnalysis(suggestion.variables)}
                                disabled={isScanning}
                                className="text-xs px-2 py-1 rounded-md text-white font-medium transition-all"
                                style={{
                                  backgroundColor: isScanning ? '#9CA3AF' : '#E4815A',
                                  cursor: isScanning ? 'not-allowed' : 'pointer'
                                }}
                                title="이 조합으로 즉시 분석 실행"
                              >
                                🚀 즉시 실행
                              </button>
                            </div>
                          </div>

                          <p className="text-xs mb-1" style={{color: '#0180CC'}}>
                            {suggestion.reason}
                          </p>
                          
                          {suggestion.varianceExplained && (
                            <div className="text-xs" style={{color: '#666'}}>
                              설명력: PC1({suggestion.varianceExplained[0]?.toFixed(1)}%), 
                              PC2({suggestion.varianceExplained[1]?.toFixed(1)}%)
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 통계방법 추천 */}
              <div className="p-4 rounded-lg" style={{backgroundColor: '#9BE8F0', border: '2px solid #74CEF7'}}>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-medium flex items-center" style={{color: '#0357AF'}}>
                    🧮 통계분석 방법 추천
                  </h4>
                  <button
                    onClick={() => getAdvancedStatistics('method-recommendation')}
                    disabled={isLoadingStats}
                    className="text-sm px-3 py-1 rounded-md text-white transition-all"
                    style={{
                      backgroundColor: isLoadingStats ? '#9CA3AF' : '#0357AF'
                    }}
                  >
                    {isLoadingStats ? '분석중...' : 'AI 추천'}
                  </button>
                </div>
                
                {methodRecommendations.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {methodRecommendations.map((method, idx) => (
                      <div key={idx} className="p-3 rounded-md bg-white border">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-sm font-medium" style={{color: '#0357AF'}}>
                            {method.method}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full text-white"
                                style={{backgroundColor: '#0180CC'}}>
                            신뢰도: {(method.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-xs" style={{color: '#0180CC'}}>
                          {method.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 분석 현황 */}
              <div className="text-xs p-3 rounded-md" style={{backgroundColor: '#74CEF7', color: 'white'}}>
                📈 변수 {data.numericColumns.length}개 | 샘플 {data.data.length}개
                {scanOptions.sampleDescription && (
                  <span className="ml-2">| {scanOptions.sampleDescription}</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 스캔 결과 */}
      {!isScanning && scanResults.length > 0 && (
        <div data-scan-results className="bg-white rounded-lg shadow-lg p-6" style={{border: '3px solid #E4815A'}}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold flex items-center" style={{color: '#0357AF'}}>
                📊 스캔 결과
              </h2>
              <p className="text-sm mt-1" style={{color: '#E4815A'}}>
                💡 <strong>결과 카드를 클릭</strong>하면 해당 조합의 <strong>그래프를 자유롭게 조작</strong>할 수 있어요!
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowPDFReport(true)}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <FileText className="h-4 w-4 mr-2" />
                PDF 리포트
              </button>
              {scanSummary && (
                <div className="text-sm text-gray-600">
                  실행 시간: {(scanSummary.executionTime / 1000).toFixed(1)}초
                </div>
              )}
            </div>
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
            {/* 필터링 및 제어 */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-medium text-gray-800">
                  전체 결과 ({allResults.length}개)
                </h3>
                
                {/* 변수 필터링 */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium" style={{color: '#0357AF'}}>
                    변수 필터:
                  </label>
                  <select
                    value={filterVariable}
                    onChange={(e) => {
                      setFilterVariable(e.target.value)
                      setCurrentPage(1) // 필터 변경시 첫 페이지로
                    }}
                    className="text-sm border border-gray-300 rounded-md px-3 py-1"
                    style={{minWidth: '120px'}}
                  >
                    <option value="">전체 보기</option>
                    {uniqueVariables.map(variable => (
                      <option key={variable} value={variable}>
                        {variable}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 페이지네이션 제어 */}
              {totalPages > 1 && (
                <div className="flex items-center gap-3">
                  {/* 페이지 직접 입력 */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">페이지:</span>
                    <input
                      type="number"
                      value={pageInput}
                      onChange={(e) => handlePageInputChange(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handlePageInputSubmit()
                        }
                      }}
                      placeholder={currentPage.toString()}
                      className="w-16 text-sm border border-gray-300 rounded-md px-2 py-1 text-center"
                      min="1"
                      max={totalPages}
                    />
                    <button
                      onClick={handlePageInputSubmit}
                      className="text-xs px-2 py-1 rounded-md text-white"
                      style={{backgroundColor: '#74CEF7'}}
                    >
                      이동
                    </button>
                  </div>

                  {/* 기존 페이지네이션 버튼들 */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="p-2 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed"
                      title="첫 페이지"
                    >
                      ⏮️
                    </button>
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="p-2 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-medium px-2" style={{color: '#0357AF'}}>
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="p-2 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed"
                      title="마지막 페이지"
                    >
                      ⏭️
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 필터링 상태 표시 */}
            {filterVariable && (
              <div className="mb-4 p-3 rounded-md" style={{backgroundColor: '#E6FBFA', border: '1px solid #9BE8F0'}}>
                <span className="text-sm" style={{color: '#0357AF'}}>
                  🔍 <strong>{filterVariable}</strong>와(과) 상관관계가 있는 결과들을 상관계수 순으로 표시 중
                  <button
                    onClick={() => setFilterVariable('')}
                    className="ml-2 text-xs px-2 py-1 rounded-md text-white"
                    style={{backgroundColor: '#E4815A'}}
                  >
                    필터 해제
                  </button>
                </span>
              </div>
            )}

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

      {/* PDF 리포트 모달 */}
      <PDFReport
        isOpen={showPDFReport}
        onClose={() => setShowPDFReport(false)}
        scanResults={scanResults}
        scanSummary={scanSummary}
        data={data}
      />
    </div>
  )
} 