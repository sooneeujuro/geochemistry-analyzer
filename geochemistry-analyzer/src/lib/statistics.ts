import * as ss from 'simple-statistics'
import { StatisticalResult, PCAResult, PCASuggestion } from '@/types/geochem'

// PCA-js import (타입 선언)
const PCA = require('pca-js')

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
    
    // 상관관계 강도에 따른 예상 분산 설명력 추정
    const estimatedPC1Variance = Math.min(avgCorrelation * 60 + 30, 85) // 30-85% 범위
    const estimatedPC2Variance = Math.max(20 - avgCorrelation * 10, 8) // 8-20% 범위
    
    // PC2가 의미있는 분산을 설명할 수 있는 경우만 추천
    if (estimatedPC2Variance >= 10) {
      const varianceExplained = estimatedPC1Variance + estimatedPC2Variance
      
      suggestions.push({
        variables: selectedVariables,
        reason: `${selectedVariables.length}개 변수가 높은 상관관계 (평균 r=${avgCorrelation.toFixed(2)})를 보임. PC1은 ${estimatedPC1Variance.toFixed(0)}%, PC2는 ${estimatedPC2Variance.toFixed(0)}%의 분산 설명 예상.`,
        expectedVariance: varianceExplained,
        correlation: avgCorrelation
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
    console.log('PCA 시작:', { 
      totalRows: data.length, 
      variables: variableNames,
      sampleData: data.slice(0, 3)
    })

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

    console.log('데이터 정리 결과:', {
      totalRows: data.length,
      validRows: cleanData.length,
      invalidRows: invalidRows.length,
      invalidRowsIndices: invalidRows.slice(0, 10), // 처음 10개만 표시
      sampleCleanData: cleanData.slice(0, 3)
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

    console.log('변수별 유효 데이터:', variableValidCounts)
    
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
    
    // PCA 수행 (pca-js 사용)
    const vectors = (PCA as any).getEigenVectors(cleanData)
    
    // 컴포넌트 수 결정 (기본: 최대 변수 수와 2 중 작은 값)
    const maxComponents = Math.min(variableNames.length, cleanData.length - 1)
    const finalNComponents = nComponents ? Math.min(nComponents, maxComponents) : Math.min(maxComponents, 2)
    
    // PCA 결과 추출
    const selectedVectors = vectors.slice(0, finalNComponents)
    const adjustedData = (PCA as any).computeAdjustedData(cleanData, ...selectedVectors)
    
    // 설명 분산 계산
    const totalVariance = vectors.reduce((sum: number, v: any) => sum + v.eigenvalue, 0)
    const explainedVariance = selectedVectors.map((v: any) => (v.eigenvalue / totalVariance) * 100)
    const eigenvalues = selectedVectors.map((v: any) => v.eigenvalue)
    
    // 누적 설명 분산 계산
    const cumulativeVariance = explainedVariance.reduce((acc: number[], val: number, index: number) => {
      acc.push((acc[index - 1] || 0) + val)
      return acc
    }, [] as number[])
    
    // PC 점수 (scores) 추출
    const scores = adjustedData.adjustedData[0] ? 
      cleanData.map((_: any, rowIndex: number) => 
        selectedVectors.map((_: any, compIndex: number) => adjustedData.adjustedData[compIndex][rowIndex])
      ) : 
      cleanData.map(() => new Array(finalNComponents).fill(0))
    
    // 로딩 (변수별 기여도) 계산
    const loadings = selectedVectors.map((vector: any) => vector.vector.slice(0, variableNames.length))
    
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

    console.log('PCA 완료:', {
      explainedVariance,
      clustersFound: k,
      validDataUsed: cleanData.length
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

// 최적 클러스터 수 결정 (엘보우 방법)
function findOptimalClusters(data: number[][], maxK: number = 6): number {
  if (data.length < 4) return 2
  
  // 데이터가 적으면 클러스터 수를 제한
  const actualMaxK = Math.min(maxK, Math.floor(data.length / 2), 4)
  
  const wcss: number[] = []
  
  for (let k = 1; k <= actualMaxK; k++) {
    const clusters = kMeansClustering(data, k)
    let totalWCSS = 0
    
    // 각 클러스터의 WCSS 계산
    for (let cluster = 0; cluster < k; cluster++) {
      const clusterPoints = data.filter((_, index) => clusters[index] === cluster)
      if (clusterPoints.length === 0) continue
      
      // 클러스터 중심점 계산
      const centroidX = clusterPoints.reduce((sum, point) => sum + point[0], 0) / clusterPoints.length
      const centroidY = clusterPoints.reduce((sum, point) => sum + point[1], 0) / clusterPoints.length
      
      // 클러스터 내 거리 제곱합
      const clusterWCSS = clusterPoints.reduce((sum, point) => {
        return sum + Math.pow(point[0] - centroidX, 2) + Math.pow(point[1] - centroidY, 2)
      }, 0)
      
      totalWCSS += clusterWCSS
    }
    
    wcss.push(totalWCSS)
  }
  
  // 엘보우 포인트 찾기 (개선된 방법)
  let optimalK = 2
  if (wcss.length > 2) {
    let maxImprovement = 0
    for (let i = 1; i < wcss.length - 1; i++) {
      const improvement = wcss[i - 1] - wcss[i]
      const nextImprovement = wcss[i] - wcss[i + 1]
      
      // 개선 정도가 급격히 감소하는 지점 찾기
      if (improvement > nextImprovement * 1.5 && improvement > maxImprovement) {
        maxImprovement = improvement
        optimalK = i + 1
      }
    }
  }
  
  return Math.max(2, Math.min(optimalK, actualMaxK))
} 