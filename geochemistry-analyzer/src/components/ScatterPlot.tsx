'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'
import { GeochemData, StatisticalResult, ColumnSelection, ChartStyleOptions, AxisRange, PlotStyleOptions } from '@/types/geochem'
import { Settings, Palette, Move3D, Download, Shapes } from 'lucide-react'

interface ScatterPlotProps {
  data: GeochemData
  selectedColumns: ColumnSelection
  statistics: StatisticalResult
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

export default function ScatterPlot({ data, selectedColumns, statistics }: ScatterPlotProps) {
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
  const [exportFormat, setExportFormat] = useState<'png' | 'svg'>('png')
  const [customFileName, setCustomFileName] = useState('')
  
  // 축 범위 상태
  const [xAxisRange, setXAxisRange] = useState<AxisRange>({ auto: true, min: 0, max: 100 })
  const [yAxisRange, setYAxisRange] = useState<AxisRange>({ auto: true, min: 0, max: 100 })

  const chartData = useMemo(() => {
    if (!selectedColumns.x || !selectedColumns.y) return []

    return data.data
      .map((row, index) => {
        // X축 데이터 계산
        let xValue: number
        if (selectedColumns.x!.type === 'single') {
          xValue = parseFloat(row[selectedColumns.x!.numerator])
        } else {
          const numerator = parseFloat(row[selectedColumns.x!.numerator])
          const denominator = parseFloat(row[selectedColumns.x!.denominator!])
          xValue = numerator / denominator
        }

        // Y축 데이터 계산
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
          type: selectedColumns.useTypeColumn && selectedColumns.selectedTypeColumn 
            ? row[selectedColumns.selectedTypeColumn] 
            : 'default',
          index
        }
      })
      .filter(point => !isNaN(point.x) && !isNaN(point.y) && isFinite(point.x) && isFinite(point.y))
  }, [data, selectedColumns])

  // 데이터 범위 자동 계산
  useEffect(() => {
    if (chartData.length > 0) {
      const xValues = chartData.map(d => d.x)
      const yValues = chartData.map(d => d.y)
      
      const xMin = Math.min(...xValues)
      const xMax = Math.max(...xValues)
      const yMin = Math.min(...yValues)
      const yMax = Math.max(...yValues)
      
      // 약간의 패딩 추가
      const xPadding = (xMax - xMin) * 0.1
      const yPadding = (yMax - yMin) * 0.1
      
      setXAxisRange(prev => ({ 
        ...prev, 
        min: Number((xMin - xPadding).toFixed(3)), 
        max: Number((xMax + xPadding).toFixed(3)) 
      }))
      setYAxisRange(prev => ({ 
        ...prev, 
        min: Number((yMin - yPadding).toFixed(3)), 
        max: Number((yMax + yPadding).toFixed(3)) 
      }))
    }
  }, [chartData])

  const regressionLine = useMemo(() => {
    if (!statistics.linearSlope || !statistics.linearIntercept || chartData.length === 0) return null
    
    const xMin = xAxisRange.auto ? Math.min(...chartData.map(d => d.x)) : xAxisRange.min
    const xMax = xAxisRange.auto ? Math.max(...chartData.map(d => d.x)) : xAxisRange.max
    
    return [
      { x: xMin, y: statistics.linearSlope * xMin + statistics.linearIntercept },
      { x: xMax, y: statistics.linearSlope * xMax + statistics.linearIntercept }
    ]
  }, [chartData, statistics, xAxisRange])

  const typeGroups = useMemo(() => {
    if (!selectedColumns.useTypeColumn || !selectedColumns.selectedTypeColumn) {
      return [{ type: 'default', data: chartData, color: plotOptions.customColors[0] }]
    }
    
    const groups = new Map<string, typeof chartData>()
    chartData.forEach(point => {
      const type = point.type
      if (!groups.has(type)) {
        groups.set(type, [])
      }
      groups.get(type)!.push(point)
    })
    
    const colors = plotOptions.useCustomColors ? plotOptions.customColors : 
      ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#F97316', '#06B6D4', '#84CC16']
    
    return Array.from(groups.entries()).map(([type, data], index) => ({
      type,
      data,
      color: colors[index % colors.length]
    }))
  }, [chartData, selectedColumns.useTypeColumn, selectedColumns.selectedTypeColumn, plotOptions])

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
    const originalFileName = data.metadata.fileName.replace(/\.[^/.]+$/, "") // 확장자 제거
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
        // PNG 내보내기 - 차트 영역만 정확히 캡처하고 여백 최소화
        const html2canvas = (await import('html2canvas' as any)).default
        
        // 차트 컨테이너 찾기 (600x600 div)
        const chartContainer = chartRef.current.querySelector('#chart-container') as HTMLElement
        
        if (chartContainer) {
          const canvas = await html2canvas(chartContainer, {
            backgroundColor: 'white',
            scale: 2, // 고해상도
            useCORS: true,
            width: 600,
            height: 600,
            x: 0,
            y: 0,
            scrollX: 0,
            scrollY: 0,
            ignoreElements: (element: HTMLElement) => {
              // 불필요한 요소들 제외
              return element.classList?.contains('recharts-tooltip-wrapper') || false
            }
          })
          
          // 캔버스에서 실제 차트 영역만 추출 (여백 자동 감지하여 자르기)
          const ctx = canvas.getContext('2d')!
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const data = imageData.data
          
          // 여백 감지
          let top = 0, bottom = canvas.height, left = 0, right = canvas.width
          
          // 상단 여백 찾기
          for (let y = 0; y < canvas.height; y++) {
            let hasContent = false
            for (let x = 0; x < canvas.width; x++) {
              const idx = (y * canvas.width + x) * 4
              // 흰색이 아닌 픽셀 찾기 (알파값도 확인)
              if (data[idx] !== 255 || data[idx + 1] !== 255 || data[idx + 2] !== 255 || data[idx + 3] !== 255) {
                hasContent = true
                break
              }
            }
            if (hasContent) {
              top = Math.max(0, y - 10) // 10px 패딩
              break
            }
          }
          
          // 하단 여백 찾기
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
              bottom = Math.min(canvas.height, y + 10) // 10px 패딩
              break
            }
          }
          
          // 좌측 여백 찾기
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
              left = Math.max(0, x - 10) // 10px 패딩
              break
            }
          }
          
          // 우측 여백 찾기
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
              right = Math.min(canvas.width, x + 10) // 10px 패딩
              break
            }
          }
          
          // 자른 영역 크기 계산
          const cropWidth = right - left
          const cropHeight = bottom - top
          
          // 새 캔버스에 자른 이미지 그리기
          const croppedCanvas = document.createElement('canvas')
          const croppedCtx = croppedCanvas.getContext('2d')!
          
          // 1:1 비율 유지하면서 적절한 크기 설정
          const maxSize = Math.max(cropWidth, cropHeight)
          croppedCanvas.width = maxSize
          croppedCanvas.height = maxSize
          
          // 흰색 배경
          croppedCtx.fillStyle = 'white'
          croppedCtx.fillRect(0, 0, maxSize, maxSize)
          
          // 중앙에 차트 배치
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
          // 백업: 전체 차트 영역 캡처
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
        // SVG 내보내기 - 차트 영역의 SVG만 추출하고 여백 최소화
        const svgElement = chartRef.current.querySelector('svg')
        if (svgElement) {
          // SVG 복제하여 크기 조정 (여백 최소화)
          const clonedSVG = svgElement.cloneNode(true) as SVGElement
          
          // SVG의 실제 내용 영역 계산
          const bbox = svgElement.getBBox()
          const padding = 20 // 최소 패딩
          
          const viewBoxX = Math.max(0, bbox.x - padding)
          const viewBoxY = Math.max(0, bbox.y - padding)
          const viewBoxWidth = bbox.width + (padding * 2)
          const viewBoxHeight = bbox.height + (padding * 2)
          
          // 1:1 비율 유지
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

  // 축 도메인 설정
  const xDomain = xAxisRange.auto ? ['auto', 'auto'] : [xAxisRange.min, xAxisRange.max]
  const yDomain = yAxisRange.auto ? ['auto', 'auto'] : [yAxisRange.min, yAxisRange.max]

  return (
    <div className="bg-white p-4 rounded-lg border">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-800">
          산점도: {selectedColumns.x.label} vs {selectedColumns.y.label}
        </h3>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowPlotPanel(!showPlotPanel)}
            className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md flex items-center"
          >
            <Shapes className="h-4 w-4 mr-1" />
            플롯 스타일
          </button>
          <button
            onClick={() => setShowAxisPanel(!showAxisPanel)}
            className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md flex items-center"
          >
            <Move3D className="h-4 w-4 mr-1" />
            축 범위
          </button>
          <button
            onClick={() => setShowStylePanel(!showStylePanel)}
            className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md flex items-center"
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
              className="px-3 py-2 text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded-md flex items-center"
            >
              <Download className="h-4 w-4 mr-1" />
              내보내기
            </button>
            <div id="export-dropdown" className="hidden absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10">
              <button
                onClick={() => openExportDialog('png')}
                className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-100"
              >
                PNG 파일
              </button>
              <button
                onClick={() => openExportDialog('svg')}
                className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-100"
              >
                SVG 파일
              </button>
            </div>
          </div>
        </div>
      </div>

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
                  {data.metadata.fileName.replace(/\.[^/.]+$/, "")}_X축 vs Y축
                </p>
                <button
                  onClick={() => setCustomFileName(generateDefaultFileName())}
                  className="mt-2 px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded"
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
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                취소
              </button>
              <button
                onClick={handleExport}
                disabled={!customFileName.trim()}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                내보내기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 플롯 스타일 설정 패널 */}
      {showPlotPanel && (
        <div className="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
            <Shapes className="h-4 w-4 mr-1" />
            플롯 스타일 설정
          </h4>
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
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
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
              
              {regressionLine && (
                <ReferenceLine 
                  segment={regressionLine}
                  stroke="#EF4444"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              )}
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
      
      {/* 통계 정보 */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg" style={{ fontFamily: styleOptions.fontFamily }}>
        <p className="text-sm text-gray-700">
          <strong>데이터 포인트:</strong> {chartData.length}개
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
            <strong>피어슨 상관계수:</strong> {statistics.pearsonCorr.toFixed(4)}
          </p>
        )}
        {statistics.rSquared && (
          <p className="text-sm text-gray-700">
            <strong>결정계수 (R²):</strong> {statistics.rSquared.toFixed(4)}
          </p>
        )}
        {regressionLine && statistics.linearSlope && statistics.linearIntercept && (
          <p className="text-sm text-gray-700">
            <strong>회귀식:</strong> y = {statistics.linearSlope.toFixed(4)}x + {statistics.linearIntercept.toFixed(4)}
          </p>
        )}
        <p className="text-xs text-gray-500 mt-2">
          💡 차트 비율: 1:1 고정 (600×600px) | 내보내기: PNG, SVG 지원 | 실시간 마커 스타일 적용
        </p>
      </div>
    </div>
  )
} 