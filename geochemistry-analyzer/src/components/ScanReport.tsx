'use client'

import { useState } from 'react'
import { ScanSummary, ScanResult } from '@/types/geochem'
import { X, Download, FileText, TrendingUp, Clock, Database, AlertCircle } from 'lucide-react'
import jsPDF from 'jspdf'

interface ScanReportProps {
  summary: ScanSummary
  results: ScanResult[]
  onClose: () => void
}

export default function ScanReport({ summary, results, onClose }: ScanReportProps) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)

  const formatNumber = (num: number | undefined, decimals: number = 4): string => {
    if (num === undefined || num === null) return 'N/A'
    return num.toFixed(decimals)
  }

  const formatPValue = (p: number | undefined): string => {
    if (p === undefined || p === null) return 'N/A'
    if (p < 0.001) return '< 0.001'
    return p.toFixed(3)
  }

  const getSignificanceLevel = (p: number | undefined): string => {
    if (p === undefined || p === null) return ''
    if (p < 0.001) return '***'
    if (p < 0.01) return '**'
    if (p < 0.05) return '*'
    return ''
  }

  const generatePDF = async () => {
    setIsGeneratingPDF(true)
    try {
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 20
      let yPosition = margin

      // 헤더
      pdf.setFontSize(20)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Geochemistry Data Correlation Analysis Report', margin, yPosition)
      yPosition += 15

      // 기본 정보
      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'normal')
      const currentDate = new Date().toLocaleString('en-US')
      pdf.text(`Generated: ${currentDate}`, margin, yPosition)
      yPosition += 7
      pdf.text(`File: ${summary.fileName}`, margin, yPosition)
      yPosition += 7
      pdf.text(`Execution time: ${(summary.executionTime / 1000).toFixed(1)}s`, margin, yPosition)
      yPosition += 15

      // 요약 통계
      pdf.setFontSize(16)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Analysis Summary', margin, yPosition)
      yPosition += 10

      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'normal')
      pdf.text(`• Total combinations: ${summary.totalCombinations}`, margin + 5, yPosition)
      yPosition += 7
      pdf.text(`• Significant correlations: ${summary.significantCombinations}`, margin + 5, yPosition)
      yPosition += 7
      pdf.text(`• Correlation threshold: ${summary.scanOptions.threshold}`, margin + 5, yPosition)
      yPosition += 7
      pdf.text(`• P-value threshold: ${summary.scanOptions.pThreshold}`, margin + 5, yPosition)
      yPosition += 7
      pdf.text(`• Analysis methods: ${summary.scanOptions.statMethods.join(', ')}`, margin + 5, yPosition)
      yPosition += 15

      // 유의미한 결과 테이블
      const significantResults = results.filter(r => r.isSignificant)
      if (significantResults.length > 0) {
        // 페이지 분할 처리
        if (yPosition > pageHeight - 60) {
          pdf.addPage()
          yPosition = margin
        }

        pdf.setFontSize(16)
        pdf.setFont('helvetica', 'bold')
        pdf.text('Significant Correlations', margin, yPosition)
        yPosition += 15

        // 테이블 헤더
        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'bold')
        const colWidths = [45, 45, 30, 25, 25, 20]
        
        pdf.text('X Variable', margin, yPosition)
        pdf.text('Y Variable', margin + colWidths[0], yPosition)
        pdf.text('Pearson r', margin + colWidths[0] + colWidths[1], yPosition)
        pdf.text('P-value', margin + colWidths[0] + colWidths[1] + colWidths[2], yPosition)
        pdf.text('R²', margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], yPosition)
        pdf.text('N', margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], yPosition)
        yPosition += 7

        // 구분선
        pdf.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2)
        yPosition += 3

        // 테이블 데이터
        pdf.setFont('helvetica', 'normal')
        significantResults.forEach((result, index) => {
          // 페이지 끝에 도달하면 새 페이지
          if (yPosition > pageHeight - 30) {
            pdf.addPage()
            yPosition = margin
            
            // 새 페이지에 헤더 다시 출력
            pdf.setFontSize(10)
            pdf.setFont('helvetica', 'bold')
            pdf.text('X Variable', margin, yPosition)
            pdf.text('Y Variable', margin + colWidths[0], yPosition)
            pdf.text('Pearson r', margin + colWidths[0] + colWidths[1], yPosition)
            pdf.text('P-value', margin + colWidths[0] + colWidths[1] + colWidths[2], yPosition)
            pdf.text('R²', margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], yPosition)
            pdf.text('N', margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], yPosition)
            yPosition += 7
            pdf.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2)
            yPosition += 3
            pdf.setFont('helvetica', 'normal')
          }

          const pearsonCorr = formatNumber(result.statistics.pearsonCorr, 3)
          const pValue = formatPValue(result.statistics.pearsonP)
          const rSquared = formatNumber(result.statistics.rSquared, 3)
          const significance = getSignificanceLevel(result.statistics.pearsonP)

          // 긴 변수명 처리
          const xVar = result.xColumn.length > 20 ? result.xColumn.substring(0, 17) + '...' : result.xColumn
          const yVar = result.yColumn.length > 20 ? result.yColumn.substring(0, 17) + '...' : result.yColumn

          pdf.text(xVar, margin, yPosition)
          pdf.text(yVar, margin + colWidths[0], yPosition)
          pdf.text(pearsonCorr + significance, margin + colWidths[0] + colWidths[1], yPosition)
          pdf.text(pValue, margin + colWidths[0] + colWidths[1] + colWidths[2], yPosition)
          pdf.text(rSquared, margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], yPosition)
          pdf.text(result.dataCount.toString(), margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], yPosition)
          
          yPosition += 6
        })

        yPosition += 10
      }

      // 통계 요약 (페이지 하단)
      if (yPosition > pageHeight - 50) {
        pdf.addPage()
        yPosition = margin
      }

      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Statistical Summary', margin, yPosition)
      yPosition += 10

      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'normal')
      
      const totalCombinations = summary.totalCombinations
      const significantCount = summary.significantCombinations
      const significanceRate = ((significantCount / totalCombinations) * 100).toFixed(1)

      pdf.text(`Total combinations analyzed: ${totalCombinations}`, margin, yPosition)
      yPosition += 6
      pdf.text(`Significant correlations found: ${significantCount}`, margin, yPosition)
      yPosition += 6
      pdf.text(`Significance rate: ${significanceRate}%`, margin, yPosition)
      yPosition += 6
      pdf.text(`Analysis completed in: ${(summary.executionTime / 1000).toFixed(1)} seconds`, margin, yPosition)
      yPosition += 15

      // 푸터
      if (yPosition > pageHeight - 30) {
        pdf.addPage()
        yPosition = margin
      }

      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'italic')
      pdf.text('*** p < 0.001, ** p < 0.01, * p < 0.05', margin, yPosition)
      yPosition += 7
      pdf.text('This report was automatically generated by Geochemistry Data Analyzer.', margin, yPosition)

      // PDF 저장 (더 작은 파일 크기)
      const fileName = `geochemistry_scan_report_${new Date().toISOString().slice(0, 10)}.pdf`
      pdf.save(fileName)

    } catch (error) {
      console.error('PDF generation failed:', error)
      alert('PDF 생성 중 오류가 발생했습니다.')
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  const significantResults = results.filter(r => r.isSignificant)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div className="flex items-center">
            <FileText className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-800">스캔 리포트</h2>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={generatePDF}
              disabled={isGeneratingPDF}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center"
            >
              {isGeneratingPDF ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  생성 중...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  PDF 다운로드 (영어)
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 리포트 내용 */}
        <div className="p-6 space-y-6">
          {/* 기본 정보 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-800 mb-3 flex items-center">
              <Database className="h-5 w-5 mr-2" />
              분석 정보
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">파일명:</span> {summary.fileName}
              </div>
              <div>
                <span className="font-medium">실행시간:</span> {(summary.executionTime / 1000).toFixed(1)}초
              </div>
              <div>
                <span className="font-medium">총 조합:</span> {summary.totalCombinations}개
              </div>
              <div>
                <span className="font-medium">유의미한 조합:</span> {summary.significantCombinations}개
              </div>
              <div>
                <span className="font-medium">상관계수 임계값:</span> {summary.scanOptions.threshold}
              </div>
              <div>
                <span className="font-medium">P-value 임계값:</span> {summary.scanOptions.pThreshold}
              </div>
            </div>
          </div>

          {/* 요약 통계 */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-600">{summary.totalCombinations}</div>
              <div className="text-sm text-gray-600">총 분석 조합</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">{summary.significantCombinations}</div>
              <div className="text-sm text-gray-600">유의미한 상관관계</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-purple-600">
                {summary.significantCombinations > 0 ? 
                  ((summary.significantCombinations / summary.totalCombinations) * 100).toFixed(1) : '0.0'}%
              </div>
              <div className="text-sm text-gray-600">유의미한 비율</div>
            </div>
          </div>

          {/* 유의미한 결과 테이블 */}
          {significantResults.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                유의미한 상관관계 ({significantResults.length}개)
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">X 변수</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Y 변수</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Pearson r</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">P-value</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">R²</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">데이터 수</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {significantResults.map((result, index) => (
                      <tr key={result.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{result.xColumn}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{result.yColumn}</td>
                        <td className="px-4 py-3 text-sm text-center">
                          <span className={`font-medium ${Math.abs(result.statistics.pearsonCorr || 0) > 0.7 ? 'text-red-600' : 
                            Math.abs(result.statistics.pearsonCorr || 0) > 0.5 ? 'text-orange-600' : 'text-blue-600'}`}>
                            {formatNumber(result.statistics.pearsonCorr, 3)}
                            <span className="text-red-500 ml-1">
                              {getSignificanceLevel(result.statistics.pearsonP)}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-gray-600">
                          {formatPValue(result.statistics.pearsonP)}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-gray-600">
                          {formatNumber(result.statistics.rSquared, 3)}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-gray-600">
                          {result.dataCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* 범례 */}
              <div className="mt-4 text-sm text-gray-600">
                <p>*** p &lt; 0.001, ** p &lt; 0.01, * p &lt; 0.05</p>
              </div>
            </div>
          )}

          {/* 결과가 없는 경우 */}
          {significantResults.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">
                <AlertCircle className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-600">유의미한 상관관계가 발견되지 않았습니다</h3>
              <p className="text-gray-500 mt-1">
                임계값을 낮추거나 다른 분석 방법을 시도해보세요.
              </p>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="border-t border-gray-200 px-6 py-4 text-center">
          <div className="flex items-center justify-center text-sm text-gray-500">
            <Clock className="h-4 w-4 mr-1" />
            생성일시: {new Date().toLocaleString('ko-KR')}
          </div>
        </div>
      </div>
    </div>
  )
} 