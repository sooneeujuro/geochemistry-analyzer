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
    rSquared?: number
    linearSlope?: number
    linearIntercept?: number
    pValue?: number
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

export default function ScatterPlot({ 
  data, 
  selectedColumns, 
  statistics, 
  isPCAMode = false, 
  clusterData = [], 
  typeStatistics = [] 
}: ScatterPlotProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  
  const [styleOptions, setStyleOptions] = useState<ChartStyleOptions>({
    numberFormat: 'normal',
    fontFamily: 'Arial',
    axisTitleBold: true,
    axisNumberSize: 12,
    axisTitleSize: 14
  })
  const [plotOptions, setPlotOptions] = useState<PlotStyleOptions>({
    size: 60,
    shape: 'circle',
    opacity: 0.7,
    strokeWidth: 1,
    strokeColor: '#000000',
    useCustomColors: false,
    customColors: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#F97316', '#06B6D4', '#84CC16']
  })
  const [showStylePanel, setShowStylePanel] = useState(false)
  const [showAxisPanel, setShowAxisPanel] = useState(false)
  const [showPlotPanel, setShowPlotPanel] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showTypePanel, setShowTypePanel] = useState(false)
  const [exportFormat, setExportFormat] = useState<'png' | 'svg'>('png')
  const [customFileName, setCustomFileName] = useState('')
  
  // 상태 관리
  const [visibleTypes, setVisibleTypes] = useState<{ [key: string]: boolean }>({})
  const [useVisibleDataRange, setUseVisibleDataRange] = useState(false)
  const [showOverallRegression, setShowOverallRegression] = useState(true)
  const [showTypeRegressions, setShowTypeRegressions] = useState(true)
  
  // 수정: 플롯 스타일로 이동된 전체 추세선 스타일 옵션
  const [overallRegressionStyle, setOverallRegressionStyle] = useState({
    color: '#EF4444',
    strokeWidth: 2,
    opacity: 0.8
  })
  
  // 전체 데이터 기반 고정 축 범위
  const [fullDataAxisRange, setFullDataAxisRange] = useState<{
    x: { min: number, max: number },
    y: { min: number, max: number }
  }>({ x: { min: 0, max: 1 }, y: { min: 0, max: 1 } })
  
  // 축 범위 초기화 완료 여부
  const [axisRangeInitialized, setAxisRangeInitialized] = useState(false)
  
  // PCA 전용 클러스터 색상
  const pcaClusterColors = [
    '#E53E3E', '#3182CE', '#38A169', '#D69E2E', '#805AD5', '#DD6B20', '#319795', '#E53E3E'
  ]
  
  // 축 범위 상태
  const [xAxisRange, setXAxisRange] = useState<AxisRange>({ auto: true, min: 0, max: 100 })
  const [yAxisRange, setYAxisRange] = useState<AxisRange>({ auto: true, min: 0, max: 100 })

  const chartData = useMemo(() => {
    if (!selectedColumns.x || !selectedColumns.y) return []

    return data.data
      .map((row, index) => {
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

        return {
          x: xValue,
          y: yValue,
          type: isPCAMode && clusterData.length > index
            ? clusterData[index] === -1 
              ? 'Invalid Data'
              : `Cluster ${clusterData[index] + 1}`
            : selectedColumns.useTypeColumn && selectedColumns.selectedTypeColumn 
              ? row[selectedColumns.selectedTypeColumn] 
              : 'default',
          index
        }
      })
      .filter(point => !isNaN(point.x) && !isNaN(point.y) && isFinite(point.x) && isFinite(point.y))
  }, [data, selectedColumns, isPCAMode, clusterData])

  // 고정 색상 매핑 (전체 데이터 기준)
  const fixedTypeColors = useMemo(() => {
    const colorMap: { [key: string]: string } = {}
    
    if (isPCAMode) {
      const types = Array.from(new Set(chartData.map(d => d.type))).sort()
      types.forEach((type, index) => {
        if (type === 'Invalid Data') {
          colorMap[type] = '#9CA3AF'
        } else {
          const clusterIndex = parseInt(type.replace('Cluster ', '')) - 1
          colorMap[type] = pcaClusterColors[clusterIndex % pcaClusterColors.length]
        }
      })
    } else {
      const types = Array.from(new Set(data.data.map(row => {
        const type = selectedColumns.useTypeColumn && selectedColumns.selectedTypeColumn 
          ? row[selectedColumns.selectedTypeColumn] 
          : 'default'
        return type
      }))).sort()
      
      types.forEach((type, index) => {
        if (plotOptions.useCustomColors) {
          colorMap[type] = plotOptions.customColors[index % plotOptions.customColors.length]
        } else {
          const defaultColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0']
          colorMap[type] = defaultColors[index % defaultColors.length]
        }
      })
    }
    
    return colorMap
  }, [data, selectedColumns.useTypeColumn, selectedColumns.selectedTypeColumn, plotOptions.useCustomColors, plotOptions.customColors, isPCAMode, chartData])

  // visibleTypes 초기화
  useEffect(() => {
    const types = Array.from(new Set(chartData.map(d => d.type)))
    const initialVisibility: { [key: string]: boolean } = {}
    types.forEach(type => {
      initialVisibility[type] = true
    })
    setVisibleTypes(prev => {
      const newVisibility = { ...initialVisibility }
      Object.keys(prev).forEach(type => {
        if (types.includes(type)) {
          newVisibility[type] = prev[type]
        }
      })
      return newVisibility
    })
  }, [chartData])

  // 전체 데이터 기반 축 범위 계산 (한 번만 실행)
  useEffect(() => {
    if (chartData.length > 0 && !axisRangeInitialized) {
      const xValues = chartData.map(d => d.x)
      const yValues = chartData.map(d => d.y)
      
      const xMin = Math.min(...xValues)
      const xMax = Math.max(...xValues)
      const yMin = Math.min(...yValues)
      const yMax = Math.max(...yValues)
      
      const xPadding = (xMax - xMin) * 0.1
      const yPadding = (yMax - yMin) * 0.1
      
      const newFullRange = {
        x: { 
          min: Number((xMin - xPadding).toFixed(3)), 
          max: Number((xMax + xPadding).toFixed(3)) 
        },
        y: { 
          min: Number((yMin - yPadding).toFixed(3)), 
          max: Number((yMax + yPadding).toFixed(3)) 
        }
      }
      
      setFullDataAxisRange(newFullRange)
      
      // 초기 축 범위 설정 (전체 데이터 기준)
      setXAxisRange({
        auto: true,
        min: newFullRange.x.min,
        max: newFullRange.x.max
      })
      setYAxisRange({
        auto: true,
        min: newFullRange.y.min,
        max: newFullRange.y.max
      })
      
      setAxisRangeInitialized(true)
      console.log('축 범위 초기화 완료:', newFullRange)
    }
  }, [chartData, axisRangeInitialized])

  // 표시 데이터 범위로 확대/축소 함수
  const adjustToVisibleDataRange = () => {
    const visibleData = chartData.filter(point => visibleTypes[point.type])
    
    if (visibleData.length === 0) return
    
    const xValues = visibleData.map(d => d.x)
    const yValues = visibleData.map(d => d.y)
    
    const xMin = Math.min(...xValues)
    const xMax = Math.max(...xValues)
    const yMin = Math.min(...yValues)
    const yMax = Math.max(...yValues)
    
    const xPadding = (xMax - xMin) * 0.1
    const yPadding = (yMax - yMin) * 0.1
    
    setXAxisRange({
      auto: false,
      min: Number((xMin - xPadding).toFixed(3)),
      max: Number((xMax + xPadding).toFixed(3))
    })
    setYAxisRange({
      auto: false,
      min: Number((yMin - yPadding).toFixed(3)),
      max: Number((yMax + yPadding).toFixed(3))
    })
    
    setUseVisibleDataRange(true)
    console.log('표시 데이터 범위로 확대 완료')
  }

  // 전체 데이터 범위로 복원 함수
  const resetToFullDataRange = () => {
    setXAxisRange({
      auto: true,
      min: fullDataAxisRange.x.min,
      max: fullDataAxisRange.x.max
    })
    setYAxisRange({
      auto: true,
      min: fullDataAxisRange.y.min,
      max: fullDataAxisRange.y.max
    })
    setUseVisibleDataRange(false)
    console.log('전체 데이터 범위로 복원 완료')
  }

  // 회귀선 계산에 사용할 X 범위
  const regressionXRange = useMemo(() => {
    if (useVisibleDataRange) {
      return { min: xAxisRange.min, max: xAxisRange.max }
    } else {
      return { min: fullDataAxisRange.x.min, max: fullDataAxisRange.x.max }
    }
  }, [useVisibleDataRange, xAxisRange, fullDataAxisRange])

  // 수정: 전체 회귀선 계산 (더 엄격한 검증)
  const regressionLine = useMemo(() => {
    console.log('전체 회귀선 계산 시작:', {
      hasSlope: !!statistics.linearSlope,
      hasIntercept: !!statistics.linearIntercept,
      slope: statistics.linearSlope,
      intercept: statistics.linearIntercept,
      slopeIsNumber: typeof statistics.linearSlope === 'number',
      interceptIsNumber: typeof statistics.linearIntercept === 'number',
      slopeIsFinite: statistics.linearSlope ? isFinite(statistics.linearSlope) : false,
      interceptIsFinite: statistics.linearIntercept ? isFinite(statistics.linearIntercept) : false
    })

    if (!statistics.linearSlope || 
        !statistics.linearIntercept || 
        typeof statistics.linearSlope !== 'number' || 
        typeof statistics.linearIntercept !== 'number' ||
        !isFinite(statistics.linearSlope) || 
        !isFinite(statistics.linearIntercept)) {
      console.log('전체 회귀선 계산 실패: 유효하지 않은 slope 또는 intercept')
      return null
    }
    
    const xMin = regressionXRange.min
    const xMax = regressionXRange.max
    
    const line = [
      { x: xMin, y: statistics.linearSlope * xMin + statistics.linearIntercept },
      { x: xMax, y: statistics.linearSlope * xMax + statistics.linearIntercept }
    ]
    
    console.log('전체 회귀선 계산 성공:', { 
      slope: statistics.linearSlope, 
      intercept: statistics.linearIntercept,
      xRange: regressionXRange,
      line 
    })
    
    return line
  }, [statistics, regressionXRange])

  // 수정: 타입별 회귀선 계산 (더 엄격한 검증과 디버깅)
  const typeRegressionLines = useMemo(() => {
    console.log('=== 타입별 회귀선 계산 시작 ===')
    console.log('입력 데이터:', {
      typeStatisticsLength: typeStatistics.length,
      visibleTypesCount: Object.keys(visibleTypes).filter(t => visibleTypes[t]).length,
      allVisibleTypes: Object.keys(visibleTypes).filter(t => visibleTypes[t]),
      regressionXRange
    })

    if (!typeStatistics || typeStatistics.length === 0) {
      console.log('타입별 통계 데이터가 없음')
      return []
    }
    
    const xMin = regressionXRange.min
    const xMax = regressionXRange.max
    
    // 모든 타입별 통계를 하나씩 검사
    const validRegressions: Array<{
      type: string;
      line: Array<{ x: number; y: number }>;
      color: string;
    }> = []

    typeStatistics.forEach((stat, index) => {
      console.log(`\n--- 타입 ${stat.type} (${index + 1}/${typeStatistics.length}) 검사 ---`)
      
      // 1. 기본 값들 검사
      const hasValidSlope = stat.linearSlope !== undefined && 
                          stat.linearSlope !== null &&
                          typeof stat.linearSlope === 'number' && 
                          !isNaN(stat.linearSlope) && 
                          isFinite(stat.linearSlope)
      
      const hasValidIntercept = stat.linearIntercept !== undefined && 
                              stat.linearIntercept !== null &&
                              typeof stat.linearIntercept === 'number' && 
                              !isNaN(stat.linearIntercept) && 
                              isFinite(stat.linearIntercept)
      
      const isTypeVisible = visibleTypes[stat.type] === true
      
      console.log('검사 결과:', {
        type: stat.type,
        slope: stat.linearSlope,
        intercept: stat.linearIntercept,
        hasValidSlope,
        hasValidIntercept,
        isTypeVisible,
        slopeType: typeof stat.linearSlope,
        interceptType: typeof stat.linearIntercept
      })
      
      // 2. 모든 조건을 만족하는지 확인
      if (hasValidSlope && hasValidIntercept && isTypeVisible) {
        const line = [
          { x: xMin, y: stat.linearSlope! * xMin + stat.linearIntercept! },
          { x: xMax, y: stat.linearSlope! * xMax + stat.linearIntercept! }
        ]
        
        const color = fixedTypeColors[stat.type] || '#8884d8'
        
        const regression = {
          type: stat.type,
          line,
          color
        }
        
        validRegressions.push(regression)
        console.log(`✅ 타입 ${stat.type} 회귀선 생성 성공:`, regression)
      } else {
        console.log(`❌ 타입 ${stat.type} 회귀선 생성 실패`)
      }
    })
    
    console.log('=== 타입별 회귀선 계산 완료 ===')
    console.log('최종 결과:', {
      totalValidRegressions: validRegressions.length,
      validTypes: validRegressions.map(r => r.type)
    })
    
    return validRegressions
  }, [typeStatistics, regressionXRange, visibleTypes, fixedTypeColors])

  const typeGroups = useMemo(() => {
    if (!selectedColumns.useTypeColumn || !selectedColumns.selectedTypeColumn) {
      return [{ type: 'default', data: chartData, color: fixedTypeColors['default'] || plotOptions.customColors[0] }]
    }
    
    const groups = new Map<string, typeof chartData>()
    chartData.forEach(point => {
      const type = point.type
      if (!groups.has(type)) {
        groups.set(type, [])
      }
      groups.get(type)!.push(point)
    })
    
    return Array.from(groups.entries())
      .filter(([type]) => visibleTypes[type])
      .map(([type, data]) => ({
        type,
        data,
        color: fixedTypeColors[type] || '#8884d8'
      }))
  }, [chartData, selectedColumns.useTypeColumn, selectedColumns.selectedTypeColumn, visibleTypes, fixedTypeColors])

  // 타입 표시/숨김 토글 함수
  const toggleType = (type: string) => {
    setVisibleTypes(prev => ({
      ...prev,
      [type]: !prev[type]
    }))
  }

  // 모든 타입 표시/숨김 토글
  const toggleAllTypes = () => {
    const allVisible = Object.values(visibleTypes).every(v => v)
    const newState: { [key: string]: boolean } = {}
    Object.keys(visibleTypes).forEach(type => {
      newState[type] = !allVisible
    })
    setVisibleTypes(newState)
  }

  // 숫자 포맷팅 함수
  const formatNumber = (value: number): string => {
    switch (styleOptions.numberFormat) {
      case 'scientific':
        return value.toExponential(2)
      case 'comma':
        return value.toLocaleString()
      default:
        return value.toString()
    }
  }

  // 기본 파일명 생성
  const generateDefaultFileName = (): string => {
    const originalFileName = data.fileName.replace(/\.[^/.]+$/, "")
    const xLabel = selectedColumns.x?.label || 'X'
    const yLabel = selectedColumns.y?.label || 'Y'
    return `${originalFileName}_${xLabel} vs ${yLabel}`
  }

  // 그래프 내보내기 함수
  const exportChart = async (format: 'png' | 'svg', fileName?: string) => {
    if (!chartRef.current) return

    const finalFileName = fileName || generateDefaultFileName()

    try {
      if (format === 'png') {
        const html2canvas = (await import('html2canvas' as any)).default
        
        const chartContainer = chartRef.current.querySelector('#chart-container') as HTMLElement
        
        if (chartContainer) {
          const canvas = await html2canvas(chartContainer, {
            backgroundColor: 'white',
            scale: 2,
            useCORS: true,
            width: 600,
            height: 600,
            x: 0,
            y: 0,
            scrollX: 0,
            scrollY: 0,
            ignoreElements: (element: HTMLElement) => {
              return element.classList?.contains('recharts-tooltip-wrapper') || false
            }
          })
          
          const ctx = canvas.getContext('2d')!
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const data = imageData.data
          
          let top = 0, bottom = canvas.height, left = 0, right = canvas.width
          
          for (let y = 0; y < canvas.height; y++) {
            let hasContent = false
            for (let x = 0; x < canvas.width; x++) {
              const idx = (y * canvas.width + x) * 4
              if (data[idx] !== 255 || data[idx + 1] !== 255 || data[idx + 2] !== 255 || data[idx + 3] !== 255) {
                hasContent = true
                break
              }
            }
            if (hasContent) {
              top = Math.max(0, y - 10)
              break
            }
          }
          
          for (let y = canvas.height - 1; y >= top; y--) {
            let hasContent = false
            for (let x = 0; x < canvas.width; x++) {
              const idx = (y * canvas.width + x) * 4
              if (data[idx] !== 255 || data[idx + 1] !== 255 || data[idx + 2] !== 255 || data[idx + 3] !== 255) {
                hasContent = true
                break
              }
            }
            if (hasContent) {
              bottom = Math.min(canvas.height, y + 10)
              break
            }
          }
          
          for (let x = 0; x < canvas.width; x++) {
            let hasContent = false
            for (let y = top; y < bottom; y++) {
              const idx = (y * canvas.width + x) * 4
              if (data[idx] !== 255 || data[idx + 1] !== 255 || data[idx + 2] !== 255 || data[idx + 3] !== 255) {
                hasContent = true
                break
              }
            }
            if (hasContent) {
              left = Math.max(0, x - 10)
              break
            }
          }
          
          for (let x = canvas.width - 1; x >= left; x--) {
            let hasContent = false
            for (let y = top; y < bottom; y++) {
              const idx = (y * canvas.width + x) * 4
              if (data[idx] !== 255 || data[idx + 1] !== 255 || data[idx + 2] !== 255 || data[idx + 3] !== 255) {
                hasContent = true
                break
              }
            }
            if (hasContent) {
              right = Math.min(canvas.width, x + 10)
              break
            }
          }
          
          const cropWidth = right - left
          const cropHeight = bottom - top
          
          const croppedCanvas = document.createElement('canvas')
          const croppedCtx = croppedCanvas.getContext('2d')!
          
          const maxSize = Math.max(cropWidth, cropHeight)
          croppedCanvas.width = maxSize
          croppedCanvas.height = maxSize
          
          croppedCtx.fillStyle = 'white'
          croppedCtx.fillRect(0, 0, maxSize, maxSize)
          
          const offsetX = (maxSize - cropWidth) / 2
          const offsetY = (maxSize - cropHeight) / 2
          
          croppedCtx.drawImage(
            canvas,
            left, top, cropWidth, cropHeight,
            offsetX, offsetY, cropWidth, cropHeight
          )
          
          const link = document.createElement('a')
          link.download = `${finalFileName}.png`
          link.href = croppedCanvas.toDataURL('image/png')
          link.click()
        } else {
          const canvas = await html2canvas(chartRef.current, {
            backgroundColor: 'white',
            scale: 2,
            useCORS: true
          })
          
          const link = document.createElement('a')
          link.download = `${finalFileName}.png`
          link.href = canvas.toDataURL('image/png')
          link.click()
        }
      } else {
        const svgElement = chartRef.current.querySelector('svg')
        if (svgElement) {
          const clonedSVG = svgElement.cloneNode(true) as SVGElement
          
          const bbox = svgElement.getBBox()
          const padding = 20
          
          const viewBoxX = Math.max(0, bbox.x - padding)
          const viewBoxY = Math.max(0, bbox.y - padding)
          const viewBoxWidth = bbox.width + (padding * 2)
          const viewBoxHeight = bbox.height + (padding * 2)
          
          const maxDimension = Math.max(viewBoxWidth, viewBoxHeight)
          const centerX = viewBoxX + viewBoxWidth / 2
          const centerY = viewBoxY + viewBoxHeight / 2
          
          const finalViewBoxX = centerX - maxDimension / 2
          const finalViewBoxY = centerY - maxDimension / 2
          
          clonedSVG.setAttribute('width', '500')
          clonedSVG.setAttribute('height', '500')
          clonedSVG.setAttribute('viewBox', `${finalViewBoxX} ${finalViewBoxY} ${maxDimension} ${maxDimension}`)
          
          const svgData = new XMLSerializer().serializeToString(clonedSVG)
          const svgBlob = new Blob([svgData], { type: 'image/svg+xml' })
          const svgUrl = URL.createObjectURL(svgBlob)
          
          const link = document.createElement('a')
          link.download = `${finalFileName}.svg`
          link.href = svgUrl
          link.click()
          
          URL.revokeObjectURL(svgUrl)
        }
      }
    } catch (error) {
      console.error('Export failed:', error)
      alert('내보내기에 실패했습니다.')
    }
  }

  // 내보내기 대화상자 열기
  const openExportDialog = (format: 'png' | 'svg') => {
    setExportFormat(format)
    setCustomFileName(generateDefaultFileName())
    setShowExportDialog(true)
  }

  // 내보내기 실행
  const handleExport = () => {
    exportChart(exportFormat, customFileName)
    setShowExportDialog(false)
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length && selectedColumns.x && selectedColumns.y) {
      const data = payload[0].payload
      return (
        <div 
          className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg"
          style={{ fontFamily: styleOptions.fontFamily }}
        >
          <p className="font-medium">{`${selectedColumns.x.label}: ${formatNumber(data.x)}`}</p>
          <p className="font-medium">{`${selectedColumns.y.label}: ${formatNumber(data.y)}`}</p>
          {data.type !== 'default' && (
            <p className="text-sm text-gray-600">{`타입: ${data.type}`}</p>
          )}
        </div>
      )
    }
    return null
  }

  if (!selectedColumns.x || !selectedColumns.y) {
    return <div className="text-center py-8 text-gray-500">변수를 선택해주세요</div>
  }

  const chartStyle = {
    fontFamily: styleOptions.fontFamily,
  }

  const axisLabelStyle = {
    fontSize: styleOptions.axisTitleSize,
    fontWeight: styleOptions.axisTitleBold ? 'bold' : 'normal',
    fontFamily: styleOptions.fontFamily,
    fill: '#374151'
  }

  const axisTickStyle = {
    fontSize: styleOptions.axisNumberSize,
    fontFamily: styleOptions.fontFamily,
    fill: '#6B7280'
  }

  // 축 도메인 설정 (항상 현재 설정된 범위 사용)
  const xDomain = [xAxisRange.min, xAxisRange.max]
  const yDomain = [yAxisRange.min, yAxisRange.max]

  return (
    <div className="bg-white p-4 rounded-lg border">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-800">
          산점도: {selectedColumns.x.label} vs {selectedColumns.y.label}
        </h3>
        <div className="flex space-x-2">
          {/* 타입 필터 버튼 */}
          {selectedColumns.useTypeColumn && selectedColumns.selectedTypeColumn && (
            <button
              onClick={() => setShowTypePanel(!showTypePanel)}
              className="px-3 py-2 text-sm bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-md flex items-center transition-colors"
            >
              <Eye className="h-4 w-4 mr-1" />
              타입 필터
            </button>
          )}
          
          <button
            onClick={() => setShowPlotPanel(!showPlotPanel)}
            className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md flex items-center transition-colors"
          >
            <Shapes className="h-4 w-4 mr-1" />
            플롯 스타일
          </button>
          <button
            onClick={() => setShowAxisPanel(!showAxisPanel)}
            className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md flex items-center transition-colors"
          >
            <Move3D className="h-4 w-4 mr-1" />
            축 범위
          </button>
          <button
            onClick={() => setShowStylePanel(!showStylePanel)}
            className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md flex items-center transition-colors"
          >
            <Palette className="h-4 w-4 mr-1" />
            차트 스타일
          </button>
          <div className="relative">
            <button
              onClick={() => {
                const dropdown = document.getElementById('export-dropdown')
                dropdown?.classList.toggle('hidden')
              }}
              className="px-3 py-2 text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded-md flex items-center transition-colors"
            >
              <Download className="h-4 w-4 mr-1" />
              내보내기
            </button>
            <div id="export-dropdown" className="hidden absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10">
              <button
                onClick={() => openExportDialog('png')}
                className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-100 transition-colors"
              >
                PNG 파일
              </button>
              <button
                onClick={() => openExportDialog('svg')}
                className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-100 transition-colors"
              >
                SVG 파일
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 타입 필터 패널 (추세선 스타일 설정 제거) */}
      {showTypePanel && selectedColumns.useTypeColumn && selectedColumns.selectedTypeColumn && (
        <div className="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-700 flex items-center">
              <Eye className="h-4 w-4 mr-1" />
              데이터 타입 표시 설정
            </h4>
            <button
              onClick={toggleAllTypes}
              className="text-xs text-purple-600 hover:text-purple-800 transition-colors"
            >
              {Object.values(visibleTypes).every(v => v) ? '모두 숨기기' : '모두 표시'}
            </button>
          </div>
          
          {/* 축 범위 조정 버튼들 */}
          <div className="mb-3 flex items-center gap-2 p-2 bg-white rounded border">
            <span className="text-xs font-medium text-gray-600">축 범위:</span>
            <button
              onClick={adjustToVisibleDataRange}
              disabled={Object.values(visibleTypes).every(v => !v)}
              className={`px-2 py-1 text-xs rounded flex items-center gap-1 transition-colors ${
                useVisibleDataRange
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:bg-gray-100 disabled:text-gray-400'
              }`}
            >
              <ZoomIn size={12} />
              표시 데이터 범위로 확대
            </button>
            <button
              onClick={resetToFullDataRange}
              className={`px-2 py-1 text-xs rounded flex items-center gap-1 transition-colors ${
                !useVisibleDataRange
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <ZoomOut size={12} />
              전체 데이터 범위로 복원
            </button>
          </div>

          {/* 추세선 제어 버튼들 */}
          <div className="mb-3 flex items-center gap-2 p-2 bg-white rounded border">
            <span className="text-xs font-medium text-gray-600">추세선:</span>
            <button
              onClick={() => setShowOverallRegression(!showOverallRegression)}
              className={`px-2 py-1 text-xs rounded flex items-center gap-1 transition-colors ${
                showOverallRegression
                  ? 'bg-red-600 text-white'
                  : 'bg-red-100 text-red-700 hover:bg-red-200'
              }`}
            >
              <TrendingUp size={12} />
              전체 추세선 {showOverallRegression ? '끄기' : '보기'}
            </button>
            <button
              onClick={() => setShowTypeRegressions(!showTypeRegressions)}
              className={`px-2 py-1 text-xs rounded flex items-center gap-1 transition-colors ${
                showTypeRegressions
                  ? 'bg-green-600 text-white'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              <TrendingDown size={12} />
              타입별 추세선 {showTypeRegressions ? '모두끄기' : '모두보기'}
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {Object.entries(visibleTypes).map(([type, isVisible]) => {
              const color = fixedTypeColors[type] || '#8884d8'
              const count = chartData.filter(d => d.type === type).length
              
              return (
                <label
                  key={type}
                  className="flex items-center gap-2 text-sm cursor-pointer hover:bg-purple-100 p-2 rounded transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={() => toggleType(type)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-gray-700 flex-1">
                    {type} ({count})
                  </span>
                  {isVisible ? (
                    <Eye size={12} className="text-green-500" />
                  ) : (
                    <EyeOff size={12} className="text-gray-400" />
                  )}
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* 수정: 플롯 스타일 설정 패널 (추세선 스타일 설정 추가) */}
      {showPlotPanel && (
        <div className="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
            <Shapes className="h-4 w-4 mr-1" />
            플롯 스타일 설정
          </h4>
          
          {/* 새로 추가: 전체 추세선 스타일 설정 */}
          {showOverallRegression && (
            <div className="mb-4 p-3 bg-white rounded-lg border">
              <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <TrendingUp className="h-4 w-4 mr-1" />
                전체 추세선 스타일
              </h5>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">색상</label>
                  <input
                    type="color"
                    value={overallRegressionStyle.color}
                    onChange={(e) => setOverallRegressionStyle({
                      ...overallRegressionStyle,
                      color: e.target.value
                    })}
                    className="w-full h-8 border border-gray-300 rounded cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">두께: {overallRegressionStyle.strokeWidth}px</label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={overallRegressionStyle.strokeWidth}
                    onChange={(e) => setOverallRegressionStyle({
                      ...overallRegressionStyle,
                      strokeWidth: parseInt(e.target.value)
                    })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">투명도: {Math.round(overallRegressionStyle.opacity * 100)}%</label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={overallRegressionStyle.opacity}
                    onChange={(e) => setOverallRegressionStyle({
                      ...overallRegressionStyle,
                      opacity: parseFloat(e.target.value)
                    })}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                💡 타입별 추세선은 각 그룹의 색상을 따라갑니다
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 마커 모양 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                마커 모양
              </label>
              <select
                value={plotOptions.shape}
                onChange={(e) => setPlotOptions({
                  ...plotOptions,
                  shape: e.target.value as PlotStyleOptions['shape']
                })}
                className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="circle">● 동그라미</option>
                <option value="triangle">▲ 세모</option>
                <option value="square">■ 네모</option>
                <option value="diamond">◆ 다이아몬드</option>
              </select>
            </div>

            {/* 마커 크기 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                마커 크기: {plotOptions.size}
              </label>
              <input
                type="range"
                min="20"
                max="120"
                value={plotOptions.size}
                onChange={(e) => setPlotOptions({
                  ...plotOptions,
                  size: parseInt(e.target.value)
                })}
                className="w-full"
              />
            </div>

            {/* 투명도 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                투명도: {Math.round(plotOptions.opacity * 100)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={plotOptions.opacity}
                onChange={(e) => setPlotOptions({
                  ...plotOptions,
                  opacity: parseFloat(e.target.value)
                })}
                className="w-full"
              />
            </div>

            {/* 테두리 두께 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                테두리: {plotOptions.strokeWidth}px
              </label>
              <input
                type="range"
                min="0"
                max="5"
                value={plotOptions.strokeWidth}
                onChange={(e) => setPlotOptions({
                  ...plotOptions,
                  strokeWidth: parseInt(e.target.value)
                })}
                className="w-full"
              />
            </div>
          </div>

          {/* 테두리 색상 */}
          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-600 mb-2">
              테두리 색상 (모든 마커 공통)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={plotOptions.strokeColor}
                onChange={(e) => setPlotOptions({
                  ...plotOptions,
                  strokeColor: e.target.value
                })}
                className="w-12 h-8 border border-gray-300 rounded cursor-pointer"
                title="테두리 색상 선택"
              />
              <span className="text-sm text-gray-700">
                {plotOptions.strokeColor}
              </span>
              <button
                onClick={() => setPlotOptions({
                  ...plotOptions,
                  strokeColor: '#000000'
                })}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                검정으로 초기화
              </button>
            </div>
          </div>

          {/* 색상 팔레트 */}
          <div className="mt-4">
            <label className="flex items-center mb-2">
              <input
                type="checkbox"
                checked={plotOptions.useCustomColors}
                onChange={(e) => setPlotOptions({
                  ...plotOptions,
                  useCustomColors: e.target.checked
                })}
                className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <span className="ml-2 text-xs text-gray-700">사용자 정의 색상 사용</span>
            </label>
            
            {plotOptions.useCustomColors && (
              <div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {plotOptions.customColors.map((color, index) => (
                    <input
                      key={index}
                      type="color"
                      value={color}
                      onChange={(e) => {
                        const newColors = [...plotOptions.customColors]
                        newColors[index] = e.target.value
                        setPlotOptions({
                          ...plotOptions,
                          customColors: newColors
                        })
                      }}
                      className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
                      title={`색상 ${index + 1}`}
                    />
                  ))}
                </div>
                
                {/* 색상 미리보기 범례 */}
                <div className="bg-white p-3 rounded border border-gray-200">
                  <p className="text-xs font-medium text-gray-600 mb-2">색상 적용 미리보기:</p>
                  <div className="flex flex-wrap gap-2">
                    {typeGroups.map((group, index) => (
                      <div key={group.type} className="flex items-center text-xs">
                        <div 
                          className="w-3 h-3 mr-1 border"
                          style={{ 
                            backgroundColor: group.color,
                            opacity: plotOptions.opacity,
                            borderColor: plotOptions.strokeColor,
                            borderWidth: Math.max(1, plotOptions.strokeWidth)
                          }}
                        />
                        <span className="text-gray-700">
                          {group.type === 'default' ? '전체 데이터' : group.type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 축 범위 설정 패널 */}
      {showAxisPanel && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
            <Move3D className="h-4 w-4 mr-1" />
            축 범위 설정
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* X축 범위 */}
            <div>
              <h5 className="text-sm font-medium text-gray-600 mb-2">X축 ({selectedColumns.x.label})</h5>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="xAxisMode"
                    checked={xAxisRange.auto}
                    onChange={() => setXAxisRange({...xAxisRange, auto: true})}
                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">자동 범위</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="xAxisMode"
                    checked={!xAxisRange.auto}
                    onChange={() => setXAxisRange({...xAxisRange, auto: false})}
                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">수동 범위</span>
                </label>
                {!xAxisRange.auto && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <label className="block text-xs text-gray-500">최소값</label>
                      <input
                        type="number"
                        value={xAxisRange.min}
                        onChange={(e) => setXAxisRange({...xAxisRange, min: parseFloat(e.target.value)})}
                        className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                        step="any"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">최대값</label>
                      <input
                        type="number"
                        value={xAxisRange.max}
                        onChange={(e) => setXAxisRange({...xAxisRange, max: parseFloat(e.target.value)})}
                        className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                        step="any"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Y축 범위 */}
            <div>
              <h5 className="text-sm font-medium text-gray-600 mb-2">Y축 ({selectedColumns.y.label})</h5>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="yAxisMode"
                    checked={yAxisRange.auto}
                    onChange={() => setYAxisRange({...yAxisRange, auto: true})}
                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">자동 범위</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="yAxisMode"
                    checked={!yAxisRange.auto}
                    onChange={() => setYAxisRange({...yAxisRange, auto: false})}
                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">수동 범위</span>
                </label>
                {!yAxisRange.auto && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <label className="block text-xs text-gray-500">최소값</label>
                      <input
                        type="number"
                        value={yAxisRange.min}
                        onChange={(e) => setYAxisRange({...yAxisRange, min: parseFloat(e.target.value)})}
                        className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                        step="any"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">최대값</label>
                      <input
                        type="number"
                        value={yAxisRange.max}
                        onChange={(e) => setYAxisRange({...yAxisRange, max: parseFloat(e.target.value)})}
                        className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                        step="any"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 스타일 설정 패널 */}
      {showStylePanel && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
            <Settings className="h-4 w-4 mr-1" />
            차트 스타일 설정
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 숫자 표기법 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                숫자 표기법
              </label>
              <select
                value={styleOptions.numberFormat}
                onChange={(e) => setStyleOptions({
                  ...styleOptions,
                  numberFormat: e.target.value as ChartStyleOptions['numberFormat']
                })}
                className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="normal">일반 (123.45)</option>
                <option value="comma">쉼표 (1,234.56)</option>
                <option value="scientific">지수 (1.23e+2)</option>
              </select>
            </div>

            {/* 폰트 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                글씨체
              </label>
              <select
                value={styleOptions.fontFamily}
                onChange={(e) => setStyleOptions({
                  ...styleOptions,
                  fontFamily: e.target.value as ChartStyleOptions['fontFamily']
                })}
                className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Arial">Arial</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Georgia">Georgia</option>
              </select>
            </div>

            {/* 축 제목 굵게 */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={styleOptions.axisTitleBold}
                  onChange={(e) => setStyleOptions({
                    ...styleOptions,
                    axisTitleBold: e.target.checked
                  })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-xs text-gray-700">축 제목 굵게</span>
              </label>
            </div>

            {/* 축 제목 크기 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                축 제목 크기: {styleOptions.axisTitleSize}px
              </label>
              <input
                type="range"
                min="10"
                max="20"
                value={styleOptions.axisTitleSize}
                onChange={(e) => setStyleOptions({
                  ...styleOptions,
                  axisTitleSize: parseInt(e.target.value)
                })}
                className="w-full"
              />
            </div>

            {/* 축 숫자 크기 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                축 숫자 크기: {styleOptions.axisNumberSize}px
              </label>
              <input
                type="range"
                min="8"
                max="16"
                value={styleOptions.axisNumberSize}
                onChange={(e) => setStyleOptions({
                  ...styleOptions,
                  axisNumberSize: parseInt(e.target.value)
                })}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* 파일명 설정 대화상자 */}
      {showExportDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-full mx-4">
            <h3 className="text-lg font-medium text-gray-800 mb-4">
              파일 내보내기 ({exportFormat.toUpperCase()})
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  파일명
                </label>
                <input
                  type="text"
                  value={customFileName}
                  onChange={(e) => setCustomFileName(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                  placeholder="파일명을 입력하세요"
                />
                <p className="text-xs text-gray-500 mt-1">
                  확장자(.{exportFormat})는 자동으로 추가됩니다.
                </p>
              </div>

              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm text-gray-700 mb-2">
                  <strong>기본 형식:</strong>
                </p>
                <p className="text-xs text-gray-600">
                  {data.fileName.replace(/\.[^/.]+$/, "")}_X축 vs Y축
                </p>
                <button
                  onClick={() => setCustomFileName(generateDefaultFileName())}
                  className="mt-2 px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded transition-colors"
                >
                  기본 형식으로 복원
                </button>
              </div>

              <div className="bg-blue-50 p-3 rounded">
                <p className="text-sm text-gray-700 mb-1">
                  <strong>미리보기:</strong>
                </p>
                <p className="text-sm text-blue-800 font-mono">
                  {customFileName}.{exportFormat}
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowExportDialog(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleExport}
                disabled={!customFileName.trim()}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                내보내기
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 1:1 비율 고정 차트 (반응형) */}
      <div className="flex justify-center" ref={chartRef}>
        <div 
          id="chart-container"
          className="w-full max-w-[600px] aspect-square" 
          style={chartStyle}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 80, left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number" 
                dataKey="x" 
                name={selectedColumns.x.label}
                domain={xDomain}
                tickFormatter={formatNumber}
                tick={axisTickStyle}
                label={{ 
                  value: selectedColumns.x.label, 
                  position: 'insideBottom', 
                  offset: -5,
                  style: axisLabelStyle,
                  textAnchor: 'middle'
                }}
              />
              <YAxis 
                type="number" 
                dataKey="y" 
                name={selectedColumns.y.label}
                domain={yDomain}
                tickFormatter={formatNumber}
                tick={axisTickStyle}
                label={{ 
                  value: selectedColumns.y.label, 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { 
                    ...axisLabelStyle,
                    textAnchor: 'middle'
                  }
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {typeGroups.map((group, index) => (
                <Scatter
                  key={group.type}
                  name={group.type}
                  data={group.data}
                  fill={group.color}
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
              ))}
              
              {/* 수정: 전체 데이터 회귀선 (더 엄격한 렌더링 조건) */}
              {regressionLine && showOverallRegression && (
                <ReferenceLine 
                  segment={regressionLine}
                  stroke={overallRegressionStyle.color}
                  strokeWidth={overallRegressionStyle.strokeWidth}
                  strokeOpacity={overallRegressionStyle.opacity}
                  strokeDasharray="5 5"
                />
              )}

              {/* 수정: 타입별 회귀선 (더 엄격한 렌더링 조건) */}
              {showTypeRegressions && typeRegressionLines.length > 0 && typeRegressionLines.map(({ type, line, color }) => (
                <ReferenceLine
                  key={`type-regression-${type}`}
                  segment={line}
                  stroke={color}
                  strokeWidth={2}
                  strokeOpacity={0.8}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* 범례 */}
      {selectedColumns.useTypeColumn && selectedColumns.selectedTypeColumn && typeGroups.length > 1 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: styleOptions.fontFamily }}>
            범례 ({selectedColumns.selectedTypeColumn}):
          </p>
          <div className="flex flex-wrap gap-3">
            {typeGroups.map((group) => (
              <div key={group.type} className="flex items-center">
                <div 
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: group.color }}
                />
                <span className="text-sm text-gray-600" style={{ fontFamily: styleOptions.fontFamily }}>
                  {group.type} ({group.data.length}개)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* 수정: 통계 정보 및 디버깅 (더 상세한 정보) */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg" style={{ fontFamily: styleOptions.fontFamily }}>
        <p className="text-sm text-gray-700">
          <strong>표시된 데이터 포인트:</strong> {typeGroups.reduce((sum, group) => sum + group.data.length, 0)}개 
          (전체 {chartData.length}개 중)
        </p>
        <p className="text-sm text-gray-700">
          <strong>축 범위:</strong> {useVisibleDataRange ? '표시 데이터 기준' : '전체 데이터 기준'} 
          (X: {xAxisRange.min.toFixed(3)} ~ {xAxisRange.max.toFixed(3)}, Y: {yAxisRange.min.toFixed(3)} ~ {yAxisRange.max.toFixed(3)})
        </p>
        <p className="text-sm text-gray-700">
          <strong>전체 추세선:</strong> {showOverallRegression ? '표시' : '숨김'} 
          {regressionLine && showOverallRegression && `(기울기: ${statistics.linearSlope?.toFixed(4)})`}
          {!regressionLine && showOverallRegression && ' (데이터 없음)'}
        </p>
        <p className="text-sm text-gray-700">
          <strong>타입별 추세선:</strong> {showTypeRegressions ? `표시 (${typeRegressionLines.length}개)` : '숨김'} 
          {showTypeRegressions && typeRegressionLines.length > 0 && `- ${typeRegressionLines.map(l => l.type).join(', ')}`}
        </p>
        {selectedColumns.x.type === 'ratio' && (
          <p className="text-sm text-gray-700">
            <strong>X축 비율:</strong> {selectedColumns.x.numerator}/{selectedColumns.x.denominator}
          </p>
        )}
        {selectedColumns.y.type === 'ratio' && (
          <p className="text-sm text-gray-700">
            <strong>Y축 비율:</strong> {selectedColumns.y.numerator}/{selectedColumns.y.denominator}
          </p>
        )}
        {statistics.pearsonCorr && (
          <p className="text-sm text-gray-700">
            <strong>전체 피어슨 상관계수:</strong> {statistics.pearsonCorr.toFixed(4)}
          </p>
        )}
        {statistics.rSquared && (
          <p className="text-sm text-gray-700">
            <strong>전체 결정계수 (R²):</strong> {statistics.rSquared.toFixed(4)}
          </p>
        )}
        {regressionLine && statistics.linearSlope && statistics.linearIntercept && (
          <p className="text-sm text-gray-700">
            <strong>전체 회귀식:</strong> y = {statistics.linearSlope.toFixed(4)}x + {statistics.linearIntercept.toFixed(4)}
          </p>
        )}
        {typeStatistics && typeStatistics.length > 0 && (
          <p className="text-sm text-gray-700">
            <strong>타입별 분석:</strong> {typeStatistics.length}개 그룹 
            (회귀선 가능: {typeStatistics.filter(s => s.linearSlope && s.linearIntercept).length}개)
          </p>
        )}
        <p className="text-xs text-gray-500 mt-2">
          💡 차트 비율: 1:1 고정 (600×600px) | 내보내기: PNG, SVG 지원 | 타입별 필터링 및 통계 분석 지원
        </p>
      </div>
    </div>
  )
}
