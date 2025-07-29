'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, AlertCircle } from 'lucide-react'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { GeochemData } from '@/types/geochem'

interface FileUploadProps {
  onDataLoad: (data: GeochemData) => void
}

export default function FileUpload({ onDataLoad }: FileUploadProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (file: File) => {
    setIsLoading(true)
    setError(null)

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

      const geochemData: GeochemData = {
        data: parsedData,
        columns,
        numericColumns,
        typeColumn,
        metadata: {
          fileName: file.name,
          rowCount: parsedData.length,
          columnCount: columns.length
        }
      }

      onDataLoad(geochemData)
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일 처리 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
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

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">데이터 파일 업로드</h2>
      
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isLoading 
            ? 'border-gray-300 bg-gray-50' 
            : 'border-blue-300 hover:border-blue-500 hover:bg-blue-50'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => !isLoading && fileInputRef.current?.click()}
      >
        {isLoading ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
            <p className="text-gray-600">파일 처리 중...</p>
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