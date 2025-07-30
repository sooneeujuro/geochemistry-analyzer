'use client'

import { useMemo } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import { ScanResult } from '@/types/geochem'
import { TrendingUp, TrendingDown, Minus, CheckCircle } from 'lucide-react'

interface ScanResultCardProps {
  result: ScanResult
  onSelect: (xColumn: string, yColumn: string) => void
  includeTypeColumn?: boolean
  selectedTypeColumn?: string
  compact?: boolean
}

export default function ScanResultCard({ 
  result, 
  onSelect, 
  includeTypeColumn, 
  selectedTypeColumn,
  compact = false 
}: ScanResultCardProps) {
  
  const typeGroups = useMemo(() => {
    if (!includeTypeColumn || !selectedTypeColumn) {
      return [{ type: 'default', data: result.chartData, color: '#3B82F6' }]
    }
    
    const groups = new Map<string, typeof result.chartData>()
    result.chartData.forEach(point => {
      const type = point.type
      if (!groups.has(type)) {
        groups.set(type, [])
      }
      groups.get(type)!.push(point)
    })
    
    const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6']
    
    return Array.from(groups.entries()).map(([type, data], index) => ({
      type,
      data,
      color: colors[index % colors.length]
    }))
  }, [result.chartData, includeTypeColumn, selectedTypeColumn])

  const getCorrelationIcon = (corr: number) => {
    if (Math.abs(corr) < 0.1) return <Minus className="h-4 w-4 text-gray-400" />
    if (corr > 0) return <TrendingUp className="h-4 w-4 text-green-500" />
    return <TrendingDown className="h-4 w-4 text-red-500" />
  }

  const getCorrelationStrength = (corr: number) => {
    const abs = Math.abs(corr)
    if (abs >= 0.8) return '매우 강함'
    if (abs >= 0.6) return '강함'
    if (abs >= 0.4) return '보통'
    if (abs >= 0.2) return '약함'
    return '매우 약함'
  }

  const pearsonCorr = result.statistics.pearsonCorr || 0
  const pearsonP = result.statistics.pearsonP || 1
  const rSquared = result.statistics.rSquared || 0

  return (
    <div 
      onClick={() => onSelect(result.xColumn, result.yColumn)}
      className={`bg-white border rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg hover:border-blue-300 ${
        result.isSignificant 
          ? 'border-green-300 bg-green-50' 
          : 'border-gray-200'
      } ${compact ? 'p-3' : 'p-4'}`}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          {result.isSignificant && (
            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
          )}
          <h4 className={`font-medium text-gray-800 ${compact ? 'text-sm' : 'text-base'}`}>
            {result.xLabel} vs {result.yLabel}
          </h4>
        </div>
        {getCorrelationIcon(pearsonCorr)}
      </div>

      {/* 미니 차트 */}
      <div className={`${compact ? 'h-20' : 'h-32'} mb-3`}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <XAxis 
              type="number" 
              dataKey="x" 
              hide
              domain={['dataMin', 'dataMax']}
            />
            <YAxis 
              type="number" 
              dataKey="y" 
              hide
              domain={['dataMin', 'dataMax']}
            />
            {typeGroups.map((group, index) => (
              <Scatter
                key={group.type}
                data={group.data}
                fill={group.color}
                fillOpacity={0.7}
                r={compact ? 2 : 3}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* 통계 정보 */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className={`text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>상관계수:</span>
          <span className={`font-medium ${compact ? 'text-xs' : 'text-sm'} ${
            Math.abs(pearsonCorr) >= 0.5 ? 'text-green-600' : 'text-gray-700'
          }`}>
            {pearsonCorr.toFixed(3)}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className={`text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>P-value:</span>
          <span className={`font-medium ${compact ? 'text-xs' : 'text-sm'} ${
            pearsonP <= 0.05 ? 'text-green-600' : 'text-gray-700'
          }`}>
            {pearsonP < 0.001 ? '<0.001' : pearsonP.toFixed(3)}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className={`text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>R²:</span>
          <span className={`font-medium ${compact ? 'text-xs' : 'text-sm'}`}>
            {rSquared.toFixed(3)}
          </span>
        </div>

        {!compact && (
          <div className="pt-2 border-t border-gray-100">
            <div className="text-xs text-gray-500">
              강도: {getCorrelationStrength(pearsonCorr)}
            </div>
            <div className="text-xs text-gray-500">
              데이터: {result.dataCount}개
            </div>
          </div>
        )}
      </div>

      {result.isSignificant && (
        <div className={`mt-2 text-center ${compact ? 'text-xs' : 'text-sm'} text-green-600 font-medium`}>
          ✨ 유의미한 상관관계
        </div>
      )}
    </div>
  )
} 