'use client'

import { useState, useEffect, Suspense } from 'react'
import FileUpload from '@/components/FileUpload'
import DataViewer from '@/components/DataViewer'
import AnalysisPanel from '@/components/AnalysisPanel'
import ScanMode from '@/components/ScanMode'
import SmartInsight from '@/components/SmartInsight'
import SavedAnalysis from '@/components/SavedAnalysis'
import MyDataPanel from '@/components/MyDataPanel'
import AuthModal from '@/components/AuthModal'
import { useAuth } from '@/contexts/AuthContext'
import { GeochemData, ColumnSelection, ScanResult, ScanSummary, GraphSettings } from '@/types/geochem'
import { SmartInsightResult } from '@/lib/smart-insight'
import { saveAnalysisSettings, loadSharedAnalysis, loadDatasetMeta, loadFullDataset } from '@/lib/supabase-data'
import { useSearchParams } from 'next/navigation'
import { BarChart3, Scan, ArrowLeft, BookOpen, User, LogOut, Star, Database, Sparkles } from 'lucide-react'
import Link from 'next/link'

type Mode = 'analysis' | 'scan' | 'smartinsight' | 'saved' | 'mydata'

function HomeContent() {
  const { user, loading, signOut } = useAuth()
  const searchParams = useSearchParams()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [data, setData] = useState<GeochemData | null>(null)
  const [selectedColumns, setSelectedColumns] = useState<ColumnSelection>({
    x: null,
    y: null,
    useTypeColumn: false,
    selectedTypeColumn: undefined
  })
  const [mode, setMode] = useState<Mode>('analysis')
  const [cameFromScan, setCameFromScan] = useState(false)
  const [cameFromSmartInsight, setCameFromSmartInsight] = useState(false)
  const [scanResults, setScanResults] = useState<ScanResult[]>([])
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null)
  const [smartInsightResult, setSmartInsightResult] = useState<SmartInsightResult | null>(null)
  const [graphSettings, setGraphSettings] = useState<GraphSettings | undefined>(undefined)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loadingShared, setLoadingShared] = useState(false)
  const [sharedError, setSharedError] = useState<string | null>(null)

  // URL에 shared 파라미터가 있으면 공유된 분석 불러오기
  useEffect(() => {
    const sharedId = searchParams.get('shared')
    if (sharedId && !data) {
      loadSharedData(sharedId)
    }
  }, [searchParams])

  const loadSharedData = async (shareId: string) => {
    setLoadingShared(true)
    setSharedError(null)

    try {
      const analysis = await loadSharedAnalysis(shareId)
      if (!analysis) {
        setSharedError('공유된 분석을 찾을 수 없거나 비공개 상태입니다.')
        return
      }

      const settings = analysis.settings as any

      // 데이터셋이 있으면 로드
      if (analysis.dataset_id) {
        const meta = await loadDatasetMeta(analysis.dataset_id)
        if (meta) {
          const rows = await loadFullDataset(analysis.dataset_id)
          const geochemData: GeochemData = {
            data: rows,
            numericColumns: meta.numeric_columns,
            nonNumericColumns: meta.non_numeric_columns,
            fileName: meta.file_name,
            typeColumn: meta.type_column,
            datasetId: analysis.dataset_id,
            metadata: {
              fileName: meta.file_name,
              rowCount: meta.row_count,
              columnCount: meta.columns.length
            }
          }
          setData(geochemData)
          setSelectedColumns(settings.selectedColumns)
          if (settings.graphSettings) {
            setGraphSettings(settings.graphSettings as GraphSettings)
          }
          setMode('analysis')
        } else {
          setSharedError('공유된 분석의 데이터셋을 찾을 수 없습니다.')
        }
      } else {
        setSharedError('공유된 분석에 연결된 데이터가 없습니다.')
      }
    } catch (err) {
      setSharedError('공유된 분석 로드 중 오류가 발생했습니다.')
    } finally {
      setLoadingShared(false)
    }
  }

  const handleDataLoad = (newData: GeochemData) => {
    setData(newData)
    // 새 데이터 로드 시 스캔 결과 초기화
    setScanResults([])
    setScanSummary(null)
    setSmartInsightResult(null)
    setCameFromScan(false)
    setCameFromSmartInsight(false)
    setMode('analysis')

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

  // 저장된 분석 로드
  const handleLoadAnalysis = (loadedData: GeochemData, loadedSettings: ColumnSelection, loadedGraphSettings?: Partial<GraphSettings>) => {
    setData(loadedData)
    setSelectedColumns(loadedSettings)
    if (loadedGraphSettings) {
      setGraphSettings(loadedGraphSettings as GraphSettings)
    }
    setMode('analysis')
  }

  // 현재 분석 저장 (플롯 옆 버튼에서 호출)
  const handleSaveAnalysis = async () => {
    if (!user) {
      setShowAuthModal(true)
      return
    }
    setShowSaveModal(true)
    setSaveName('')
    setSaveError(null)
  }

  // 실제 저장 처리
  const handleConfirmSave = async () => {
    if (!saveName.trim()) {
      setSaveError('이름을 입력해주세요')
      return
    }
    if (!data) {
      setSaveError('저장할 데이터가 없습니다')
      return
    }

    setSaving(true)
    setSaveError(null)

    try {
      const result = await saveAnalysisSettings({
        name: saveName.trim(),
        dataset_id: data.datasetId,
        settings: {
          selectedColumns,
          dataFileName: data.fileName,
          graphSettings: graphSettings
        }
      })

      if (result.success) {
        setShowSaveModal(false)
        setSaveName('')
        alert('분석이 저장되었습니다!')
      } else {
        setSaveError(result.error || '저장 실패')
      }
    } catch (err) {
      setSaveError('저장 중 오류 발생')
    } finally {
      setSaving(false)
    }
  }

  // 스캔 모드 렌더링
  if (mode === 'scan' && data) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-8">
        <div className="max-w-7xl mx-auto">
          <header className="text-center mb-8 relative">
            {/* 상단 로그인 버튼 */}
            <div className="absolute top-0 right-0 flex items-center gap-2">
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
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8 relative">
          {/* 공유 링크 로딩 중 */}
          {loadingShared && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span className="text-blue-700">공유된 분석을 불러오는 중...</span>
              </div>
            </div>
          )}

          {/* 공유 링크 에러 */}
          {sharedError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-center">{sharedError}</p>
              <button
                onClick={() => setSharedError(null)}
                className="mt-2 mx-auto block text-sm text-red-600 hover:underline"
              >
                닫기
              </button>
            </div>
          )}

          {/* 스캔/Smart Insight에서 온 경우 돌아가기 버튼 */}
          {(cameFromScan || cameFromSmartInsight) && (
            <div className="flex justify-center mb-6">
              <button
                onClick={() => {
                  if (cameFromSmartInsight) {
                    setMode('smartinsight')
                    setCameFromSmartInsight(false)
                  } else {
                    setMode('scan')
                    setCameFromScan(false)
                  }
                }}
                className="flex items-center px-6 py-3 text-base font-medium rounded-lg transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                style={{
                  backgroundColor: cameFromSmartInsight ? '#9333ea' : '#E4815A',
                  color: 'white'
                }}
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                {cameFromSmartInsight ? 'Smart Insight로 돌아가기' : '스캔 결과로 돌아가기'}
              </button>
            </div>
          )}

          {/* 상단 로그인 버튼 */}
          <div className="absolute top-0 right-0 flex items-center gap-2">
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

          {/* 모드 선택 탭 */}
          <div className="flex justify-center mt-6 space-x-2">
            <button
              onClick={() => setMode('analysis')}
              className={`flex items-center px-5 py-2.5 rounded-lg font-medium transition-all ${
                mode === 'analysis'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 shadow hover:shadow-md'
              }`}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              기본 분석
            </button>
            <button
              onClick={() => setMode('scan')}
              disabled={!data}
              className={`flex items-center px-5 py-2.5 rounded-lg font-medium transition-all ${
                mode === 'scan'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 shadow hover:shadow-md'
              } ${!data ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Scan className="h-4 w-4 mr-2" />
              스캔 모드
            </button>
            <button
              onClick={() => setMode('smartinsight')}
              disabled={!data}
              className={`flex items-center px-5 py-2.5 rounded-lg font-medium transition-all ${
                mode === 'smartinsight'
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 shadow hover:shadow-md'
              } ${!data ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              AI Smart Insight
            </button>
            <button
              onClick={() => setMode('saved')}
              className={`flex items-center px-5 py-2.5 rounded-lg font-medium transition-all ${
                mode === 'saved'
                  ? 'bg-yellow-500 text-white shadow-lg'
                  : 'bg-white text-gray-700 shadow hover:shadow-md'
              }`}
            >
              <Star className="h-4 w-4 mr-2" />
              저장된 분석
            </button>
            <button
              onClick={() => setMode('mydata')}
              className={`flex items-center px-5 py-2.5 rounded-lg font-medium transition-all ${
                mode === 'mydata'
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 shadow hover:shadow-md'
              }`}
            >
              <Database className="h-4 w-4 mr-2" />
              내 데이터
            </button>
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

        {/* AI Smart Insight 모드 */}
        {mode === 'smartinsight' && data && (
          <SmartInsight
            data={data}
            onSelectPair={(xColumn, yColumn) => {
              setSelectedColumns({
                x: { type: 'single', numerator: xColumn, label: xColumn },
                y: { type: 'single', numerator: yColumn, label: yColumn },
                useTypeColumn: selectedColumns.useTypeColumn,
                selectedTypeColumn: selectedColumns.selectedTypeColumn
              })
              setCameFromSmartInsight(true)
              setCameFromScan(false)
              setMode('analysis')
            }}
            onDataUpdate={handleDataUpdate}
            onModeChange={(newMode) => {
              setCameFromSmartInsight(true)
              setCameFromScan(false)
              setMode(newMode)
            }}
            selectedTypeColumn={selectedColumns.selectedTypeColumn}
            cachedResult={smartInsightResult}
            onResultChange={setSmartInsightResult}
          />
        )}

        {/* 저장된 분석 모드 */}
        {mode === 'saved' && (
          <SavedAnalysis
            currentData={data}
            currentSettings={selectedColumns}
            onLoadAnalysis={handleLoadAnalysis}
          />
        )}

        {/* 내 데이터 모드 */}
        {mode === 'mydata' && (
          <MyDataPanel onLoadData={handleDataLoad} />
        )}

        {/* 기본 분석 모드 */}
        {mode === 'analysis' && (
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
            {data && selectedColumns.x && selectedColumns.y && (
              <div className="mt-6">
                <AnalysisPanel
                  data={data}
                  selectedColumns={selectedColumns}
                  graphSettings={graphSettings}
                  onGraphSettingsChange={setGraphSettings}
                  onSaveAnalysis={handleSaveAnalysis}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* 로그인 모달 */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

      {/* 분석 저장 모달 */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center">
                <Star className="h-5 w-5 mr-2" />
                분석 저장
              </h3>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-white hover:text-gray-200 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {saveError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {saveError}
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  분석 이름
                </label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="예: SiO2 vs MgO 상관분석"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  autoFocus
                />
              </div>

              <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
                <p className="text-gray-600 font-medium mb-2">저장될 정보:</p>
                <ul className="space-y-1 text-gray-500">
                  <li>• X축: {selectedColumns.x?.label || '미선택'}</li>
                  <li>• Y축: {selectedColumns.y?.label || '미선택'}</li>
                  <li>• 데이터: {data?.fileName || '없음'}</li>
                  <li>• 그래프 설정: {graphSettings ? '포함' : '기본값'}</li>
                  {graphSettings?.referenceImages && graphSettings.referenceImages.length > 0 && (
                    <li>• 레퍼런스 이미지: {graphSettings.referenceImages.length}개</li>
                  )}
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleConfirmSave}
                  disabled={saving || !saveName.trim()}
                  className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}
