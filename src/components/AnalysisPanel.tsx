// AnalysisPanel.tsx의 주요 수정 사항만 표시

// 수정 2: 타입별 통계를 항상 계산하고 표시하도록 수정
useEffect(() => {
  if (selectedColumns.x && selectedColumns.y && data) {
    performAnalysis()
    // 타입 컬럼이 설정되어 있으면 항상 타입별 분석 수행
    if (selectedColumns.useTypeColumn && selectedColumns.selectedTypeColumn) {
      performTypeAnalysis()
    } else {
      setTypeStatistics([]) // 타입 컬럼이 없으면 초기화
    }
  }
}, [selectedColumns.x, selectedColumns.y, selectedColumns.useTypeColumn, selectedColumns.selectedTypeColumn, data])

// 수정 2: 타입별 분석 함수 개선
const performTypeAnalysis = async () => {
  // 타입 컬럼이 설정되지 않았으면 빈 배열 반환
  if (!selectedColumns.x || !selectedColumns.y || !selectedColumns.useTypeColumn || !selectedColumns.selectedTypeColumn) {
    setTypeStatistics([])
    return
  }

  try {
    // 기존 로직 유지하되, 더 안정적으로 처리
    const xDataWithType = calculateAxisDataWithType(selectedColumns.x)
    const yDataWithType = calculateAxisDataWithType(selectedColumns.y)

    // 타입별 데이터 그룹화
    const typeGroups: { [key: string]: { x: number[], y: number[] } } = {}
    
    // 더 안전한 데이터 매칭
    for (let i = 0; i < Math.min(xDataWithType.length, yDataWithType.length); i++) {
      const xItem = xDataWithType[i]
      const yItem = yDataWithType[i]
      
      if (xItem && yItem && xItem.type === yItem.type) {
        if (!typeGroups[xItem.type]) {
          typeGroups[xItem.type] = { x: [], y: [] }
        }
        typeGroups[xItem.type].x.push(xItem.value)
        typeGroups[xItem.type].y.push(yItem.value)
      }
    }

    // 각 타입별로 통계 계산
    const results: TypeStatisticsResult[] = []
    
    for (const [type, { x, y }] of Object.entries(typeGroups)) {
      if (x.length >= 3 && y.length >= 3 && x.length === y.length) {
        try {
          const typeStats = calculateStatistics(x, y, ['pearson', 'spearman'])
          results.push({
            type,
            count: x.length,
            pearsonCorr: typeStats.pearsonCorr,
            spearmanCorr: typeStats.spearmanCorr,
            pearsonP: typeStats.pearsonP,
            spearmanP: typeStats.spearmanP,
            rSquared: typeStats.rSquared,
            linearSlope: typeStats.linearSlope,
            linearIntercept: typeStats.linearIntercept,
            pValue: typeStats.pearsonP
          })
        } catch (error) {
          console.error(`Error calculating statistics for type ${type}:`, error)
          results.push({
            type,
            count: x.length
          })
        }
      } else {
        results.push({
          type,
          count: x.length
        })
      }
    }

    console.log('타입별 통계 계산 완료:', results) // 디버깅용
    setTypeStatistics(results)
  } catch (error) {
    console.error('Type analysis failed:', error)
    setTypeStatistics([])
  }
}
