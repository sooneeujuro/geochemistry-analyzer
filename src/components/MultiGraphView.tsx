'use client'

import { useState, useCallback, useMemo } from 'react'
import { GeochemData } from '@/types/geochem'
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
  Trash2,
  MousePointer2,
  Move,
  RotateCcw,
  Eye,
  EyeOff,
  Layers
} from 'lucide-react'

interface GraphPanel {
  id: string
  xColumn: string | null
  yColumn: string | null
}

interface MultiGraphViewProps {
  data: GeochemData
}

export default function MultiGraphView({ data }: MultiGraphViewProps) {
  // 그래프 패널 상태 (최대 3개)
  const [panels, setPanels] = useState<GraphPanel[]>([
    { id: '1', xColumn: null, yColumn: null }
  ])

  // 선택된 시료 인덱스들 (모든 그래프에서 공유)
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())

  // 드래그 선택 상태
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number; panelId: string } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null)

  // 선택 모드: 'click' | 'brush'
  const [selectionMode, setSelectionMode] = useState<'click' | 'brush'>('brush')

  // 하이라이트 표시 여부
  const [showHighlight, setShowHighlight] = useState(true)

  // 패널 추가
  const addPanel = () => {
    if (panels.length >= 3) return
    setPanels([...panels, { id: Date.now().toString(), xColumn: null, yColumn: null }])
  }

  // 패널 제거
  const removePanel = (panelId: string) => {
    if (panels.length <= 1) return
    setPanels(panels.filter(p => p.id !== panelId))
  }

  // 패널 축 변경
  const updatePanelAxis = (panelId: string, axis: 'x' | 'y', column: string) => {
    setPanels(panels.map(p =>
      p.id === panelId
        ? { ...p, [axis === 'x' ? 'xColumn' : 'yColumn']: column }
        : p
    ))
  }

  // 선택 초기화
  const clearSelection = () => {
    setSelectedIndices(new Set())
  }

  // 시료 클릭 핸들러
  const handlePointClick = (index: number, event: React.MouseEvent) => {
    if (selectionMode !== 'click') return

    if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd + 클릭: 토글
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
      // Shift + 클릭: 추가
      setSelectedIndices(prev => new Set([...Array.from(prev), index]))
    } else {
      // 일반 클릭: 단일 선택
      setSelectedIndices(new Set([index]))
    }
  }

  // 드래그 선택 완료 핸들러
  const handleBrushEnd = useCallback((panelId: string, xColumn: string, yColumn: string) => {
    if (!dragStart || !dragEnd || dragStart.panelId !== panelId) return

    const minX = Math.min(dragStart.x, dragEnd.x)
    const maxX = Math.max(dragStart.x, dragEnd.x)
    const minY = Math.min(dragStart.y, dragEnd.y)
    const maxY = Math.max(dragStart.y, dragEnd.y)

    // 범위 내 시료 찾기
    const indicesInRange = new Set<number>()
    data.data.forEach((row, index) => {
      const x = parseFloat(String(row[xColumn]))
      const y = parseFloat(String(row[yColumn]))
      if (!isNaN(x) && !isNaN(y) && x >= minX && x <= maxX && y >= minY && y <= maxY) {
        indicesInRange.add(index)
      }
    })

    setSelectedIndices(indicesInRange)
    setDragStart(null)
    setDragEnd(null)
    setIsDragging(false)
  }, [dragStart, dragEnd, data.data])

  // 그래프 데이터 생성
  const getChartData = useCallback((xColumn: string, yColumn: string) => {
    return data.data.map((row, index) => {
      const x = parseFloat(String(row[xColumn]))
      const y = parseFloat(String(row[yColumn]))
      return {
        x: isNaN(x) ? null : x,
        y: isNaN(y) ? null : y,
        index,
        isSelected: selectedIndices.has(index)
      }
    }).filter(d => d.x !== null && d.y !== null)
  }, [data.data, selectedIndices])

  // 선택된 시료 정보
  const selectionInfo = useMemo(() => {
    const count = selectedIndices.size
    const total = data.data.length
    return { count, total, percentage: ((count / total) * 100).toFixed(1) }
  }, [selectedIndices, data.data.length])

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
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
            {/* 선택 모드 토글 */}
            <div className="flex bg-white/20 rounded-lg p-1">
              <button
                onClick={() => setSelectionMode('brush')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  selectionMode === 'brush'
                    ? 'bg-white text-teal-700'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                <Move className="w-4 h-4" />
                드래그
              </button>
              <button
                onClick={() => setSelectionMode('click')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  selectionMode === 'click'
                    ? 'bg-white text-teal-700'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                <MousePointer2 className="w-4 h-4" />
                클릭
              </button>
            </div>

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
              disabled={panels.length >= 3}
              className="flex items-center gap-1 px-4 py-1.5 bg-white text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Plus className="w-4 h-4" />
              그래프 추가
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
              {selectionMode === 'click' ? 'Ctrl+클릭으로 추가 선택' : '드래그로 영역 선택'}
            </span>
          </div>
        </div>
      )}

      {/* 그래프 패널들 */}
      <div className={`p-6 grid gap-4 ${
        panels.length === 1 ? 'grid-cols-1' :
        panels.length === 2 ? 'grid-cols-2' :
        'grid-cols-3'
      }`}>
        {panels.map((panel, panelIndex) => (
          <div key={panel.id} className="border rounded-lg overflow-hidden">
            {/* 패널 헤더 */}
            <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
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
            <div className="p-4 bg-gray-50 border-b grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">X축</label>
                <select
                  value={panel.xColumn || ''}
                  onChange={(e) => updatePanelAxis(panel.id, 'x', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">선택...</option>
                  {data.numericColumns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Y축</label>
                <select
                  value={panel.yColumn || ''}
                  onChange={(e) => updatePanelAxis(panel.id, 'y', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">선택...</option>
                  {data.numericColumns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 그래프 영역 */}
            <div className="p-4" style={{ height: panels.length === 1 ? '500px' : '400px' }}>
              {panel.xColumn && panel.yColumn ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart
                    margin={{ top: 20, right: 20, bottom: 40, left: 60 }}
                    onMouseDown={(e) => {
                      if (selectionMode === 'brush' && e && e.xValue !== undefined) {
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
                      if (isDragging && panel.xColumn && panel.yColumn) {
                        handleBrushEnd(panel.id, panel.xColumn, panel.yColumn)
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis
                      type="number"
                      dataKey="x"
                      name={panel.xColumn}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => value.toExponential(1)}
                      label={{
                        value: panel.xColumn,
                        position: 'bottom',
                        offset: 0,
                        style: { fontSize: 12, fill: '#666' }
                      }}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      name={panel.yColumn}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => value.toExponential(1)}
                      label={{
                        value: panel.yColumn,
                        angle: -90,
                        position: 'insideLeft',
                        style: { fontSize: 12, fill: '#666' }
                      }}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      content={({ payload }) => {
                        if (!payload || payload.length === 0) return null
                        const point = payload[0].payload
                        return (
                          <div className="bg-white p-2 border rounded shadow-lg text-xs">
                            <div><strong>시료 #{point.index + 1}</strong></div>
                            <div>{panel.xColumn}: {point.x?.toFixed(4)}</div>
                            <div>{panel.yColumn}: {point.y?.toFixed(4)}</div>
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
                      data={getChartData(panel.xColumn, panel.yColumn)}
                      onClick={(data, index, event) => {
                        if (data && data.index !== undefined) {
                          handlePointClick(data.index, event as unknown as React.MouseEvent)
                        }
                      }}
                    >
                      {getChartData(panel.xColumn, panel.yColumn).map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={showHighlight && entry.isSelected ? '#f97316' : '#0d9488'}
                          fillOpacity={showHighlight && entry.isSelected ? 1 : 0.6}
                          stroke={showHighlight && entry.isSelected ? '#c2410c' : 'none'}
                          strokeWidth={showHighlight && entry.isSelected ? 2 : 0}
                          r={showHighlight && entry.isSelected ? 8 : 5}
                          style={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <Layers className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>X축과 Y축을 선택하세요</p>
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
            <strong>🖱️ 드래그 모드:</strong> 그래프 위에서 드래그하여 영역 내 시료 선택
          </div>
          <div>
            <strong>👆 클릭 모드:</strong> 점 클릭으로 선택 (Ctrl+클릭: 추가, Shift+클릭: 다중)
          </div>
          <div>
            <strong>🎯 선택 동기화:</strong> 한 그래프에서 선택하면 모든 그래프에서 하이라이트
          </div>
        </div>
      </div>
    </div>
  )
}
