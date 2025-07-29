'use client'

import { useState } from 'react'
import { GeochemData, AxisConfig, ColumnSelection } from '@/types/geochem'
import { Table, BarChart3, Settings, Calculator, Users } from 'lucide-react'

interface DataViewerProps {
  data: GeochemData
  selectedColumns: ColumnSelection
  onColumnSelect: (columns: ColumnSelection) => void
}

export default function DataViewer({ data, selectedColumns, onColumnSelect }: DataViewerProps) {
  const [viewMode, setViewMode] = useState<'table' | 'summary'>('summary')
  const [currentPage, setCurrentPage] = useState(1)
  const [xAxisType, setXAxisType] = useState<'single' | 'ratio'>('single')
  const [yAxisType, setYAxisType] = useState<'single' | 'ratio'>('single')
  
  // 임시 비율 상태 저장
  const [xRatioTemp, setXRatioTemp] = useState({ numerator: '', denominator: '' })
  const [yRatioTemp, setYRatioTemp] = useState({ numerator: '', denominator: '' })
  
  const itemsPerPage = 10

  const totalPages = Math.ceil(data.data.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentData = data.data.slice(startIndex, endIndex)

  // 사용 가능한 타입 컬럼들 (문자형 컬럼들)
  const typeColumns = data.columns.filter(col => 
    !data.numericColumns.includes(col) && 
    data.data.some(row => typeof row[col] === 'string')
  )

  const handleAxisConfigChange = (axis: 'x' | 'y', config: AxisConfig | null) => {
    onColumnSelect({
      ...selectedColumns,
      [axis]: config
    })
  }

  const handleTypeColumnToggle = (enabled: boolean) => {
    onColumnSelect({
      ...selectedColumns,
      useTypeColumn: enabled,
      selectedTypeColumn: enabled ? (selectedColumns.selectedTypeColumn || data.typeColumn) : undefined
    })
  }

  const handleTypeColumnSelect = (column: string) => {
    onColumnSelect({
      ...selectedColumns,
      selectedTypeColumn: column
    })
  }

  const createAxisConfig = (type: 'single' | 'ratio', numerator: string, denominator?: string): AxisConfig => {
    const label = type === 'single' ? numerator : `${numerator}/${denominator}`
    return { type, numerator, denominator, label }
  }

  const handleAxisTypeChange = (axis: 'x' | 'y', type: 'single' | 'ratio') => {
    if (axis === 'x') {
      setXAxisType(type)
      // 타입 변경 시 기존 선택 초기화
      handleAxisConfigChange('x', null)
      setXRatioTemp({ numerator: '', denominator: '' })
    } else {
      setYAxisType(type)
      // 타입 변경 시 기존 선택 초기화
      handleAxisConfigChange('y', null)
      setYRatioTemp({ numerator: '', denominator: '' })
    }
  }

  const handleSingleColumnSelect = (axis: 'x' | 'y', column: string) => {
    if (column) {
      handleAxisConfigChange(axis, createAxisConfig('single', column))
    } else {
      handleAxisConfigChange(axis, null)
    }
  }

  const handleRatioColumnSelect = (axis: 'x' | 'y', type: 'numerator' | 'denominator', column: string) => {
    if (axis === 'x') {
      const newRatio = { ...xRatioTemp, [type]: column }
      setXRatioTemp(newRatio)
      
      // 분자와 분모가 모두 선택되었을 때만 AxisConfig 생성
      if (newRatio.numerator && newRatio.denominator) {
        handleAxisConfigChange('x', createAxisConfig('ratio', newRatio.numerator, newRatio.denominator))
      } else {
        // 하나라도 비어있으면 AxisConfig 제거
        handleAxisConfigChange('x', null)
      }
    } else {
      const newRatio = { ...yRatioTemp, [type]: column }
      setYRatioTemp(newRatio)
      
      // 분자와 분모가 모두 선택되었을 때만 AxisConfig 생성
      if (newRatio.numerator && newRatio.denominator) {
        handleAxisConfigChange('y', createAxisConfig('ratio', newRatio.numerator, newRatio.denominator))
      } else {
        // 하나라도 비어있으면 AxisConfig 제거
        handleAxisConfigChange('y', null)
      }
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* 헤더 */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">
            데이터 미리보기
          </h2>
          <div className="flex space-x-2">
            <button
              onClick={() => setViewMode('summary')}
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                viewMode === 'summary'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <BarChart3 className="h-4 w-4 inline mr-1" />
              요약
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                viewMode === 'table'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Table className="h-4 w-4 inline mr-1" />
              테이블
            </button>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          <p className="mb-1">파일: {data.metadata.fileName}</p>
          <p>데이터: {data.metadata.rowCount}행 × {data.metadata.columnCount}열</p>
        </div>
      </div>

      {/* 타입 컬럼 설정 */}
      <div className="p-6 border-b border-gray-200 bg-yellow-50">
        <h3 className="text-lg font-medium text-gray-800 mb-3">
          <Users className="h-5 w-5 inline mr-2" />
          타입 분류 설정
        </h3>
        <div className="space-y-3">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="useTypeColumn"
              checked={selectedColumns.useTypeColumn}
              onChange={(e) => handleTypeColumnToggle(e.target.checked)}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="useTypeColumn" className="ml-2 text-sm text-gray-700">
              타입별 분류 사용 (암석 타입, 샘플 그룹 등)
            </label>
          </div>
          
          {selectedColumns.useTypeColumn && typeColumns.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                타입 컬럼 선택
              </label>
              <select
                value={selectedColumns.selectedTypeColumn || ''}
                onChange={(e) => handleTypeColumnSelect(e.target.value)}
                className="w-full max-w-xs p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">타입 컬럼을 선택하세요</option>
                {typeColumns.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
          )}
          
          {selectedColumns.useTypeColumn && typeColumns.length === 0 && (
            <p className="text-sm text-gray-500">사용 가능한 타입 컬럼이 없습니다.</p>
          )}
        </div>
      </div>

      {/* 컬럼 선택 */}
      <div className="p-6 border-b border-gray-200 bg-gray-50">
        <h3 className="text-lg font-medium text-gray-800 mb-4">
          <Settings className="h-5 w-5 inline mr-2" />
          분석 변수 선택
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* X축 설정 */}
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-700 text-lg">X축 변수</h4>
            
            {/* 타입 선택 라디오 버튼 */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600 mb-2">변수 타입 선택:</p>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="xAxisType"
                    value="single"
                    checked={xAxisType === 'single'}
                    onChange={() => handleAxisTypeChange('x', 'single')}
                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">단일 컬럼</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="xAxisType"
                    value="ratio"
                    checked={xAxisType === 'ratio'}
                    onChange={() => handleAxisTypeChange('x', 'ratio')}
                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    <Calculator className="h-4 w-4 inline mr-1" />
                    비율 (분자/분모)
                  </span>
                </label>
              </div>
            </div>

            {/* 단일 컬럼 선택 */}
            {xAxisType === 'single' && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  컬럼 선택
                </label>
                <select
                  value={selectedColumns.x?.type === 'single' ? selectedColumns.x.numerator : ''}
                  onChange={(e) => handleSingleColumnSelect('x', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">컬럼을 선택하세요</option>
                  {data.numericColumns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 비율 컬럼 선택 */}
            {xAxisType === 'ratio' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    분자 (위쪽 값)
                  </label>
                  <select
                    value={xRatioTemp.numerator}
                    onChange={(e) => handleRatioColumnSelect('x', 'numerator', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">분자를 선택하세요</option>
                    {data.numericColumns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    분모 (아래쪽 값)
                  </label>
                  <select
                    value={xRatioTemp.denominator}
                    onChange={(e) => handleRatioColumnSelect('x', 'denominator', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">분모를 선택하세요</option>
                    {data.numericColumns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
                
                {/* 임시 선택 상태 표시 */}
                {(xRatioTemp.numerator || xRatioTemp.denominator) && (
                  <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="text-sm text-orange-800">
                      <strong>진행 상황:</strong> {xRatioTemp.numerator || '?'} / {xRatioTemp.denominator || '?'}
                    </p>
                    {!xRatioTemp.numerator && <p className="text-xs text-orange-600">분자를 선택해주세요</p>}
                    {!xRatioTemp.denominator && <p className="text-xs text-orange-600">분모를 선택해주세요</p>}
                  </div>
                )}
              </div>
            )}

            {/* X축 결과 표시 */}
            {selectedColumns.x && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-800">
                  ✅ X축: <span className="font-mono">{selectedColumns.x.label}</span>
                </p>
              </div>
            )}
          </div>

          {/* Y축 설정 */}
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-700 text-lg">Y축 변수</h4>
            
            {/* 타입 선택 라디오 버튼 */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600 mb-2">변수 타입 선택:</p>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="yAxisType"
                    value="single"
                    checked={yAxisType === 'single'}
                    onChange={() => handleAxisTypeChange('y', 'single')}
                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">단일 컬럼</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="yAxisType"
                    value="ratio"
                    checked={yAxisType === 'ratio'}
                    onChange={() => handleAxisTypeChange('y', 'ratio')}
                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    <Calculator className="h-4 w-4 inline mr-1" />
                    비율 (분자/분모)
                  </span>
                </label>
              </div>
            </div>

            {/* 단일 컬럼 선택 */}
            {yAxisType === 'single' && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  컬럼 선택
                </label>
                <select
                  value={selectedColumns.y?.type === 'single' ? selectedColumns.y.numerator : ''}
                  onChange={(e) => handleSingleColumnSelect('y', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">컬럼을 선택하세요</option>
                  {data.numericColumns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 비율 컬럼 선택 */}
            {yAxisType === 'ratio' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    분자 (위쪽 값)
                  </label>
                  <select
                    value={yRatioTemp.numerator}
                    onChange={(e) => handleRatioColumnSelect('y', 'numerator', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">분자를 선택하세요</option>
                    {data.numericColumns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    분모 (아래쪽 값)
                  </label>
                  <select
                    value={yRatioTemp.denominator}
                    onChange={(e) => handleRatioColumnSelect('y', 'denominator', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">분모를 선택하세요</option>
                    {data.numericColumns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
                
                {/* 임시 선택 상태 표시 */}
                {(yRatioTemp.numerator || yRatioTemp.denominator) && (
                  <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="text-sm text-orange-800">
                      <strong>진행 상황:</strong> {yRatioTemp.numerator || '?'} / {yRatioTemp.denominator || '?'}
                    </p>
                    {!yRatioTemp.numerator && <p className="text-xs text-orange-600">분자를 선택해주세요</p>}
                    {!yRatioTemp.denominator && <p className="text-xs text-orange-600">분모를 선택해주세요</p>}
                  </div>
                )}
              </div>
            )}

            {/* Y축 결과 표시 */}
            {selectedColumns.y && (
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm font-medium text-green-800">
                  ✅ Y축: <span className="font-mono">{selectedColumns.y.label}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="p-6">
        {viewMode === 'summary' ? (
          <div className="space-y-6">
            <div>
              <h4 className="text-lg font-medium text-gray-800 mb-3">컬럼 정보</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h5 className="font-medium text-blue-800">전체 컬럼</h5>
                  <p className="text-2xl font-bold text-blue-600">{data.columns.length}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h5 className="font-medium text-green-800">수치형 컬럼</h5>
                  <p className="text-2xl font-bold text-green-600">{data.numericColumns.length}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h5 className="font-medium text-purple-800">타입 컬럼</h5>
                  <p className="text-2xl font-bold text-purple-600">
                    {typeColumns.length}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-lg font-medium text-gray-800 mb-3">수치형 컬럼 목록</h4>
              <div className="flex flex-wrap gap-2">
                {data.numericColumns.map(col => (
                  <span
                    key={col}
                    className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                  >
                    {col}
                  </span>
                ))}
              </div>
            </div>

            {typeColumns.length > 0 && (
              <div>
                <h4 className="text-lg font-medium text-gray-800 mb-3">사용 가능한 타입 컬럼</h4>
                <div className="flex flex-wrap gap-2">
                  {typeColumns.map(col => (
                    <span
                      key={col}
                      className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full"
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {data.columns.map(col => (
                      <th
                        key={col}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentData.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      {data.columns.map(col => (
                        <td key={col} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {typeof row[col] === 'number' ? row[col].toFixed(3) : row[col]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="mt-4 flex justify-between items-center">
                <p className="text-sm text-gray-700">
                  {startIndex + 1}-{Math.min(endIndex, data.data.length)} / {data.data.length} 행
                </p>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                  >
                    이전
                  </button>
                  <span className="px-3 py-1 text-sm">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                  >
                    다음
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 