export interface GeochemData {
  data: Record<string, any>[]
  numericColumns: string[]
  nonNumericColumns: string[]
  fileName: string
  typeColumn?: string  // 타입 컬럼 (선택사항)
  metadata?: Record<string, any>  // 메타데이터 (선택사항)
  pcaResult?: PCAResult  // PCA 분석 결과 (선택사항)
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
} 