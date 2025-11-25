'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, FileText, AlertCircle, Database, Clock, Trash2, Check, Cloud } from 'lucide-react'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { GeochemData } from '@/types/geochem'
import { saveDatasetToSupabase, listDatasets, deleteDataset, loadFullDataset, loadDatasetMeta, DatasetMeta } from '@/lib/supabase-data'

interface FileUploadProps {
  onDataLoad: (data: GeochemData) => void
}

export default function FileUpload({ onDataLoad }: FileUploadProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [savedDatasets, setSavedDatasets] = useState<DatasetMeta[]>([])
  const [showSavedData, setShowSavedData] = useState(false)
  const [saveToCloud, setSaveToCloud] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 저장된 데이터셋 목록 로드
  useEffect(() => {
    loadSavedDatasets()
  }, [])

  const loadSavedDatasets = async () => {
    try {
      const datasets = await listDatasets()
      setSavedDatasets(datasets)
    } catch (err) {
      // Supabase 연결 실패 시 무시
    }
  }

  const handleFileSelect = async (file: File) => {
    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase()
      let parsedData: any[] = []

      if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        // Excel 파일 처리
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        parsedData = XLSX.utils.sheet_to_json(worksheet)
      } else if (fileExtension === 'csv') {
        // CSV 파일 처리
        const text = await file.text()
        const result = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true
        })
        parsedData = result.data as any[]
      } else {
        throw new Error('지원되지 않는 파일 형식입니다. Excel(.xlsx) 또는 CSV 파일을 업로드해주세요.')
      }

      if (parsedData.length === 0) {
        throw new Error('파일에 데이터가 없습니다.')
      }

      // 컬럼 정보 추출
      const columns = Object.keys(parsedData[0])
      const numericColumns: string[] = []
      let typeColumn: string | undefined

      // 수치형 컬럼과 타입 컬럼 식별
      columns.forEach(col => {
        const values = parsedData.map(row => row[col]).filter(val => val !== null && val !== undefined)
        const numericValues = values.filter(val => !isNaN(parseFloat(val)) && isFinite(parseFloat(val)))

        if (numericValues.length / values.length > 0.8) {
          numericColumns.push(col)
        } else if (!typeColumn && typeof values[0] === 'string') {
          typeColumn = col
        }
      })

      // 비수치형 컬럼 계산
      const nonNumericColumns = columns.filter(col => !numericColumns.includes(col))

      const geochemData: GeochemData = {
        data: parsedData,
        numericColumns,
        nonNumericColumns,
        fileName: file.name,
        typeColumn,
        metadata: {
          fileName: file.name,
          rowCount: parsedData.length,
          columnCount: columns.length
        }
      }

      // 클라우드 저장 옵션이 켜져있으면 Supabase에 저장
      if (saveToCloud) {
        setIsSaving(true)
        const saveResult = await saveDatasetToSupabase(geochemData)
        setIsSaving(false)

        if (saveResult.success) {
          setSuccessMessage(`☁️ 클라우드에 저장됨 (${parsedData.length}행)`)
          loadSavedDatasets() // 목록 새로고침
        } else {
          setError(`클라우드 저장 실패: ${saveResult.error}`)
        }
      }

      onDataLoad(geochemData)
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일 처리 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
      setIsSaving(false)
    }
  }

  // 저장된 데이터셋 불러오기
  const handleLoadSavedDataset = async (dataset: DatasetMeta) => {
    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const rows = await loadFullDataset(dataset.id)

      const geochemData: GeochemData = {
        data: rows,
        numericColumns: dataset.numeric_columns,
        nonNumericColumns: dataset.non_numeric_columns,
        fileName: dataset.file_name,
        typeColumn: dataset.type_column,
        metadata: {
          fileName: dataset.file_name,
          rowCount: dataset.row_count,
          columnCount: dataset.columns.length
        }
      }

      onDataLoad(geochemData)
      setSuccessMessage(`☁️ ${dataset.file_name} 불러옴`)
      setShowSavedData(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 로드 실패')
    } finally {
      setIsLoading(false)
    }
  }

  // 데이터셋 삭제
  const handleDeleteDataset = async (datasetId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('이 데이터셋을 삭제하시겠습니까?')) return

    const success = await deleteDataset(datasetId)
    if (success) {
      loadSavedDatasets()
    } else {
      setError('삭제 실패')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">데이터 파일 업로드</h2>

      {/* 클라우드 저장 토글 */}
      <div className="mb-4 flex items-center justify-between">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={saveToCloud}
            onChange={(e) => setSaveToCloud(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="ml-2 text-sm text-gray-700 flex items-center">
            <Cloud className="h-4 w-4 mr-1 text-blue-500" />
            클라우드에 자동 저장
          </span>
        </label>

        {savedDatasets.length > 0 && (
          <button
            onClick={() => setShowSavedData(!showSavedData)}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
          >
            <Database className="h-4 w-4 mr-1" />
            저장된 데이터 ({savedDatasets.length})
          </button>
        )}
      </div>

      {/* 저장된 데이터셋 목록 */}
      {showSavedData && savedDatasets.length > 0 && (
        <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-700">☁️ 클라우드에 저장된 데이터</h3>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {savedDatasets.map((dataset) => (
              <div
                key={dataset.id}
                onClick={() => handleLoadSavedDataset(dataset)}
                className="flex items-center justify-between px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {dataset.file_name}
                  </p>
                  <p className="text-xs text-gray-500 flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    {formatDate(dataset.created_at)} · {dataset.row_count.toLocaleString()}행
                  </p>
                </div>
                <button
                  onClick={(e) => handleDeleteDataset(dataset.id, e)}
                  className="ml-2 p-1 text-gray-400 hover:text-red-500"
                  title="삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isLoading || isSaving
            ? 'border-gray-300 bg-gray-50'
            : 'border-blue-300 hover:border-blue-500 hover:bg-blue-50'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => !isLoading && !isSaving && fileInputRef.current?.click()}
      >
        {isLoading ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
            <p className="text-gray-600">파일 처리 중...</p>
          </div>
        ) : isSaving ? (
          <div className="flex flex-col items-center">
            <Cloud className="h-8 w-8 text-blue-500 animate-pulse mb-2" />
            <p className="text-gray-600">클라우드에 저장 중...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Upload className="h-12 w-12 text-blue-500 mb-2" />
            <p className="text-lg text-gray-700 mb-1">
              파일을 드래그하거나 클릭하여 선택하세요
            </p>
            <p className="text-sm text-gray-500">
              지원 형식: Excel (.xlsx), CSV (.csv)
            </p>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFileSelect(file)
        }}
        className="hidden"
      />

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start">
          <Check className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
          <p className="text-green-700 text-sm">{successMessage}</p>
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500">
        <h3 className="font-semibold mb-1">데이터 형식 가이드:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>첫 번째 행은 컬럼 헤더여야 합니다</li>
          <li>수치형 데이터는 자동으로 감지됩니다</li>
          <li>문자형 컬럼은 타입 분류에 사용됩니다</li>
          <li>예: SiO2, Al2O3, Fe2O3, MgO, rock_type</li>
        </ul>
      </div>
    </div>
  )
}
