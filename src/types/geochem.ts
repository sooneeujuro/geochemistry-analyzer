export interface GeochemData {
  data: Record<string, any>[]
  numericColumns: string[]
  nonNumericColumns: string[]
  fileName: string
  typeColumn?: string  // 타입 컬럼 (선택사항)
  metadata?: Record<string, any>  // 메타데이터 (선택사항)
  pcaResult?: PCAResult  // PCA 분석 결과 (선택사항)
  datasetId?: string  // Supabase 데이터셋 ID (클라우드 저장 시)
}

export interface StatisticalResult {
  pearsonCorr?: number
  pearsonP?: number
  spearmanCorr?: number
  spearmanP?: number
  kendallCorr?: number
  kendallP?: number
  rSquared?: number
  linearSlope?: number
  linearIntercept?: number
  error?: string
}

export interface AnalysisOptions {
  statMethods: ('pearson' | 'spearman' | 'kendall')[]
  threshold: number
  pThreshold: number
}

export interface AxisConfig {
  type: 'single' | 'ratio'
  numerator: string
  denominator?: string
  label: string
}

export interface ColumnSelection {
  x: AxisConfig | null
  y: AxisConfig | null
  useTypeColumn: boolean
  selectedTypeColumn?: string
}

export interface ChartStyleOptions {
  numberFormat: 'normal' | 'scientific' | 'comma'
  fontFamily: 'Arial' | 'Times New Roman' | 'Helvetica' | 'Georgia'
  axisTitleBold: boolean
  axisNumberSize: number
  axisTitleSize: number
}

export interface AxisRange {
  auto: boolean
  min: number
  max: number
}

export interface PlotStyleOptions {
  size: number
  shape: 'circle' | 'triangle' | 'square' | 'diamond'
  opacity: number
  strokeWidth: number
  strokeColor: string
  useCustomColors: boolean
  customColors: string[]
}

export interface ScanResult {
  id: string
  xColumn: string
  yColumn: string
  xLabel: string
  yLabel: string
  statistics: StatisticalResult
  isSignificant: boolean
  chartData: Array<{ x: number, y: number, type: string }>
  dataCount: number
  aiRecommended?: boolean
  aiReason?: string
  aiConfidence?: number
}

export interface ScanOptions {
  statMethods: ('pearson' | 'spearman' | 'kendall')[]
  threshold: number
  pThreshold: number
  excludeColumns: string[]
  includeTypeColumn: boolean
  selectedTypeColumn?: string
  useAIRecommendations?: boolean
  aiProvider?: 'openai' | 'google'
  sampleDescription?: string
  aiRecommendationsOnly?: boolean
}

export interface ScanSummary {
  totalCombinations: number
  significantCombinations: number
  topResults: ScanResult[]
  executionTime: number
  fileName: string
  scanOptions: ScanOptions
  aiRecommendationsUsed?: boolean
  aiRecommendationsCount?: number
}

export interface PCAResult {
  scores: number[][]  // PC scores for each observation
  loadings: number[][]  // PC loadings for each variable
  explainedVariance: number[]  // Explained variance for each PC
  cumulativeVariance: number[]  // Cumulative explained variance
  eigenvalues: number[]  // Eigenvalues
  variableNames: string[]  // Names of original variables
  nComponents: number  // Number of components
  clusters: number[]  // Cluster assignments for each observation
}

export interface PCASuggestion {
  variables: string[]
  reason: string
  expectedVariance: number
  correlation: number
  confidence: number
}

// 레퍼런스 이미지 타입
export interface ReferenceImage {
  id: string
  name: string
  imageData: string // base64
  naturalWidth: number
  naturalHeight: number
  cropX: number
  cropY: number
  cropWidth: number
  cropHeight: number
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  opacity: number
  visible: boolean
}

// 축 범위 타입
export interface CustomAxisRange {
  xMin: number | 'auto'
  xMax: number | 'auto'
  yMin: number | 'auto'
  yMax: number | 'auto'
}

// 추세선 스타일
export interface TrendlineStyle {
  color: string
  strokeWidth: number
  opacity: number
}

// 오차바 설정
export interface ErrorBarSettings {
  enabled: boolean
  mode: 'column' | 'percentage' | 'fixed' | 'stddev' | 'stderr'
  column: string
  value: number
}

// 전체 그래프 설정 타입
export interface GraphSettings {
  // 축 설정
  axisRange: CustomAxisRange
  xLogScale: boolean
  yLogScale: boolean
  xTickInterval: number | 'auto'
  yTickInterval: number | 'auto'
  invertXAxis: boolean
  invertYAxis: boolean
  maintain1to1Ratio: boolean
  chartAspectRatio: number | null

  // 스타일 옵션
  styleOptions: ChartStyleOptions
  plotOptions: PlotStyleOptions
  trendlineStyle: TrendlineStyle
  backgroundColor: string

  // 표시 옵션
  showGridlines: boolean
  show1to1Line: boolean
  showChartTitle: boolean
  chartTitle: string
  showDataLabels: boolean
  labelFontSize: number

  // 숫자 형식
  xNumberFormat: 'normal' | 'scientific' | 'comma'
  yNumberFormat: 'normal' | 'scientific' | 'comma'
  xExponentialFormat: 'standard' | 'superscript'
  yExponentialFormat: 'standard' | 'superscript'
  xDecimalPlaces: number
  yDecimalPlaces: number
  xAxisLabelOffset: number
  yAxisLabelOffset: number

  // 오차바
  xErrorBar: ErrorBarSettings
  yErrorBar: ErrorBarSettings

  // 추세선
  showOverallTrend: boolean
  showTypeTrends: Record<string, boolean>
  showAllTypeTrends: boolean

  // 가시성
  visibleTypes: Record<string, boolean>
  useVisibleDataRange: boolean

  // 레퍼런스 이미지
  referenceImages: ReferenceImage[]
}

// GPT 4o 대피소 관련 타입들
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

export interface ChatSession {
  id?: string // Supabase UUID
  session_id: string // User-defined session ID
  messages: ChatMessage[]
  created_at?: string
  updated_at?: string
}

// 다중 그래프 비교용 패널 축 범위
export interface MultiViewAxisRange {
  xMin?: number | 'auto'
  xMax?: number | 'auto'
  yMin?: number | 'auto'
  yMax?: number | 'auto'
}

// 다중 그래프 비교용 패널 타입
export interface MultiViewPanel {
  id: string
  xAxis: AxisConfig | null
  yAxis: AxisConfig | null
  axisRange?: MultiViewAxisRange
} 