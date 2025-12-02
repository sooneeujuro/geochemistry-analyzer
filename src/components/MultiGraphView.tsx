'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { GeochemData, AxisConfig, MultiViewPanel, MultiViewAxisRange } from '@/types/geochem'
import html2canvas from 'html2canvas'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  Cell
} from 'recharts'
import {
  Plus,
  X,
  RotateCcw,
  Eye,
  EyeOff,
  Layers,
  ChevronDown,
  ChevronUp,
  Download
} from 'lucide-react'

// GraphPanel은 MultiViewPanel 타입 사용
type GraphPanel = MultiViewPanel

interface MultiGraphViewProps {
  data: GeochemData
  initialPanels?: MultiViewPanel[]  // 외부에서 설정 가져오기
}

// 축 선택 컴포넌트
function AxisSelector({
  axis,
  label,
  value,
  columns,
  onChange
}: {
  axis: 'x' | 'y'
  label: string
  value: AxisConfig | null
  columns: string[]
  onChange: (config: AxisConfig | null) => void
}) {
  const [axisType, setAxisType] = useState<'single' | 'ratio'>(value?.type || 'single')
  const [ratioTemp, setRatioTemp] = useState({ numerator: '', denominator: '' })
  const [isExpanded, setIsExpanded] = useState(false)

  // 외부 value 변경 시 동기화
  useEffect(() => {
    if (value) {
      setAxisType(value.type)
      if (value.type === 'ratio' && value.denominator) {
        setRatioTemp({ numerator: value.numerator, denominator: value.denominator })
      }
    }
  }, [value])

  const handleTypeChange = (type: 'single' | 'ratio') => {
    setAxisType(type)
    onChange(null)
    setRatioTemp({ numerator: '', denominator: '' })
  }

  const handleSingleSelect = (column: string) => {
    if (column) {
      onChange({ type: 'single', numerator: column, label: column })
    } else {
      onChange(null)
    }
  }

  const handleRatioSelect = (part: 'numerator' | 'denominator', column: string) => {
    const newRatio = { ...ratioTemp, [part]: column }
    setRatioTemp(newRatio)

    if (newRatio.numerator && newRatio.denominator) {
      onChange({
        type: 'ratio',
        numerator: newRatio.numerator,
        denominator: newRatio.denominator,
        label: `${newRatio.numerator}/${newRatio.denominator}`
      })
    } else {
      onChange(null)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-600">{label}</label>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          {axisType === 'ratio' ? '비율' : '단일'}
          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {isExpanded && (
        <div className="flex gap-1 mb-2">
          <button
            onClick={() => handleTypeChange('single')}
            className={`flex-1 px-2 py-1 text-xs rounded ${
              axisType === 'single'
                ? 'bg-teal-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            단일 변수
          </button>
          <button
            onClick={() => handleTypeChange('ratio')}
            className={`flex-1 px-2 py-1 text-xs rounded ${
              axisType === 'ratio'
                ? 'bg-teal-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            비율 (A/B)
          </button>
        </div>
      )}

      {axisType === 'single' ? (
        <select
          value={value?.type === 'single' ? value.numerator : ''}
          onChange={(e) => handleSingleSelect(e.target.value)}
          className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-teal-500"
        >
          <option value="">선택...</option>
          {columns.map(col => (
            <option key={col} value={col}>{col}</option>
          ))}
        </select>
      ) : (
        <div className="space-y-1">
          <select
            value={ratioTemp.numerator}
            onChange={(e) => handleRatioSelect('numerator', e.target.value)}
            className="w-full px-2 py-1 text-xs border rounded focus:ring-2 focus:ring-teal-500"
          >
            <option value="">분자 선택...</option>
            {columns.map(col => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
          <div className="text-center text-gray-400 text-xs">÷</div>
          <select
            value={ratioTemp.denominator}
            onChange={(e) => handleRatioSelect('denominator', e.target.value)}
            className="w-full px-2 py-1 text-xs border rounded focus:ring-2 focus:ring-teal-500"
          >
            <option value="">분모 선택...</option>
            {columns.map(col => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
          {ratioTemp.numerator && ratioTemp.denominator && (
            <div className="text-center text-xs text-teal-600 font-medium">
              = {ratioTemp.numerator}/{ratioTemp.denominator}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const MAX_PANELS = 4

export default function MultiGraphView({ data, initialPanels }: MultiGraphViewProps) {
  // 그래프 패널 상태 (최대 4개)
  const [panels, setPanels] = useState<GraphPanel[]>(
    initialPanels || [{ id: '1', xAxis: null, yAxis: null }]
  )

  // 선택된 시료 인덱스들 (모든 그래프에서 공유)
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())

  // 그래프 컨테이너 ref (이미지 내보내기용)
  const graphContainerRef = useRef<HTMLDivElement>(null)
  const [isExporting, setIsExporting] = useState(false)

  // 드래그 선택 상태
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number; panelId: string } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null)

  // 클릭과 드래그 모두 활성화 (드래그 거리로 구분)

  // 하이라이트 표시 여부
  const [showHighlight, setShowHighlight] = useState(true)

  // 호버된 시료 인덱스 (모든 그래프에서 동기화)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // initialPanels가 변경되면 업데이트
  useEffect(() => {
    if (initialPanels && initialPanels.length > 0) {
      setPanels(initialPanels)
    }
  }, [initialPanels])

  // 패널 추가
  const addPanel = () => {
    if (panels.length >= MAX_PANELS) return
    setPanels([...panels, { id: Date.now().toString(), xAxis: null, yAxis: null }])
  }

  // 패널 제거
  const removePanel = (panelId: string) => {
    if (panels.length <= 1) return
    setPanels(panels.filter(p => p.id !== panelId))
  }

  // 패널 축 변경
  const updatePanelAxis = (panelId: string, axis: 'x' | 'y', config: AxisConfig | null) => {
    setPanels(panels.map(p =>
      p.id === panelId
        ? { ...p, [axis === 'x' ? 'xAxis' : 'yAxis']: config }
        : p
    ))
  }

  // 패널 축 범위 변경
  const updatePanelAxisRange = (panelId: string, range: Partial<MultiViewAxisRange>) => {
    setPanels(panels.map(p =>
      p.id === panelId
        ? { ...p, axisRange: { ...p.axisRange, ...range } }
        : p
    ))
  }

  // 축 도메인 계산 - 항상 숫자 배열 반환
  const getAxisDomain = (panel: GraphPanel, axis: 'x' | 'y', chartData: any[]): [number, number] => {
    const range = panel.axisRange
    const minKey = axis === 'x' ? 'xMin' : 'yMin'
    const maxKey = axis === 'x' ? 'xMax' : 'yMax'
    const dataKey = axis

    const userMin = range?.[minKey]
    const userMax = range?.[maxKey]

    const dataValues = chartData.map(d => d[dataKey]).filter(v => v !== null && v !== undefined && !isNaN(v))
    const dataMin = dataValues.length > 0 ? Math.min(...dataValues) : 0
    const dataMax = dataValues.length > 0 ? Math.max(...dataValues) : 1

    // 사용자 입력값이 숫자이면 그 값 사용, 아니면 데이터 범위 사용
    const min = typeof userMin === 'number' ? userMin : dataMin
    const max = typeof userMax === 'number' ? userMax : dataMax

    return [min, max]
  }

  // 선택 초기화
  const clearSelection = () => {
    setSelectedIndices(new Set())
  }

  // 이미지로 내보내기 (그래프 영역만)
  const exportAsImage = async () => {
    if (!graphContainerRef.current || isExporting) return

    setIsExporting(true)
    try {
      // 설정 패널들 일시적으로 숨기기
      const settingsPanels = graphContainerRef.current.querySelectorAll('[data-settings-panel]')
      settingsPanels.forEach(el => (el as HTMLElement).style.display = 'none')

      const canvas = await html2canvas(graphContainerRef.current, {
        backgroundColor: '#ffffff',
        scale: 2, // 고해상도
        logging: false,
        useCORS: true
      })

      // 설정 패널들 다시 표시
      settingsPanels.forEach(el => (el as HTMLElement).style.display = '')

      const link = document.createElement('a')
      link.download = `multiview-comparison-${new Date().toISOString().slice(0, 10)}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (error) {
      console.error('이미지 내보내기 실패:', error)
      alert('이미지 내보내기에 실패했습니다.')
    } finally {
      setIsExporting(false)
    }
  }

  // 데이터 값 계산 (단일 또는 비율)
  const getAxisValue = useCallback((row: Record<string, any>, config: AxisConfig): number | null => {
    if (config.type === 'single') {
      const val = parseFloat(String(row[config.numerator]))
      return isNaN(val) ? null : val
    } else {
      const num = parseFloat(String(row[config.numerator]))
      const den = parseFloat(String(row[config.denominator!]))
      if (isNaN(num) || isNaN(den) || den === 0) return null
      return num / den
    }
  }, [])

  // 시료 클릭 핸들러 (드래그 중이 아닐 때만)
  const handlePointClick = (index: number, event: React.MouseEvent) => {
    // 드래그 중이면 클릭 무시
    if (isDragging) return

    if (event.ctrlKey || event.metaKey) {
      setSelectedIndices(prev => {
        const newSet = new Set(prev)
        if (newSet.has(index)) {
          newSet.delete(index)
        } else {
          newSet.add(index)
        }
        return newSet
      })
    } else if (event.shiftKey) {
      setSelectedIndices(prev => new Set([...Array.from(prev), index]))
    } else {
      setSelectedIndices(new Set([index]))
    }
  }

  // 드래그 선택 완료 핸들러
  const handleBrushEnd = useCallback((panelId: string, xAxis: AxisConfig, yAxis: AxisConfig) => {
    if (!dragStart || !dragEnd || dragStart.panelId !== panelId) return

    const minX = Math.min(dragStart.x, dragEnd.x)
    const maxX = Math.max(dragStart.x, dragEnd.x)
    const minY = Math.min(dragStart.y, dragEnd.y)
    const maxY = Math.max(dragStart.y, dragEnd.y)

    const indicesInRange = new Set<number>()
    data.data.forEach((row, index) => {
      const x = getAxisValue(row, xAxis)
      const y = getAxisValue(row, yAxis)
      if (x !== null && y !== null && x >= minX && x <= maxX && y >= minY && y <= maxY) {
        indicesInRange.add(index)
      }
    })

    setSelectedIndices(indicesInRange)
    setDragStart(null)
    setDragEnd(null)
    setIsDragging(false)
  }, [dragStart, dragEnd, data.data, getAxisValue])

  // 그래프 데이터 생성
  const getChartData = useCallback((xAxis: AxisConfig, yAxis: AxisConfig) => {
    return data.data.map((row, index) => {
      const x = getAxisValue(row, xAxis)
      const y = getAxisValue(row, yAxis)
      return {
        x,
        y,
        index,
        isSelected: selectedIndices.has(index),
        isHovered: hoveredIndex === index
      }
    }).filter(d => d.x !== null && d.y !== null)
  }, [data.data, selectedIndices, hoveredIndex, getAxisValue])

  // 데이터 범위 계산 (자동값 placeholder용)
  const getDataBounds = useCallback((xAxis: AxisConfig | null, yAxis: AxisConfig | null) => {
    if (!xAxis || !yAxis) return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }
    const xValues: number[] = []
    const yValues: number[] = []
    data.data.forEach(row => {
      const x = getAxisValue(row, xAxis)
      const y = getAxisValue(row, yAxis)
      if (x !== null) xValues.push(x)
      if (y !== null) yValues.push(y)
    })
    if (xValues.length === 0 || yValues.length === 0) return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }
    return {
      xMin: Math.min(...xValues),
      xMax: Math.max(...xValues),
      yMin: Math.min(...yValues),
      yMax: Math.max(...yValues)
    }
  }, [data.data, getAxisValue])

  // 선택된 시료 정보
  const selectionInfo = useMemo(() => {
    const count = selectedIndices.size
    const total = data.data.length
    return { count, total, percentage: ((count / total) * 100).toFixed(1) }
  }, [selectedIndices, data.data.length])

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden select-none">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">다중 그래프 비교</h2>
              <p className="text-teal-200 text-sm">시료를 선택하면 모든 그래프에서 하이라이트됩니다</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* 하이라이트 토글 */}
            <button
              onClick={() => setShowHighlight(!showHighlight)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                showHighlight
                  ? 'bg-white text-teal-700'
                  : 'bg-white/20 text-white'
              }`}
            >
              {showHighlight ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              하이라이트
            </button>

            {/* 선택 초기화 */}
            <button
              onClick={clearSelection}
              disabled={selectedIndices.size === 0}
              className="flex items-center gap-1 px-3 py-1.5 bg-white/20 text-white rounded-lg text-sm font-medium hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              초기화
            </button>

            {/* 패널 추가 */}
            <button
              onClick={addPanel}
              disabled={panels.length >= MAX_PANELS}
              className="flex items-center gap-1 px-4 py-1.5 bg-white text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              title={panels.length >= MAX_PANELS ? `최대 ${MAX_PANELS}개까지 비교 가능` : '그래프 추가'}
            >
              <Plus className="w-4 h-4" />
              그래프 추가 ({panels.length}/{MAX_PANELS})
            </button>

            {/* 이미지 내보내기 */}
            <button
              onClick={exportAsImage}
              disabled={isExporting || panels.every(p => !p.xAxis || !p.yAxis)}
              className="flex items-center gap-1 px-4 py-1.5 bg-white text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              title="그래프를 이미지로 내보내기"
            >
              <Download className="w-4 h-4" />
              {isExporting ? '내보내는 중...' : '이미지 저장'}
            </button>
          </div>
        </div>
      </div>

      {/* 선택 정보 바 */}
      {selectedIndices.size > 0 && (
        <div className="px-6 py-3 bg-teal-50 border-b border-teal-200">
          <div className="flex items-center justify-between">
            <span className="text-teal-800 font-medium">
              🎯 선택된 시료: {selectionInfo.count}개 / {selectionInfo.total}개 ({selectionInfo.percentage}%)
            </span>
            <span className="text-teal-600 text-sm">
              드래그로 영역 선택 / Ctrl+클릭으로 개별 선택
            </span>
          </div>
        </div>
      )}

      {/* 그래프 패널들 */}
      <div
        ref={graphContainerRef}
        className={`p-6 grid gap-4 bg-white ${
          panels.length === 1 ? 'grid-cols-1' :
          panels.length === 2 ? 'grid-cols-2' :
          panels.length === 3 ? 'grid-cols-3' :
          'grid-cols-2'  // 4개일 때 2x2
        }`}
      >
        {panels.map((panel, panelIndex) => (
          <div key={panel.id} className="border rounded-lg overflow-hidden">
            {/* 패널 헤더 + 축 선택 (이미지 저장 시 제외) */}
            <div data-settings-panel className="bg-gray-50">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <span className="font-medium text-gray-700">그래프 {panelIndex + 1}</span>
                {panels.length > 1 && (
                  <button
                    onClick={() => removePanel(panel.id)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

            {/* 축 선택 */}
            <div className="p-4 bg-gray-50 border-b">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <AxisSelector
                  axis="x"
                  label="X축"
                  value={panel.xAxis}
                  columns={data.numericColumns}
                  onChange={(config) => updatePanelAxis(panel.id, 'x', config)}
                />
                <AxisSelector
                  axis="y"
                  label="Y축"
                  value={panel.yAxis}
                  columns={data.numericColumns}
                  onChange={(config) => updatePanelAxis(panel.id, 'y', config)}
                />
              </div>
              {/* 축 범위 설정 */}
              {panel.xAxis && panel.yAxis && (() => {
                const bounds = getDataBounds(panel.xAxis, panel.yAxis)
                return (
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <input
                    type="number"
                    placeholder={bounds.xMin.toPrecision(3)}
                    value={panel.axisRange?.xMin !== 'auto' ? panel.axisRange?.xMin ?? '' : ''}
                    onChange={(e) => updatePanelAxisRange(panel.id, { xMin: e.target.value ? parseFloat(e.target.value) : 'auto' })}
                    className="px-2 py-1 border rounded text-center placeholder:text-gray-400"
                  />
                  <input
                    type="number"
                    placeholder={bounds.xMax.toPrecision(3)}
                    value={panel.axisRange?.xMax !== 'auto' ? panel.axisRange?.xMax ?? '' : ''}
                    onChange={(e) => updatePanelAxisRange(panel.id, { xMax: e.target.value ? parseFloat(e.target.value) : 'auto' })}
                    className="px-2 py-1 border rounded text-center placeholder:text-gray-400"
                  />
                  <input
                    type="number"
                    placeholder={bounds.yMin.toPrecision(3)}
                    value={panel.axisRange?.yMin !== 'auto' ? panel.axisRange?.yMin ?? '' : ''}
                    onChange={(e) => updatePanelAxisRange(panel.id, { yMin: e.target.value ? parseFloat(e.target.value) : 'auto' })}
                    className="px-2 py-1 border rounded text-center placeholder:text-gray-400"
                  />
                  <input
                    type="number"
                    placeholder={bounds.yMax.toPrecision(3)}
                    value={panel.axisRange?.yMax !== 'auto' ? panel.axisRange?.yMax ?? '' : ''}
                    onChange={(e) => updatePanelAxisRange(panel.id, { yMax: e.target.value ? parseFloat(e.target.value) : 'auto' })}
                    className="px-2 py-1 border rounded text-center placeholder:text-gray-400"
                  />
                </div>
                )
              })()}
            </div>
            </div>

            {/* 그래프 영역 */}
            <div className="p-4" style={{ height: panels.length === 1 ? '500px' : panels.length <= 3 ? '400px' : '350px' }}>
              {panel.xAxis && panel.yAxis ? (() => {
                const chartData = getChartData(panel.xAxis, panel.yAxis)
                const range = panel.axisRange
                // 사용자 지정 범위가 있으면 그 값 사용, 없으면 'dataMin'/'dataMax' 사용
                // 사용자가 범위를 지정했는지 확인
                const hasCustomXRange = typeof range?.xMin === 'number' || typeof range?.xMax === 'number'
                const hasCustomYRange = typeof range?.yMin === 'number' || typeof range?.yMax === 'number'

                // domain이 undefined면 Recharts 자동 계산, 숫자면 강제 적용
                const xDomain: [number, number] | undefined = hasCustomXRange ? [
                  typeof range?.xMin === 'number' ? range.xMin : Math.min(...chartData.map(d => d.x)),
                  typeof range?.xMax === 'number' ? range.xMax : Math.max(...chartData.map(d => d.x))
                ] : undefined
                const yDomain: [number, number] | undefined = hasCustomYRange ? [
                  typeof range?.yMin === 'number' ? range.yMin : Math.min(...chartData.map(d => d.y)),
                  typeof range?.yMax === 'number' ? range.yMax : Math.max(...chartData.map(d => d.y))
                ] : undefined
                return (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart
                    margin={{ top: 20, right: 20, bottom: 40, left: 60 }}
                    onMouseDown={(e) => {
                      if (e && e.xValue !== undefined) {
                        setIsDragging(true)
                        setDragStart({
                          x: e.xValue as number,
                          y: e.yValue as number,
                          panelId: panel.id
                        })
                      }
                    }}
                    onMouseMove={(e) => {
                      if (isDragging && dragStart && dragStart.panelId === panel.id && e && e.xValue !== undefined) {
                        setDragEnd({
                          x: e.xValue as number,
                          y: e.yValue as number
                        })
                      }
                    }}
                    onMouseUp={() => {
                      if (isDragging && panel.xAxis && panel.yAxis) {
                        handleBrushEnd(panel.id, panel.xAxis, panel.yAxis)
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis
                      type="number"
                      dataKey="x"
                      name={panel.xAxis.label}
                      domain={xDomain}
                      allowDataOverflow={hasCustomXRange}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => typeof value === 'number' ? value.toExponential(1) : value}
                      label={{
                        value: panel.xAxis.label,
                        position: 'bottom',
                        offset: 0,
                        style: { fontSize: 12, fill: '#666' }
                      }}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      name={panel.yAxis.label}
                      domain={yDomain}
                      allowDataOverflow={hasCustomYRange}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => typeof value === 'number' ? value.toExponential(1) : value}
                      label={{
                        value: panel.yAxis.label,
                        angle: -90,
                        position: 'insideLeft',
                        style: { fontSize: 12, fill: '#666' }
                      }}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      content={({ payload, active }) => {
                        if (!payload || payload.length === 0) return null
                        const point = payload[0].payload
                        // 호버 시 인덱스 동기화
                        if (active && point.index !== hoveredIndex) {
                          setTimeout(() => setHoveredIndex(point.index), 0)
                        }
                        return (
                          <div className="bg-white p-2 border rounded shadow-lg text-xs">
                            <div><strong>시료 #{point.index + 1}</strong></div>
                            <div>{panel.xAxis?.label}: {point.x?.toFixed(4)}</div>
                            <div>{panel.yAxis?.label}: {point.y?.toFixed(4)}</div>
                            {point.isSelected && (
                              <div className="text-teal-600 font-medium mt-1">✓ 선택됨</div>
                            )}
                          </div>
                        )
                      }}
                    />

                    {/* 드래그 선택 영역 표시 */}
                    {isDragging && dragStart && dragEnd && dragStart.panelId === panel.id && (
                      <ReferenceArea
                        x1={dragStart.x}
                        x2={dragEnd.x}
                        y1={dragStart.y}
                        y2={dragEnd.y}
                        stroke="#0d9488"
                        strokeOpacity={0.8}
                        fill="#0d9488"
                        fillOpacity={0.2}
                      />
                    )}

                    <Scatter
                      data={chartData}
                      onClick={(data, index, event) => {
                        if (data && data.index !== undefined) {
                          handlePointClick(data.index, event as unknown as React.MouseEvent)
                        }
                      }}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      {chartData.map((entry, index) => {
                        const isHighlighted = showHighlight && (entry.isSelected || entry.isHovered)
                        const isSelected = entry.isSelected
                        const isHovered = entry.isHovered && !entry.isSelected
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={isSelected ? '#f97316' : isHovered ? '#3b82f6' : '#0d9488'}
                            fillOpacity={isHighlighted ? 1 : 0.6}
                            stroke={isSelected ? '#c2410c' : isHovered ? '#1d4ed8' : 'none'}
                            strokeWidth={isHighlighted ? 2 : 0}
                            r={isHighlighted ? 8 : 5}
                            style={{ cursor: 'pointer' }}
                          />
                        )
                      })}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
                )
              })() : (
                <div className="h-full flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <Layers className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>X축과 Y축을 선택하세요</p>
                    <p className="text-xs mt-1">비율(A/B)도 선택 가능</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 사용 안내 */}
      <div className="px-6 py-4 bg-gray-50 border-t text-sm text-gray-600">
        <div className="flex items-start gap-6">
          <div>
            <strong>🖱️ 드래그:</strong> 그래프 위에서 드래그하여 영역 내 시료 선택
          </div>
          <div>
            <strong>👆 클릭:</strong> 점 클릭으로 선택 (Ctrl+클릭: 추가/제거)
          </div>
          <div>
            <strong>📊 비율 축:</strong> 축 옆 화살표 클릭 → "비율 (A/B)" 선택
          </div>
        </div>
      </div>
    </div>
  )
}
