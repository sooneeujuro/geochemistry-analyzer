export interface GeochemData {
  data: Record<string, any>[]
  columns: string[]
  numericColumns: string[]
  typeColumn?: string
  metadata: {
    fileName: string
    rowCount: number
    columnCount: number
  }
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