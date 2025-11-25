import * as ss from 'simple-statistics'
import { StatisticalResult, PCAResult, PCASuggestion } from '@/types/geochem'

// ML-Matrix import (타입 선언 없음)
const { Matrix, EVD } = require('ml-matrix')

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

// t-분포 p-값 계산 (regularized incomplete beta function 사용)
function calculateTTestPValue(t: number, df: number): number {
  const absT = Math.abs(t)
  const x = df / (df + absT * absT)

  // Regularized incomplete beta function 근사 (Lentz's continued fraction algorithm)
  const betaIncomplete = (a: number, b: number, x: number): number => {
    if (x === 0) return 0
    if (x === 1) return 1

    // Lanczos approximation for beta function
    const lnBeta = (a: number, b: number): number => {
      const lnGamma = (z: number): number => {
        const g = 7
        const coefficients = [
          0.99999999999980993,
          676.5203681218851,
          -1259.1392167224028,
          771.32342877765313,
          -176.61502916214059,
          12.507343278686905,
          -0.13857109526572012,
          9.9843695780195716e-6,
          1.5056327351493116e-7
        ]

        if (z < 0.5) {
          return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z)
        }

        z -= 1
        let x = coefficients[0]
        for (let i = 1; i < g + 2; i++) {
          x += coefficients[i] / (z + i)
        }
        const t = z + g + 0.5
        return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
      }

      return lnGamma(a) + lnGamma(b) - lnGamma(a + b)
    }

    // Continued fraction approximation
    const maxIterations = 200
    const epsilon = 1e-10

    let c = 1
    let d = 1 - (a + b) * x / (a + 1)
    if (Math.abs(d) < epsilon) d = epsilon
    d = 1 / d
    let h = d

    for (let m = 1; m <= maxIterations; m++) {
      const m2 = 2 * m

      // Even step
      let an = m * (b - m) * x / ((a + m2 - 1) * (a + m2))
      d = 1 + an * d
      if (Math.abs(d) < epsilon) d = epsilon
      c = 1 + an / c
      if (Math.abs(c) < epsilon) c = epsilon
      d = 1 / d
      h *= d * c

      // Odd step
      an = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1))
      d = 1 + an * d
      if (Math.abs(d) < epsilon) d = epsilon
      c = 1 + an / c
      if (Math.abs(c) < epsilon) c = epsilon
      d = 1 / d
      const del = d * c
      h *= del

      if (Math.abs(del - 1) < epsilon) break
    }

    const lnBetaVal = lnBeta(a, b)
    const result = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lnBetaVal) * h / a

    return Math.min(1, Math.max(0, result))
  }

  // Two-tailed p-value from t-distribution
  const pValue = betaIncomplete(df / 2, 0.5, x)
  return Math.min(1, Math.max(0, pValue))
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

// 헬퍼 함수들
function calculateSkewness(data: number[], mean: number, stdDev: number): number {
  const n = data.length
  const m3 = data.reduce((sum, x) => sum + Math.pow((x - mean) / stdDev, 3), 0) / n
  return m3
}

function calculateKurtosis(data: number[], mean: number, stdDev: number): number {
  const n = data.length
  const m4 = data.reduce((sum, x) => sum + Math.pow((x - mean) / stdDev, 4), 0) / n
  return m4 - 3 // excess kurtosis
}

// 고급 통계분석 기능들
export interface AdvancedStatistics {
  mean: number
  median: number
  standardDeviation: number
  variance: number
  skewness: number
  kurtosis: number
  quantiles: {
    q25: number
    q75: number
  }
  outliers: number[]
  normality: {
    shapiroWilk?: number
    isNormal: boolean
  }
}

export interface RegressionAnalysis {
  model: 'linear' | 'polynomial' | 'multiple'
  coefficients: number[]
  rSquared: number
  adjustedRSquared: number
  fStatistic: number
  pValue: number
  residuals: number[]
  predicted: number[]
}

// 기술통계 계산
export function calculateDescriptiveStats(data: number[]): AdvancedStatistics {
  const cleanData = data.filter(x => !isNaN(x) && isFinite(x))
  
  if (cleanData.length === 0) {
    throw new Error('No valid data points')
  }

  // 기본 통계량
  const meanVal = ss.mean(cleanData)
  const medianVal = ss.median(cleanData)
  const stdDev = ss.standardDeviation(cleanData)
  const varianceVal = ss.variance(cleanData)
  
  // 분포 형태 (직접 계산)
  const skewnessVal = calculateSkewness(cleanData, meanVal, stdDev)
  const kurtosisVal = calculateKurtosis(cleanData, meanVal, stdDev)
  
  // 사분위수
  const q25 = ss.quantile(cleanData, 0.25)
  const q75 = ss.quantile(cleanData, 0.75)
  
  // 이상치 탐지 (IQR 방법)
  const iqr = q75 - q25
  const lowerBound = q25 - 1.5 * iqr
  const upperBound = q75 + 1.5 * iqr
  const outliers = cleanData.filter(x => x < lowerBound || x > upperBound)
  
  // 정규성 검정 (간단한 근사)
  const isNormal = Math.abs(skewnessVal) < 1 && Math.abs(kurtosisVal) < 3
  
  return {
    mean: meanVal,
    median: medianVal,
    standardDeviation: stdDev,
    variance: varianceVal,
    skewness: skewnessVal,
    kurtosis: kurtosisVal,
    quantiles: { q25, q75 },
    outliers,
    normality: { isNormal }
  }
}

// 상관관계 매트릭스 계산
export function calculateCorrelationMatrix(data: Record<string, number[]>): Record<string, Record<string, number>> {
  const variables = Object.keys(data)
  const matrix: Record<string, Record<string, number>> = {}
  
  variables.forEach(var1 => {
    matrix[var1] = {}
    variables.forEach(var2 => {
      if (var1 === var2) {
        matrix[var1][var2] = 1
      } else {
        try {
          const corr = ss.sampleCorrelation(data[var1], data[var2])
          matrix[var1][var2] = isNaN(corr) ? 0 : corr
        } catch {
          matrix[var1][var2] = 0
        }
      }
    })
  })
  
  return matrix
}

// PCA 추천 로직
export function suggestPCAVariables(
  correlationMatrix: number[][],
  variableNames: string[],
  threshold: number = 0.6
): PCASuggestion[] {
  const suggestions: PCASuggestion[] = []
  
  // 상관관계가 높은 변수 그룹 찾기
  const groups: string[][] = []
  const used = new Set<string>()
  
  for (let i = 0; i < variableNames.length; i++) {
    if (used.has(variableNames[i])) continue
    
    const group = [variableNames[i]]
    used.add(variableNames[i])
    
    for (let j = i + 1; j < variableNames.length; j++) {
      if (used.has(variableNames[j])) continue
      
      // 그룹 내 모든 변수와의 평균 상관계수 계산
      let totalCorr = 0
      let count = 0
      
      for (const groupVar of group) {
        const groupIdx = variableNames.indexOf(groupVar)
        totalCorr += Math.abs(correlationMatrix[groupIdx][j])
        count++
      }
      
      const avgCorr = totalCorr / count
      if (avgCorr >= threshold) {
        group.push(variableNames[j])
        used.add(variableNames[j])
      }
    }
    
    if (group.length >= 3) { // 최소 3개 변수 이상인 그룹만
      groups.push(group)
    }
  }
  
  // 각 그룹에 대해 PCA 추천 생성 (개선된 로직)
  groups.forEach((group, index) => {
    // 그룹 내에서 가장 대표적인 변수들 선정 (최대 6개)
    const sortedByVariance = group.sort((a, b) => {
      const aIdx = variableNames.indexOf(a)
      const bIdx = variableNames.indexOf(b)
      
      // 다른 변수들과의 평균 상관계수로 정렬 (높은 순)
      const aAvgCorr = correlationMatrix[aIdx].reduce((sum, corr, idx) => {
        if (idx !== aIdx && group.includes(variableNames[idx])) {
          return sum + Math.abs(corr)
        }
        return sum
      }, 0) / (group.length - 1)
      
      const bAvgCorr = correlationMatrix[bIdx].reduce((sum, corr, idx) => {
        if (idx !== bIdx && group.includes(variableNames[idx])) {
          return sum + Math.abs(corr)
        }
        return sum
      }, 0) / (group.length - 1)
      
      return bAvgCorr - aAvgCorr
    })
    
    const selectedVariables = sortedByVariance.slice(0, 6) // 최대 6개
    
    // 가상 PCA 검증: 최소 2개 컴포넌트가 의미있는지 확인
    const avgCorrelation = selectedVariables.reduce((sum, var1, i) => {
      return sum + selectedVariables.slice(i + 1).reduce((innerSum, var2) => {
        const idx1 = variableNames.indexOf(var1)
        const idx2 = variableNames.indexOf(var2)
        return innerSum + Math.abs(correlationMatrix[idx1][idx2])
      }, 0)
    }, 0) / (selectedVariables.length * (selectedVariables.length - 1) / 2)
    
    // 상관관계 강도에 따른 예상 분산 설명력 추정 (개선된 공식)
    const estimatedPC1Variance = Math.min(avgCorrelation * 50 + 40, 80) // 40-80% 범위
    const estimatedPC2Variance = Math.max(30 - avgCorrelation * 15, 10) // 10-30% 범위
    
    // PC2가 최소 10% 이상의 분산을 설명할 수 있는 경우만 추천
    if (estimatedPC2Variance >= 10) {
      const varianceExplained = estimatedPC1Variance + estimatedPC2Variance
      
      // 신뢰도 계산: 상관관계 강도, PC2 설명력, 변수 수의 균형을 고려
      const correlationScore = Math.min(avgCorrelation, 1) // 0-1 범위
      const pc2Score = Math.min(estimatedPC2Variance / 30, 1) // 30%를 만점으로 0-1 범위
      const variableCountScore = Math.min((selectedVariables.length - 2) / 4, 1) // 2-6개 변수 범위에서 0-1
      
      const confidence = (correlationScore * 0.4 + pc2Score * 0.4 + variableCountScore * 0.2)
      
      suggestions.push({
        variables: selectedVariables,
        reason: `${selectedVariables.length}개 변수가 높은 상관관계 (평균 r=${avgCorrelation.toFixed(2)})를 보임. PC1은 ${estimatedPC1Variance.toFixed(0)}%, PC2는 ${estimatedPC2Variance.toFixed(0)}%의 분산 설명 예상.`,
        expectedVariance: varianceExplained,
        correlation: avgCorrelation,
        confidence: confidence
      })
    }
  })
  
  // 분산 설명력과 상관계수를 종합한 점수로 정렬
  suggestions.sort((a, b) => {
    const scoreA = a.expectedVariance * 0.7 + a.correlation * 30
    const scoreB = b.expectedVariance * 0.7 + b.correlation * 30
    return scoreB - scoreA
  })
  
  return suggestions.slice(0, 3) // 상위 3개만 반환
}

// PCA 계산 함수 (pca-js 사용)
export function performPCA(
  data: Record<string, any>[],
  variableNames: string[],
  nComponents?: number
): PCAResult {
  try {
    // 데이터 준비: 변수별로 숫자 데이터만 추출하고 결측값 제거
    const cleanData: number[][] = []
    const invalidRows: number[] = []
    
    data.forEach((row, rowIndex) => {
      const values = variableNames.map(name => {
        const val = row[name]
        // 더 관대한 숫자 변환 시도
        if (typeof val === 'string' && val.trim() !== '') {
          const parsed = parseFloat(val.trim())
          return !isNaN(parsed) && isFinite(parsed) ? parsed : null
        }
        return typeof val === 'number' && !isNaN(val) && isFinite(val) ? val : null
      })
      
      // 완화된 조건: 최소 80%의 변수가 유효하면 포함 (단, 최소 2개 변수는 필요)
      const validCount = values.filter(val => val !== null).length
      const minRequiredValid = Math.max(2, Math.ceil(variableNames.length * 0.8))
      
      if (validCount >= minRequiredValid) {
        // 결측값을 해당 변수의 평균값으로 대체
        const filledValues = values.map((val, varIndex) => {
          if (val !== null) return val
          
          // 해당 변수의 유효한 값들의 평균 계산
          const varName = variableNames[varIndex]
          const validValues = data
            .map(r => {
              const v = r[varName]
              if (typeof v === 'string' && v.trim() !== '') {
                const parsed = parseFloat(v.trim())
                return !isNaN(parsed) && isFinite(parsed) ? parsed : null
              }
              return typeof v === 'number' && !isNaN(v) && isFinite(v) ? v : null
            })
            .filter(v => v !== null) as number[]
          
          // 평균값으로 대체 (유효한 값이 없으면 0으로 대체)
          return validValues.length > 0 
            ? validValues.reduce((sum, v) => sum + v, 0) / validValues.length 
            : 0
        })
        
        cleanData.push(filledValues)
      } else {
        invalidRows.push(rowIndex)
      }
    })

    // 변수별 유효 데이터 개수 확인
    const variableValidCounts = variableNames.map(name => {
      const validCount = data.filter(row => {
        const val = row[name]
        if (typeof val === 'string' && val.trim() !== '') {
          const parsed = parseFloat(val.trim())
          return !isNaN(parsed) && isFinite(parsed)
        }
        return typeof val === 'number' && !isNaN(val) && isFinite(val)
      }).length
      return { variable: name, validCount, totalCount: data.length }
    })

    if (cleanData.length < 3) {
      const errorDetails = `
PCA 분석에 필요한 유효 데이터가 부족합니다.

📊 데이터 현황:
• 전체 행 수: ${data.length}개
• 유효 행 수: ${cleanData.length}개 
• 필요한 최소 행 수: 3개

🔍 변수별 유효 데이터:
${variableValidCounts.map(v => `• ${v.variable}: ${v.validCount}/${v.totalCount}개`).join('\n')}

💡 해결 방법:
1. 결측값이 적은 변수들을 선택해보세요
2. 데이터에 숫자가 아닌 값(텍스트, 빈 칸)이 있는지 확인해보세요
3. 더 많은 데이터가 포함된 파일을 사용해보세요`

      throw new Error(errorDetails)
    }
    
    if (variableNames.length < 2) {
      throw new Error('PCA를 수행하기에 변수가 부족합니다. (최소 2개 변수 필요)')
    }
    
    // 데이터 표준화 (평균 0, 분산 1)
    const means = new Array(variableNames.length).fill(0)
    const stds = new Array(variableNames.length).fill(0)
    
    // 평균 계산
    for (let j = 0; j < variableNames.length; j++) {
      means[j] = cleanData.reduce((sum, row) => sum + row[j], 0) / cleanData.length
    }
    
    // 표준편차 계산
    for (let j = 0; j < variableNames.length; j++) {
      const variance = cleanData.reduce((sum, row) => sum + Math.pow(row[j] - means[j], 2), 0) / (cleanData.length - 1)
      stds[j] = Math.sqrt(variance)
    }
    
    // 데이터 표준화
    const standardizedData = cleanData.map(row => 
      row.map((val, j) => stds[j] > 0 ? (val - means[j]) / stds[j] : 0)
    )
    
    // 공분산 행렬 계산 (표준화된 데이터에서는 상관관계 행렬과 동일)
    const numVars = variableNames.length
    const covMatrix = Array(numVars).fill(null).map(() => Array(numVars).fill(0))
    
    for (let i = 0; i < numVars; i++) {
      for (let j = 0; j < numVars; j++) {
        let sum = 0
        for (let k = 0; k < standardizedData.length; k++) {
          sum += standardizedData[k][i] * standardizedData[k][j]
        }
        covMatrix[i][j] = sum / (standardizedData.length - 1)
      }
    }
    
    // 고유값과 고유벡터 계산 (반복법 사용)
    const eigenResults = computeTopEigenValues(covMatrix, Math.min(numVars, 6))
    
    // 컴포넌트 수 결정
    const maxComponents = Math.min(variableNames.length, cleanData.length - 1)
    const finalNComponents = nComponents ? Math.min(nComponents, maxComponents) : Math.min(maxComponents, 2)
    
    // 상위 고유값/고유벡터 선택
    const selectedEigenvalues = eigenResults.eigenvalues.slice(0, finalNComponents)
    const selectedEigenvectors = eigenResults.eigenvectors.slice(0, finalNComponents)
    
    // 설명 분산 계산
    const totalVariance = eigenResults.eigenvalues.reduce((sum: number, val: number) => sum + val, 0)
    const explainedVariance = selectedEigenvalues.map((val: number) => (val / totalVariance) * 100)
    const eigenvalues = selectedEigenvalues
    
    // 누적 설명 분산 계산
    const cumulativeVariance = explainedVariance.reduce((acc: number[], val: number, index: number) => {
      acc.push((acc[index - 1] || 0) + val)
      return acc
    }, [] as number[])
    
    // PC 점수 계산 (표준화된 데이터 × 고유벡터)
    const scores = standardizedData.map(row => 
      selectedEigenvectors.map((eigenvector: number[]) => 
        row.reduce((sum, val, idx) => sum + val * eigenvector[idx], 0)
      )
    )
    
    // 로딩 계산 (고유벡터 자체가 로딩)
    const loadings = selectedEigenvectors
    
    // K-means 클러스터링 수행 (유효한 데이터만 사용)
    const k = findOptimalClusters(scores.map(row => row.slice(0, 2))) // 첫 두 컴포넌트만 사용
    const clusters = kMeansClustering(scores, k)
    
    // 원본 데이터 크기에 맞춰 클러스터 정보 확장 (유효하지 않은 행은 -1로 표시)
    const fullClusters = new Array(data.length).fill(-1)
    let validIndex = 0
    data.forEach((_, rowIndex) => {
      if (!invalidRows.includes(rowIndex)) {
        fullClusters[rowIndex] = clusters[validIndex] || 0
        validIndex++
      }
    })

    return {
      scores: scores,
      loadings: loadings,
      explainedVariance: explainedVariance,
      cumulativeVariance: cumulativeVariance,
      eigenvalues: eigenvalues,
      variableNames: variableNames,
      nComponents: finalNComponents,
      clusters: fullClusters  // 전체 크기 배열 반환
    }
    
  } catch (error) {
    console.error('PCA calculation error:', error)
    throw new Error(`PCA 계산 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// 상위 고유값과 고유벡터 계산 함수
function computeTopEigenValues(matrix: number[][], numComponents: number): { eigenvalues: number[], eigenvectors: number[][] } {
  const n = matrix.length
  const eigenvalues: number[] = []
  const eigenvectors: number[][] = []
  
  // 작업 행렬 복사
  let workMatrix = matrix.map(row => [...row])
  
  for (let comp = 0; comp < numComponents; comp++) {
    // 전력법으로 가장 큰 고유값과 고유벡터 찾기
    let eigenvector = new Array(n).fill(0).map(() => Math.random() - 0.5) // 랜덤 초기 벡터
    let eigenvalue = 0
    
    // 전력법 반복
    for (let iter = 0; iter < 100; iter++) {
      // A * v
      const newVector = new Array(n).fill(0)
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          newVector[i] += workMatrix[i][j] * eigenvector[j]
        }
      }
      
      // 크기 계산
      const norm = Math.sqrt(newVector.reduce((sum, val) => sum + val * val, 0))
      if (norm < 1e-10) break
      
      // 정규화
      eigenvector = newVector.map(val => val / norm)
      
      // 고유값 계산 (Rayleigh quotient)
      let numerator = 0
      let denominator = 0
      for (let i = 0; i < n; i++) {
        let temp = 0
        for (let j = 0; j < n; j++) {
          temp += workMatrix[i][j] * eigenvector[j]
        }
        numerator += eigenvector[i] * temp
        denominator += eigenvector[i] * eigenvector[i]
      }
      
      const newEigenvalue = numerator / denominator
      
      // 수렴 체크
      if (Math.abs(newEigenvalue - eigenvalue) < 1e-8) break
      eigenvalue = newEigenvalue
    }
    
    // 고유값이 충분히 큰 경우만 저장
    if (Math.abs(eigenvalue) > 1e-10) {
      eigenvalues.push(Math.abs(eigenvalue))
      eigenvectors.push([...eigenvector])
      
      // 찾은 고유벡터의 영향을 제거 (디플레이션)
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          workMatrix[i][j] -= eigenvalue * eigenvector[i] * eigenvector[j]
        }
      }
    }
  }
  
  // 고유값 크기순으로 정렬
  const sortedIndices = eigenvalues
    .map((val, idx) => ({ val, idx }))
    .sort((a, b) => b.val - a.val)
    .map(item => item.idx)
  
  const sortedEigenvalues = sortedIndices.map(idx => eigenvalues[idx])
  const sortedEigenvectors = sortedIndices.map(idx => eigenvectors[idx])
  
  return {
    eigenvalues: sortedEigenvalues,
    eigenvectors: sortedEigenvectors
  }
} 

// K-means 클러스터링 함수
function kMeansClustering(data: number[][], k: number, maxIterations: number = 100): number[] {
  if (data.length === 0 || k <= 0) return []
  
  // 데이터가 k보다 적으면 각각을 다른 클러스터로 할당
  if (data.length <= k) {
    return data.map((_, index) => index)
  }
  
  // 초기 중심점 설정 (k-means++ 방식으로 개선)
  const centroids: number[][] = []
  
  // 첫 번째 중심점은 랜덤하게 선택
  const firstIndex = Math.floor(Math.random() * data.length)
  centroids.push([...data[firstIndex]])
  
  // 나머지 중심점들은 기존 중심점들로부터 가장 먼 점을 선택
  for (let i = 1; i < k; i++) {
    let maxDistance = -1
    let bestPoint = [...data[0]]
    
    for (const point of data) {
      let minDistToCentroid = Infinity
      
      // 각 기존 중심점까지의 최소 거리 계산
      for (const centroid of centroids) {
        const distance = Math.sqrt(
          Math.pow(point[0] - centroid[0], 2) + 
          Math.pow(point[1] - centroid[1], 2)
        )
        minDistToCentroid = Math.min(minDistToCentroid, distance)
      }
      
      // 가장 먼 점을 다음 중심점으로 선택
      if (minDistToCentroid > maxDistance) {
        maxDistance = minDistToCentroid
        bestPoint = [...point]
      }
    }
    
    centroids.push(bestPoint)
  }
  
  let clusters: number[] = new Array(data.length).fill(0)
  
  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false
    
    // 각 데이터 포인트를 가장 가까운 중심점에 할당
    for (let i = 0; i < data.length; i++) {
      let minDistance = Infinity
      let bestCluster = 0
      
      for (let j = 0; j < k; j++) {
        const distance = Math.sqrt(
          Math.pow(data[i][0] - centroids[j][0], 2) + 
          Math.pow(data[i][1] - centroids[j][1], 2)
        )
        
        if (distance < minDistance) {
          minDistance = distance
          bestCluster = j
        }
      }
      
      if (clusters[i] !== bestCluster) {
        clusters[i] = bestCluster
        changed = true
      }
    }
    
    // 중심점 업데이트
    for (let j = 0; j < k; j++) {
      const clusterPoints = data.filter((_, index) => clusters[index] === j)
      if (clusterPoints.length > 0) {
        centroids[j][0] = clusterPoints.reduce((sum, point) => sum + point[0], 0) / clusterPoints.length
        centroids[j][1] = clusterPoints.reduce((sum, point) => sum + point[1], 0) / clusterPoints.length
      }
    }
    
    if (!changed) break
  }
  
  return clusters
}

// Silhouette 스코어 계산 (간단한 구현)
function calculateSilhouetteScore(data: number[][], clusters: number[]): number {
  const n = data.length
  const k = Math.max(...clusters) + 1
  let totalSilhouette = 0
  
  for (let i = 0; i < n; i++) {
    const clusterI = clusters[i]
    
    // a(i): 같은 클러스터 내 평균 거리
    const sameCluster = data.filter((_, idx) => clusters[idx] === clusterI && idx !== i)
    const aI = sameCluster.length > 0 ? 
      sameCluster.reduce((sum, point) => sum + euclideanDistance(data[i], point), 0) / sameCluster.length : 0
    
    // b(i): 가장 가까운 다른 클러스터까지의 평균 거리
    let minBI = Infinity
    for (let c = 0; c < k; c++) {
      if (c !== clusterI) {
        const otherCluster = data.filter((_, idx) => clusters[idx] === c)
        if (otherCluster.length > 0) {
          const avgDist = otherCluster.reduce((sum, point) => sum + euclideanDistance(data[i], point), 0) / otherCluster.length
          minBI = Math.min(minBI, avgDist)
        }
      }
    }
    
    const bI = minBI === Infinity ? 0 : minBI
    const silhouette = aI === 0 && bI === 0 ? 0 : (bI - aI) / Math.max(aI, bI)
    totalSilhouette += silhouette
  }
  
  return totalSilhouette / n
}

// 유클리드 거리 계산
function euclideanDistance(point1: number[], point2: number[]): number {
  return Math.sqrt(point1.reduce((sum, val, idx) => sum + Math.pow(val - point2[idx], 2), 0))
}

// 개선된 최적 클러스터 수 결정 (Silhouette + Elbow 방법)
function findOptimalClusters(data: number[][], maxK: number = 8): number {
  if (data.length < 6) return 3 // 기본값을 3으로 변경
  
  // 데이터 크기에 따른 최대 클러스터 수 결정 (제한 완화)
  const actualMaxK = Math.min(maxK, Math.floor(data.length / 2), 6) // 최대 6개

  const wcss: number[] = []
  const silhouetteScores: number[] = []

  for (let k = 2; k <= actualMaxK; k++) {
    const clusters = kMeansClustering(data, k)
    
    // WCSS 계산
    let totalWCSS = 0
    for (let cluster = 0; cluster < k; cluster++) {
      const clusterPoints = data.filter((_, index) => clusters[index] === cluster)
      if (clusterPoints.length === 0) continue
      
      const centroid = clusterPoints[0].map((_, dim) => 
        clusterPoints.reduce((sum, point) => sum + point[dim], 0) / clusterPoints.length
      )
      
      const clusterWCSS = clusterPoints.reduce((sum, point) => {
        return sum + point.reduce((distSum, val, dim) => distSum + Math.pow(val - centroid[dim], 2), 0)
      }, 0)
      
      totalWCSS += clusterWCSS
    }
    wcss.push(totalWCSS)
    
    // Silhouette 스코어 계산
    const silScore = calculateSilhouetteScore(data, clusters)
    silhouetteScores.push(silScore)
  }
  
  // 최적 k 결정: Silhouette 스코어 우선, 그 다음 Elbow
  let bestK = 3 // 기본값을 3으로 설정
  let maxSilhouette = -1
  
  // Silhouette 스코어 기반 최적화
  for (let i = 0; i < silhouetteScores.length; i++) {
    const k = i + 2
    const silScore = silhouetteScores[i]
    
    // Silhouette 스코어가 좋고, 3개 이상의 클러스터를 선호
    if (silScore > maxSilhouette && silScore >= 0.15) { // 기준 완화
      maxSilhouette = silScore
      bestK = k
    }
  }
  
  // 3개 클러스터 선호하는 로직 추가
  if (silhouetteScores.length >= 2) { // k=3이 가능한 경우
    const k3Score = silhouetteScores[1] // k=3의 스코어
    const k2Score = silhouetteScores[0] // k=2의 스코어

    // k=3이 k=2보다 조금이라도 좋거나, 거의 비슷하면 k=3 선택
    if (k3Score >= k2Score - 0.05) { // 0.05 차이까지는 k=3 선호
      bestK = 3
      maxSilhouette = k3Score
    }
  }

  return Math.max(2, Math.min(bestK, actualMaxK))
}

// PCA 계산 함수 (sklearn.decomposition.PCA와 동일한 방식)
export async function calculatePCA(
  data: number[][],
  variableNames: string[],
  nComponents?: number
): Promise<PCAResult> {
  try {
    if (!data || data.length === 0) {
      throw new Error('PCA를 위한 데이터가 없습니다.')
    }

    // 데이터 검증 및 정리
    const cleanData = data.filter(row => 
      row.every(val => !isNaN(val) && isFinite(val))
    )

    if (cleanData.length < 3) {
      throw new Error('PCA 계산을 위해 최소 3개의 유효한 샘플이 필요합니다.')
    }

    const numVars = variableNames.length
    const numSamples = cleanData.length

    if (numSamples <= numVars) {
      throw new Error('샘플 수가 변수 수보다 많아야 합니다.')
    }

    console.log('🔍 PCA 시작:', {
      samples: numSamples,
      variables: numVars,
      variableNames
    })

    // 1. 데이터 표준화 (sklearn StandardScaler와 동일한 방식)
    const means = new Array(numVars).fill(0)
    const stds = new Array(numVars).fill(0)
    
    // 평균 계산
    for (let j = 0; j < numVars; j++) {
      means[j] = cleanData.reduce((sum, row) => sum + row[j], 0) / numSamples
    }
    
    // 표준편차 계산 (Bessel's correction: n-1)
    for (let j = 0; j < numVars; j++) {
      const variance = cleanData.reduce((sum, row) => sum + Math.pow(row[j] - means[j], 2), 0) / (numSamples - 1)
      stds[j] = Math.sqrt(variance)
    }
    
    // 표준화된 데이터 생성
    const standardizedData = cleanData.map(row =>
      row.map((val, j) => stds[j] > 0 ? (val - means[j]) / stds[j] : 0)
    )

    // 2. ML-Matrix를 사용한 공분산 행렬 계산
    const dataMatrix = new Matrix(standardizedData)
    
    // 공분산 행렬 = (X^T * X) / (n-1)
    const covMatrix = dataMatrix.transpose().mmul(dataMatrix).div(numSamples - 1)

    // 3. 고유값 분해 (EVD) 사용
    const evd = new (EVD as any)(covMatrix)
    const eigenvaluesRaw = (evd as any).realEigenvalues as number[]
    const eigenvalues = [...eigenvaluesRaw].reverse() // 내림차순 정렬
    const eigenvectorsRaw = (evd as any).eigenvectorMatrix.transpose().to2DArray() as number[][]
    const eigenvectors = [...eigenvectorsRaw].reverse() // 고유벡터들

    // 컴포넌트 수 결정
    const maxComponents = Math.min(variableNames.length, cleanData.length - 1)
    const finalNComponents = nComponents ? Math.min(nComponents, maxComponents) : Math.min(maxComponents, 2)
    
    // 상위 고유값/고유벡터 선택
    const selectedEigenvalues = eigenvalues.slice(0, finalNComponents)
    const selectedEigenvectors = eigenvectors.slice(0, finalNComponents)
    
    // 4. 설명 분산 계산 (sklearn과 동일한 방식)
    const totalVariance = eigenvalues.reduce((sum: number, val: number) => sum + Math.max(0, val), 0) // 음수 고유값 제거
    const explainedVariance = selectedEigenvalues.map((val: number) => (Math.max(0, val) / totalVariance) * 100)
    
    // 누적 설명 분산 계산
    const cumulativeVariance = explainedVariance.reduce((acc: number[], val: number, index: number) => {
      acc.push((acc[index - 1] || 0) + val)
      return acc
    }, [])

    // 5. PC 점수 계산 (표준화된 데이터 × 고유벡터)
    const scores = standardizedData.map(sample => 
      selectedEigenvectors.map((eigenvector: number[]) => 
        sample.reduce((sum, val, i) => sum + val * eigenvector[i], 0)
      )
    )

    // 6. 로딩 행렬 계산 (고유벡터 × sqrt(고유값))
    const loadings = selectedEigenvectors.map((eigenvector: number[], compIndex: number) =>
      eigenvector.map((loading: number) => loading * Math.sqrt(Math.max(0, selectedEigenvalues[compIndex])))
    )

    return {
      scores,
      loadings,
      explainedVariance,
      cumulativeVariance,
      eigenvalues: selectedEigenvalues,
      variableNames,
      nComponents: finalNComponents,
      clusters: [] // 클러스터링은 별도로 수행
    }

  } catch (error) {
    console.error('PCA calculation error:', error)
    throw new Error(`PCA 계산 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
} 