'use client'

import { useState, useEffect } from 'react'
import { GeochemData, StatisticalResult, ColumnSelection } from '@/types/geochem'
import { calculateStatistics } from '@/lib/statistics'
import ScatterPlot from './ScatterPlot'
import { Activity, TrendingUp, BarChart } from 'lucide-react'

interface AnalysisPanelProps {
  data: GeochemData
  selectedColumns: ColumnSelection
}

export default function AnalysisPanel({ data, selectedColumns }: AnalysisPanelProps) {
  const [statistics, setStatistics] = useState<StatisticalResult | null>(null)
  const [loading, setLoading] = useState(false)

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

  useEffect(() => {
    if (selectedColumns.x && selectedColumns.y && data) {
      performAnalysis()
    }
  }, [selectedColumns.x, selectedColumns.y, data])

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

  if (!selectedColumns.x || !selectedColumns.y) {
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow-lg">
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
              <ScatterPlot
                data={data}
                selectedColumns={selectedColumns}
                statistics={statistics}
              />
            </div>

            {/* 통계 결과 */}
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                상관관계 통계
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
                선형 회귀 분석
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
    </div>
  )
} 