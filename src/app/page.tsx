'use client'

import { useState } from 'react'
import FileUpload from '@/components/FileUpload'
import DataViewer from '@/components/DataViewer'
import AnalysisPanel from '@/components/AnalysisPanel'
import ScanMode from '@/components/ScanMode'
import AuthModal from '@/components/AuthModal'
import { useAuth } from '@/contexts/AuthContext'
import { GeochemData, ColumnSelection, ScanResult, ScanSummary } from '@/types/geochem'
import { BarChart3, Scan, ArrowLeft, BookOpen, User, LogOut } from 'lucide-react'
import Link from 'next/link'

export default function Home() {
  const { user, loading, signOut } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [data, setData] = useState<GeochemData | null>(null)
  const [selectedColumns, setSelectedColumns] = useState<ColumnSelection>({
    x: null,
    y: null,
    useTypeColumn: false,
    selectedTypeColumn: undefined
  })
  const [mode, setMode] = useState<'analysis' | 'scan'>('analysis')
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

  if (mode === 'scan' && data) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-8">
        <div className="max-w-7xl mx-auto">
          <header className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <button
                onClick={() => {
                  setMode('analysis')
                  setCameFromScan(false)
                }}
                className="flex items-center px-4 py-2 text-sm bg-white shadow-md rounded-lg hover:bg-gray-50 mr-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                기본 분석으로 돌아가기
              </button>
              <h1 className="text-4xl font-bold text-gray-800">
                스캔 모드: 전체 상관관계 분석
              </h1>
            </div>
            <p className="text-gray-600">
              모든 수치 컬럼 조합의 상관관계를 자동으로 분석하여 유의미한 패턴을 찾아드립니다
            </p>
          </header>
          
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
      </main>
    )
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
          
          {/* 상단 로그인 버튼 */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {loading ? (
              <div className="animate-pulse bg-gray-200 h-10 w-24 rounded-lg"></div>
            ) : user ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 bg-white px-3 py-2 rounded-lg shadow">
                  {user.email?.split('@')[0]}
                </span>
                <button
                  onClick={() => signOut()}
                  className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  title="로그아웃"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg shadow hover:shadow-md transition-all"
              >
                <User className="w-4 h-4" />
                <span className="font-medium">로그인</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-center gap-4 mb-2">
            <h1 className="text-4xl font-bold text-gray-800">
              지구화학 데이터 분석기
            </h1>
            <Link
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              title="새 탭에서 사용 가이드 열기"
            >
              <BookOpen className="w-5 h-5" />
              <span className="font-semibold">사용 가이드</span>
            </Link>
          </div>
          <p className="text-gray-600">
            Excel/CSV 파일을 업로드하여 지구화학 데이터를 분석하고 시각화하세요
          </p>
          <p className="text-sm text-gray-500 mt-2">
            ✨ 새 기능: 레퍼런스 이미지 오버레이 (OCR 자동 인식, 클립보드 지원)
          </p>
          
          {/* 모드 선택 버튼 */}
          <div className="flex justify-center mt-4 space-x-4">
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
        {data && selectedColumns.x && selectedColumns.y && (
          <div className="mt-6">
            <AnalysisPanel
              data={data}
              selectedColumns={selectedColumns}
            />
          </div>
        )}
      </div>

      {/* 로그인 모달 */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </main>
  )
} 