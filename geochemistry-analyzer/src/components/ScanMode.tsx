'use client'

import { useState, useEffect, useMemo } from 'react'
import { GeochemData, ScanResult, ScanOptions, ScanSummary } from '@/types/geochem'
import { calculateStatistics } from '@/lib/statistics'
import ScanResultCard from './ScanResultCard'
// import ScanReport from './ScanReport' // 임시 비활성화
import { Play, Settings, Download, Filter, TrendingUp, AlertCircle, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'

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
  const [showReport, setShowReport] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [resultsPerPage] = useState(20) // 페이지당 결과 수
  const [scanOptions, setScanOptions] = useState<ScanOptions>({
    statMethods: ['pearson'],
    threshold: 0.5,
    pThreshold: 0.05,
    excludeColumns: [],
    includeTypeColumn: !!selectedTypeColumn,
    selectedTypeColumn: selectedTypeColumn
  })

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

  const performScan = async () => {
    if (analysisColumns.length < 2) {
      alert('분석할 수치 컬럼이 최소 2개 이상 필요합니다.')
      return
    }

    setIsScanning(true)
    setCurrentPage(1) // 페이지 초기화
    const startTime = Date.now()
    const results: ScanResult[] = []

    try {
      // 모든 조합 생성 및 분석
      for (let i = 0; i < analysisColumns.length; i++) {
        for (let j = i + 1; j < analysisColumns.length; j++) {
          const xColumn = analysisColumns[i]
          const yColumn = analysisColumns[j]

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
            dataCount: validData.length
          })
        }
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
        scanOptions
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
            {scanSummary && (
              <button
                onClick={() => setShowReport(true)}
                className="px-3 py-2 text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded-md flex items-center"
              >
                <Download className="h-4 w-4 mr-1" />
                PDF 리포트
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{analysisColumns.length}</div>
            <div className="text-sm text-gray-600">분석 대상 컬럼</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{totalCombinations}</div>
            <div className="text-sm text-gray-600">전체 조합</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {scanSummary?.significantCombinations || 0}
            </div>
            <div className="text-sm text-gray-600">유의미한 조합</div>
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

          {/* 컬럼 배제 설정 */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-md font-medium text-gray-800">분석에서 배제할 컬럼 선택</h4>
              <div className="flex space-x-2">
                <button
                  onClick={() => setScanOptions({
                    ...scanOptions,
                    excludeColumns: []
                  })}
                  className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded"
                >
                  전체 선택 해제
                </button>
                <button
                  onClick={() => setScanOptions({
                    ...scanOptions,
                    excludeColumns: [...data.numericColumns]
                  })}
                  className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                >
                  전체 선택
                </button>
              </div>
            </div>
            
            {/* 자동 배제된 컬럼들 표시 */}
            {autoExcludeColumns.length > 0 && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="text-sm font-medium text-yellow-800 mb-2">
                  자동 배제된 컬럼 (ID, 번호 등)
                </div>
                <div className="flex flex-wrap gap-2">
                  {autoExcludeColumns.map((col) => (
                    <span key={col} className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 수동 배제 컬럼 선택 */}
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md p-3">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {data.numericColumns
                  .filter(col => !autoExcludeColumns.includes(col))
                  .map((column) => (
                    <label
                      key={column}
                      className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={scanOptions.excludeColumns.includes(column)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setScanOptions({
                              ...scanOptions,
                              excludeColumns: [...scanOptions.excludeColumns, column]
                            })
                          } else {
                            setScanOptions({
                              ...scanOptions,
                              excludeColumns: scanOptions.excludeColumns.filter(col => col !== column)
                            })
                          }
                        }}
                        className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                      />
                      <span className="text-sm text-gray-700 truncate" title={column}>
                        {column}
                      </span>
                    </label>
                  ))}
              </div>
            </div>

            {/* 선택된 배제 컬럼 요약 */}
            {scanOptions.excludeColumns.length > 0 && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="text-sm font-medium text-red-800 mb-2">
                  배제할 컬럼 ({scanOptions.excludeColumns.length}개)
                </div>
                <div className="flex flex-wrap gap-1">
                  {scanOptions.excludeColumns.map((col) => (
                    <span key={col} className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 분석 대상 컬럼 수 표시 */}
            <div className="mt-4 text-center">
              <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                <span className="font-medium">분석 대상: {analysisColumns.length}개 컬럼</span>
                <span className="ml-2 text-blue-600">
                  ({totalCombinations}개 조합)
                </span>
              </div>
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
                {significantResults.map((result) => (
                  <ScanResultCard
                    key={result.id}
                    result={result}
                    onSelect={() => onResultSelect(result.xColumn, result.yColumn)}
                    includeTypeColumn={scanOptions.includeTypeColumn}
                    selectedTypeColumn={scanOptions.selectedTypeColumn}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 전체 결과들 (페이지네이션) */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-gray-500 mr-2" />
                <h3 className="text-lg font-medium text-gray-800">
                  전체 결과 ({allResults.length}개)
                </h3>
              </div>
              
              {/* 페이지네이션 컨트롤 */}
              {totalPages > 1 && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm text-gray-600">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {paginatedResults.map((result) => (
                <ScanResultCard
                  key={result.id}
                  result={result}
                  onSelect={() => onResultSelect(result.xColumn, result.yColumn)}
                  includeTypeColumn={scanOptions.includeTypeColumn}
                  selectedTypeColumn={scanOptions.selectedTypeColumn}
                  compact
                />
              ))}
            </div>
            
            {/* 페이지 정보 */}
            {totalPages > 1 && (
              <div className="mt-4 text-center text-sm text-gray-500">
                {(currentPage - 1) * resultsPerPage + 1} - {Math.min(currentPage * resultsPerPage, allResults.length)} / {allResults.length} 결과
              </div>
            )}
          </div>
        </div>
      )}

      {/* 로딩 상태 */}
      {isScanning && (
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">스캔 진행 중...</h3>
            <p className="text-gray-600 text-center">
              {totalCombinations}개 조합을 분석하고 있습니다.<br />
              잠시만 기다려주세요.
            </p>
          </div>
        </div>
      )}

      {/* PDF 리포트 모달 - 임시 비활성화 */}
      {/* {showReport && scanSummary && (
        <ScanReport
          summary={scanSummary}
          results={scanResults}
          onClose={() => setShowReport(false)}
        />
      )} */}
    </div>
  )
} 