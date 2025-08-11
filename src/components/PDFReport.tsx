'use client'

import { useState } from 'react'
import { ScanResult, ScanSummary, GeochemData } from '@/types/geochem'
import { X, FileText, Download, Printer, Brain, BarChart3 } from 'lucide-react'

interface PDFReportProps {
  isOpen: boolean
  onClose: () => void
  scanResults: ScanResult[]
  scanSummary: ScanSummary | null
  data: GeochemData
}

export default function PDFReport({ 
  isOpen, 
  onClose, 
  scanResults, 
  scanSummary, 
  data 
}: PDFReportProps) {
  const [reportType, setReportType] = useState<'detailed' | 'summary'>('summary')
  const [isGenerating, setIsGenerating] = useState(false)

  if (!isOpen || !scanSummary) return null

  // AI 추천 결과 필터링
  const aiRecommended = scanResults.filter(result => result.aiRecommended)
  const significantResults = scanResults.filter(result => result.isSignificant)
  const topResults = [...significantResults]
    .sort((a, b) => Math.abs(b.statistics.pearsonCorr || 0) - Math.abs(a.statistics.pearsonCorr || 0))
    .slice(0, 10)

  const generateDetailedReport = () => {
    return `
      <div class="detailed-report">
        <h1>Geochemical Analysis - Detailed Report</h1>
        <div class="metadata">
          <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Dataset:</strong> ${data.data.length} samples, ${data.numericColumns.length + data.nonNumericColumns.length} variables</p>
          <p><strong>Analysis Type:</strong> Comprehensive correlation analysis</p>
        </div>

        <h2>Executive Summary</h2>
        <p>This report presents a comprehensive geochemical correlation analysis of ${data.data.length} samples across ${data.numericColumns.length + data.nonNumericColumns.length} geochemical variables. The analysis identified ${significantResults.length} statistically significant correlations (p &lt; 0.05, |r| &gt; 0.5) out of ${scanResults.length} possible variable combinations.</p>

        ${scanSummary.aiRecommendationsUsed ? `
        <h2>AI-Enhanced Analysis</h2>
        <p>This analysis incorporated AI recommendations from ${scanSummary.scanOptions?.aiProvider || 'AI provider'}, which identified ${aiRecommended.length} geochemically significant variable combinations. The AI analysis considered established geochemical principles and mineral chemistry relationships to prioritize the most meaningful correlations.</p>
        ` : ''}

        <h2>Methodology</h2>
        <p>The correlation analysis employed Pearson correlation coefficients to quantify linear relationships between geochemical variables. Statistical significance was assessed using p-values, with α = 0.05 as the significance threshold. Effect sizes were interpreted following Cohen's conventions: small (|r| = 0.1), medium (|r| = 0.3), and large (|r| = 0.5) effects.</p>

        <h2>Key Findings</h2>
        <div class="findings">
          ${topResults.map((result, index) => `
            <div class="finding">
              <h3>${index + 1}. ${result.xLabel} vs ${result.yLabel}</h3>
              <ul>
                <li><strong>Correlation:</strong> r = ${(result.statistics.pearsonCorr || 0).toFixed(4)} (${Math.abs(result.statistics.pearsonCorr || 0) > 0.7 ? 'Strong' : Math.abs(result.statistics.pearsonCorr || 0) > 0.5 ? 'Moderate' : 'Weak'})</li>
                <li><strong>Statistical Significance:</strong> p ${(result.statistics.pearsonP || 0) < 0.001 ? '< 0.001' : '= ' + (result.statistics.pearsonP || 0).toFixed(4)}</li>
                <li><strong>Effect Size:</strong> R² = ${(result.statistics.rSquared || 0).toFixed(4)} (${((result.statistics.rSquared || 0) * 100).toFixed(1)}% of variance explained)</li>
                ${result.aiRecommended ? `<li><strong>AI Assessment:</strong> ${result.aiReason || 'Geochemically significant relationship identified'}</li>` : ''}
              </ul>
              <p class="interpretation">
                ${getInterpretation(result)}
              </p>
            </div>
          `).join('')}
        </div>

        <h2>Statistical Summary</h2>
        <div class="statistics">
          <table>
            <tr><th>Metric</th><th>Value</th></tr>
            <tr><td>Total Combinations Analyzed</td><td>${scanResults.length}</td></tr>
            <tr><td>Significant Correlations</td><td>${significantResults.length}</td></tr>
            <tr><td>Significance Rate</td><td>${((significantResults.length / scanResults.length) * 100).toFixed(1)}%</td></tr>
            <tr><td>Strongest Correlation</td><td>|r| = ${Math.max(...scanResults.map(r => Math.abs(r.statistics.pearsonCorr || 0))).toFixed(4)}</td></tr>
            ${scanSummary.aiRecommendationsUsed ? `<tr><td>AI Recommendations</td><td>${aiRecommended.length}</td></tr>` : ''}
          </table>
        </div>

        <h2>Geological Implications</h2>
        <p>The identified correlations provide insights into:</p>
        <ul>
          <li><strong>Mineral Chemistry:</strong> Element associations reflecting primary and secondary mineral compositions</li>
          <li><strong>Petrogenetic Processes:</strong> Correlations indicating fractional crystallization, partial melting, or metamorphic processes</li>
          <li><strong>Alteration Patterns:</strong> Element mobility during weathering or hydrothermal alteration</li>
          <li><strong>Source Characteristics:</strong> Geochemical signatures reflecting crustal vs. mantle sources</li>
        </ul>

        <h2>Data Quality Assessment</h2>
        <p>Data completeness: ${((data.data.filter((row: any) => Object.values(row).every(val => val !== null && val !== undefined)).length / data.data.length) * 100).toFixed(1)}% complete cases. The analysis employed pairwise deletion for missing values to maximize sample size for each correlation.</p>

        <h2>Recommendations</h2>
        <ul>
          <li>Further investigate the strongest correlations through detailed petrographic analysis</li>
          <li>Consider multivariate techniques (PCA, cluster analysis) to identify geochemical groupings</li>
          <li>Validate key relationships with additional sampling or analytical methods</li>
          <li>Integrate results with geological mapping and structural data</li>
        </ul>

        <footer>
          <p><em>Report generated by Geochemistry Analyzer v0.1.5</em></p>
        </footer>
      </div>
    `
  }

  const generateSummaryReport = () => {
    const displayResults = scanSummary.aiRecommendationsUsed ? aiRecommended : topResults
    
    return `
      <div class="summary-report">
        <h1>Geochemical Analysis - Summary Report</h1>
                 <div class="metadata">
           <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
           <p><strong>Dataset:</strong> ${data.data.length} samples</p>
           <p><strong>Analysis:</strong> ${scanSummary.aiRecommendationsUsed ? 'AI-Enhanced' : 'Comprehensive'} Correlation Analysis</p>
         </div>

        <div class="overview">
          <h2>Analysis Overview</h2>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="number">${scanResults.length}</span>
              <span class="label">Total Combinations</span>
            </div>
            <div class="stat-item">
              <span class="number">${significantResults.length}</span>
              <span class="label">Significant Results</span>
            </div>
            ${scanSummary.aiRecommendationsUsed ? `
            <div class="stat-item">
              <span class="number">${aiRecommended.length}</span>
              <span class="label">AI Recommended</span>
            </div>
            ` : ''}
          </div>
        </div>

        <h2>${scanSummary.aiRecommendationsUsed ? 'AI-Recommended' : 'Top'} Correlations</h2>
        <div class="results-grid">
          ${displayResults.slice(0, 8).map((result, index) => `
            <div class="result-card ${result.isSignificant ? 'significant' : ''}">
              <h3>${result.xLabel} vs ${result.yLabel}</h3>
              <div class="correlation-value">
                r = ${(result.statistics.pearsonCorr || 0).toFixed(3)}
              </div>
              <div class="p-value">
                p ${(result.statistics.pearsonP || 0) < 0.001 ? '< 0.001' : '= ' + (result.statistics.pearsonP || 0).toFixed(3)}
              </div>
              ${result.aiRecommended ? `
                <div class="ai-badge">🤖 AI Recommended</div>
                ${result.aiReason ? `<div class="ai-reason">${result.aiReason}</div>` : ''}
              ` : ''}
            </div>
          `).join('')}
        </div>

        ${scanSummary.aiRecommendationsUsed ? `
                 <div class="ai-section">
           <h2>AI Analysis Summary</h2>
           <p>AI analysis using ${scanSummary.scanOptions?.aiProvider || 'advanced algorithms'} identified geochemically meaningful relationships based on established mineral chemistry and petrogenetic principles.</p>
         </div>
        ` : ''}

        <footer>
          <p><em>Generated by Geochemistry Analyzer</em></p>
        </footer>
      </div>
    `
  }

  const getInterpretation = (result: ScanResult): string => {
    const corr = Math.abs(result.statistics.pearsonCorr || 0)
    const elements = [result.xLabel, result.yLabel]
    
    if (elements.some(el => el.includes('SiO2')) && elements.some(el => el.includes('Al2O3'))) {
      return "This correlation reflects primary igneous differentiation processes, where SiO2 and Al2O3 contents are controlled by feldspar crystallization and fractionation."
    }
    if (elements.some(el => el.includes('Fe')) && elements.some(el => el.includes('Mg'))) {
      return "The Fe-Mg relationship indicates mafic mineral control, typical of olivine and pyroxene fractionation during magmatic evolution."
    }
    if (elements.some(el => el.includes('K2O')) && elements.some(el => el.includes('Na2O'))) {
      return "K2O-Na2O correlations reflect alkali feldspar composition and crystallization temperature effects during magmatic processes."
    }
    
    if (corr > 0.8) {
      return "This very strong correlation suggests these elements are controlled by the same mineral phase or geochemical process."
    } else if (corr > 0.6) {
      return "This strong correlation indicates a significant geochemical relationship, likely reflecting shared mineral hosts or coupled geochemical behavior."
    } else if (corr > 0.4) {
      return "This moderate correlation suggests a meaningful geochemical relationship that warrants further investigation."
    }
    
    return "This correlation may reflect secondary processes such as alteration, weathering, or analytical uncertainty."
  }

  const handlePrint = () => {
    const reportContent = reportType === 'detailed' ? generateDetailedReport() : generateSummaryReport()
    
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Geochemical Analysis Report</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              line-height: 1.6; 
              max-width: 210mm; 
              margin: 0 auto; 
              padding: 20px; 
              color: #333;
            }
            h1 { 
              color: #2563eb; 
              border-bottom: 3px solid #2563eb; 
              padding-bottom: 10px; 
            }
            h2 { 
              color: #1d4ed8; 
              border-bottom: 1px solid #e5e7eb; 
              padding-bottom: 5px; 
            }
            h3 { 
              color: #1e40af; 
            }
            .metadata { 
              background: #f3f4f6; 
              padding: 15px; 
              border-radius: 8px; 
              margin: 20px 0; 
            }
            .finding { 
              margin: 20px 0; 
              padding: 15px; 
              border-left: 4px solid #3b82f6; 
              background: #f8fafc; 
            }
            .interpretation { 
              font-style: italic; 
              color: #4b5563; 
              margin-top: 10px; 
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 15px 0; 
            }
            th, td { 
              border: 1px solid #d1d5db; 
              padding: 8px; 
              text-align: left; 
            }
            th { 
              background: #f3f4f6; 
            }
            .stats-grid { 
              display: grid; 
              grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); 
              gap: 15px; 
              margin: 20px 0; 
            }
            .stat-item { 
              text-align: center; 
              padding: 15px; 
              background: #f3f4f6; 
              border-radius: 8px; 
            }
            .stat-item .number { 
              display: block; 
              font-size: 2em; 
              font-weight: bold; 
              color: #2563eb; 
            }
            .stat-item .label { 
              color: #6b7280; 
            }
            .results-grid { 
              display: grid; 
              grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
              gap: 15px; 
              margin: 20px 0; 
            }
            .result-card { 
              border: 1px solid #d1d5db; 
              border-radius: 8px; 
              padding: 15px; 
              background: white; 
            }
            .result-card.significant { 
              border-color: #10b981; 
              background: #f0fdf4; 
            }
            .correlation-value { 
              font-size: 1.5em; 
              font-weight: bold; 
              color: #2563eb; 
            }
            .p-value { 
              color: #6b7280; 
              font-size: 0.9em; 
            }
            .ai-badge { 
              background: #fbbf24; 
              color: white; 
              padding: 4px 8px; 
              border-radius: 4px; 
              font-size: 0.8em; 
              margin-top: 8px; 
            }
            .ai-reason { 
              font-style: italic; 
              color: #4b5563; 
              font-size: 0.9em; 
              margin-top: 5px; 
            }
            footer { 
              margin-top: 40px; 
              padding-top: 20px; 
              border-top: 1px solid #e5e7eb; 
              text-align: center; 
              color: #6b7280; 
            }
            @media print {
              body { margin: 0; }
              .result-card { break-inside: avoid; }
              .finding { break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          ${reportContent}
        </body>
      </html>
    `)
    
    printWindow.document.close()
    printWindow.print()
  }

  const handleDownloadPDF = async () => {
    setIsGenerating(true)
    
    try {
      // jsPDF를 사용한 PDF 생성 (간단한 버전)
      const reportContent = reportType === 'detailed' ? generateDetailedReport() : generateSummaryReport()
      
      // 임시로 브라우저 인쇄 기능 사용
      handlePrint()
      
    } catch (error) {
      console.error('PDF generation failed:', error)
      alert('PDF 생성 중 오류가 발생했습니다. 브라우저 인쇄 기능을 사용해주세요.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">
            <FileText className="h-6 w-6 inline mr-2" />
            PDF 리포트 생성
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 내용 */}
        <div className="p-6">
          {/* 리포트 타입 선택 */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">리포트 타입 선택</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                onClick={() => setReportType('summary')}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  reportType === 'summary'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center mb-2">
                  <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
                  <h4 className="font-medium">개요 리포트</h4>
                </div>
                <p className="text-sm text-gray-600">
                  {scanSummary.aiRecommendationsUsed 
                    ? 'AI 추천 조합 위주의 간단한 요약' 
                    : '상위 상관관계 중심의 간단한 요약'
                  }
                </p>
              </div>

              <div
                onClick={() => setReportType('detailed')}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  reportType === 'detailed'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center mb-2">
                  <Brain className="h-5 w-5 mr-2 text-purple-600" />
                  <h4 className="font-medium">상세 리포트</h4>
                </div>
                <p className="text-sm text-gray-600">
                  전문적인 영어 분석 보고서 (학술/업무용)
                </p>
              </div>
            </div>
          </div>

          {/* 미리보기 정보 */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">리포트 정보</h4>
                         <div className="text-sm text-gray-600 space-y-1">
               <p>• 데이터: {data.data.length}개 샘플</p>
               <p>• 분석 조합: {scanResults.length}개</p>
               <p>• 유의한 상관관계: {significantResults.length}개</p>
               {scanSummary.aiRecommendationsUsed && (
                 <p>• AI 추천: {aiRecommended.length}개</p>
               )}
             </div>
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              disabled={isGenerating}
              className="flex-1 flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Printer className="h-4 w-4 mr-2" />
              브라우저 인쇄
            </button>
            
            <button
              onClick={handleDownloadPDF}
              disabled={isGenerating}
              className="flex-1 flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <Download className="h-4 w-4 mr-2" />
              {isGenerating ? '생성 중...' : 'PDF 다운로드'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 