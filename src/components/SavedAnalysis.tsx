'use client'

import { useState, useEffect } from 'react'
import { Star, Play, Trash2, Share2, Copy, Check, Lock, Globe, Plus, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  listAnalysisSettings,
  deleteAnalysisSettings,
  saveAnalysisSettings,
  loadFullDataset,
  loadDatasetMeta,
  AnalysisSettings
} from '@/lib/supabase-data'
import { supabase } from '@/lib/supabase'
import { GeochemData, ColumnSelection, GraphSettings } from '@/types/geochem'

interface SavedAnalysisProps {
  currentData: GeochemData | null
  currentSettings: ColumnSelection
  onLoadAnalysis: (data: GeochemData, settings: ColumnSelection, graphSettings?: Partial<GraphSettings>) => void
}

export default function SavedAnalysis({
  currentData,
  currentSettings,
  onLoadAnalysis
}: SavedAnalysisProps) {
  const { user } = useAuth()
  const [savedList, setSavedList] = useState<(AnalysisSettings & { is_public?: boolean; share_id?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadSavedList()
    } else {
      setSavedList([])
      setLoading(false)
    }
  }, [user])

  const loadSavedList = async () => {
    setLoading(true)
    try {
      const list = await listAnalysisSettings()

      // 공유 정보도 함께 가져오기
      const { data: fullData } = await supabase
        .from('user_analysis_settings')
        .select('id, is_public, share_id')
        .in('id', list.map(l => l.id))

      const enrichedList = list.map(item => {
        const extra = fullData?.find(d => d.id === item.id)
        return {
          ...item,
          is_public: extra?.is_public || false,
          share_id: extra?.share_id || null
        }
      })

      setSavedList(enrichedList)
    } catch (err) {
      setError('목록 로드 실패')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!saveName.trim()) {
      setError('이름을 입력해주세요')
      return
    }
    if (!currentData) {
      setError('저장할 데이터가 없습니다')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // 현재 데이터의 dataset_id 찾기 (있으면)
      const result = await saveAnalysisSettings({
        name: saveName.trim(),
        settings: {
          selectedColumns: currentSettings,
          dataFileName: currentData.fileName
        }
      })

      if (result.success) {
        setSaveName('')
        setShowSaveModal(false)
        loadSavedList()
      } else {
        setError(result.error || '저장 실패')
      }
    } catch (err) {
      setError('저장 중 오류 발생')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 분석 설정을 삭제하시겠습니까?')) return

    const success = await deleteAnalysisSettings(id)
    if (success) {
      loadSavedList()
    } else {
      setError('삭제 실패')
    }
  }

  const handleLoad = async (item: AnalysisSettings) => {
    try {
      // 설정에서 데이터 파일명이 있으면 해당 데이터도 로드 시도
      const settings = item.settings as any
      const graphSettings = settings.graphSettings as Partial<GraphSettings> | undefined

      if (item.dataset_id) {
        // dataset_id가 있으면 해당 데이터셋 로드
        const meta = await loadDatasetMeta(item.dataset_id)
        if (meta) {
          const rows = await loadFullDataset(item.dataset_id)
          const geochemData: GeochemData = {
            data: rows,
            numericColumns: meta.numeric_columns,
            nonNumericColumns: meta.non_numeric_columns,
            fileName: meta.file_name,
            typeColumn: meta.type_column,
            datasetId: item.dataset_id,
            metadata: {
              fileName: meta.file_name,
              rowCount: meta.row_count,
              columnCount: meta.columns.length
            }
          }
          onLoadAnalysis(geochemData, settings.selectedColumns, graphSettings)
          return
        }
      }

      // 데이터 없이 설정만 적용 (현재 데이터 유지)
      if (currentData) {
        onLoadAnalysis(currentData, settings.selectedColumns, graphSettings)
      } else {
        setError('먼저 데이터를 업로드해주세요')
      }
    } catch (err) {
      setError('분석 로드 실패')
    }
  }

  const handleToggleShare = async (item: AnalysisSettings & { is_public?: boolean; share_id?: string }) => {
    const newIsPublic = !item.is_public
    const newShareId = newIsPublic && !item.share_id
      ? Math.random().toString(36).substring(2, 10)
      : item.share_id

    const { error } = await supabase
      .from('user_analysis_settings')
      .update({
        is_public: newIsPublic,
        share_id: newShareId
      })
      .eq('id', item.id)

    if (!error) {
      loadSavedList()
    }
  }

  const handleCopyLink = async (shareId: string) => {
    const url = `${window.location.origin}?shared=${shareId}`
    await navigator.clipboard.writeText(url)
    setCopiedId(shareId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!user) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <Star className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-700 mb-2">로그인이 필요합니다</h3>
        <p className="text-gray-500">분석 설정을 저장하고 불러오려면 로그인해주세요.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* 헤더 */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
              <Star className="h-5 w-5 mr-2 text-yellow-500" />
              저장된 분석
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              자주 사용하는 분석 설정을 저장하고 빠르게 불러오세요
            </p>
          </div>
          <button
            onClick={() => setShowSaveModal(true)}
            disabled={!currentData || !currentSettings.x || !currentSettings.y}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="h-4 w-4" />
            현재 분석 저장
          </button>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 목록 */}
      <div className="p-6">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-gray-500 mt-2">로딩 중...</p>
          </div>
        ) : savedList.length === 0 ? (
          <div className="text-center py-8">
            <Star className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">저장된 분석이 없습니다</p>
            <p className="text-sm text-gray-400 mt-1">
              분석 설정 후 "현재 분석 저장" 버튼을 눌러 저장하세요
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {savedList.map((item) => (
              <div
                key={item.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-800 truncate">
                        {item.name}
                      </h3>
                      {item.is_public ? (
                        <span className="flex items-center text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                          <Globe className="h-3 w-3 mr-1" />
                          공유중
                        </span>
                      ) : (
                        <span className="flex items-center text-xs text-gray-500">
                          <Lock className="h-3 w-3 mr-1" />
                          비공개
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {(item.settings as any)?.selectedColumns?.x?.label || '?'} × {(item.settings as any)?.selectedColumns?.y?.label || '?'}
                      {(item.settings as any)?.dataFileName && (
                        <span className="ml-2 text-gray-400">
                          · {(item.settings as any).dataFileName}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDate(item.updated_at || item.created_at)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {/* 공유 토글 */}
                    <button
                      onClick={() => handleToggleShare(item)}
                      className={`p-2 rounded-lg transition-colors ${
                        item.is_public
                          ? 'text-green-600 bg-green-100 hover:bg-green-200'
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                      }`}
                      title={item.is_public ? '공유 해제' : '공유하기'}
                    >
                      <Share2 className="h-4 w-4" />
                    </button>

                    {/* 링크 복사 (공유중일 때만) */}
                    {item.is_public && item.share_id && (
                      <button
                        onClick={() => handleCopyLink(item.share_id!)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        title="링크 복사"
                      >
                        {copiedId === item.share_id ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    )}

                    {/* 실행 */}
                    <button
                      onClick={() => handleLoad(item)}
                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                      title="이 분석 열기"
                    >
                      <Play className="h-4 w-4" />
                    </button>

                    {/* 삭제 */}
                    <button
                      onClick={() => handleDelete(item.id!)}
                      className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 저장 모달 */}
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
                className="text-white hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
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
                <p className="text-gray-600">
                  <strong>저장될 정보:</strong>
                </p>
                <ul className="mt-2 space-y-1 text-gray-500">
                  <li>• X축: {currentSettings.x?.label || '미선택'}</li>
                  <li>• Y축: {currentSettings.y?.label || '미선택'}</li>
                  <li>• 데이터: {currentData?.fileName || '없음'}</li>
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
                  onClick={handleSave}
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
    </div>
  )
}
