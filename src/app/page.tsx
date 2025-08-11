'use client'

import { useState } from 'react'
import FileUpload from '@/components/FileUpload'
import DataViewer from '@/components/DataViewer'
import AnalysisPanel from '@/components/AnalysisPanel'
import ScanMode from '@/components/ScanMode'
import ChatInterface from '@/components/ChatInterface'
import { GeochemData, ColumnSelection, ScanResult, ScanSummary } from '@/types/geochem'
import { BarChart3, Scan, ArrowLeft, MessageCircle } from 'lucide-react'

export default function Home() {
  const [data, setData] = useState<GeochemData | null>(null)
  const [selectedColumns, setSelectedColumns] = useState<ColumnSelection>({
    x: null,
    y: null,
    useTypeColumn: false,
    selectedTypeColumn: undefined
  })
  const [mode, setMode] = useState<'analysis' | 'scan' | 'chat'>('analysis')
  const [cameFromScan, setCameFromScan] = useState(false)
  const [scanResults, setScanResults] = useState<ScanResult[]>([])
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null)

  const handleDataLoad = (newData: GeochemData) => {
    setData(newData)
    // 새 데이터 로드 시 스캔 결과 초기화
    setScanResults([])
    setScanSummary(null)
    setCameFromScan(false)
    
    if (newData.typeColumn) {
      setSelectedColumns(prev => ({
        ...prev,
        useTypeColumn: true,
        selectedTypeColumn: newData.typeColumn
      }))
    }
  }

  const handleScanResultSelect = (xColumn: string, yColumn: string) => {
    // 스캔 결과에서 선택된 조합을 기본 분석 모드로 설정
    setSelectedColumns({
      x: { type: 'single', numerator: xColumn, label: xColumn },
      y: { type: 'single', numerator: yColumn, label: yColumn },
      useTypeColumn: selectedColumns.useTypeColumn,
      selectedTypeColumn: selectedColumns.selectedTypeColumn
    })
    setCameFromScan(true)
    setMode('analysis')
  }

  // 스캔 완료 처리
  const handleScanComplete = (results: ScanResult[], summary: ScanSummary | null) => {
    setScanResults(results)
    setScanSummary(summary)
  }

  // 새 스캔 시작 처리
  const handleStartNewScan = () => {
    setScanResults([])
    setScanSummary(null)
  }

  // 데이터 업데이트 처리 (PCA 결과 등)
  const handleDataUpdate = (newData: GeochemData) => {
    setData(newData)
  }

  // 모드 변경 처리 (PCA → 분석 모드 전환)
  const handleModeChange = (newMode: 'analysis' | 'scan') => {
    setMode(newMode)
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          {/* 스캔에서 온 경우 돌아가기 버튼 */}
          {cameFromScan && (
            <div className="flex justify-center mb-6">
              <button
                onClick={() => {
                  setMode('scan')
                  setCameFromScan(false)
                }}
                className="flex items-center px-6 py-3 text-base font-medium rounded-lg transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                style={{
                  backgroundColor: '#E4815A',
                  color: 'white'
                }}
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                📊 스캔 결과로 돌아가기
              </button>
            </div>
          )}
          
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            {mode === 'chat' ? 'GPT 4o 대피소 🏠' : '지구화학 데이터 분석기'}
          </h1>
          <p className="text-gray-600">
            {mode === 'chat' 
              ? '영어 문장을 10점 만점으로 평가하고 최상위권 SCI 저널 수준으로 개선해드립니다'
              : 'Excel/CSV 파일을 업로드하여 지구화학 데이터를 분석하고 시각화하세요'
            }
          </p>
          {mode !== 'chat' && (
            <p className="text-sm text-gray-500 mt-2">
              ✨ 새 기능: 비율 계산 (SiO2/Al2O3 등) 및 타입 분류 옵션
            </p>
          )}
          {mode === 'chat' && (
            <p className="text-sm text-green-600 mt-2">
              🎯 논문 문장 평가 시스템 | 동위원소 표기 자동 정리 | 학술적 어조 개선
            </p>
          )}
          
          {/* 모드 선택 버튼 */}
          <div className="flex justify-center mt-4 space-x-4">
            {/* 채팅 모드는 항상 표시 */}
            <button
              onClick={() => {
                setMode('chat')
                setCameFromScan(false)
              }}
              className={`flex items-center px-6 py-3 rounded-lg font-medium transition-all ${
                mode === 'chat' 
                  ? 'bg-green-600 text-white shadow-lg' 
                  : 'bg-white text-gray-700 shadow-md hover:shadow-lg'
              }`}
            >
              <MessageCircle className="h-5 w-5 mr-2" />
              GPT 4o 대피소
            </button>
            
            {/* 데이터 분석 모드들은 데이터가 있을 때만 표시 */}
            {data && !cameFromScan && (
              <>
                <button
                  onClick={() => {
                    setMode('analysis')
                    setCameFromScan(false)
                  }}
                  className={`flex items-center px-6 py-3 rounded-lg font-medium transition-all ${
                    mode === 'analysis' 
                      ? 'bg-blue-600 text-white shadow-lg' 
                      : 'bg-white text-gray-700 shadow-md hover:shadow-lg'
                  }`}
                >
                  <BarChart3 className="h-5 w-5 mr-2" />
                  기본 분석 모드
                </button>
                <button
                  onClick={() => {
                    setMode('scan')
                    setCameFromScan(false)
                  }}
                  className={`flex items-center px-6 py-3 rounded-lg font-medium transition-all ${
                    mode === 'scan' 
                      ? 'bg-purple-600 text-white shadow-lg' 
                      : 'bg-white text-gray-700 shadow-md hover:shadow-lg'
                  }`}
                >
                  <Scan className="h-5 w-5 mr-2" />
                  스캔 모드 (전체 분석)
                </button>
              </>
            )}
          </div>
          
          {/* 스캔에서 온 경우 현재 선택된 조합 표시 */}
          {cameFromScan && selectedColumns.x && selectedColumns.y && (
            <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center justify-center text-purple-800">
                <Scan className="h-4 w-4 mr-2" />
                <span className="text-sm font-medium">
                  스캔 결과에서 선택됨: {selectedColumns.x.label} × {selectedColumns.y.label}
                </span>
              </div>
            </div>
          )}
        </header>
        
        {/* 채팅 모드 */}
        {mode === 'chat' && (
          <div className="h-[600px]">
            <ChatInterface />
          </div>
        )}

        {/* 분석 모드들 */}
        {mode !== 'chat' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <FileUpload onDataLoad={handleDataLoad} />
              </div>
              <div className="lg:col-span-2">
                {data && (
                  <DataViewer
                    data={data}
                    selectedColumns={selectedColumns}
                    onColumnSelect={setSelectedColumns}
                  />
                )}
              </div>
            </div>

            {/* 기본 분석 모드 */}
            {mode === 'analysis' && data && selectedColumns.x && selectedColumns.y && (
              <div className="mt-6">
                <AnalysisPanel
                  data={data}
                  selectedColumns={selectedColumns}
                />
              </div>
            )}

            {/* 스캔 모드 */}
            {mode === 'scan' && data && (
              <div className="mt-6">
                <ScanMode
                  data={data}
                  onResultSelect={handleScanResultSelect}
                  selectedTypeColumn={selectedColumns.selectedTypeColumn}
                  scanResults={scanResults}
                  scanSummary={scanSummary}
                  onScanComplete={handleScanComplete}
                  onStartNewScan={handleStartNewScan}
                  onDataUpdate={handleDataUpdate}
                  onModeChange={handleModeChange}
                />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
} 