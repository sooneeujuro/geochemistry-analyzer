'use client'

import { useState, useEffect } from 'react'
import { Database, Trash2, Download, Eye, Calendar, Table2, Columns } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { listDatasets, deleteDataset, loadFullDataset, DatasetMeta } from '@/lib/supabase-data'
import { GeochemData } from '@/types/geochem'

interface MyDataPanelProps {
  onLoadData: (data: GeochemData) => void
}

export default function MyDataPanel({ onLoadData }: MyDataPanelProps) {
  const { user } = useAuth()
  const [datasets, setDatasets] = useState<DatasetMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadDatasetList()
    } else {
      setDatasets([])
      setLoading(false)
    }
  }, [user])

  const loadDatasetList = async () => {
    setLoading(true)
    try {
      const list = await listDatasets()
      setDatasets(list)
    } catch (err) {
      setError('데이터 목록 로드 실패')
    } finally {
      setLoading(false)
    }
  }

  const handleLoad = async (dataset: DatasetMeta) => {
    setLoadingId(dataset.id)
    setError(null)

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

      onLoadData(geochemData)
    } catch (err) {
      setError('데이터 로드 실패')
    } finally {
      setLoadingId(null)
    }
  }

  const handleDelete = async (id: string, fileName: string) => {
    if (!confirm(`"${fileName}"을(를) 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return

    const success = await deleteDataset(id)
    if (success) {
      loadDatasetList()
    } else {
      setError('삭제 실패')
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString('ko-KR')
  }

  if (!user) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <Database className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-700 mb-2">로그인이 필요합니다</h3>
        <p className="text-gray-500">내 데이터를 관리하려면 로그인해주세요.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* 헤더 */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center">
          <Database className="h-5 w-5 mr-2 text-indigo-500" />
          내 데이터
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          업로드한 데이터셋을 관리하고 빠르게 불러오세요
        </p>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 데이터 목록 */}
      <div className="p-6">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
            <p className="text-gray-500 mt-2">로딩 중...</p>
          </div>
        ) : datasets.length === 0 ? (
          <div className="text-center py-8">
            <Database className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">저장된 데이터가 없습니다</p>
            <p className="text-sm text-gray-400 mt-1">
              파일을 업로드하면 자동으로 저장됩니다
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    파일명
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">
                    <div className="flex items-center justify-center gap-1">
                      <Table2 className="h-4 w-4" />
                      행 수
                    </div>
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">
                    <div className="flex items-center justify-center gap-1">
                      <Columns className="h-4 w-4" />
                      컬럼
                    </div>
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">
                    <div className="flex items-center justify-center gap-1">
                      <Calendar className="h-4 w-4" />
                      저장일
                    </div>
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((dataset) => (
                  <tr
                    key={dataset.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <div className="font-medium text-gray-800 truncate max-w-xs" title={dataset.file_name}>
                        {dataset.file_name}
                      </div>
                      {dataset.type_column && (
                        <div className="text-xs text-gray-400 mt-1">
                          타입 컬럼: {dataset.type_column}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="text-gray-700 font-medium">
                        {formatNumber(dataset.row_count)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-blue-600 font-medium" title="수치형 컬럼">
                          {dataset.numeric_columns.length}
                        </span>
                        <span className="text-gray-400">/</span>
                        <span className="text-purple-600 font-medium" title="전체 컬럼">
                          {dataset.columns.length}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center text-sm text-gray-500">
                      {formatDate(dataset.created_at)}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleLoad(dataset)}
                          disabled={loadingId === dataset.id}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
                        >
                          {loadingId === dataset.id ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-700"></div>
                              로딩...
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4" />
                              열기
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(dataset.id, dataset.file_name)}
                          className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 요약 */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
              <span>총 {datasets.length}개 데이터셋</span>
              <span>
                전체 {formatNumber(datasets.reduce((sum, d) => sum + d.row_count, 0))}행
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
