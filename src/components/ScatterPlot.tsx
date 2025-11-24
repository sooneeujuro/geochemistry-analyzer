'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'
import { GeochemData, StatisticalResult, ColumnSelection, ChartStyleOptions, PlotStyleOptions } from '@/types/geochem'
import { Settings, Palette, Move3D, Download, Shapes, Eye, EyeOff, ZoomIn, ZoomOut, TrendingUp, TrendingDown } from 'lucide-react'

interface ScatterPlotProps {
  data: GeochemData
  selectedColumns: ColumnSelection
  statistics: StatisticalResult
  isPCAMode?: boolean
  clusterData?: number[]
  typeStatistics?: Array<{
    type: string
    count: number
    pearsonCorr?: number
    spearmanCorr?: number
    pValue?: number
    rSquared?: number
    slope?: number
    intercept?: number
  }>
}

// 축 범위 타입 직접 정의
interface CustomAxisRange {
  xMin: number | 'auto'
  xMax: number | 'auto'
  yMin: number | 'auto'
  yMax: number | 'auto'
}

// 커스텀 마커 컴포넌트
const CustomMarker = (props: any) => {
  const { cx, cy, fill, shape, size, opacity, strokeWidth, strokeColor } = props
  const radius = size / 10

  switch (shape) {
    case 'triangle':
      const triangleHeight = radius * 1.5
      return (
        <polygon
          points={`${cx},${cy - triangleHeight} ${cx - radius},${cy + triangleHeight/2} ${cx + radius},${cy + triangleHeight/2}`}
          fill={fill}
          fillOpacity={opacity}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      )
    case 'square':
      return (
        <rect
          x={cx - radius}
          y={cy - radius}
          width={radius * 2}
          height={radius * 2}
          fill={fill}
          fillOpacity={opacity}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      )
    case 'diamond':
      return (
        <polygon
          points={`${cx},${cy - radius} ${cx + radius},${cy} ${cx},${cy + radius} ${cx - radius},${cy}`}
          fill={fill}
          fillOpacity={opacity}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      )
    default: // circle
      return (
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill={fill}
          fillOpacity={opacity}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      )
  }
}

export default function ScatterPlot({ data, selectedColumns, statistics, isPCAMode = false, clusterData = [], typeStatistics = [] }: ScatterPlotProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  
  const [styleOptions, setStyleOptions] = useState<ChartStyleOptions>({
    numberFormat: 'normal',
    fontFamily: 'Arial',
    axisTitleBold: true,
    axisNumberSize: 12,
    axisTitleSize: 14
  })

  const [xNumberFormat, setXNumberFormat] = useState<'normal' | 'scientific' | 'comma'>('normal')
  const [yNumberFormat, setYNumberFormat] = useState<'normal' | 'scientific' | 'comma'>('normal')
  const [xExponentialFormat, setXExponentialFormat] = useState<'standard' | 'superscript'>('standard')
  const [yExponentialFormat, setYExponentialFormat] = useState<'standard' | 'superscript'>('standard')
  
  const [plotOptions, setPlotOptions] = useState<PlotStyleOptions>({
    size: 60,
    shape: 'circle',
    opacity: 0.7,
    strokeWidth: 1,
    strokeColor: '#000000',
    useCustomColors: false,
    customColors: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#F97316', '#06B6D4', '#84CC16']
  })

  const [showGridlines, setShowGridlines] = useState(true)
  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF')
  const [visibleTypes, setVisibleTypes] = useState<Record<string, boolean>>({})
  const [useVisibleDataRange, setUseVisibleDataRange] = useState(false)
  const [showOverallTrend, setShowOverallTrend] = useState(true)
  const [showTypeTrends, setShowTypeTrends] = useState<Record<string, boolean>>({})
  const [showAllTypeTrends, setShowAllTypeTrends] = useState(false)
  
  const [trendlineStyle, setTrendlineStyle] = useState({
    color: '#FF0000',
    strokeWidth: 2,
    opacity: 0.8
  })

  const [axisRange, setAxisRange] = useState<CustomAxisRange>({
    xMin: 'auto',
    xMax: 'auto',
    yMin: 'auto',
    yMax: 'auto'
  })

  const [xLogScale, setXLogScale] = useState(false)
  const [yLogScale, setYLogScale] = useState(false)
  const [maintain1to1Ratio, setMaintain1to1Ratio] = useState(false)
  const [xTickInterval, setXTickInterval] = useState<number | 'auto'>('auto')
  const [yTickInterval, setYTickInterval] = useState<number | 'auto'>('auto')
  const [show1to1Line, setShow1to1Line] = useState(false)
  const [chartTitle, setChartTitle] = useState('')
  const [showChartTitle, setShowChartTitle] = useState(false)

  const [showStylePanel, setShowStylePanel] = useState(false)
  const [showPlotPanel, setShowPlotPanel] = useState(false)
  const [showAxisPanel, setShowAxisPanel] = useState(false)

  // 타입 안전한 type 필드 접근
  const getTypeField = () => {
    if (selectedColumns.useTypeColumn && selectedColumns.selectedTypeColumn) {
      return selectedColumns.selectedTypeColumn
    }
    return null
  }

  // 디버깅 로그
  console.log('ScatterPlot 데이터:', {
    statistics,
    typeStatistics,
    hasLinearRegression: !!(statistics as any)?.linearRegression,
    directSlope: (statistics as any)?.slope,
    directIntercept: (statistics as any)?.intercept,
    typeField: getTypeField()
  })

  // 차트 데이터 준비
  const chartData = useMemo(() => {
    if (!selectedColumns.x || !selectedColumns.y) return []

    const typeField = getTypeField()

    return data.data.map((row, index) => {
      let xValue: number
      if (selectedColumns.x!.type === 'single') {
        xValue = parseFloat(row[selectedColumns.x!.numerator])
      } else {
        const numerator = parseFloat(row[selectedColumns.x!.numerator])
        const denominator = parseFloat(row[selectedColumns.x!.denominator!])
        xValue = numerator / denominator
      }

      let yValue: number
      if (selectedColumns.y!.type === 'single') {
        yValue = parseFloat(row[selectedColumns.y!.numerator])
      } else {
        const numerator = parseFloat(row[selectedColumns.y!.numerator])
        const denominator = parseFloat(row[selectedColumns.y!.denominator!])
        yValue = numerator / denominator
      }

      let type = 'All Data'
      if (isPCAMode && clusterData.length > index) {
        type = `Cluster ${clusterData[index]}`
      } else if (typeField && row[typeField]) {
        type = row[typeField]?.toString().trim() || 'Unknown'
      }

      return {
        x: xValue,
        y: yValue,
        type: type,
        originalIndex: index,
        ...row
      }
    }).filter(item => !isNaN(item.x) && !isNaN(item.y) && isFinite(item.x) && isFinite(item.y))
  }, [data, selectedColumns, isPCAMode, clusterData])
  
  // 타입별 데이터 그룹화 (고정된 색상 매핑)
  const { typeGroups, fixedColorMap } = useMemo(() => {
    const groups: Record<string, typeof chartData> = {}
    const allTypes = Array.from(new Set(chartData.map(item => item.type))).sort()
    
    const colorMap: Record<string, string> = {}
    allTypes.forEach((type, index) => {
      colorMap[type] = plotOptions.customColors[index % plotOptions.customColors.length]
    })

    chartData.forEach(item => {
      if (!groups[item.type]) {
        groups[item.type] = []
      }
      groups[item.type].push(item)
    })

    return { typeGroups: groups, fixedColorMap: colorMap }
  }, [chartData, plotOptions.customColors])

  // 전체 데이터 범위 계산
  const fullDataRange = useMemo(() => {
    if (chartData.length === 0) return { xMin: 0, xMax: 100, yMin: 0, yMax: 100 }
    
    const xValues = chartData.map(d => d.x)
    const yValues = chartData.map(d => d.y)
    
    const xMin = Math.min(...xValues)
    const xMax = Math.max(...xValues)
    const yMin = Math.min(...yValues)
    const yMax = Math.max(...yValues)
    
    const xRange = xMax - xMin
    const yRange = yMax - yMin
    const xPadding = xRange * 0.05
    const yPadding = yRange * 0.05
    
    return {
      xMin: xMin - xPadding,
      xMax: xMax + xPadding,
      yMin: yMin - yPadding,
      yMax: yMax + yPadding
    }
  }, [chartData])

  // 표시되는 데이터 범위 계산
  const visibleDataRange = useMemo(() => {
    const visibleData = chartData.filter(item => visibleTypes[item.type] !== false)
    if (visibleData.length === 0) return fullDataRange
    
    const xValues = visibleData.map(d => d.x)
    const yValues = visibleData.map(d => d.y)
    
    const xMin = Math.min(...xValues)
    const xMax = Math.max(...xValues)
    const yMin = Math.min(...yValues)
    const yMax = Math.max(...yValues)
    
    const xRange = xMax - xMin
    const yRange = yMax - yMin
    const xPadding = xRange * 0.05
    const yPadding = yRange * 0.05
    
    return {
      xMin: xMin - xPadding,
      xMax: xMax + xPadding,
      yMin: yMin - yPadding,
      yMax: yMax + yPadding
    }
  }, [chartData, visibleTypes, fullDataRange])

  const currentRange = useVisibleDataRange ? visibleDataRange : fullDataRange

  // 로그 스케일을 위한 안전한 domain 계산
  const getLogSafeDomain = (min: number | 'auto', max: number | 'auto', isLog: boolean): [number, number] | 'auto' => {
    if (min === 'auto' || max === 'auto') {
      return 'auto'
    }

    if (isLog) {
      // 로그 스케일의 경우 양수만 허용
      const safeMin = min <= 0 ? 0.0001 : min
      const safeMax = max <= 0 ? 1 : max
      return [safeMin, safeMax]
    }

    return [min, max]
  }

  // 초기 설정
  useEffect(() => {
    const types = Object.keys(typeGroups)
    const newVisibleTypes: Record<string, boolean> = {}
    const newShowTypeTrends: Record<string, boolean> = {}
    
    types.forEach(type => {
      if (!(type in visibleTypes)) {
        newVisibleTypes[type] = true
      }
      if (!(type in showTypeTrends)) {
        newShowTypeTrends[type] = false
      }
    })
    
    if (Object.keys(newVisibleTypes).length > 0) {
      setVisibleTypes(prev => ({ ...prev, ...newVisibleTypes }))
    }
    if (Object.keys(newShowTypeTrends).length > 0) {
      setShowTypeTrends(prev => ({ ...prev, ...newShowTypeTrends }))
    }
  }, [typeGroups])

  // 추세선 좌표 계산 함수 (두 점만 반환)
  const calculateTrendlineSegment = (slope: number, intercept: number, xRange: { xMin: number, xMax: number }) => {
    if (!isFinite(slope) || !isFinite(intercept)) return null
    
    return [
      { x: xRange.xMin, y: slope * xRange.xMin + intercept },
      { x: xRange.xMax, y: slope * xRange.xMax + intercept }
    ]
  }

  // 전체 추세선 데이터
  const overallTrendSegment = useMemo(() => {
    // 여러 가능한 statistics 구조 확인
    let slope: number | undefined
    let intercept: number | undefined
    
    const stats = statistics as any
    
    if (stats?.linearRegression?.slope !== undefined && stats?.linearRegression?.intercept !== undefined) {
      slope = stats.linearRegression.slope
      intercept = stats.linearRegression.intercept
    } else if (stats?.slope !== undefined && stats?.intercept !== undefined) {
      slope = stats.slope
      intercept = stats.intercept
    } else if (stats?.regression?.slope !== undefined && stats?.regression?.intercept !== undefined) {
      slope = stats.regression.slope
      intercept = stats.regression.intercept
    }
    
    console.log('전체 추세선 데이터:', { slope, intercept, statistics })
    
    if (slope !== undefined && intercept !== undefined) {
      return calculateTrendlineSegment(slope, intercept, currentRange)
    }
    
    return null
  }, [statistics, currentRange])

  // 타입별 추세선 데이터
  const typeRegressionSegments = useMemo(() => {
    const segments: Array<{ type: string, segment: any[], color: string }> = []
    
    typeStatistics.forEach(typeStat => {
      if (!showTypeTrends[typeStat.type] || visibleTypes[typeStat.type] === false) return
      if (typeStat.slope === undefined || typeStat.intercept === undefined) return
      
      const segment = calculateTrendlineSegment(typeStat.slope, typeStat.intercept, currentRange)
      if (segment) {
        segments.push({
          type: typeStat.type,
          segment,
          color: fixedColorMap[typeStat.type] || '#666666'
        })
        
        console.log(`타입별 추세선 생성: ${typeStat.type}`, {
          slope: typeStat.slope,
          intercept: typeStat.intercept,
          segment,
          color: fixedColorMap[typeStat.type]
        })
      }
    })
    
    return segments
  }, [typeStatistics, showTypeTrends, visibleTypes, currentRange, fixedColorMap])

  // 토글 함수들
  const toggleTypeVisibility = (type: string) => {
    setVisibleTypes(prev => ({ ...prev, [type]: !prev[type] }))
  }

  const toggleAllTypes = () => {
    const allVisible = Object.values(visibleTypes).every(v => v)
    const newState = !allVisible
    const newVisibleTypes: Record<string, boolean> = {}
    Object.keys(typeGroups).forEach(type => {
      newVisibleTypes[type] = newState
    })
    setVisibleTypes(newVisibleTypes)
  }

  const toggleTypeTrendline = (type: string) => {
    setShowTypeTrends(prev => ({ ...prev, [type]: !prev[type] }))
  }

  const toggleAllTypeTrendlines = () => {
    const newState = !showAllTypeTrends
    setShowAllTypeTrends(newState)
    const newShowTypeTrends: Record<string, boolean> = {}
    Object.keys(typeGroups).forEach(type => {
      newShowTypeTrends[type] = newState
    })
    setShowTypeTrends(newShowTypeTrends)
  }

  const visibleData = chartData.filter(item => visibleTypes[item.type] !== false)

  // 위첨자 숫자 변환 함수
  const toSuperscript = (num: string) => {
    const superscriptMap: Record<string, string> = {
      '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
      '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
      '-': '⁻', '+': '⁺'
    }
    return num.split('').map(char => superscriptMap[char] || char).join('')
  }

  const formatXAxisLabel = (value: any) => {
    if (typeof value !== 'number' || !isFinite(value)) return ''

    switch (xNumberFormat) {
      case 'scientific':
        if (xExponentialFormat === 'superscript') {
          // 10^n 형식으로 변환
          const exp = value.toExponential(2)
          const match = exp.match(/^(-?\d+\.?\d*)e([+-]?\d+)$/)
          if (match) {
            const coefficient = parseFloat(match[1])
            const exponent = parseInt(match[2])
            if (coefficient === 1) {
              return `10${toSuperscript(exponent.toString())}`
            }
            return `${coefficient.toFixed(2)}×10${toSuperscript(exponent.toString())}`
          }
          return exp
        }
        return value.toExponential(2)
      case 'comma':
        return value.toLocaleString(undefined, { maximumFractionDigits: 3 })
      default:
        return value.toFixed(3)
    }
  }

  const formatYAxisLabel = (value: any) => {
    if (typeof value !== 'number' || !isFinite(value)) return ''

    switch (yNumberFormat) {
      case 'scientific':
        if (yExponentialFormat === 'superscript') {
          // 10^n 형식으로 변환
          const exp = value.toExponential(2)
          const match = exp.match(/^(-?\d+\.?\d*)e([+-]?\d+)$/)
          if (match) {
            const coefficient = parseFloat(match[1])
            const exponent = parseInt(match[2])
            if (coefficient === 1) {
              return `10${toSuperscript(exponent.toString())}`
            }
            return `${coefficient.toFixed(2)}×10${toSuperscript(exponent.toString())}`
          }
          return exp
        }
        return value.toExponential(2)
      case 'comma':
        return value.toLocaleString(undefined, { maximumFractionDigits: 3 })
      default:
        return value.toFixed(3)
    }
  }

  // 1:1 비율 유지를 위한 범위 계산
  const adjusted1to1Range = useMemo(() => {
    if (!maintain1to1Ratio) return currentRange

    const xRange = currentRange.xMax - currentRange.xMin
    const yRange = currentRange.yMax - currentRange.yMin
    const maxRange = Math.max(xRange, yRange)

    const xCenter = (currentRange.xMin + currentRange.xMax) / 2
    const yCenter = (currentRange.yMin + currentRange.yMax) / 2

    return {
      xMin: xCenter - maxRange / 2,
      xMax: xCenter + maxRange / 2,
      yMin: yCenter - maxRange / 2,
      yMax: yCenter + maxRange / 2
    }
  }, [currentRange, maintain1to1Ratio])

  // 커스텀 tick 생성 함수
  const generateTicks = (min: number, max: number, interval: number | 'auto') => {
    if (interval === 'auto') return undefined

    // 안전성 검사
    if (!isFinite(interval) || interval <= 0) return undefined
    if (!isFinite(min) || !isFinite(max)) return undefined
    if (min >= max) return undefined

    const ticks = []
    let current = Math.ceil(min / interval) * interval
    const maxTicks = 1000 // 최대 눈금 개수 제한

    while (current <= max && ticks.length < maxTicks) {
      ticks.push(current)
      current += interval
    }

    return ticks.length > 0 ? ticks : undefined
  }

  const xTicks = useMemo(() => {
    const min = axisRange.xMin === 'auto' ? adjusted1to1Range.xMin : axisRange.xMin
    const max = axisRange.xMax === 'auto' ? adjusted1to1Range.xMax : axisRange.xMax
    return generateTicks(min, max, xTickInterval)
  }, [axisRange.xMin, axisRange.xMax, adjusted1to1Range, xTickInterval])

  const yTicks = useMemo(() => {
    const min = axisRange.yMin === 'auto' ? adjusted1to1Range.yMin : axisRange.yMin
    const max = axisRange.yMax === 'auto' ? adjusted1to1Range.yMax : axisRange.yMax
    return generateTicks(min, max, yTickInterval)
  }, [axisRange.yMin, axisRange.yMax, adjusted1to1Range, yTickInterval])

  // 1:1 참조선 계산
  const oneToOneLineSegment = useMemo(() => {
    const xMin = axisRange.xMin === 'auto' ? adjusted1to1Range.xMin : axisRange.xMin
    const xMax = axisRange.xMax === 'auto' ? adjusted1to1Range.xMax : axisRange.xMax
    const yMin = axisRange.yMin === 'auto' ? adjusted1to1Range.yMin : axisRange.yMin
    const yMax = axisRange.yMax === 'auto' ? adjusted1to1Range.yMax : axisRange.yMax

    const overallMin = Math.max(xMin, yMin)
    const overallMax = Math.min(xMax, yMax)

    if (overallMin >= overallMax) return null

    return [
      { x: overallMin, y: overallMin },
      { x: overallMax, y: overallMax }
    ]
  }, [axisRange, adjusted1to1Range])

  const getAxisTitle = (config: NonNullable<ColumnSelection['x']>) => {
    if (config.type === 'single') {
      return config.numerator
    } else {
      return `${config.numerator}/${config.denominator}`
    }
  }

  const exportChart = async () => {
    if (!chartRef.current) return

    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: backgroundColor,
        scale: 2,
        logging: false,
        useCORS: true
      })

      const link = document.createElement('a')
      link.download = 'scatter-plot.png'
      link.href = canvas.toDataURL()
      link.click()
    } catch (error) {
      console.error('Export failed:', error)
      alert('이미지 내보내기에 실패했습니다.')
    }
  }

  if (!selectedColumns.x || !selectedColumns.y) {
    return (
      <div className="p-6 text-center text-gray-500">
        X축과 Y축을 선택해주세요
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 컨트롤 패널 */}
      <div className="flex flex-wrap gap-2 p-4 bg-gray-50 rounded-lg">
        <button
          onClick={() => setShowStylePanel(!showStylePanel)}
          className="flex items-center gap-2 px-3 py-2 bg-white border rounded-md hover:bg-gray-50"
        >
          <Palette className="w-4 h-4" />
          차트 스타일
        </button>
        
        <button
          onClick={() => setShowPlotPanel(!showPlotPanel)}
          className="flex items-center gap-2 px-3 py-2 bg-white border rounded-md hover:bg-gray-50"
        >
          <Shapes className="w-4 h-4" />
          플롯 스타일
        </button>
        
        <button
          onClick={() => setShowAxisPanel(!showAxisPanel)}
          className="flex items-center gap-2 px-3 py-2 bg-white border rounded-md hover:bg-gray-50"
        >
          <Move3D className="w-4 h-4" />
          축 범위
        </button>
        
        <button
          onClick={exportChart}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Download className="w-4 h-4" />
          이미지 저장
        </button>
      </div>

      {/* 타입별 데이터 표시 설정 */}
      {Object.keys(typeGroups).length > 1 && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex flex-wrap items-center gap-4 mb-3">
            <h3 className="font-medium">데이터 타입 표시 설정</h3>
            <button
              onClick={toggleAllTypes}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-white border rounded hover:bg-gray-50"
            >
              {Object.values(visibleTypes).every(v => v) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              전체 {Object.values(visibleTypes).every(v => v) ? '숨김' : '표시'}
            </button>
            <button
              onClick={() => setUseVisibleDataRange(!useVisibleDataRange)}
              className={`flex items-center gap-1 px-3 py-1 text-sm border rounded ${
                useVisibleDataRange ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-300'
              }`}
            >
              {useVisibleDataRange ? <ZoomIn className="w-4 h-4" /> : <ZoomOut className="w-4 h-4" />}
              {useVisibleDataRange ? '표시 데이터 범위' : '전체 데이터 범위'}
            </button>
          </div>
          
          {/* 추세선 제어 */}
          <div className="flex flex-wrap items-center gap-4 mb-3">
            <h4 className="font-medium text-sm">추세선 표시 설정</h4>
            <button
              onClick={() => setShowOverallTrend(!showOverallTrend)}
              className={`flex items-center gap-1 px-3 py-1 text-sm border rounded ${
                showOverallTrend ? 'bg-red-100 border-red-300 text-red-700' : 'bg-white border-gray-300'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              전체 추세선
            </button>
            <button
              onClick={toggleAllTypeTrendlines}
              className={`flex items-center gap-1 px-3 py-1 text-sm border rounded ${
                showAllTypeTrends ? 'bg-green-100 border-green-300 text-green-700' : 'bg-white border-gray-300'
              }`}
            >
              <TrendingDown className="w-4 h-4" />
              타입별 추세선 {showAllTypeTrends ? '모두 끄기' : '모두 보기'}
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {Object.keys(typeGroups).map(type => (
              <div key={type} className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={visibleTypes[type] !== false}
                    onChange={() => toggleTypeVisibility(type)}
                    className="rounded"
                  />
                  <div
                    className="w-3 h-3 rounded border"
                    style={{ backgroundColor: fixedColorMap[type] }}
                  />
                </div>
                <span className="text-sm truncate flex-1" title={type}>
                  {type} ({typeGroups[type].length})
                </span>
                <button
                  onClick={() => toggleTypeTrendline(type)}
                  className={`p-1 rounded ${
                    showTypeTrends[type] ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                  }`}
                  title={`${type} 추세선`}
                >
                  <TrendingUp className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 스타일 패널들 */}
      {showStylePanel && (
        <div className="p-4 bg-white border rounded-lg">
          <h3 className="font-medium mb-3">차트 스타일 설정</h3>

          {/* X축 숫자 형식 */}
          <div className="mb-4 pb-4 border-b">
            <h4 className="text-sm font-semibold mb-3 text-blue-700">X축 숫자 형식</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">X축 숫자 형식</label>
                <select
                  value={xNumberFormat}
                  onChange={(e) => setXNumberFormat(e.target.value as any)}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="normal">일반</option>
                  <option value="scientific">과학적 표기법</option>
                  <option value="comma">천 단위 구분</option>
                </select>
              </div>
              {xNumberFormat === 'scientific' && (
                <div>
                  <label className="block text-sm font-medium mb-1">X축 지수 표기</label>
                  <select
                    value={xExponentialFormat}
                    onChange={(e) => setXExponentialFormat(e.target.value as any)}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="standard">표준 (1.23e+4)</option>
                    <option value="superscript">위첨자 (1.23×10⁴)</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Y축 숫자 형식 */}
          <div className="mb-4 pb-4 border-b">
            <h4 className="text-sm font-semibold mb-3 text-green-700">Y축 숫자 형식</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Y축 숫자 형식</label>
                <select
                  value={yNumberFormat}
                  onChange={(e) => setYNumberFormat(e.target.value as any)}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="normal">일반</option>
                  <option value="scientific">과학적 표기법</option>
                  <option value="comma">천 단위 구분</option>
                </select>
              </div>
              {yNumberFormat === 'scientific' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Y축 지수 표기</label>
                  <select
                    value={yExponentialFormat}
                    onChange={(e) => setYExponentialFormat(e.target.value as any)}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="standard">표준 (1.23e+4)</option>
                    <option value="superscript">위첨자 (1.23×10⁴)</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* 기타 스타일 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">폰트</label>
              <select
                value={styleOptions.fontFamily}
                onChange={(e) => setStyleOptions(prev => ({ ...prev, fontFamily: e.target.value as any }))}
                className="w-full p-2 border rounded-md"
              >
                <option value="Arial">Arial</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Georgia">Georgia</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">축 제목 크기</label>
              <input
                type="number"
                value={styleOptions.axisTitleSize}
                onChange={(e) => setStyleOptions(prev => ({ ...prev, axisTitleSize: parseInt(e.target.value) }))}
                className="w-full p-2 border rounded-md"
                min="8"
                max="24"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">축 숫자 크기</label>
              <input
                type="number"
                value={styleOptions.axisNumberSize}
                onChange={(e) => setStyleOptions(prev => ({ ...prev, axisNumberSize: parseInt(e.target.value) }))}
                className="w-full p-2 border rounded-md"
                min="6"
                max="20"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={styleOptions.axisTitleBold}
                onChange={(e) => setStyleOptions(prev => ({ ...prev, axisTitleBold: e.target.checked }))}
                className="mr-2"
              />
              <label className="text-sm font-medium">축 제목 굵게</label>
            </div>
          </div>
        </div>
      )}

      {showPlotPanel && (
        <div className="p-4 bg-white border rounded-lg">
          <h3 className="font-medium mb-3">플롯 스타일 설정</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">마커 크기</label>
              <input
                type="range"
                min="20"
                max="200"
                value={plotOptions.size}
                onChange={(e) => setPlotOptions(prev => ({ ...prev, size: parseInt(e.target.value) }))}
                className="w-full"
              />
              <span className="text-sm text-gray-500">{plotOptions.size}</span>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">마커 모양</label>
              <select
                value={plotOptions.shape}
                onChange={(e) => setPlotOptions(prev => ({ ...prev, shape: e.target.value as any }))}
                className="w-full p-2 border rounded-md"
              >
                <option value="circle">원</option>
                <option value="square">사각형</option>
                <option value="triangle">삼각형</option>
                <option value="diamond">다이아몬드</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">마커 불투명도</label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={plotOptions.opacity}
                onChange={(e) => setPlotOptions(prev => ({ ...prev, opacity: parseFloat(e.target.value) }))}
                className="w-full"
              />
              <span className="text-sm text-gray-500">{plotOptions.opacity}</span>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">테두리 두께</label>
              <input
                type="range"
                min="0"
                max="5"
                value={plotOptions.strokeWidth}
                onChange={(e) => setPlotOptions(prev => ({ ...prev, strokeWidth: parseInt(e.target.value) }))}
                className="w-full"
              />
              <span className="text-sm text-gray-500">{plotOptions.strokeWidth}</span>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">테두리 색상</label>
              <input
                type="color"
                value={plotOptions.strokeColor}
                onChange={(e) => setPlotOptions(prev => ({ ...prev, strokeColor: e.target.value }))}
                className="w-full h-10 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">배경색</label>
              <input
                type="color"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                className="w-full h-10 border rounded-md"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={showGridlines}
                onChange={(e) => setShowGridlines(e.target.checked)}
                className="mr-2"
              />
              <label className="text-sm font-medium">격자 표시</label>
            </div>

            {/* 차트 제목 설정 */}
            <div className="col-span-full border-t pt-4 mt-4">
              <h4 className="font-medium mb-3">차트 제목 설정</h4>
              <div className="flex items-center gap-3 mb-2">
                <input
                  type="checkbox"
                  id="showChartTitle"
                  checked={showChartTitle}
                  onChange={(e) => setShowChartTitle(e.target.checked)}
                  className="mr-1"
                />
                <label htmlFor="showChartTitle" className="text-sm font-medium">제목 표시</label>
              </div>
              {showChartTitle && (
                <input
                  type="text"
                  value={chartTitle}
                  onChange={(e) => setChartTitle(e.target.value)}
                  placeholder="차트 제목을 입력하세요"
                  className="w-full p-2 border rounded-md"
                />
              )}
            </div>

            {/* 사용자 정의 색상 설정 */}
            <div className="col-span-full border-t pt-4 mt-4">
              <h4 className="font-medium mb-3">타입별 색상 설정</h4>
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  id="useCustomColors"
                  checked={plotOptions.useCustomColors}
                  onChange={(e) => setPlotOptions(prev => ({ ...prev, useCustomColors: e.target.checked }))}
                  className="mr-1"
                />
                <label htmlFor="useCustomColors" className="text-sm font-medium">사용자 정의 색상 사용</label>
              </div>
              {plotOptions.useCustomColors && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">타입별로 사용할 색상을 설정하세요 (최대 8개)</p>
                  <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                    {plotOptions.customColors.map((color, index) => (
                      <div key={index} className="flex flex-col items-center">
                        <label className="text-xs text-gray-600 mb-1">색상 {index + 1}</label>
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => {
                            const newColors = [...plotOptions.customColors]
                            newColors[index] = e.target.value
                            setPlotOptions(prev => ({ ...prev, customColors: newColors }))
                          }}
                          className="w-12 h-12 border rounded cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setPlotOptions(prev => ({
                      ...prev,
                      customColors: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#F97316', '#06B6D4', '#84CC16']
                    }))}
                    className="mt-3 px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  >
                    기본값으로 재설정
                  </button>
                </div>
              )}
            </div>

            {/* 추세선 스타일 설정 */}
            <div className="col-span-full border-t pt-4 mt-4">
              <h4 className="font-medium mb-3">추세선 스타일 설정</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">전체 추세선 색상</label>
                  <input
                    type="color"
                    value={trendlineStyle.color}
                    onChange={(e) => setTrendlineStyle(prev => ({ ...prev, color: e.target.value }))}
                    className="w-full h-10 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">전체 추세선 두께</label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={trendlineStyle.strokeWidth}
                    onChange={(e) => setTrendlineStyle(prev => ({ ...prev, strokeWidth: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                  <span className="text-sm text-gray-500">{trendlineStyle.strokeWidth}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">전체 추세선 불투명도</label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={trendlineStyle.opacity}
                    onChange={(e) => setTrendlineStyle(prev => ({ ...prev, opacity: parseFloat(e.target.value) }))}
                    className="w-full"
                  />
                  <span className="text-sm text-gray-500">{trendlineStyle.opacity}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAxisPanel && (
        <div className="p-4 bg-white border rounded-lg">
          <h3 className="font-medium mb-3">축 범위 설정</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">X축 최솟값</label>
              <input
                type="number"
                value={axisRange.xMin === 'auto' ? '' : axisRange.xMin}
                onChange={(e) => setAxisRange(prev => ({ ...prev, xMin: e.target.value === '' ? 'auto' : parseFloat(e.target.value) }))}
                placeholder="자동"
                className="w-full p-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">X축 최댓값</label>
              <input
                type="number"
                value={axisRange.xMax === 'auto' ? '' : axisRange.xMax}
                onChange={(e) => setAxisRange(prev => ({ ...prev, xMax: e.target.value === '' ? 'auto' : parseFloat(e.target.value) }))}
                placeholder="자동"
                className="w-full p-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Y축 최솟값</label>
              <input
                type="number"
                value={axisRange.yMin === 'auto' ? '' : axisRange.yMin}
                onChange={(e) => setAxisRange(prev => ({ ...prev, yMin: e.target.value === '' ? 'auto' : parseFloat(e.target.value) }))}
                placeholder="자동"
                className="w-full p-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Y축 최댓값</label>
              <input
                type="number"
                value={axisRange.yMax === 'auto' ? '' : axisRange.yMax}
                onChange={(e) => setAxisRange(prev => ({ ...prev, yMax: e.target.value === '' ? 'auto' : parseFloat(e.target.value) }))}
                placeholder="자동"
                className="w-full p-2 border rounded-md"
              />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t">
            <h4 className="font-medium mb-3">축 스케일 설정</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="xLogScale"
                  checked={xLogScale}
                  onChange={(e) => setXLogScale(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="xLogScale" className="text-sm font-medium">X축 로그 스케일</label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="yLogScale"
                  checked={yLogScale}
                  onChange={(e) => setYLogScale(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="yLogScale" className="text-sm font-medium">Y축 로그 스케일</label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="maintain1to1"
                  checked={maintain1to1Ratio}
                  onChange={(e) => setMaintain1to1Ratio(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="maintain1to1" className="text-sm font-medium">1:1 비율 유지</label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="show1to1Line"
                  checked={show1to1Line}
                  onChange={(e) => setShow1to1Line(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="show1to1Line" className="text-sm font-medium">1:1 참조선 표시</label>
              </div>
            </div>
            {(xLogScale || yLogScale) && (
              <p className="text-xs text-amber-600 mt-2">
                ⚠️ 로그 스케일은 양수 값에만 적용됩니다. 0 이하의 값은 표시되지 않습니다.
              </p>
            )}
            {maintain1to1Ratio && (
              <p className="text-xs text-blue-600 mt-2">
                ℹ️ 1:1 비율이 적용되어 정사각형 플롯이 생성됩니다.
              </p>
            )}
            {show1to1Line && (
              <p className="text-xs text-green-600 mt-2">
                ✓ 1:1 참조선이 표시됩니다 (대각선: y=x).
              </p>
            )}
          </div>

          <div className="mt-4 pt-4 border-t">
            <h4 className="font-medium mb-3">눈금 간격 설정</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">X축 눈금 간격</label>
                <input
                  type="number"
                  value={xTickInterval === 'auto' ? '' : xTickInterval}
                  onChange={(e) => setXTickInterval(e.target.value === '' ? 'auto' : parseFloat(e.target.value))}
                  placeholder="자동"
                  step="any"
                  className="w-full p-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Y축 눈금 간격</label>
                <input
                  type="number"
                  value={yTickInterval === 'auto' ? '' : yTickInterval}
                  onChange={(e) => setYTickInterval(e.target.value === '' ? 'auto' : parseFloat(e.target.value))}
                  placeholder="자동"
                  step="any"
                  className="w-full p-2 border rounded-md"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              💡 눈금 간격을 비워두면 자동으로 설정됩니다.
            </p>
          </div>
        </div>
      )}

      {/* 차트 */}
      <div ref={chartRef} className="w-full p-4" style={{
        backgroundColor: backgroundColor,
        aspectRatio: maintain1to1Ratio ? '1 / 1' : 'auto',
        height: maintain1to1Ratio ? 'auto' : '24rem'
      }}>
        {showChartTitle && chartTitle && (
          <div className="text-center mb-2">
            <h3 className="text-lg font-semibold" style={{ fontFamily: styleOptions.fontFamily }}>
              {chartTitle}
            </h3>
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 30, bottom: 60, left: 60 }}>
            {showGridlines && <CartesianGrid strokeDasharray="3 3" />}

            <XAxis
              type="number"
              dataKey="x"
              scale={xLogScale ? 'log' : 'linear'}
              domain={getLogSafeDomain(
                axisRange.xMin === 'auto' ? adjusted1to1Range.xMin : axisRange.xMin,
                axisRange.xMax === 'auto' ? adjusted1to1Range.xMax : axisRange.xMax,
                xLogScale
              )}
              ticks={xTicks}
              tickFormatter={formatXAxisLabel}
              tick={{
                fontSize: styleOptions.axisNumberSize,
                fontFamily: styleOptions.fontFamily
              }}
              label={{
                value: getAxisTitle(selectedColumns.x!),
                position: 'insideBottom',
                offset: -40,
                style: {
                  textAnchor: 'middle',
                  fontSize: styleOptions.axisTitleSize,
                  fontFamily: styleOptions.fontFamily,
                  fontWeight: styleOptions.axisTitleBold ? 'bold' : 'normal'
                }
              }}
              allowDataOverflow={xLogScale}
            />

            <YAxis
              type="number"
              dataKey="y"
              scale={yLogScale ? 'log' : 'linear'}
              domain={getLogSafeDomain(
                axisRange.yMin === 'auto' ? adjusted1to1Range.yMin : axisRange.yMin,
                axisRange.yMax === 'auto' ? adjusted1to1Range.yMax : axisRange.yMax,
                yLogScale
              )}
              ticks={yTicks}
              tickFormatter={formatYAxisLabel}
              tick={{
                fontSize: styleOptions.axisNumberSize,
                fontFamily: styleOptions.fontFamily
              }}
              label={{
                value: getAxisTitle(selectedColumns.y!),
                angle: -90,
                position: 'insideLeft',
                style: {
                  textAnchor: 'middle',
                  fontSize: styleOptions.axisTitleSize,
                  fontFamily: styleOptions.fontFamily,
                  fontWeight: styleOptions.axisTitleBold ? 'bold' : 'normal'
                }
              }}
              allowDataOverflow={yLogScale}
            />
            
            <Tooltip
              formatter={(value: any, name: string) => {
                // name이 'x'이면 X축 포맷, 'y'이면 Y축 포맷 사용
                const formattedValue = name === 'x' ? formatXAxisLabel(value) : formatYAxisLabel(value)
                return [formattedValue, name]
              }}
              labelFormatter={() => ''}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '12px'
              }}
            />

            {/* 데이터 포인트 렌더링 */}
            {Object.keys(typeGroups).map(type => {
              if (visibleTypes[type] === false) return null
              
              return (
                <Scatter
                  key={type}
                  name={type}
                  data={typeGroups[type]}
                  fill={fixedColorMap[type]}
                  shape={(props: any) => (
                    <CustomMarker
                      {...props}
                      shape={plotOptions.shape}
                      size={plotOptions.size}
                      opacity={plotOptions.opacity}
                      strokeWidth={plotOptions.strokeWidth}
                      strokeColor={plotOptions.strokeColor}
                    />
                  )}
                />
              )
            })}

            {/* 1:1 참조선 */}
            {show1to1Line && oneToOneLineSegment && (
              <ReferenceLine
                segment={oneToOneLineSegment}
                stroke="#000000"
                strokeWidth={1.5}
                strokeOpacity={0.6}
                strokeDasharray="10 5"
                label={{
                  value: '1:1',
                  position: 'insideTopRight',
                  fill: '#000000',
                  fontSize: 12
                }}
              />
            )}

            {/* 전체 추세선 */}
            {showOverallTrend && overallTrendSegment && (
              <ReferenceLine
                segment={overallTrendSegment}
                stroke={trendlineStyle.color}
                strokeWidth={trendlineStyle.strokeWidth}
                strokeOpacity={trendlineStyle.opacity}
                strokeDasharray="0"
              />
            )}

            {/* 타입별 추세선들 */}
            {typeRegressionSegments.map(({ type, segment, color }) => (
              <ReferenceLine
                key={`trend-${type}`}
                segment={segment}
                stroke={color}
                strokeWidth={2}
                strokeOpacity={0.8}
                strokeDasharray="5 5"
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
