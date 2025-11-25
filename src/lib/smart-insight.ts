'use client'

import * as ss from 'simple-statistics'
import { GeochemData, StatisticalResult } from '@/types/geochem'

// 순위 계산 함수
function getRanks(data: number[]): number[] {
  const sorted = [...data]
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value)

  const ranks = new Array(data.length)

  for (let i = 0; i < sorted.length; i++) {
    ranks[sorted[i].index] = i + 1
  }

  return ranks
}

// p-값 간단 계산 (t-분포 근사)
function calculatePValue(t: number, df: number): number {
  if (!isFinite(t) || isNaN(t)) return 1

  const absT = Math.abs(t)
  // 간단한 근사: 큰 t값은 작은 p값
  const x = df / (df + absT * absT)

  // 간단한 베타 함수 근사
  if (absT > 10) return 0.0001
  if (absT > 5) return 0.001
  if (absT > 3) return 0.01
  if (absT > 2) return 0.05
  if (absT > 1.5) return 0.1
  return 0.5
}

// Smart Insight 결과 타입들
export interface InsightCandidate {
  id: string
  xColumn: string
  yColumn: string
  xLabel: string
  yLabel: string
  pearsonCorr: number
  spearmanCorr: number
  pearsonP: number
  spearmanP: number
  rSquared: number
  dataCount: number
  tags: InsightTag[]
  priority: number // 높을수록 흥미로운 관계
  statistics: StatisticalResult
  chartData: Array<{ x: number; y: number; type: string }>
}

export type InsightTag =
  | 'non-linear'      // 비선형 관계
  | 'strong-positive' // 강한 양의 상관
  | 'strong-negative' // 강한 음의 상관
  | 'moderate'        // 중간 상관
  | 'duplicate'       // 중복 의심 (r > 0.99)
  | 'pca-recommend'   // PCA 추천
  | 'log-scale'       // 로그 스케일 추천

export interface SmartInsightResult {
  candidates: InsightCandidate[]
  pcaRecommendations: PCARecommendation[]
  totalPairsAnalyzed: number
  filteredCount: number
  executionTime: number
}

export interface PCARecommendation {
  variable: string
  correlatedVariables: string[]
  avgCorrelation: number
  reason: string
}

export interface AIInterpretationRequest {
  xColumn: string
  yColumn: string
  correlation: number
  rSquared: number
  dataType?: string
  sampleDescription?: string
  tags: InsightTag[]
  statistics: StatisticalResult
}

// A. 무의미한 중복 제거
function isDuplicatePair(
  pearsonCorr: number,
  xColumn: string,
  yColumn: string
): boolean {
  // r > 0.99이면 중복 의심
  if (Math.abs(pearsonCorr) <= 0.99) return false

  // 변수명이 완전히 다른 경우는 제외하지 않음
  const xLower = xColumn.toLowerCase()
  const yLower = yColumn.toLowerCase()

  // 비슷한 이름 패턴 체크 (단위 변환 의심)
  const similarPatterns = [
    // 같은 원소의 다른 단위
    [/ppm$/i, /ppb$/i],
    [/mg\/l$/i, /g\/l$/i],
    [/wt%$/i, /mol%$/i],
    // 같은 접두사
    [/^total/i, /^sum/i],
  ]

  for (const [pattern1, pattern2] of similarPatterns) {
    if (
      (pattern1.test(xColumn) && pattern2.test(yColumn)) ||
      (pattern2.test(xColumn) && pattern1.test(yColumn))
    ) {
      return true
    }
  }

  // 이름이 90% 이상 겹치면 중복
  const commonLength = getCommonPrefixLength(xLower, yLower)
  const maxLength = Math.max(xLower.length, yLower.length)
  if (commonLength / maxLength > 0.9) return true

  return false
}

function getCommonPrefixLength(a: string, b: string): number {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) {
    i++
  }
  return i
}

// B. 비선형 관계 탐지
function detectNonLinearRelationship(
  pearsonCorr: number,
  spearmanCorr: number
): { isNonLinear: boolean; suggestLogScale: boolean } {
  const absPearson = Math.abs(pearsonCorr)
  const absSpearman = Math.abs(spearmanCorr)

  // 조건: |Spearman| > 0.7 이면서 |Spearman| - |Pearson| > 0.1
  const isNonLinear = absSpearman > 0.7 && (absSpearman - absPearson) > 0.1

  // 로그 스케일 추천: Spearman이 높고 Pearson이 낮은 경우
  const suggestLogScale = isNonLinear && absPearson < 0.6

  return { isNonLinear, suggestLogScale }
}

// C. PCA 추천 로직
function analyzePCARecommendations(
  correlationMatrix: Record<string, Record<string, number>>,
  threshold: number = 0.8,
  minCorrelatedVars: number = 10
): PCARecommendation[] {
  const recommendations: PCARecommendation[] = []
  const variables = Object.keys(correlationMatrix)

  for (const variable of variables) {
    const correlatedVars: string[] = []
    let totalCorr = 0

    for (const otherVar of variables) {
      if (variable === otherVar) continue

      const corr = Math.abs(correlationMatrix[variable][otherVar] || 0)
      if (corr >= threshold) {
        correlatedVars.push(otherVar)
        totalCorr += corr
      }
    }

    // 10개 이상의 변수와 높은 상관관계
    if (correlatedVars.length >= minCorrelatedVars) {
      const avgCorr = totalCorr / correlatedVars.length
      recommendations.push({
        variable,
        correlatedVariables: correlatedVars.slice(0, 10), // 상위 10개만
        avgCorrelation: avgCorr,
        reason: `${variable}이(가) ${correlatedVars.length}개 변수와 r > ${threshold} 상관관계를 보임. 개별 그래프 대신 PCA 분석을 권장합니다.`
      })
    }
  }

  // 평균 상관계수 기준 정렬
  return recommendations.sort((a, b) => b.avgCorrelation - a.avgCorrelation)
}

// 태그 생성 함수
function generateTags(
  pearsonCorr: number,
  spearmanCorr: number,
  isDuplicate: boolean,
  nonLinear: { isNonLinear: boolean; suggestLogScale: boolean }
): InsightTag[] {
  const tags: InsightTag[] = []
  const absCorr = Math.abs(pearsonCorr)

  if (isDuplicate) {
    tags.push('duplicate')
    return tags // 중복이면 다른 태그 불필요
  }

  if (nonLinear.isNonLinear) {
    tags.push('non-linear')
  }

  if (nonLinear.suggestLogScale) {
    tags.push('log-scale')
  }

  if (absCorr >= 0.8) {
    tags.push(pearsonCorr > 0 ? 'strong-positive' : 'strong-negative')
  } else if (absCorr >= 0.5) {
    tags.push('moderate')
  }

  return tags
}

// 우선순위 계산 (높을수록 흥미로움)
function calculatePriority(
  pearsonCorr: number,
  spearmanCorr: number,
  tags: InsightTag[],
  dataCount: number
): number {
  let priority = 0

  // 기본 점수: 상관계수 강도
  priority += Math.abs(pearsonCorr) * 30
  priority += Math.abs(spearmanCorr) * 30

  // 비선형 관계는 더 흥미로움
  if (tags.includes('non-linear')) {
    priority += 20
  }

  // 데이터 수가 많을수록 신뢰성 증가
  if (dataCount >= 100) priority += 10
  else if (dataCount >= 50) priority += 5

  // 중복은 우선순위 크게 감소
  if (tags.includes('duplicate')) {
    priority -= 50
  }

  return Math.max(0, priority)
}

// 메인 Smart Insight 분석 함수
export async function performSmartInsight(
  data: GeochemData,
  options: {
    correlationThreshold?: number
    pValueThreshold?: number
    maxResults?: number
    includeTypeColumn?: boolean
    selectedTypeColumn?: string
  } = {}
): Promise<SmartInsightResult> {
  const startTime = Date.now()

  const {
    correlationThreshold = 0.5,
    pValueThreshold = 0.05,
    maxResults = 20,
    includeTypeColumn = false,
    selectedTypeColumn
  } = options

  const candidates: InsightCandidate[] = []
  const correlationMatrix: Record<string, Record<string, number>> = {}

  const numericColumns = data.numericColumns
  let totalPairs = 0
  let skippedLowData = 0
  let skippedError = 0
  let skippedLowCorr = 0
  let skippedHighP = 0
  let skippedDuplicate = 0

  // 상관관계 매트릭스 초기화
  for (const col of numericColumns) {
    correlationMatrix[col] = {}
  }

  // 디버그: 데이터 구조 확인
  console.log('Smart Insight 데이터 구조:', {
    numericColumns: numericColumns.slice(0, 5),
    totalRows: data.data.length,
    sampleRow: data.data[0],
    sampleRowKeys: data.data[0] ? Object.keys(data.data[0]).slice(0, 10) : []
  })

  // 모든 변수 쌍 분석
  for (let i = 0; i < numericColumns.length; i++) {
    for (let j = i + 1; j < numericColumns.length; j++) {
      totalPairs++

      const xCol = numericColumns[i]
      const yCol = numericColumns[j]

      // 데이터 추출
      const pairs: { x: number; y: number; type: string }[] = []

      for (const row of data.data) {
        const xVal = row[xCol]
        const yVal = row[yCol]

        // 숫자 파싱 개선
        const x = typeof xVal === 'number' ? xVal : parseFloat(String(xVal))
        const y = typeof yVal === 'number' ? yVal : parseFloat(String(yVal))

        if (!isNaN(x) && !isNaN(y) && isFinite(x) && isFinite(y)) {
          const type = includeTypeColumn && selectedTypeColumn
            ? (row[selectedTypeColumn] || 'default')
            : 'default'
          pairs.push({ x, y, type })
        }
      }

      // 첫 번째 조합 디버깅
      if (totalPairs === 1) {
        console.log('첫 번째 조합 디버그:', {
          xCol,
          yCol,
          pairsFound: pairs.length,
          sampleXVal: data.data[0]?.[xCol],
          sampleYVal: data.data[0]?.[yCol]
        })
      }

      if (pairs.length < 10) {
        skippedLowData++
        continue
      }

      const xData = pairs.map(p => p.x)
      const yData = pairs.map(p => p.y)

      // 통계 계산 - simple-statistics 직접 사용
      let pearsonCorr = 0
      let spearmanCorr = 0
      let rSquared = 0

      try {
        pearsonCorr = ss.sampleCorrelation(xData, yData)

        // 스피어만: 순위로 변환 후 피어슨
        const xRanks = getRanks(xData)
        const yRanks = getRanks(yData)
        spearmanCorr = ss.sampleCorrelation(xRanks, yRanks)

        // R² 계산
        const regressionData = pairs.map(p => [p.x, p.y])
        const regression = ss.linearRegression(regressionData)
        const regressionLine = ss.linearRegressionLine(regression)
        rSquared = ss.rSquared(regressionData, regressionLine)
      } catch (e) {
        skippedError++
        continue
      }

      // NaN 체크
      if (isNaN(pearsonCorr) || isNaN(spearmanCorr)) {
        skippedError++
        continue
      }

      // p-값 근사 계산
      const n = xData.length
      const tPearson = pearsonCorr * Math.sqrt((n - 2) / (1 - pearsonCorr * pearsonCorr))
      const tSpearman = spearmanCorr * Math.sqrt((n - 2) / (1 - spearmanCorr * spearmanCorr))
      const pearsonP = calculatePValue(tPearson, n - 2)
      const spearmanP = calculatePValue(tSpearman, n - 2)

      // 상관관계 매트릭스 업데이트
      correlationMatrix[xCol][yCol] = pearsonCorr
      correlationMatrix[yCol][xCol] = pearsonCorr

      // 필터링 조건
      const absCorr = Math.abs(pearsonCorr)
      if (absCorr < correlationThreshold) {
        skippedLowCorr++
        continue
      }
      if (pearsonP > pValueThreshold && spearmanP > pValueThreshold) {
        skippedHighP++
        continue
      }

      // 중복 체크
      const isDuplicate = isDuplicatePair(pearsonCorr, xCol, yCol)
      if (isDuplicate) {
        skippedDuplicate++
        continue
      }

      // 비선형 관계 탐지
      const nonLinear = detectNonLinearRelationship(pearsonCorr, spearmanCorr)

      // 태그 생성
      const tags = generateTags(pearsonCorr, spearmanCorr, isDuplicate, nonLinear)

      // 우선순위 계산
      const priority = calculatePriority(pearsonCorr, spearmanCorr, tags, pairs.length)

      candidates.push({
        id: `${xCol}-${yCol}`,
        xColumn: xCol,
        yColumn: yCol,
        xLabel: xCol,
        yLabel: yCol,
        pearsonCorr,
        spearmanCorr,
        pearsonP,
        spearmanP,
        rSquared,
        dataCount: pairs.length,
        tags,
        priority,
        statistics: {
          pearsonCorr,
          spearmanCorr,
          pearsonP,
          spearmanP,
          rSquared
        },
        chartData: pairs
      })
    }
  }

  console.log('Smart Insight 분석 결과:', {
    totalPairs,
    skippedLowData,
    skippedError,
    skippedLowCorr,
    skippedHighP,
    skippedDuplicate,
    candidates: candidates.length
  })

  // PCA 추천 분석
  const pcaRecommendations = analyzePCARecommendations(correlationMatrix)

  // 우선순위로 정렬 후 상위 결과만 반환
  const sortedCandidates = candidates
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxResults)

  const executionTime = Date.now() - startTime

  return {
    candidates: sortedCandidates,
    pcaRecommendations,
    totalPairsAnalyzed: totalPairs,
    filteredCount: candidates.length,
    executionTime
  }
}

// AI 해석 요청 포맷 생성
export function formatAIInterpretationRequest(
  candidate: InsightCandidate,
  sampleDescription?: string,
  dataType?: string
): string {
  const tagDescriptions: Record<InsightTag, string> = {
    'non-linear': '비선형 관계가 감지됨',
    'strong-positive': '강한 양의 상관관계',
    'strong-negative': '강한 음의 상관관계',
    'moderate': '중간 정도의 상관관계',
    'duplicate': '중복 변수 의심',
    'pca-recommend': 'PCA 분석 권장',
    'log-scale': '로그 스케일 적용 권장'
  }

  const tagText = candidate.tags.map(t => tagDescriptions[t]).join(', ')

  return `
X축: ${candidate.xColumn}
Y축: ${candidate.yColumn}
피어슨 상관계수: ${candidate.pearsonCorr.toFixed(4)}
스피어만 상관계수: ${candidate.spearmanCorr.toFixed(4)}
결정계수 (R²): ${candidate.rSquared.toFixed(4)}
데이터 수: ${candidate.dataCount}개
${dataType ? `데이터 타입: ${dataType}` : ''}
${sampleDescription ? `샘플 설명: ${sampleDescription}` : ''}
특징: ${tagText || '일반적인 선형 관계'}

이 그래프가 갖는 지구화학적/지질학적 의미를 분석해주세요.
${candidate.tags.includes('non-linear') ? '특히 비선형 관계가 나타나는 이유와 그 의미를 설명해주세요.' : ''}
`.trim()
}

// Top N 흥미로운 결과 선택
export function selectTopInsights(
  result: SmartInsightResult,
  topN: number = 5
): InsightCandidate[] {
  // 이미 정렬되어 있으므로 상위 N개 선택
  return result.candidates.slice(0, topN)
}
