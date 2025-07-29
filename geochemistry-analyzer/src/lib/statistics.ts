import * as ss from 'simple-statistics'
import { StatisticalResult } from '@/types/geochem'

export function calculateStatistics(
  xData: number[],
  yData: number[],
  statMethods: ('pearson' | 'spearman' | 'kendall')[] = ['pearson', 'spearman']
): StatisticalResult {
  try {
    // 결측값 제거
    const validPairs = xData
      .map((x, i) => ({ x, y: yData[i] }))
      .filter(pair => !isNaN(pair.x) && !isNaN(pair.y) && isFinite(pair.x) && isFinite(pair.y))
    
    if (validPairs.length < 3) {
      return { error: "유효한 데이터 포인트가 부족합니다." }
    }
    
    const xClean = validPairs.map(p => p.x)
    const yClean = validPairs.map(p => p.y)
    
    const results: StatisticalResult = {}
    
    // 피어슨 상관계수
    if (statMethods.includes('pearson')) {
      try {
        const pearsonCorr = ss.sampleCorrelation(xClean, yClean)
        results.pearsonCorr = pearsonCorr
        
        // p-값 근사 계산 (t-test)
        const n = xClean.length
        const t = pearsonCorr * Math.sqrt((n - 2) / (1 - pearsonCorr * pearsonCorr))
        results.pearsonP = calculateTTestPValue(t, n - 2)
      } catch (e) {
        console.warn('Pearson correlation calculation failed:', e)
      }
    }
    
    // 스피어만 상관계수 (순위 기반)
    if (statMethods.includes('spearman')) {
      try {
        const xRanks = getRanks(xClean)
        const yRanks = getRanks(yClean)
        const spearmanCorr = ss.sampleCorrelation(xRanks, yRanks)
        results.spearmanCorr = spearmanCorr
        
        // p-값 근사 계산
        const n = xClean.length
        const t = spearmanCorr * Math.sqrt((n - 2) / (1 - spearmanCorr * spearmanCorr))
        results.spearmanP = calculateTTestPValue(t, n - 2)
      } catch (e) {
        console.warn('Spearman correlation calculation failed:', e)
      }
    }
    
    // 선형 회귀
    if (xClean.length > 2) {
      try {
        // simple-statistics 형식에 맞게 [[x1, y1], [x2, y2], ...] 배열로 변환
        const regressionData = validPairs.map(point => [point.x, point.y])
        const regression = ss.linearRegression(regressionData)
        const regressionLine = ss.linearRegressionLine(regression)
        const rSquared = ss.rSquared(regressionData, regressionLine)
        
        results.rSquared = rSquared
        results.linearSlope = regression.m
        results.linearIntercept = regression.b
      } catch (e) {
        console.warn('Linear regression calculation failed:', e)
      }
    }
    
    return results
  } catch (error) {
    return { error: `통계 계산 중 오류 발생: ${error}` }
  }
}

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

// t-test p-값 근사 계산
function calculateTTestPValue(t: number, df: number): number {
  // 간단한 t-분포 p-값 근사
  // 실제 프로덕션에서는 더 정확한 라이브러리 사용 권장
  const absT = Math.abs(t)
  
  if (absT > 6) return 0.0001
  if (absT > 4) return 0.001
  if (absT > 3) return 0.01
  if (absT > 2) return 0.05
  if (absT > 1) return 0.1
  
  return 0.5
}

// 전체 스캔 분석 함수
export function performFullScanAnalysis(
  data: Record<string, any>[],
  numericColumns: string[],
  threshold: number = 0.5,
  pThreshold: number = 0.05,
  statMethods: ('pearson' | 'spearman' | 'kendall')[] = ['pearson']
) {
  const results: Array<{
    xVariable: string
    yVariable: string
    meetsQriteria: boolean
  } & StatisticalResult> = []
  
  // 모든 가능한 조합 생성
  for (let i = 0; i < numericColumns.length; i++) {
    for (let j = i + 1; j < numericColumns.length; j++) {
      const col1 = numericColumns[i]
      const col2 = numericColumns[j]
      
      const xData = data.map(row => parseFloat(row[col1])).filter(val => !isNaN(val))
      const yData = data.map(row => parseFloat(row[col2])).filter(val => !isNaN(val))
      
      const stats = calculateStatistics(xData, yData, statMethods)
      
      if (!stats.error) {
        const meetsQriteria = statMethods.some(method => {
          const corrKey = `${method}Corr` as keyof StatisticalResult
          const pKey = `${method}P` as keyof StatisticalResult
          const corr = stats[corrKey] as number
          const p = stats[pKey] as number
          
          return Math.abs(corr) >= threshold && p <= pThreshold
        })
        
        results.push({
          xVariable: col1,
          yVariable: col2,
          meetsQriteria,
          ...stats
        })
      }
    }
  }
  
  return results.filter(result => result.meetsQriteria)
} 