'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'
import { GeochemData, StatisticalResult, ColumnSelection, ChartStyleOptions, AxisRange, PlotStyleOptions } from '@/types/geochem'
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
  
  // PlotStyleOptions에서 허용되는 속성만 사용
  const [plotOptions, setPlotOptions] = useState<PlotStyleOptions>({
    size: 60,
    shape: 'circle',
    opacity: 0.7,
    strokeWidth: 1,
    strokeColor: '#000000',
    useCustomColors: false,
    customColors: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#F97316', '#06B6D4', '#84CC16']
  })

  // 별도 상태로 완전 분리
  const [showGridlines, setShowGridlines] = useState(true)
  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF')

  // 타입별 체크박스 상태
  const [visibleTypes, setVisibleTypes] = useState<Record<string, boolean>>({})
  
  // 축 범위 설정
  const [useVisibleDataRange, setUseVisibleDataRange] = useState(false)
  
  // 추세선 표시 설정
  const [showOverallTrend, setShowOverallTrend] = useState(true)
  const [showTypeTrends, setShowTypeTrends] = useState<Record<string, boolean>>({})
  const [showAllTypeTrends, setShowAllTypeTrends] = useState(false)
  
  // 추세선 스타일 설정
  const [trendlineStyle, setTrendlineStyle] = useState({
    color: '#FF0000',
    strokeWidth: 2,
    opacity: 0.8
  })

  const [axisRange, setAxisRange] = useState<AxisRange>({
    xMin: 'auto', xMax: 'auto',
    yMin: 'auto', yMax: 'auto'
  })
  const [showStylePanel, setShowStylePanel] = useState(false)
  const [showPlotPanel, setShowPlotPanel] = useState(false)
  const [showAxisPanel, setShowAxisPanel] = useState(false)

  // 디버깅 로그 추가
  console.log('ScatterPlot 렌더링:', {
    isPCAMode,
    clusterDataLength: clusterData.length,
    dataLength: data.data.length,
    selectedColumns: selectedColumns,
    typeStatisticsLength: typeStatistics.length,
    statistics: statistics,
    typeStatistics: typeStatistics
  })

  // 축 데이터 계산 함수
  const calculateAxisData = (axisConfig: NonNullable<ColumnSelection['x']>) => {
    if (axisConfig.type === 'single') {
      return data.data
        .map(row => parseFloat(row[axisConfig.numerator]))
        .filter(val => !isNaN(val) && isFinite(val))
    } else {
      return data.data
        .map(row => {
          const numerator = parseFloat(row[axisConfig.numerator])
          const denominator = parseFloat(row[axisConfig.denominator!])
          return numerator / denominator
        })
        .filter(val => !isNaN(val) && isFinite(val))
    }
  }

  // 차트 데이터 준비
  const chartData = useMemo(() => {
    if (!selectedColumns.x || !selectedColumns.y) return []

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

      let type = 'Unknown'
      if (isPCAMode && clusterData.length > index) {
        type = `Cluster ${clusterData[index]}`
      } else if (selectedColumns.type && row[selectedColumns.type]) {
        type = row[selectedColumns.type]
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
    
    // 고정된 색상 맵 생성
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

  // 전체 데이터 범위 계산 (모든 데이터 기준)
  const fullDataRange = useMemo(() => {
    if (chartData.length === 0) return { xMin: 0, xMax: 100, yMin: 0, yMax: 100 }
    
    const xValues = chartData.map(d => d.x)
    const yValues = chartData.map(d => d.y)
    
    const xMin = Math.min(...xValues)
    const xMax = Math.max(...xValues)
    const yMin = Math.min(...yValues)
    const yMax = Math.max(...yValues)
    
    // 여백 추가 (5%)
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

  // 표시되는 데이터 범위 계산 (체크박스 기준)
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

  // 실제 사용할 범위 결정
  const currentRange = useVisibleDataRange ? visibleDataRange : fullDataRange

  // 초기 체크박스 상태 설정
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

  // 체크박스 토글 함수
  const toggleTypeVisibility = (type: string) => {
    setVisibleTypes(prev => ({
      ...prev,
      [type]: !prev[type]
    }))
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

  // 추세선 토글 함수들
  const toggleTypeTrendline = (type: string) => {
    setShowTypeTrends(prev => ({
      ...prev,
      [type]: !prev[type]
    }))
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

  // 추세선 데이터 생성 함수
  const generateTrendlinePoints = (slope: number, intercept: number, range: { xMin: number, xMax: number }) => {
    if (!isFinite(slope) || !isFinite(intercept)) return []
    
    const points = []
    const step = (range.xMax - range.xMin) / 100
    
    for (let x = range.xMin; x <= range.xMax; x += step) {
      const y = slope * x + intercept
      points.push({ x, y })
    }
    
    return points
  }

  // 표시할 데이터 필터링
  const visibleData = chartData.filter(item => visibleTypes[item.type] !== false)

  const formatAxisLabel = (value: any) => {
    if (typeof value !== 'number' || !isFinite(value)) return ''
    
    switch (styleOptions.numberFormat) {
      case 'scientific':
        return value.toExponential(2)
      case 'engineering':
        const exp = Math.floor(Math.log10(Math.abs(value)) / 3) * 3
        const mantissa = value / Math.pow(10, exp)
        return `${mantissa.toFixed(2)}e${exp}`
      default:
        return value.toFixed(3)
    }
  }

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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">숫자 형식</label>
              <select
                value={styleOptions.numberFormat}
                onChange={(e) => setStyleOptions(prev => ({ ...prev, numberFormat: e.target.value as any }))}
                className="w-full p-2 border rounded-md"
              >
                <option value="normal">일반</option>
                <option value="scientific">과학적 표기법</option>
                <option value="engineering">공학적 표기법</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">폰트</label>
              <select
                value={styleOptions.fontFamily}
                onChange={(e) => setStyleOptions(prev => ({ ...prev, fontFamily: e.target.value }))}
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
        </div>
      )}

      {/* 차트 */}
      <div ref={chartRef} className="w-full h-96 p-4" style={{ backgroundColor: backgroundColor }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 30, bottom: 60, left: 60 }}>
            {showGridlines && <CartesianGrid strokeDasharray="3 3" />}
            
            <XAxis
              type="number"
              dataKey="x"
              domain={[
                axisRange.xMin === 'auto' ? currentRange.xMin : axisRange.xMin,
                axisRange.xMax === 'auto' ? currentRange.xMax : axisRange.xMax
              ]}
              tickFormatter={formatAxisLabel}
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
            />
            
            <YAxis
              type="number"
              dataKey="y"
              domain={[
                axisRange.yMin === 'auto' ? currentRange.yMin : axisRange.yMin,
                axisRange.yMax === 'auto' ? currentRange.yMax : axisRange.yMax
              ]}
              tickFormatter={formatAxisLabel}
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
            />
            
            <Tooltip
              formatter={(value: any, name: string) => [formatAxisLabel(value), name]}
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

            {/* 전체 추세선 */}
            {showOverallTrend && statistics.slope !== undefined && statistics.intercept !== undefined && 
             isFinite(statistics.slope) && isFinite(statistics.intercept) && (
              <ReferenceLine
                segment={generateTrendlinePoints(statistics.slope, statistics.intercept, currentRange)}
                stroke={trendlineStyle.color}
                strokeWidth={trendlineStyle.strokeWidth}
                strokeOpacity={trendlineStyle.opacity}
                strokeDasharray="0"
              />
            )}

            {/* 타입별 추세선 */}
            {typeStatistics.map(typeStat => {
              if (!showTypeTrends[typeStat.type] || visibleTypes[typeStat.type] === false) return null
              if (typeStat.slope === undefined || typeStat.intercept === undefined) return null
              if (!isFinite(typeStat.slope) || !isFinite(typeStat.intercept)) return null
              
              console.log(`Rendering trendline for ${typeStat.type}:`, {
                slope: typeStat.slope,
                intercept: typeStat.intercept,
                color: fixedColorMap[typeStat.type]
              })
              
              return (
                <ReferenceLine
                  key={`trend-${typeStat.type}`}
                  segment={generateTrendlinePoints(typeStat.slope, typeStat.intercept, currentRange)}
                  stroke={fixedColorMap[typeStat.type]}
                  strokeWidth={2}
                  strokeOpacity={0.8}
                  strokeDasharray="5 5"
                />
              )
            })}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
