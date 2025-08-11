import React from 'react'
import { PCAResult, GeochemData } from '@/types/geochem'

interface PCAResultsTableProps {
  pcaResult: PCAResult
  data: GeochemData
  selectedVariables: string[]
}

export default function PCAResultsTable({ pcaResult, data, selectedVariables }: PCAResultsTableProps) {
  // 클러스터별 원본 변수 평균 계산
  const calculateClusterAverages = () => {
    const clusterStats = new Map<number, { count: number, sums: Record<string, number> }>()
    
    // 각 클러스터별 합계 및 개수 계산
    data.data.forEach((row, index) => {
      const cluster = pcaResult.clusters[index]
      if (cluster === -1) return // 유효하지 않은 데이터 제외
      
      if (!clusterStats.has(cluster)) {
        clusterStats.set(cluster, { 
          count: 0, 
          sums: Object.fromEntries(selectedVariables.map(v => [v, 0])) 
        })
      }
      
      const stats = clusterStats.get(cluster)!
      stats.count++
      
      selectedVariables.forEach(variable => {
        const value = parseFloat(row[variable])
        if (!isNaN(value) && isFinite(value)) {
          stats.sums[variable] += value
        }
      })
    })
    
    // 평균 계산
    const clusterAverages = new Map<number, Record<string, number>>()
    clusterStats.forEach((stats, cluster) => {
      const averages: Record<string, number> = {}
      selectedVariables.forEach(variable => {
        averages[variable] = stats.count > 0 ? stats.sums[variable] / stats.count : 0
      })
      clusterAverages.set(cluster, averages)
    })
    
    return clusterAverages
  }

  // PC 점수의 클러스터별 평균 계산
  const calculatePCClusterAverages = () => {
    const clusterPCStats = new Map<number, { count: number, sumPC1: number, sumPC2: number }>()
    
    pcaResult.scores.forEach((scores, index) => {
      const cluster = pcaResult.clusters[index]
      if (cluster === -1) return
      
      if (!clusterPCStats.has(cluster)) {
        clusterPCStats.set(cluster, { count: 0, sumPC1: 0, sumPC2: 0 })
      }
      
      const stats = clusterPCStats.get(cluster)!
      stats.count++
      stats.sumPC1 += scores[0] || 0
      stats.sumPC2 += scores[1] || 0
    })
    
    const clusterPCAverages = new Map<number, { PC1: number, PC2: number }>()
    clusterPCStats.forEach((stats, cluster) => {
      clusterPCAverages.set(cluster, {
        PC1: stats.count > 0 ? stats.sumPC1 / stats.count : 0,
        PC2: stats.count > 0 ? stats.sumPC2 / stats.count : 0
      })
    })
    
    return clusterPCAverages
  }

  const clusterAverages = calculateClusterAverages()
  const pcClusterAverages = calculatePCClusterAverages()
  const clusters = Array.from(new Set(pcaResult.clusters.filter(c => c !== -1))).sort()

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
      <h3 className="text-lg font-semibold mb-4 text-blue-800">📊 PCA 분석 결과 요약</h3>
      
      {/* 설명 분산 및 고유값 */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong>🔍 설명 분산:</strong>
            <div>PC1: {pcaResult.explainedVariance[0]?.toFixed(1)}%</div>
            <div>PC2: {pcaResult.explainedVariance[1]?.toFixed(1)}%</div>
            <div>누적: {(pcaResult.explainedVariance[0] + pcaResult.explainedVariance[1]).toFixed(1)}%</div>
          </div>
          <div>
            <strong>⚡ 고유값:</strong>
            <div>PC1: {pcaResult.eigenvalues[0]?.toFixed(3)}</div>
            <div>PC2: {pcaResult.eigenvalues[1]?.toFixed(3)}</div>
          </div>
        </div>
      </div>

      {/* PCA 로딩 (변수별 가중치) 테이블 */}
      <div className="mb-6">
        <h4 className="text-md font-medium mb-3 text-gray-800">🔬 주성분 로딩 (변수별 가중치)</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300 text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 px-3 py-2 text-left font-medium">변수</th>
                <th className="border border-gray-300 px-3 py-2 text-center font-medium">
                  PC1 가중치<br/>
                  <span className="text-xs text-gray-600">({pcaResult.explainedVariance[0]?.toFixed(1)}%)</span>
                </th>
                <th className="border border-gray-300 px-3 py-2 text-center font-medium">
                  PC2 가중치<br/>
                  <span className="text-xs text-gray-600">({pcaResult.explainedVariance[1]?.toFixed(1)}%)</span>
                </th>
                <th className="border border-gray-300 px-3 py-2 text-center font-medium">주요 기여</th>
              </tr>
            </thead>
            <tbody>
              {selectedVariables.map((variable, index) => {
                const pc1Loading = pcaResult.loadings[0]?.[index] || 0
                const pc2Loading = pcaResult.loadings[1]?.[index] || 0
                const maxContribution = Math.abs(pc1Loading) > Math.abs(pc2Loading) ? 'PC1' : 'PC2'
                
                return (
                  <tr key={variable} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-3 py-2 font-medium">{variable}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${
                        Math.abs(pc1Loading) > 0.3 ? 'bg-red-100 text-red-800' :
                        Math.abs(pc1Loading) > 0.1 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {pc1Loading.toFixed(3)}
                      </span>
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${
                        Math.abs(pc2Loading) > 0.3 ? 'bg-red-100 text-red-800' :
                        Math.abs(pc2Loading) > 0.1 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {pc2Loading.toFixed(3)}
                      </span>
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        maxContribution === 'PC1' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {maxContribution}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 클러스터별 평균 테이블 */}
      <div className="mb-6">
        <h4 className="text-md font-medium mb-3 text-gray-800">🎯 클러스터별 평균값</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300 text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 px-3 py-2 text-left font-medium">구분</th>
                <th className="border border-gray-300 px-3 py-2 text-center font-medium">PC1 점수</th>
                <th className="border border-gray-300 px-3 py-2 text-center font-medium">PC2 점수</th>
                {selectedVariables.map(variable => (
                  <th key={variable} className="border border-gray-300 px-3 py-2 text-center font-medium">
                    {variable}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clusters.map(cluster => {
                const pcAvg = pcClusterAverages.get(cluster) || { PC1: 0, PC2: 0 }
                const varAvg = clusterAverages.get(cluster) || {}
                const clusterCount = pcaResult.clusters.filter(c => c === cluster).length
                
                return (
                  <tr key={cluster} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-3 py-2 font-medium">
                      <span className="px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">
                        Cluster {cluster + 1} (n={clusterCount})
                      </span>
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center font-mono text-xs">
                      {pcAvg.PC1.toFixed(3)}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center font-mono text-xs">
                      {pcAvg.PC2.toFixed(3)}
                    </td>
                    {selectedVariables.map(variable => (
                      <td key={variable} className="border border-gray-300 px-3 py-2 text-center font-mono text-xs">
                        {varAvg[variable]?.toFixed(3) || '0.000'}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 해석 가이드 */}
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <h5 className="font-medium text-green-800 mb-2">💡 해석 가이드</h5>
        <div className="text-sm text-green-700 space-y-1">
          <div>• <strong>가중치 절댓값이 클수록</strong> 해당 주성분에 더 큰 영향을 미침</div>
          <div>• <strong>가중치 색상:</strong> 빨간색(강함, |값| {'>'}0.3), 노란색(보통, |값| {'>'}0.1), 회색(약함)</div>
          <div>• <strong>클러스터별 차이</strong>가 클수록 해당 변수가 그룹 구분에 중요한 역할</div>
          <div>• <strong>PC1은 주요 분산</strong>, <strong>PC2는 보조 분산</strong>을 설명</div>
        </div>
      </div>
    </div>
  )
} 