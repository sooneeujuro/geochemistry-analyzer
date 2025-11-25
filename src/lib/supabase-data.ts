import { supabase } from './supabase'
import { GeochemData } from '@/types/geochem'

// 데이터셋 저장 결과 타입
export interface SaveDatasetResult {
  success: boolean
  datasetId?: string
  error?: string
}

// 페이지네이션 결과 타입
export interface PaginatedDataResult {
  rows: Record<string, any>[]
  totalCount: number
  currentPage: number
  totalPages: number
  hasMore: boolean
}

// 데이터셋 메타 정보 타입
export interface DatasetMeta {
  id: string
  file_name: string
  created_at: string
  row_count: number
  columns: string[]
  numeric_columns: string[]
  non_numeric_columns: string[]
  type_column?: string
}

/**
 * 지구화학 데이터를 Supabase에 저장
 * - 메타데이터는 geochem_datasets 테이블에
 * - 각 행은 geochem_data_rows 테이블에 개별 저장
 */
export async function saveDatasetToSupabase(
  data: GeochemData
): Promise<SaveDatasetResult> {
  try {
    // 1. 메타데이터 저장
    const { data: dataset, error: metaError } = await supabase
      .from('geochem_datasets')
      .insert({
        file_name: data.fileName,
        row_count: data.data.length,
        columns: [...data.numericColumns, ...data.nonNumericColumns],
        numeric_columns: data.numericColumns,
        non_numeric_columns: data.nonNumericColumns,
        type_column: data.typeColumn || null
      })
      .select('id')
      .single()

    if (metaError) {
      throw new Error(`메타데이터 저장 실패: ${metaError.message}`)
    }

    const datasetId = dataset.id

    // 2. 데이터 행들을 배치로 저장 (500행씩)
    const BATCH_SIZE = 500
    const totalRows = data.data.length

    for (let i = 0; i < totalRows; i += BATCH_SIZE) {
      const batch = data.data.slice(i, i + BATCH_SIZE).map((row, index) => ({
        dataset_id: datasetId,
        row_index: i + index,
        data: row
      }))

      const { error: rowError } = await supabase
        .from('geochem_data_rows')
        .insert(batch)

      if (rowError) {
        // 실패 시 전체 롤백 (메타데이터도 삭제)
        await supabase.from('geochem_datasets').delete().eq('id', datasetId)
        throw new Error(`데이터 저장 실패 (행 ${i}~${i + batch.length}): ${rowError.message}`)
      }
    }

    return { success: true, datasetId }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }
  }
}

/**
 * 페이지네이션된 데이터 로드
 */
export async function loadPaginatedData(
  datasetId: string,
  page: number = 1,
  pageSize: number = 100
): Promise<PaginatedDataResult> {
  const offset = (page - 1) * pageSize

  // 데이터 행 가져오기
  const { data: rows, error } = await supabase
    .from('geochem_data_rows')
    .select('data')
    .eq('dataset_id', datasetId)
    .order('row_index', { ascending: true })
    .range(offset, offset + pageSize - 1)

  if (error) {
    throw new Error(`데이터 로드 실패: ${error.message}`)
  }

  // 총 행 수 가져오기
  const { count, error: countError } = await supabase
    .from('geochem_data_rows')
    .select('*', { count: 'exact', head: true })
    .eq('dataset_id', datasetId)

  if (countError) {
    throw new Error(`행 수 조회 실패: ${countError.message}`)
  }

  const totalCount = count || 0
  const totalPages = Math.ceil(totalCount / pageSize)

  return {
    rows: rows?.map(r => r.data) || [],
    totalCount,
    currentPage: page,
    totalPages,
    hasMore: page < totalPages
  }
}

/**
 * 데이터셋 메타정보 로드
 */
export async function loadDatasetMeta(datasetId: string): Promise<DatasetMeta | null> {
  const { data, error } = await supabase
    .from('geochem_datasets')
    .select('*')
    .eq('id', datasetId)
    .single()

  if (error || !data) {
    return null
  }

  return {
    id: data.id,
    file_name: data.file_name,
    created_at: data.created_at,
    row_count: data.row_count,
    columns: data.columns || [],
    numeric_columns: data.numeric_columns || [],
    non_numeric_columns: data.non_numeric_columns || [],
    type_column: data.type_column
  }
}

/**
 * 저장된 모든 데이터셋 목록 가져오기
 */
export async function listDatasets(): Promise<DatasetMeta[]> {
  const { data, error } = await supabase
    .from('geochem_datasets')
    .select('*')
    .order('created_at', { ascending: false })

  if (error || !data) {
    return []
  }

  return data.map(d => ({
    id: d.id,
    file_name: d.file_name,
    created_at: d.created_at,
    row_count: d.row_count,
    columns: d.columns || [],
    numeric_columns: d.numeric_columns || [],
    non_numeric_columns: d.non_numeric_columns || [],
    type_column: d.type_column
  }))
}

/**
 * 데이터셋 삭제 (CASCADE로 행들도 자동 삭제)
 */
export async function deleteDataset(datasetId: string): Promise<boolean> {
  const { error } = await supabase
    .from('geochem_datasets')
    .delete()
    .eq('id', datasetId)

  return !error
}

/**
 * 전체 데이터 로드 (분석용 - 작은 데이터셋에만 사용)
 */
export async function loadFullDataset(datasetId: string): Promise<Record<string, any>[]> {
  const { data, error } = await supabase
    .from('geochem_data_rows')
    .select('data')
    .eq('dataset_id', datasetId)
    .order('row_index', { ascending: true })

  if (error) {
    throw new Error(`전체 데이터 로드 실패: ${error.message}`)
  }

  return data?.map(r => r.data) || []
}
