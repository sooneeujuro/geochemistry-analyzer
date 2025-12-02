'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell, LabelList, ErrorBar, Customized } from 'recharts'
import { GeochemData, StatisticalResult, ColumnSelection, ChartStyleOptions, PlotStyleOptions, GraphSettings, ReferenceImage as ReferenceImageType, CustomAxisRange as CustomAxisRangeType, TrendlineStyle, ErrorBarSettings } from '@/types/geochem'
import { Settings, Palette, Move3D, Download, Shapes, Eye, EyeOff, ZoomIn, ZoomOut, TrendingUp, TrendingDown, AlertTriangle, Image as ImageIcon, Upload, Trash2, Eye as EyeIcon, Crop as CropIcon, Check, X } from 'lucide-react'
import { standardDeviation } from 'simple-statistics'
import { createWorker } from 'tesseract.js'
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

interface ScatterPlotProps {
  data: GeochemData
  selectedColumns: ColumnSelection
  statistics: StatisticalResult
  isPCAMode?: boolean
  clusterData?: number[]
  typeStatistics?: Array<{
    type: string
    count: number
    pearsonCorr?: number
    spearmanCorr?: number
    pValue?: number
    rSquared?: number
    slope?: number
    intercept?: number
  }>
  initialGraphSettings?: Partial<GraphSettings>
  onSettingsChange?: (settings: GraphSettings) => void
}

// 축 범위 타입 직접 정의
interface CustomAxisRange {
  xMin: number | 'auto'
  xMax: number | 'auto'
  yMin: number | 'auto'
  yMax: number | 'auto'
}

// 레퍼런스 이미지 타입
interface ReferenceImage {
  id: string
  name: string
  imageData: string // base64
  // 이미지 크기 정보
  naturalWidth: number
  naturalHeight: number
  // 크롭 영역 (이미지 내 그래프 영역, 픽셀 좌표)
  cropX: number
  cropY: number
  cropWidth: number
  cropHeight: number
  // 차트 축 범위 (데이터 값)
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  opacity: number
  visible: boolean
}

// 커스텀 마커 컴포넌트
const CustomMarker = (props: any) => {
  const { cx, cy, fill, shape, size, opacity, strokeWidth, strokeColor } = props
  const radius = size / 10

  switch (shape) {
    case 'triangle':
      const triangleHeight = radius * 1.5
      return (
        <polygon
          points={`${cx},${cy - triangleHeight} ${cx - radius},${cy + triangleHeight/2} ${cx + radius},${cy + triangleHeight/2}`}
          fill={fill}
          fillOpacity={opacity}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      )
    case 'square':
      return (
        <rect
          x={cx - radius}
          y={cy - radius}
          width={radius * 2}
          height={radius * 2}
          fill={fill}
          fillOpacity={opacity}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      )
    case 'diamond':
      return (
        <polygon
          points={`${cx},${cy - radius} ${cx + radius},${cy} ${cx},${cy + radius} ${cx - radius},${cy}`}
          fill={fill}
          fillOpacity={opacity}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      )
    default: // circle
      return (
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill={fill}
          fillOpacity={opacity}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      )
  }
}

// 기본 그래프 설정값
const defaultGraphSettings: GraphSettings = {
  axisRange: { xMin: 'auto', xMax: 'auto', yMin: 'auto', yMax: 'auto' },
  xLogScale: false,
  yLogScale: false,
  xTickInterval: 'auto',
  yTickInterval: 'auto',
  invertXAxis: false,
  invertYAxis: false,
  maintain1to1Ratio: false,
  chartAspectRatio: null,
  styleOptions: {
    numberFormat: 'normal',
    fontFamily: 'Arial',
    axisTitleBold: true,
    axisNumberSize: 12,
    axisTitleSize: 14
  },
  plotOptions: {
    size: 60,
    shape: 'circle',
    opacity: 0.7,
    strokeWidth: 1,
    strokeColor: '#000000',
    useCustomColors: false,
    customColors: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#F97316', '#06B6D4', '#84CC16']
  },
  trendlineStyle: { color: '#FF0000', strokeWidth: 2, opacity: 0.8 },
  backgroundColor: '#FFFFFF',
  showGridlines: true,
  show1to1Line: false,
  showChartTitle: false,
  chartTitle: '',
  showDataLabels: false,
  labelFontSize: 10,
  xNumberFormat: 'normal',
  yNumberFormat: 'normal',
  xExponentialFormat: 'standard',
  yExponentialFormat: 'standard',
  xDecimalPlaces: 2,
  yDecimalPlaces: 2,
  xAxisLabelOffset: -50,
  yAxisLabelOffset: -10,
  xErrorBar: { enabled: false, mode: 'percentage', column: '', value: 5 },
  yErrorBar: { enabled: false, mode: 'percentage', column: '', value: 5 },
  showOverallTrend: true,
  showTypeTrends: {},
  showAllTypeTrends: false,
  visibleTypes: {},
  useVisibleDataRange: false,
  referenceImages: []
}

export { defaultGraphSettings }

export default function ScatterPlot({ data, selectedColumns, statistics, isPCAMode = false, clusterData = [], typeStatistics = [], initialGraphSettings, onSettingsChange }: ScatterPlotProps) {
  const chartRef = useRef<HTMLDivElement>(null)

  // initialGraphSettings에서 초기값 가져오기
  const initSettings = { ...defaultGraphSettings, ...initialGraphSettings }

  const [styleOptions, setStyleOptions] = useState<ChartStyleOptions>(initSettings.styleOptions)

  const [xNumberFormat, setXNumberFormat] = useState<'normal' | 'scientific' | 'comma'>(initSettings.xNumberFormat)
  const [yNumberFormat, setYNumberFormat] = useState<'normal' | 'scientific' | 'comma'>(initSettings.yNumberFormat)
  const [xExponentialFormat, setXExponentialFormat] = useState<'standard' | 'superscript'>(initSettings.xExponentialFormat)
  const [yExponentialFormat, setYExponentialFormat] = useState<'standard' | 'superscript'>(initSettings.yExponentialFormat)
  const [xDecimalPlaces, setXDecimalPlaces] = useState(initSettings.xDecimalPlaces)
  const [yDecimalPlaces, setYDecimalPlaces] = useState(initSettings.yDecimalPlaces)
  const [xAxisLabelOffset, setXAxisLabelOffset] = useState(initSettings.xAxisLabelOffset)
  const [yAxisLabelOffset, setYAxisLabelOffset] = useState(initSettings.yAxisLabelOffset)

  const [plotOptions, setPlotOptions] = useState<PlotStyleOptions>(initSettings.plotOptions)

  const [showGridlines, setShowGridlines] = useState(initSettings.showGridlines)
  const [backgroundColor, setBackgroundColor] = useState(initSettings.backgroundColor)
  const [visibleTypes, setVisibleTypes] = useState<Record<string, boolean>>(initSettings.visibleTypes)
  const [useVisibleDataRange, setUseVisibleDataRange] = useState(initSettings.useVisibleDataRange)
  const [showOverallTrend, setShowOverallTrend] = useState(initSettings.showOverallTrend)
  const [showTypeTrends, setShowTypeTrends] = useState<Record<string, boolean>>(initSettings.showTypeTrends)
  const [showAllTypeTrends, setShowAllTypeTrends] = useState(initSettings.showAllTypeTrends)

  const [trendlineStyle, setTrendlineStyle] = useState(initSettings.trendlineStyle)

  const [axisRange, setAxisRange] = useState<CustomAxisRange>(initSettings.axisRange)

  const [xLogScale, setXLogScale] = useState(initSettings.xLogScale)
  const [yLogScale, setYLogScale] = useState(initSettings.yLogScale)
  const [maintain1to1Ratio, setMaintain1to1Ratio] = useState(initSettings.maintain1to1Ratio)
  const [chartAspectRatio, setChartAspectRatio] = useState<number | null>(initSettings.chartAspectRatio)
  const [xTickInterval, setXTickInterval] = useState<number | 'auto'>(initSettings.xTickInterval)
  const [yTickInterval, setYTickInterval] = useState<number | 'auto'>(initSettings.yTickInterval)
  const [show1to1Line, setShow1to1Line] = useState(initSettings.show1to1Line)
  const [chartTitle, setChartTitle] = useState(initSettings.chartTitle)
  const [showChartTitle, setShowChartTitle] = useState(initSettings.showChartTitle)
  const [invertXAxis, setInvertXAxis] = useState(initSettings.invertXAxis)
  const [invertYAxis, setInvertYAxis] = useState(initSettings.invertYAxis)
  const [showDataLabels, setShowDataLabels] = useState(initSettings.showDataLabels)
  const [labelFontSize, setLabelFontSize] = useState(initSettings.labelFontSize)

  const [showStylePanel, setShowStylePanel] = useState(false)
  const [showPlotPanel, setShowPlotPanel] = useState(false)
  const [showAxisPanel, setShowAxisPanel] = useState(false)
  const [showErrorBarPanel, setShowErrorBarPanel] = useState(false)
  const [showReferencePanel, setShowReferencePanel] = useState(false)

  // 레퍼런스 이미지 관련 state
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>(initSettings.referenceImages as ReferenceImage[])
  const [ocrProcessing, setOcrProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 크롭 에디터 state
  const [cropEditorOpen, setCropEditorOpen] = useState(false)
  const [cropEditorImage, setCropEditorImage] = useState<{id: string, imageData: string, name: string, naturalWidth: number, naturalHeight: number} | null>(null)
  const cropImageRef = useRef<HTMLImageElement>(null)
  const [cropImageLoaded, setCropImageLoaded] = useState(false)

  // ReactCrop state
  const [tempCrop, setTempCrop] = useState<Crop>({
    unit: '%',
    x: 10,
    y: 10,
    width: 80,
    height: 80
  })
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null)

  // 키보드 크롭 조정 state
  const [selectedCorner, setSelectedCorner] = useState<'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | null>(null)

  // 돋보기 state
  const [magnifierPosition, setMagnifierPosition] = useState<{x: number, y: number} | null>(null)
  const magnifierRef = useRef<HTMLCanvasElement>(null)

  // 오차범위 설정
  const [xErrorBarEnabled, setXErrorBarEnabled] = useState(initSettings.xErrorBar.enabled)
  const [xErrorBarMode, setXErrorBarMode] = useState<'column' | 'percentage' | 'fixed' | 'stddev' | 'stderr'>(initSettings.xErrorBar.mode)
  const [xErrorBarColumn, setXErrorBarColumn] = useState<string>(initSettings.xErrorBar.column)
  const [xErrorBarValue, setXErrorBarValue] = useState(initSettings.xErrorBar.value)

  const [yErrorBarEnabled, setYErrorBarEnabled] = useState(initSettings.yErrorBar.enabled)
  const [yErrorBarMode, setYErrorBarMode] = useState<'column' | 'percentage' | 'fixed' | 'stddev' | 'stderr'>(initSettings.yErrorBar.mode)
  const [yErrorBarColumn, setYErrorBarColumn] = useState<string>(initSettings.yErrorBar.column)
  const [yErrorBarValue, setYErrorBarValue] = useState(initSettings.yErrorBar.value)

  // 현재 그래프 설정을 GraphSettings 객체로 반환하는 함수
  const getCurrentSettings = (): GraphSettings => ({
    axisRange,
    xLogScale,
    yLogScale,
    xTickInterval,
    yTickInterval,
    invertXAxis,
    invertYAxis,
    maintain1to1Ratio,
    chartAspectRatio,
    styleOptions,
    plotOptions,
    trendlineStyle,
    backgroundColor,
    showGridlines,
    show1to1Line,
    showChartTitle,
    chartTitle,
    showDataLabels,
    labelFontSize,
    xNumberFormat,
    yNumberFormat,
    xExponentialFormat,
    yExponentialFormat,
    xDecimalPlaces,
    yDecimalPlaces,
    xAxisLabelOffset,
    yAxisLabelOffset,
    xErrorBar: { enabled: xErrorBarEnabled, mode: xErrorBarMode, column: xErrorBarColumn, value: xErrorBarValue },
    yErrorBar: { enabled: yErrorBarEnabled, mode: yErrorBarMode, column: yErrorBarColumn, value: yErrorBarValue },
    showOverallTrend,
    showTypeTrends,
    showAllTypeTrends,
    visibleTypes,
    useVisibleDataRange,
    referenceImages: referenceImages as ReferenceImageType[]
  })

  // 설정 변경시 콜백 호출
  useEffect(() => {
    if (onSettingsChange) {
      onSettingsChange(getCurrentSettings())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    axisRange, xLogScale, yLogScale, xTickInterval, yTickInterval, invertXAxis, invertYAxis,
    maintain1to1Ratio, chartAspectRatio, styleOptions, plotOptions, trendlineStyle, backgroundColor,
    showGridlines, show1to1Line, showChartTitle, chartTitle, showDataLabels, labelFontSize,
    xNumberFormat, yNumberFormat, xExponentialFormat, yExponentialFormat, xDecimalPlaces, yDecimalPlaces,
    xAxisLabelOffset, yAxisLabelOffset, xErrorBarEnabled, xErrorBarMode, xErrorBarColumn, xErrorBarValue,
    yErrorBarEnabled, yErrorBarMode, yErrorBarColumn, yErrorBarValue, showOverallTrend, showTypeTrends,
    showAllTypeTrends, visibleTypes, useVisibleDataRange, referenceImages
  ])

  // 레퍼런스 이미지 OCR 처리
  const processImageWithOCR = async (imageData: string): Promise<{ xMin: number; xMax: number; yMin: number; yMax: number } | null> => {
    try {
      setOcrProcessing(true)
      const worker = await createWorker('eng')
      const { data: { text } } = await worker.recognize(imageData)
      await worker.terminate()

      // 숫자 패턴 추출 (소수점 포함)
      const numbers = text.match(/\d+\.?\d*/g)
      if (numbers && numbers.length >= 4) {
        // 간단한 휴리스틱: 처음 4개 숫자를 xMin, xMax, yMin, yMax로 가정
        return {
          xMin: parseFloat(numbers[0]),
          xMax: parseFloat(numbers[1]),
          yMin: parseFloat(numbers[2]),
          yMax: parseFloat(numbers[3])
        }
      }
      return null
    } catch (error) {
      console.error('OCR failed:', error)
      return null
    } finally {
      setOcrProcessing(false)
    }
  }

  // 이미지 파일 처리
  const handleImageUpload = async (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const imageData = e.target?.result as string

      // 이미지 크기 정보를 얻기 위해 Image 객체 생성
      const img = new Image()
      img.onload = () => {
        // 크롭 에디터 열기 (고유 ID 생성)
        setCropEditorImage({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          imageData,
          name: file.name,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight
        })
        setCropImageLoaded(false) // 이미지 로드 상태 리셋
        setCropEditorOpen(true)
        setSelectedCorner(null) // 모서리 선택 해제
        setTempCrop({
          unit: '%',
          x: 10,
          y: 10,
          width: 80,
          height: 80
        })
      }
      img.src = imageData
    }
    reader.readAsDataURL(file)
  }

  // 크롭 확인 후 레퍼런스 이미지 추가
  const handleCropConfirm = async () => {
    if (!cropEditorImage || !cropImageRef.current || !completedCrop) return

    const image = cropImageRef.current

    // 화면에 표시된 이미지 크기
    const scaleX = cropEditorImage.naturalWidth / image.width
    const scaleY = cropEditorImage.naturalHeight / image.height

    // 픽셀 크롭 좌표를 원본 이미지 좌표로 변환
    const cropX = completedCrop.x * scaleX
    const cropY = completedCrop.y * scaleY
    const cropWidth = completedCrop.width * scaleX
    const cropHeight = completedCrop.height * scaleY

    // 캔버스로 크롭된 이미지 추출
    const canvas = document.createElement('canvas')
    canvas.width = cropWidth
    canvas.height = cropHeight
    const ctx = canvas.getContext('2d')

    if (ctx) {
      // 원본 이미지를 로드
      const img = new Image()
      img.onload = async () => {
        // 크롭된 부분만 캔버스에 그리기
        ctx.drawImage(
          img,
          cropX, cropY, cropWidth, cropHeight, // 소스 영역
          0, 0, cropWidth, cropHeight // 대상 영역
        )

        // 크롭된 이미지를 base64로 변환
        const croppedImageData = canvas.toDataURL('image/png')

        // 크롭된 영역에서 OCR 시도 (선택적)
        const ocrResult = await processImageWithOCR(croppedImageData)

        const newImage: ReferenceImage = {
          id: cropEditorImage.id,
          name: cropEditorImage.name,
          imageData: croppedImageData, // 크롭된 이미지 사용
          naturalWidth: cropWidth,
          naturalHeight: cropHeight,
          cropX: 0, // 크롭된 이미지는 전체 영역 사용
          cropY: 0,
          cropWidth: cropWidth,
          cropHeight: cropHeight,
          xMin: ocrResult?.xMin || 0,
          xMax: ocrResult?.xMax || 100,
          yMin: ocrResult?.yMin || 0,
          yMax: ocrResult?.yMax || 100,
          opacity: 30,
          visible: true
        }

        setReferenceImages(prev => [...prev, newImage])
        setCropEditorOpen(false)
        setCropEditorImage(null)
        setCompletedCrop(null)
        setCropImageLoaded(false)

        if (!ocrResult) {
          alert('⚠️ 자동 축 인식에 실패했습니다. 수동으로 범위를 입력해주세요.')
        }
      }
      img.src = cropEditorImage.imageData
    }
  }

  // 클립보드 이미지 처리
  const handlePaste = async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          handleImageUpload(file)
        }
      }
    }
  }

  // 돋보기 그리기
  const drawMagnifier = (mouseX: number, mouseY: number) => {
    if (!cropImageRef.current || !magnifierRef.current) return

    const img = cropImageRef.current
    const canvas = magnifierRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 돋보기 설정
    const magnifierSize = 120 // 돋보기 크기
    const zoomLevel = 3 // 확대 배율

    canvas.width = magnifierSize
    canvas.height = magnifierSize

    // 이미지에서의 실제 위치 계산
    const rect = img.getBoundingClientRect()
    const scaleX = img.naturalWidth / rect.width
    const scaleY = img.naturalHeight / rect.height
    const imgX = (mouseX - rect.left) * scaleX
    const imgY = (mouseY - rect.top) * scaleY

    // 확대할 영역 크기
    const sourceSize = magnifierSize / zoomLevel

    // 돋보기에 이미지 그리기
    ctx.drawImage(
      img,
      imgX - sourceSize / 2, // source x
      imgY - sourceSize / 2, // source y
      sourceSize, // source width
      sourceSize, // source height
      0, // dest x
      0, // dest y
      magnifierSize, // dest width
      magnifierSize // dest height
    )

    // 십자선 그리기
    ctx.strokeStyle = '#ff00ff'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(magnifierSize / 2, 0)
    ctx.lineTo(magnifierSize / 2, magnifierSize)
    ctx.moveTo(0, magnifierSize / 2)
    ctx.lineTo(magnifierSize, magnifierSize / 2)
    ctx.stroke()

    // 원형 테두리
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(magnifierSize / 2, magnifierSize / 2, magnifierSize / 2 - 1, 0, Math.PI * 2)
    ctx.stroke()
  }

  // 클립보드 이벤트 리스너 등록
  useEffect(() => {
    if (showReferencePanel) {
      window.addEventListener('paste', handlePaste as any)
      return () => window.removeEventListener('paste', handlePaste as any)
    }
  }, [showReferencePanel])

  // 크롭 에디터에서 전역 마우스 이벤트로 돋보기 작동
  useEffect(() => {
    if (!cropEditorOpen || !cropImageLoaded) return

    const handleGlobalMouseMove = (e: MouseEvent) => {
      // 모서리가 선택된 경우 마우스 이벤트 무시 (키보드 모드)
      if (selectedCorner) return

      if (!cropImageRef.current || !magnifierRef.current) return

      const rect = cropImageRef.current.getBoundingClientRect()

      // 마우스가 이미지 위에 있는지 확인
      if (e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top && e.clientY <= rect.bottom) {
        setMagnifierPosition({ x: e.clientX, y: e.clientY })
        drawMagnifier(e.clientX, e.clientY)
      } else {
        setMagnifierPosition(null)
      }
    }

    document.addEventListener('mousemove', handleGlobalMouseMove, true)

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove, true)
    }
  }, [cropEditorOpen, cropImageLoaded, selectedCorner])

  // 선택된 모서리에 돋보기 고정
  useEffect(() => {
    if (!cropEditorOpen || !selectedCorner || !completedCrop || !cropImageRef.current || !magnifierRef.current) {
      return
    }

    const img = cropImageRef.current
    const rect = img.getBoundingClientRect()

    // 모서리 위치 계산 (화면 좌표)
    let cornerX = 0, cornerY = 0

    switch (selectedCorner) {
      case 'topLeft':
        cornerX = rect.left + completedCrop.x
        cornerY = rect.top + completedCrop.y
        break
      case 'topRight':
        cornerX = rect.left + completedCrop.x + completedCrop.width
        cornerY = rect.top + completedCrop.y
        break
      case 'bottomLeft':
        cornerX = rect.left + completedCrop.x
        cornerY = rect.top + completedCrop.y + completedCrop.height
        break
      case 'bottomRight':
        cornerX = rect.left + completedCrop.x + completedCrop.width
        cornerY = rect.top + completedCrop.y + completedCrop.height
        break
    }

    setMagnifierPosition({ x: cornerX, y: cornerY })
    drawMagnifier(cornerX, cornerY)
  }, [selectedCorner, completedCrop, cropEditorOpen])

  // 키보드로 크롭 영역 조정
  useEffect(() => {
    if (!cropEditorOpen || !selectedCorner || !completedCrop || !cropImageRef.current) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) === -1) return

      e.preventDefault()

      const step = e.shiftKey ? 10 : 1 // Shift로 큰 단위 이동
      const img = cropImageRef.current!
      const rect = img.getBoundingClientRect()

      const newCrop = { ...completedCrop }

      // 모서리별로 조정
      switch (selectedCorner) {
        case 'topLeft':
          if (e.key === 'ArrowLeft') newCrop.x = Math.max(0, newCrop.x - step)
          if (e.key === 'ArrowRight') newCrop.x = Math.min(newCrop.x + newCrop.width - 10, newCrop.x + step)
          if (e.key === 'ArrowUp') newCrop.y = Math.max(0, newCrop.y - step)
          if (e.key === 'ArrowDown') newCrop.y = Math.min(newCrop.y + newCrop.height - 10, newCrop.y + step)
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            const deltaX = newCrop.x - completedCrop.x
            newCrop.width = completedCrop.width - deltaX
          }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            const deltaY = newCrop.y - completedCrop.y
            newCrop.height = completedCrop.height - deltaY
          }
          break
        case 'topRight':
          if (e.key === 'ArrowLeft') newCrop.width = Math.max(10, newCrop.width - step)
          if (e.key === 'ArrowRight') newCrop.width = Math.min(rect.width - newCrop.x, newCrop.width + step)
          if (e.key === 'ArrowUp') newCrop.y = Math.max(0, newCrop.y - step)
          if (e.key === 'ArrowDown') newCrop.y = Math.min(newCrop.y + newCrop.height - 10, newCrop.y + step)
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            const deltaY = newCrop.y - completedCrop.y
            newCrop.height = completedCrop.height - deltaY
          }
          break
        case 'bottomLeft':
          if (e.key === 'ArrowLeft') newCrop.x = Math.max(0, newCrop.x - step)
          if (e.key === 'ArrowRight') newCrop.x = Math.min(newCrop.x + newCrop.width - 10, newCrop.x + step)
          if (e.key === 'ArrowUp') newCrop.height = Math.max(10, newCrop.height - step)
          if (e.key === 'ArrowDown') newCrop.height = Math.min(rect.height - newCrop.y, newCrop.height + step)
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            const deltaX = newCrop.x - completedCrop.x
            newCrop.width = completedCrop.width - deltaX
          }
          break
        case 'bottomRight':
          if (e.key === 'ArrowLeft') newCrop.width = Math.max(10, newCrop.width - step)
          if (e.key === 'ArrowRight') newCrop.width = Math.min(rect.width - newCrop.x, newCrop.width + step)
          if (e.key === 'ArrowUp') newCrop.height = Math.max(10, newCrop.height - step)
          if (e.key === 'ArrowDown') newCrop.height = Math.min(rect.height - newCrop.y, newCrop.height + step)
          break
      }

      setCompletedCrop(newCrop)

      // tempCrop도 업데이트 (백분율로 변환)
      setTempCrop({
        unit: 'px',
        x: newCrop.x,
        y: newCrop.y,
        width: newCrop.width,
        height: newCrop.height
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cropEditorOpen, selectedCorner, completedCrop])

  // 타입 안전한 type 필드 접근
  const getTypeField = () => {
    if (selectedColumns.useTypeColumn && selectedColumns.selectedTypeColumn) {
      return selectedColumns.selectedTypeColumn
    }
    return null
  }

  // 차트 데이터 준비
  const chartData = useMemo(() => {
    if (!selectedColumns.x || !selectedColumns.y) return []

    const typeField = getTypeField()

    // 먼저 기본 데이터 생성
    const baseData = data.data.map((row, index) => {
      let xValue: number
      if (selectedColumns.x!.type === 'single') {
        xValue = parseFloat(row[selectedColumns.x!.numerator])
      } else {
        const numerator = parseFloat(row[selectedColumns.x!.numerator])
        const denominator = parseFloat(row[selectedColumns.x!.denominator!])
        xValue = numerator / denominator
      }

      let yValue: number
      if (selectedColumns.y!.type === 'single') {
        yValue = parseFloat(row[selectedColumns.y!.numerator])
      } else {
        const numerator = parseFloat(row[selectedColumns.y!.numerator])
        const denominator = parseFloat(row[selectedColumns.y!.denominator!])
        yValue = numerator / denominator
      }

      let type = 'All Data'
      if (isPCAMode && clusterData.length > index) {
        type = `Cluster ${clusterData[index]}`
      } else if (typeField && row[typeField]) {
        type = row[typeField]?.toString().trim() || 'Unknown'
      }

      return {
        x: xValue,
        y: yValue,
        type: type,
        originalIndex: index,
        ...row
      }
    }).filter(item => !isNaN(item.x) && !isNaN(item.y) && isFinite(item.x) && isFinite(item.y))

    // 오차범위 계산
    const calculateErrorBars = (
      data: typeof baseData,
      axis: 'x' | 'y',
      mode: 'column' | 'percentage' | 'fixed' | 'stddev' | 'stderr',
      column: string,
      value: number
    ): number[] => {
      const values = data.map(d => d[axis])

      switch (mode) {
        case 'column':
          // 컬럼에서 직접 읽기
          return data.map(d => {
            const dataRecord = d as any
            const errorValue = dataRecord[column] ? parseFloat(dataRecord[column]) : 0
            return isNaN(errorValue) ? 0 : Math.abs(errorValue)
          })
        case 'percentage':
          // 값의 n%
          return values.map(v => Math.abs(v * value / 100))
        case 'fixed':
          // 고정값
          return values.map(() => Math.abs(value))
        case 'stddev':
          // 표준편차
          try {
            const stddev = standardDeviation(values)
            return values.map(() => stddev)
          } catch {
            return values.map(() => 0)
          }
        case 'stderr':
          // 표준오차 (표준편차 / √n)
          try {
            const stddev = standardDeviation(values)
            const stderr = stddev / Math.sqrt(values.length)
            return values.map(() => stderr)
          } catch {
            return values.map(() => 0)
          }
        default:
          return values.map(() => 0)
      }
    }

    // X축 오차범위 추가
    let xErrors: number[] = []
    if (xErrorBarEnabled) {
      xErrors = calculateErrorBars(baseData, 'x', xErrorBarMode, xErrorBarColumn, xErrorBarValue)
    }

    // Y축 오차범위 추가
    let yErrors: number[] = []
    if (yErrorBarEnabled) {
      yErrors = calculateErrorBars(baseData, 'y', yErrorBarMode, yErrorBarColumn, yErrorBarValue)
    }

    // 오차범위를 데이터에 추가
    return baseData.map((item, index) => ({
      ...item,
      ...(xErrorBarEnabled && { errorX: xErrors[index] || 0 }),
      ...(yErrorBarEnabled && { errorY: yErrors[index] || 0 })
    }))
  }, [data, selectedColumns, isPCAMode, clusterData, xErrorBarEnabled, xErrorBarMode, xErrorBarColumn, xErrorBarValue, yErrorBarEnabled, yErrorBarMode, yErrorBarColumn, yErrorBarValue])
  
  // 타입별 데이터 그룹화 (고정된 색상 매핑)
  const { typeGroups, fixedColorMap } = useMemo(() => {
    const groups: Record<string, typeof chartData> = {}
    const allTypes = Array.from(new Set(chartData.map(item => item.type))).sort()
    
    const colorMap: Record<string, string> = {}
    allTypes.forEach((type, index) => {
      colorMap[type] = plotOptions.customColors[index % plotOptions.customColors.length]
    })

    chartData.forEach(item => {
      if (!groups[item.type]) {
        groups[item.type] = []
      }
      groups[item.type].push(item)
    })

    return { typeGroups: groups, fixedColorMap: colorMap }
  }, [chartData, plotOptions.customColors])

  // 전체 데이터 범위 계산
  const fullDataRange = useMemo(() => {
    if (chartData.length === 0) return { xMin: 0, xMax: 100, yMin: 0, yMax: 100 }
    
    const xValues = chartData.map(d => d.x)
    const yValues = chartData.map(d => d.y)
    
    const xMin = Math.min(...xValues)
    const xMax = Math.max(...xValues)
    const yMin = Math.min(...yValues)
    const yMax = Math.max(...yValues)
    
    const xRange = xMax - xMin
    const yRange = yMax - yMin
    const xPadding = xRange * 0.05
    const yPadding = yRange * 0.05
    
    return {
      xMin: xMin - xPadding,
      xMax: xMax + xPadding,
      yMin: yMin - yPadding,
      yMax: yMax + yPadding
    }
  }, [chartData])

  // 표시되는 데이터 범위 계산
  const visibleDataRange = useMemo(() => {
    const visibleData = chartData.filter(item => visibleTypes[item.type] !== false)
    if (visibleData.length === 0) return fullDataRange
    
    const xValues = visibleData.map(d => d.x)
    const yValues = visibleData.map(d => d.y)
    
    const xMin = Math.min(...xValues)
    const xMax = Math.max(...xValues)
    const yMin = Math.min(...yValues)
    const yMax = Math.max(...yValues)
    
    const xRange = xMax - xMin
    const yRange = yMax - yMin
    const xPadding = xRange * 0.05
    const yPadding = yRange * 0.05
    
    return {
      xMin: xMin - xPadding,
      xMax: xMax + xPadding,
      yMin: yMin - yPadding,
      yMax: yMax + yPadding
    }
  }, [chartData, visibleTypes, fullDataRange])

  const currentRange = useVisibleDataRange ? visibleDataRange : fullDataRange

  // 로그 스케일을 위한 안전한 domain 계산
  const getLogSafeDomain = (min: number | 'auto', max: number | 'auto', isLog: boolean): [number, number] | undefined => {
    if (min === 'auto' || max === 'auto') {
      return undefined
    }

    if (isLog) {
      // 로그 스케일의 경우 양수만 허용
      const safeMin = min <= 0 ? 0.0001 : min
      const safeMax = max <= 0 ? 1 : max
      return [safeMin, safeMax]
    }

    return [min, max]
  }

  // 초기 설정
  useEffect(() => {
    const types = Object.keys(typeGroups)
    const newVisibleTypes: Record<string, boolean> = {}
    const newShowTypeTrends: Record<string, boolean> = {}
    
    types.forEach(type => {
      if (!(type in visibleTypes)) {
        newVisibleTypes[type] = true
      }
      if (!(type in showTypeTrends)) {
        newShowTypeTrends[type] = false
      }
    })
    
    if (Object.keys(newVisibleTypes).length > 0) {
      setVisibleTypes(prev => ({ ...prev, ...newVisibleTypes }))
    }
    if (Object.keys(newShowTypeTrends).length > 0) {
      setShowTypeTrends(prev => ({ ...prev, ...newShowTypeTrends }))
    }
  }, [typeGroups])

  // 추세선 좌표 계산 함수 (두 점만 반환)
  const calculateTrendlineSegment = (slope: number, intercept: number, xRange: { xMin: number, xMax: number }) => {
    if (!isFinite(slope) || !isFinite(intercept)) return null
    
    return [
      { x: xRange.xMin, y: slope * xRange.xMin + intercept },
      { x: xRange.xMax, y: slope * xRange.xMax + intercept }
    ]
  }

  // 전체 추세선 데이터
  const overallTrendSegment = useMemo(() => {
    // 여러 가능한 statistics 구조 확인
    let slope: number | undefined
    let intercept: number | undefined
    
    const stats = statistics as any
    
    if (stats?.linearRegression?.slope !== undefined && stats?.linearRegression?.intercept !== undefined) {
      slope = stats.linearRegression.slope
      intercept = stats.linearRegression.intercept
    } else if (stats?.slope !== undefined && stats?.intercept !== undefined) {
      slope = stats.slope
      intercept = stats.intercept
    } else if (stats?.regression?.slope !== undefined && stats?.regression?.intercept !== undefined) {
      slope = stats.regression.slope
      intercept = stats.regression.intercept
    }
    
    if (slope !== undefined && intercept !== undefined) {
      return calculateTrendlineSegment(slope, intercept, currentRange)
    }
    
    return null
  }, [statistics, currentRange])

  // 타입별 추세선 데이터
  const typeRegressionSegments = useMemo(() => {
    const segments: Array<{ type: string, segment: any[], color: string }> = []
    
    typeStatistics.forEach(typeStat => {
      if (!showTypeTrends[typeStat.type] || visibleTypes[typeStat.type] === false) return
      if (typeStat.slope === undefined || typeStat.intercept === undefined) return
      
      const segment = calculateTrendlineSegment(typeStat.slope, typeStat.intercept, currentRange)
      if (segment) {
        segments.push({
          type: typeStat.type,
          segment,
          color: fixedColorMap[typeStat.type] || '#666666'
        })
      }
    })
    
    return segments
  }, [typeStatistics, showTypeTrends, visibleTypes, currentRange, fixedColorMap])

  // 토글 함수들
  const toggleTypeVisibility = (type: string) => {
    setVisibleTypes(prev => ({ ...prev, [type]: !prev[type] }))
  }

  const toggleAllTypes = () => {
    const allVisible = Object.values(visibleTypes).every(v => v)
    const newState = !allVisible
    const newVisibleTypes: Record<string, boolean> = {}
    Object.keys(typeGroups).forEach(type => {
      newVisibleTypes[type] = newState
    })
    setVisibleTypes(newVisibleTypes)
  }

  const toggleTypeTrendline = (type: string) => {
    setShowTypeTrends(prev => ({ ...prev, [type]: !prev[type] }))
  }

  const toggleAllTypeTrendlines = () => {
    const newState = !showAllTypeTrends
    setShowAllTypeTrends(newState)
    const newShowTypeTrends: Record<string, boolean> = {}
    Object.keys(typeGroups).forEach(type => {
      newShowTypeTrends[type] = newState
    })
    setShowTypeTrends(newShowTypeTrends)
  }

  const visibleData = chartData.filter(item => visibleTypes[item.type] !== false)

  // 위첨자 숫자 변환 함수
  const toSuperscript = (num: string) => {
    const superscriptMap: Record<string, string> = {
      '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
      '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
      '-': '⁻', '+': '⁺'
    }
    return num.split('').map(char => superscriptMap[char] || char).join('')
  }

  const formatXAxisLabel = (value: any) => {
    if (typeof value !== 'number' || !isFinite(value)) return ''

    switch (xNumberFormat) {
      case 'scientific':
        if (xExponentialFormat === 'superscript') {
          // 10^n 형식으로 변환
          const exp = value.toExponential(xDecimalPlaces)
          const match = exp.match(/^(-?\d+\.?\d*)e([+-]?\d+)$/)
          if (match) {
            const coefficient = parseFloat(match[1])
            const exponent = parseInt(match[2])
            // 항상 계수를 표시 (1×10⁴ 형식)
            return `${coefficient.toFixed(xDecimalPlaces)}×10${toSuperscript(exponent.toString())}`
          }
          return exp
        }
        return value.toExponential(xDecimalPlaces)
      case 'comma':
        return value.toLocaleString(undefined, { maximumFractionDigits: xDecimalPlaces })
      default:
        return value.toFixed(xDecimalPlaces)
    }
  }

  const formatYAxisLabel = (value: any) => {
    if (typeof value !== 'number' || !isFinite(value)) return ''

    switch (yNumberFormat) {
      case 'scientific':
        if (yExponentialFormat === 'superscript') {
          // 10^n 형식으로 변환
          const exp = value.toExponential(yDecimalPlaces)
          const match = exp.match(/^(-?\d+\.?\d*)e([+-]?\d+)$/)
          if (match) {
            const coefficient = parseFloat(match[1])
            const exponent = parseInt(match[2])
            // 항상 계수를 표시 (1×10⁴ 형식)
            return `${coefficient.toFixed(yDecimalPlaces)}×10${toSuperscript(exponent.toString())}`
          }
          return exp
        }
        return value.toExponential(yDecimalPlaces)
      case 'comma':
        return value.toLocaleString(undefined, { maximumFractionDigits: yDecimalPlaces })
      default:
        return value.toFixed(yDecimalPlaces)
    }
  }

  // 1:1 비율 유지를 위한 범위 계산
  const adjusted1to1Range = useMemo(() => {
    if (!maintain1to1Ratio) return currentRange

    const xRange = currentRange.xMax - currentRange.xMin
    const yRange = currentRange.yMax - currentRange.yMin
    const maxRange = Math.max(xRange, yRange)

    const xCenter = (currentRange.xMin + currentRange.xMax) / 2
    const yCenter = (currentRange.yMin + currentRange.yMax) / 2

    return {
      xMin: xCenter - maxRange / 2,
      xMax: xCenter + maxRange / 2,
      yMin: yCenter - maxRange / 2,
      yMax: yCenter + maxRange / 2
    }
  }, [currentRange, maintain1to1Ratio])

  // 커스텀 tick 생성 함수
  const generateTicks = (min: number, max: number, interval: number | 'auto') => {
    if (interval === 'auto') return undefined

    // 안전성 검사
    if (!isFinite(interval) || interval <= 0) return undefined
    if (!isFinite(min) || !isFinite(max)) return undefined
    if (min >= max) return undefined

    const ticks = []
    let current = Math.ceil(min / interval) * interval
    const maxTicks = 1000 // 최대 눈금 개수 제한

    while (current <= max && ticks.length < maxTicks) {
      ticks.push(current)
      current += interval
    }

    return ticks.length > 0 ? ticks : undefined
  }

  const xTicks = useMemo(() => {
    const min = axisRange.xMin === 'auto' ? adjusted1to1Range.xMin : axisRange.xMin
    const max = axisRange.xMax === 'auto' ? adjusted1to1Range.xMax : axisRange.xMax
    return generateTicks(min, max, xTickInterval)
  }, [axisRange.xMin, axisRange.xMax, adjusted1to1Range, xTickInterval])

  const yTicks = useMemo(() => {
    const min = axisRange.yMin === 'auto' ? adjusted1to1Range.yMin : axisRange.yMin
    const max = axisRange.yMax === 'auto' ? adjusted1to1Range.yMax : axisRange.yMax
    return generateTicks(min, max, yTickInterval)
  }, [axisRange.yMin, axisRange.yMax, adjusted1to1Range, yTickInterval])

  // 1:1 참조선 계산
  const oneToOneLineSegment = useMemo(() => {
    const xMin = axisRange.xMin === 'auto' ? adjusted1to1Range.xMin : axisRange.xMin
    const xMax = axisRange.xMax === 'auto' ? adjusted1to1Range.xMax : axisRange.xMax
    const yMin = axisRange.yMin === 'auto' ? adjusted1to1Range.yMin : axisRange.yMin
    const yMax = axisRange.yMax === 'auto' ? adjusted1to1Range.yMax : axisRange.yMax

    const overallMin = Math.max(xMin, yMin)
    const overallMax = Math.min(xMax, yMax)

    if (overallMin >= overallMax) return null

    return [
      { x: overallMin, y: overallMin },
      { x: overallMax, y: overallMax }
    ]
  }, [axisRange, adjusted1to1Range])

  const getAxisTitle = (config: NonNullable<ColumnSelection['x']>) => {
    if (config.type === 'single') {
      return config.numerator
    } else {
      return `${config.numerator}/${config.denominator}`
    }
  }

  const exportChart = async () => {
    if (!chartRef.current) return

    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: backgroundColor,
        scale: 2,
        logging: false,
        useCORS: true
      })

      const link = document.createElement('a')
      link.download = 'scatter-plot.png'
      link.href = canvas.toDataURL()
      link.click()
    } catch (error) {
      console.error('Export failed:', error)
      alert('이미지 내보내기에 실패했습니다.')
    }
  }

  const exportSVG = () => {
    if (!chartRef.current) return

    try {
      const svgElement = chartRef.current.querySelector('svg')
      if (!svgElement) {
        alert('SVG를 찾을 수 없습니다.')
        return
      }

      const clonedSvg = svgElement.cloneNode(true) as SVGElement

      // 배경색 추가
      const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      bgRect.setAttribute('width', '100%')
      bgRect.setAttribute('height', '100%')
      bgRect.setAttribute('fill', backgroundColor)
      clonedSvg.insertBefore(bgRect, clonedSvg.firstChild)

      // 인라인 스타일 중 transition 제거 (SVG에 불필요)
      const allElements = clonedSvg.querySelectorAll('*')
      allElements.forEach((el) => {
        const style = el.getAttribute('style')
        if (style && style.includes('transition')) {
          const cleanStyle = style.replace(/transition[^;]*;?/g, '').trim()
          if (cleanStyle) {
            el.setAttribute('style', cleanStyle)
          } else {
            el.removeAttribute('style')
          }
        }
      })

      // SVG 문자열 생성
      const serializer = new XMLSerializer()
      let svgString = serializer.serializeToString(clonedSvg)

      // Illustrator 호환성을 위한 문자열 수정
      // 1. xmlns:xlink 네임스페이스 추가 (중복 방지)
      if (!svgString.includes('xmlns:xlink')) {
        if (svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
          svgString = svgString.replace(
            'xmlns="http://www.w3.org/2000/svg"',
            'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1"'
          )
        }
      }

      // 2. image 태그의 href를 xlink:href로 변경
      svgString = svgString.replace(/(<image[^>]*)\shref="/gi, '$1 xlink:href="')

      // XML 선언 추가 (Illustrator 호환성)
      svgString = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + svgString

      // 다운로드
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `scatter-plot-${Date.now()}.svg`
      link.href = url
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('SVG export failed:', error)
      alert('SVG 내보내기에 실패했습니다.')
    }
  }

  if (!selectedColumns.x || !selectedColumns.y) {
    return (
      <div className="p-6 text-center text-gray-500">
        X축과 Y축을 선택해주세요
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 반응형 레이아웃: 옵션과 플롯 */}
      <div className="flex flex-col xl:flex-row gap-4">
        {/* 왼쪽: 옵션 패널들 */}
        <div className="space-y-4 xl:w-96 flex-shrink-0">
          {/* 컨트롤 패널 */}
          <div className="flex flex-wrap gap-2 p-4 bg-gray-50 rounded-lg">
        <button
          onClick={() => setShowStylePanel(!showStylePanel)}
          className={`flex items-center gap-2 px-3 py-2 border rounded-md transition-colors ${
            showStylePanel
              ? 'bg-blue-100 border-blue-400 text-blue-700 font-medium'
              : 'bg-white border-gray-300 hover:bg-gray-50'
          }`}
        >
          <Palette className="w-4 h-4" />
          차트 스타일
        </button>

        <button
          onClick={() => setShowPlotPanel(!showPlotPanel)}
          className={`flex items-center gap-2 px-3 py-2 border rounded-md transition-colors ${
            showPlotPanel
              ? 'bg-purple-100 border-purple-400 text-purple-700 font-medium'
              : 'bg-white border-gray-300 hover:bg-gray-50'
          }`}
        >
          <Shapes className="w-4 h-4" />
          플롯 스타일
        </button>

        <button
          onClick={() => setShowAxisPanel(!showAxisPanel)}
          className={`flex items-center gap-2 px-3 py-2 border rounded-md transition-colors ${
            showAxisPanel
              ? 'bg-green-100 border-green-400 text-green-700 font-medium'
              : 'bg-white border-gray-300 hover:bg-gray-50'
          }`}
        >
          <Move3D className="w-4 h-4" />
          축 범위
        </button>

        <button
          onClick={() => setShowErrorBarPanel(!showErrorBarPanel)}
          className={`flex items-center gap-2 px-3 py-2 border rounded-md transition-colors ${
            showErrorBarPanel
              ? 'bg-orange-100 border-orange-400 text-orange-700 font-medium'
              : 'bg-white border-gray-300 hover:bg-gray-50'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          오차범위
        </button>

        <button
          onClick={() => setShowReferencePanel(!showReferencePanel)}
          className={`flex items-center gap-2 px-3 py-2 border rounded-md transition-colors ${
            showReferencePanel
              ? 'bg-pink-100 border-pink-400 text-pink-700 font-medium'
              : 'bg-white border-gray-300 hover:bg-gray-50'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          레퍼런스
        </button>

        <button
          onClick={exportChart}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Download className="w-4 h-4" />
          PNG 저장
        </button>

        <button
          onClick={exportSVG}
          className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
        >
          <Download className="w-4 h-4" />
          SVG 저장
        </button>
      </div>

      {/* 타입별 데이터 표시 설정 */}
      {Object.keys(typeGroups).length > 1 && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex flex-wrap items-center gap-4 mb-3">
            <h3 className="font-medium">데이터 타입 표시 설정</h3>
            <button
              onClick={toggleAllTypes}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-white border rounded hover:bg-gray-50"
            >
              {Object.values(visibleTypes).every(v => v) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              전체 {Object.values(visibleTypes).every(v => v) ? '숨김' : '표시'}
            </button>
            <button
              onClick={() => setUseVisibleDataRange(!useVisibleDataRange)}
              className={`flex items-center gap-1 px-3 py-1 text-sm border rounded ${
                useVisibleDataRange ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-300'
              }`}
            >
              {useVisibleDataRange ? <ZoomIn className="w-4 h-4" /> : <ZoomOut className="w-4 h-4" />}
              {useVisibleDataRange ? '표시 데이터 범위' : '전체 데이터 범위'}
            </button>
          </div>
          
          {/* 추세선 제어 */}
          <div className="flex flex-wrap items-center gap-4 mb-3">
            <h4 className="font-medium text-sm">추세선 표시 설정</h4>
            <button
              onClick={() => setShowOverallTrend(!showOverallTrend)}
              className={`flex items-center gap-1 px-3 py-1 text-sm border rounded ${
                showOverallTrend ? 'bg-red-100 border-red-300 text-red-700' : 'bg-white border-gray-300'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              전체 추세선
            </button>
            <button
              onClick={toggleAllTypeTrendlines}
              className={`flex items-center gap-1 px-3 py-1 text-sm border rounded ${
                showAllTypeTrends ? 'bg-green-100 border-green-300 text-green-700' : 'bg-white border-gray-300'
              }`}
            >
              <TrendingDown className="w-4 h-4" />
              타입별 추세선 {showAllTypeTrends ? '모두 끄기' : '모두 보기'}
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {Object.keys(typeGroups).map(type => (
              <div key={type} className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={visibleTypes[type] !== false}
                    onChange={() => toggleTypeVisibility(type)}
                    className="rounded"
                  />
                  <div
                    className="w-3 h-3 rounded border"
                    style={{ backgroundColor: fixedColorMap[type] }}
                  />
                </div>
                <span className="text-sm truncate flex-1" title={type}>
                  {type} ({typeGroups[type].length})
                </span>
                <button
                  onClick={() => toggleTypeTrendline(type)}
                  className={`p-1 rounded ${
                    showTypeTrends[type] ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                  }`}
                  title={`${type} 추세선`}
                >
                  <TrendingUp className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 스타일 패널들 */}
      {showStylePanel && (
        <div className="p-4 bg-white border rounded-lg">
          <h3 className="font-medium mb-3">차트 스타일 설정</h3>

          {/* X축 숫자 형식 */}
          <div className="mb-4 pb-4 border-b">
            <h4 className="text-sm font-semibold mb-3 text-blue-700">X축 숫자 형식</h4>
            <div className={`grid gap-4 ${xNumberFormat === 'scientific' ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div>
                <label className="block text-sm font-medium mb-1">X축 숫자 형식</label>
                <select
                  value={xNumberFormat}
                  onChange={(e) => setXNumberFormat(e.target.value as any)}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="normal">일반</option>
                  <option value="scientific">과학적 표기법</option>
                  <option value="comma">천 단위 구분</option>
                </select>
              </div>
              {xNumberFormat === 'scientific' && (
                <div>
                  <label className="block text-sm font-medium mb-1">X축 지수 표기</label>
                  <select
                    value={xExponentialFormat}
                    onChange={(e) => setXExponentialFormat(e.target.value as any)}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="standard">표준 (1.23e+4)</option>
                    <option value="superscript">위첨자 (1.23×10⁴)</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">소수점 자릿수</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={xDecimalPlaces}
                  onChange={(e) => setXDecimalPlaces(parseInt(e.target.value) || 0)}
                  className="w-full p-2 border rounded-md"
                />
              </div>
            </div>
          </div>

          {/* Y축 숫자 형식 */}
          <div className="mb-4 pb-4 border-b">
            <h4 className="text-sm font-semibold mb-3 text-green-700">Y축 숫자 형식</h4>
            <div className={`grid gap-4 ${yNumberFormat === 'scientific' ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div>
                <label className="block text-sm font-medium mb-1">Y축 숫자 형식</label>
                <select
                  value={yNumberFormat}
                  onChange={(e) => setYNumberFormat(e.target.value as any)}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="normal">일반</option>
                  <option value="scientific">과학적 표기법</option>
                  <option value="comma">천 단위 구분</option>
                </select>
              </div>
              {yNumberFormat === 'scientific' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Y축 지수 표기</label>
                  <select
                    value={yExponentialFormat}
                    onChange={(e) => setYExponentialFormat(e.target.value as any)}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="standard">표준 (1.23e+4)</option>
                    <option value="superscript">위첨자 (1.23×10⁴)</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">소수점 자릿수</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={yDecimalPlaces}
                  onChange={(e) => setYDecimalPlaces(parseInt(e.target.value) || 0)}
                  className="w-full p-2 border rounded-md"
                />
              </div>
            </div>
          </div>

          {/* 기타 스타일 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">폰트</label>
              <select
                value={styleOptions.fontFamily}
                onChange={(e) => setStyleOptions(prev => ({ ...prev, fontFamily: e.target.value as any }))}
                className="w-full p-2 border rounded-md"
              >
                <option value="Arial">Arial</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Georgia">Georgia</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">축 제목 크기</label>
              <input
                type="number"
                value={styleOptions.axisTitleSize}
                onChange={(e) => setStyleOptions(prev => ({ ...prev, axisTitleSize: parseInt(e.target.value) }))}
                className="w-full p-2 border rounded-md"
                min="8"
                max="24"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">축 숫자 크기</label>
              <input
                type="number"
                value={styleOptions.axisNumberSize}
                onChange={(e) => setStyleOptions(prev => ({ ...prev, axisNumberSize: parseInt(e.target.value) }))}
                className="w-full p-2 border rounded-md"
                min="6"
                max="20"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={styleOptions.axisTitleBold}
                onChange={(e) => setStyleOptions(prev => ({ ...prev, axisTitleBold: e.target.checked }))}
                className="mr-2"
              />
              <label className="text-sm font-medium">축 제목 굵게</label>
            </div>
          </div>

          {/* 축 제목 위치 조정 */}
          <div className="col-span-full border-t pt-4 mt-4">
            <h4 className="font-medium mb-3">축 제목 위치 조정</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  X축 제목 위치 (아래 방향: -, 위 방향: +)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="-100"
                    max="0"
                    value={xAxisLabelOffset}
                    onChange={(e) => setXAxisLabelOffset(parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <input
                    type="number"
                    value={xAxisLabelOffset}
                    onChange={(e) => setXAxisLabelOffset(parseInt(e.target.value) || -50)}
                    className="w-20 p-1 border rounded-md text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Y축 제목 위치 (왼쪽: -, 오른쪽: +)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="-60"
                    max="20"
                    value={yAxisLabelOffset}
                    onChange={(e) => setYAxisLabelOffset(parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <input
                    type="number"
                    value={yAxisLabelOffset}
                    onChange={(e) => setYAxisLabelOffset(parseInt(e.target.value) || -10)}
                    className="w-20 p-1 border rounded-md text-sm"
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              💡 제목이 숫자와 겹치면 음수 값을 더 크게 조정하세요 (예: -60, -80)
            </p>
          </div>
        </div>
      )}

      {showPlotPanel && (
        <div className="p-4 bg-white border rounded-lg">
          <h3 className="font-medium mb-3">플롯 스타일 설정</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">마커 크기</label>
              <input
                type="range"
                min="20"
                max="200"
                value={plotOptions.size}
                onChange={(e) => setPlotOptions(prev => ({ ...prev, size: parseInt(e.target.value) }))}
                className="w-full"
              />
              <span className="text-sm text-gray-500">{plotOptions.size}</span>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">마커 모양</label>
              <select
                value={plotOptions.shape}
                onChange={(e) => setPlotOptions(prev => ({ ...prev, shape: e.target.value as any }))}
                className="w-full p-2 border rounded-md"
              >
                <option value="circle">원</option>
                <option value="square">사각형</option>
                <option value="triangle">삼각형</option>
                <option value="diamond">다이아몬드</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">마커 불투명도</label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={plotOptions.opacity}
                onChange={(e) => setPlotOptions(prev => ({ ...prev, opacity: parseFloat(e.target.value) }))}
                className="w-full"
              />
              <span className="text-sm text-gray-500">{plotOptions.opacity}</span>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">테두리 두께</label>
              <input
                type="range"
                min="0"
                max="5"
                value={plotOptions.strokeWidth}
                onChange={(e) => setPlotOptions(prev => ({ ...prev, strokeWidth: parseInt(e.target.value) }))}
                className="w-full"
              />
              <span className="text-sm text-gray-500">{plotOptions.strokeWidth}</span>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">테두리 색상</label>
              <input
                type="color"
                value={plotOptions.strokeColor}
                onChange={(e) => setPlotOptions(prev => ({ ...prev, strokeColor: e.target.value }))}
                className="w-full h-10 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">배경색</label>
              <input
                type="color"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                className="w-full h-10 border rounded-md"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={showGridlines}
                onChange={(e) => setShowGridlines(e.target.checked)}
                className="mr-2"
              />
              <label className="text-sm font-medium">격자 표시</label>
            </div>

            {/* 데이터 라벨 설정 */}
            <div className="col-span-full border-t pt-4 mt-4">
              <h4 className="font-medium mb-3">데이터 포인트 라벨</h4>
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  id="showDataLabels"
                  checked={showDataLabels}
                  onChange={(e) => setShowDataLabels(e.target.checked)}
                  className="mr-1"
                />
                <label htmlFor="showDataLabels" className="text-sm font-medium">데이터 라벨 표시 (타입 이름)</label>
              </div>
              {showDataLabels && (
                <div>
                  <label className="block text-sm font-medium mb-1">라벨 폰트 크기</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="6"
                      max="16"
                      value={labelFontSize}
                      onChange={(e) => setLabelFontSize(parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-sm text-gray-500 w-8">{labelFontSize}</span>
                  </div>
                  <p className="text-xs text-amber-600 mt-2">
                    ⚠️ 데이터가 많으면 라벨이 겹칠 수 있습니다.
                  </p>
                </div>
              )}
            </div>

            {/* 차트 제목 설정 */}
            <div className="col-span-full border-t pt-4 mt-4">
              <h4 className="font-medium mb-3">차트 제목 설정</h4>
              <div className="flex items-center gap-3 mb-2">
                <input
                  type="checkbox"
                  id="showChartTitle"
                  checked={showChartTitle}
                  onChange={(e) => setShowChartTitle(e.target.checked)}
                  className="mr-1"
                />
                <label htmlFor="showChartTitle" className="text-sm font-medium">제목 표시</label>
              </div>
              {showChartTitle && (
                <input
                  type="text"
                  value={chartTitle}
                  onChange={(e) => setChartTitle(e.target.value)}
                  placeholder="차트 제목을 입력하세요"
                  className="w-full p-2 border rounded-md"
                />
              )}
            </div>

            {/* 사용자 정의 색상 설정 */}
            <div className="col-span-full border-t pt-4 mt-4">
              <h4 className="font-medium mb-3">타입별 색상 설정</h4>
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  id="useCustomColors"
                  checked={plotOptions.useCustomColors}
                  onChange={(e) => setPlotOptions(prev => ({ ...prev, useCustomColors: e.target.checked }))}
                  className="mr-1"
                />
                <label htmlFor="useCustomColors" className="text-sm font-medium">사용자 정의 색상 사용</label>
              </div>
              {plotOptions.useCustomColors && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">타입별로 사용할 색상을 설정하세요 (최대 8개)</p>
                  <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                    {plotOptions.customColors.map((color, index) => (
                      <div key={index} className="flex flex-col items-center">
                        <label className="text-xs text-gray-600 mb-1">색상 {index + 1}</label>
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => {
                            const newColors = [...plotOptions.customColors]
                            newColors[index] = e.target.value
                            setPlotOptions(prev => ({ ...prev, customColors: newColors }))
                          }}
                          className="w-12 h-12 border rounded cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setPlotOptions(prev => ({
                      ...prev,
                      customColors: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#F97316', '#06B6D4', '#84CC16']
                    }))}
                    className="mt-3 px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  >
                    기본값으로 재설정
                  </button>
                </div>
              )}
            </div>

            {/* 추세선 스타일 설정 */}
            <div className="col-span-full border-t pt-4 mt-4">
              <h4 className="font-medium mb-3">추세선 스타일 설정</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">전체 추세선 색상</label>
                  <input
                    type="color"
                    value={trendlineStyle.color}
                    onChange={(e) => setTrendlineStyle(prev => ({ ...prev, color: e.target.value }))}
                    className="w-full h-10 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">전체 추세선 두께</label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={trendlineStyle.strokeWidth}
                    onChange={(e) => setTrendlineStyle(prev => ({ ...prev, strokeWidth: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                  <span className="text-sm text-gray-500">{trendlineStyle.strokeWidth}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">전체 추세선 불투명도</label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={trendlineStyle.opacity}
                    onChange={(e) => setTrendlineStyle(prev => ({ ...prev, opacity: parseFloat(e.target.value) }))}
                    className="w-full"
                  />
                  <span className="text-sm text-gray-500">{trendlineStyle.opacity}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showErrorBarPanel && (
        <div className="p-4 bg-white border rounded-lg">
          <h3 className="font-medium mb-3">오차범위 설정</h3>
          <p className="text-sm text-gray-600 mb-4">
            데이터 포인트의 불확실성을 시각화합니다. X축과 Y축 각각에 대해 오차범위를 설정할 수 있습니다.
          </p>

          {/* X축 오차범위 */}
          <div className="mb-6 pb-6 border-b">
            <div className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                id="xErrorBarEnabled"
                checked={xErrorBarEnabled}
                onChange={(e) => setXErrorBarEnabled(e.target.checked)}
                className="mr-1"
              />
              <label htmlFor="xErrorBarEnabled" className="text-sm font-semibold text-blue-700">
                X축 오차범위 표시
              </label>
            </div>

            {xErrorBarEnabled && (
              <div className="space-y-4 pl-4 border-l-2 border-blue-200">
                <div>
                  <label className="block text-sm font-medium mb-2">오차 계산 방법</label>
                  <select
                    value={xErrorBarMode}
                    onChange={(e) => setXErrorBarMode(e.target.value as any)}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="percentage">백분율 (%)</option>
                    <option value="fixed">고정값</option>
                    <option value="column">데이터 컬럼에서 읽기</option>
                    <option value="stddev">표준편차 (Standard Deviation)</option>
                    <option value="stderr">표준오차 (Standard Error)</option>
                  </select>
                </div>

                {xErrorBarMode === 'column' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">오차값 컬럼 선택</label>
                    <select
                      value={xErrorBarColumn}
                      onChange={(e) => setXErrorBarColumn(e.target.value)}
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="">컬럼을 선택하세요</option>
                      {[...data.numericColumns, ...data.nonNumericColumns].map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      선택한 컬럼의 값이 오차범위로 사용됩니다.
                    </p>
                  </div>
                )}

                {(xErrorBarMode === 'percentage' || xErrorBarMode === 'fixed') && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {xErrorBarMode === 'percentage' ? '오차 백분율 (%)' : '오차 고정값'}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max={xErrorBarMode === 'percentage' ? 100 : 50}
                        step={xErrorBarMode === 'percentage' ? 1 : 0.1}
                        value={xErrorBarValue}
                        onChange={(e) => setXErrorBarValue(parseFloat(e.target.value))}
                        className="flex-1"
                      />
                      <input
                        type="number"
                        value={xErrorBarValue}
                        onChange={(e) => setXErrorBarValue(parseFloat(e.target.value) || 0)}
                        className="w-20 p-1 border rounded-md text-sm"
                        step={xErrorBarMode === 'percentage' ? 1 : 0.1}
                      />
                      <span className="text-sm text-gray-600">
                        {xErrorBarMode === 'percentage' ? '%' : ''}
                      </span>
                    </div>
                  </div>
                )}

                {(xErrorBarMode === 'stddev' || xErrorBarMode === 'stderr') && (
                  <div className="p-3 bg-blue-50 rounded-md">
                    <p className="text-sm text-blue-700">
                      {xErrorBarMode === 'stddev'
                        ? '✓ 모든 X값의 표준편차가 오차범위로 사용됩니다.'
                        : '✓ 표준편차 / √n 값이 오차범위로 사용됩니다.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Y축 오차범위 */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                id="yErrorBarEnabled"
                checked={yErrorBarEnabled}
                onChange={(e) => setYErrorBarEnabled(e.target.checked)}
                className="mr-1"
              />
              <label htmlFor="yErrorBarEnabled" className="text-sm font-semibold text-green-700">
                Y축 오차범위 표시
              </label>
            </div>

            {yErrorBarEnabled && (
              <div className="space-y-4 pl-4 border-l-2 border-green-200">
                <div>
                  <label className="block text-sm font-medium mb-2">오차 계산 방법</label>
                  <select
                    value={yErrorBarMode}
                    onChange={(e) => setYErrorBarMode(e.target.value as any)}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="percentage">백분율 (%)</option>
                    <option value="fixed">고정값</option>
                    <option value="column">데이터 컬럼에서 읽기</option>
                    <option value="stddev">표준편차 (Standard Deviation)</option>
                    <option value="stderr">표준오차 (Standard Error)</option>
                  </select>
                </div>

                {yErrorBarMode === 'column' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">오차값 컬럼 선택</label>
                    <select
                      value={yErrorBarColumn}
                      onChange={(e) => setYErrorBarColumn(e.target.value)}
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="">컬럼을 선택하세요</option>
                      {[...data.numericColumns, ...data.nonNumericColumns].map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      선택한 컬럼의 값이 오차범위로 사용됩니다.
                    </p>
                  </div>
                )}

                {(yErrorBarMode === 'percentage' || yErrorBarMode === 'fixed') && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {yErrorBarMode === 'percentage' ? '오차 백분율 (%)' : '오차 고정값'}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max={yErrorBarMode === 'percentage' ? 100 : 50}
                        step={yErrorBarMode === 'percentage' ? 1 : 0.1}
                        value={yErrorBarValue}
                        onChange={(e) => setYErrorBarValue(parseFloat(e.target.value))}
                        className="flex-1"
                      />
                      <input
                        type="number"
                        value={yErrorBarValue}
                        onChange={(e) => setYErrorBarValue(parseFloat(e.target.value) || 0)}
                        className="w-20 p-1 border rounded-md text-sm"
                        step={yErrorBarMode === 'percentage' ? 1 : 0.1}
                      />
                      <span className="text-sm text-gray-600">
                        {yErrorBarMode === 'percentage' ? '%' : ''}
                      </span>
                    </div>
                  </div>
                )}

                {(yErrorBarMode === 'stddev' || yErrorBarMode === 'stderr') && (
                  <div className="p-3 bg-green-50 rounded-md">
                    <p className="text-sm text-green-700">
                      {yErrorBarMode === 'stddev'
                        ? '✓ 모든 Y값의 표준편차가 오차범위로 사용됩니다.'
                        : '✓ 표준편차 / √n 값이 오차범위로 사용됩니다.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 도움말 */}
          <div className="mt-6 pt-6 border-t">
            <h4 className="text-sm font-semibold mb-2">💡 오차범위 계산 방법 설명</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li><strong>백분율</strong>: 데이터 값의 n%를 오차로 표시 (예: 5% → 값이 100이면 ±5)</li>
              <li><strong>고정값</strong>: 모든 데이터에 동일한 오차값 적용</li>
              <li><strong>컬럼</strong>: 엑셀 파일의 특정 컬럼에서 오차값 직접 읽기</li>
              <li><strong>표준편차</strong>: 데이터의 분산 정도를 나타내는 통계값</li>
              <li><strong>표준오차</strong>: 평균의 불확실성을 나타내는 값 (표본 크기를 고려)</li>
            </ul>
          </div>
        </div>
      )}

      {showAxisPanel && (
        <div className="p-4 bg-white border rounded-lg">
          <h3 className="font-medium mb-3">축 범위 설정</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">X축 최솟값</label>
              <input
                type="number"
                value={axisRange.xMin === 'auto' ? '' : axisRange.xMin}
                onChange={(e) => setAxisRange(prev => ({ ...prev, xMin: e.target.value === '' ? 'auto' : parseFloat(e.target.value) }))}
                placeholder="자동"
                className="w-full p-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">X축 최댓값</label>
              <input
                type="number"
                value={axisRange.xMax === 'auto' ? '' : axisRange.xMax}
                onChange={(e) => setAxisRange(prev => ({ ...prev, xMax: e.target.value === '' ? 'auto' : parseFloat(e.target.value) }))}
                placeholder="자동"
                className="w-full p-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Y축 최솟값</label>
              <input
                type="number"
                value={axisRange.yMin === 'auto' ? '' : axisRange.yMin}
                onChange={(e) => setAxisRange(prev => ({ ...prev, yMin: e.target.value === '' ? 'auto' : parseFloat(e.target.value) }))}
                placeholder="자동"
                className="w-full p-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Y축 최댓값</label>
              <input
                type="number"
                value={axisRange.yMax === 'auto' ? '' : axisRange.yMax}
                onChange={(e) => setAxisRange(prev => ({ ...prev, yMax: e.target.value === '' ? 'auto' : parseFloat(e.target.value) }))}
                placeholder="자동"
                className="w-full p-2 border rounded-md"
              />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t">
            <h4 className="font-medium mb-3">축 스케일 설정</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="xLogScale"
                  checked={xLogScale}
                  onChange={(e) => setXLogScale(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="xLogScale" className="text-sm font-medium">X축 로그 스케일</label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="yLogScale"
                  checked={yLogScale}
                  onChange={(e) => setYLogScale(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="yLogScale" className="text-sm font-medium">Y축 로그 스케일</label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="maintain1to1"
                  checked={maintain1to1Ratio}
                  onChange={(e) => setMaintain1to1Ratio(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="maintain1to1" className="text-sm font-medium">1:1 비율 유지</label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="show1to1Line"
                  checked={show1to1Line}
                  onChange={(e) => setShow1to1Line(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="show1to1Line" className="text-sm font-medium">1:1 참조선 표시</label>
              </div>
            </div>

            {/* 축 반전 */}
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="invertXAxis"
                  checked={invertXAxis}
                  onChange={(e) => setInvertXAxis(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="invertXAxis" className="text-sm font-medium">X축 반전</label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="invertYAxis"
                  checked={invertYAxis}
                  onChange={(e) => setInvertYAxis(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="invertYAxis" className="text-sm font-medium">Y축 반전 (깊이 표시용)</label>
              </div>
            </div>
            {(xLogScale || yLogScale) && (
              <p className="text-xs text-amber-600 mt-2">
                ⚠️ 로그 스케일은 양수 값에만 적용됩니다. 0 이하의 값은 표시되지 않습니다.
              </p>
            )}
            {maintain1to1Ratio && (
              <p className="text-xs text-blue-600 mt-2">
                ℹ️ 1:1 비율이 적용되어 정사각형 플롯이 생성됩니다.
              </p>
            )}
            {show1to1Line && (
              <p className="text-xs text-green-600 mt-2">
                ✓ 1:1 참조선이 표시됩니다 (대각선: y=x).
              </p>
            )}
          </div>

          <div className="mt-4 pt-4 border-t">
            <h4 className="font-medium mb-3">눈금 간격 설정</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">X축 눈금 간격</label>
                <input
                  type="number"
                  value={xTickInterval === 'auto' ? '' : xTickInterval}
                  onChange={(e) => setXTickInterval(e.target.value === '' ? 'auto' : parseFloat(e.target.value))}
                  placeholder="자동"
                  step="any"
                  className="w-full p-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Y축 눈금 간격</label>
                <input
                  type="number"
                  value={yTickInterval === 'auto' ? '' : yTickInterval}
                  onChange={(e) => setYTickInterval(e.target.value === '' ? 'auto' : parseFloat(e.target.value))}
                  placeholder="자동"
                  step="any"
                  className="w-full p-2 border rounded-md"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              💡 눈금 간격을 비워두면 자동으로 설정됩니다.
            </p>
          </div>

          {/* 그래프 비율 설정 */}
          <div className="mt-4 pt-4 border-t">
            <h4 className="font-medium mb-3">그래프 가로세로 비율</h4>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">비율:</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                placeholder="가로/세로 (예: 1.5)"
                value={chartAspectRatio || ''}
                onChange={(e) => {
                  const val = e.target.value
                  setChartAspectRatio(val === '' ? null : parseFloat(val))
                }}
                className="w-32 px-3 py-2 border rounded-md"
              />
              <button
                onClick={() => setChartAspectRatio(null)}
                className="px-3 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 whitespace-nowrap"
                title="자동으로 재설정"
              >
                자동
              </button>
              <span className="text-xs text-gray-500">
                {chartAspectRatio ? `현재: ${chartAspectRatio.toFixed(2)}` : '자동'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              💡 레퍼런스 이미지 비율에 맞추려면 이미지 오버레이 패널의 "📐 이미지 비율 적용" 버튼을 사용하세요.
            </p>
          </div>
        </div>
      )}

      {/* 레퍼런스 이미지 오버레이 패널 */}
      {showReferencePanel && (
        <div className="p-6 bg-gradient-to-br from-pink-50 to-rose-50 border-2 border-pink-300 rounded-lg shadow-lg">
          <h3 className="font-semibold text-lg mb-4 text-pink-800">📷 레퍼런스 이미지 오버레이</h3>

          {/* 이미지 업로드 영역 */}
          <div className="mb-6">
            <div className="border-2 border-dashed border-pink-300 rounded-lg p-6 bg-white hover:bg-pink-50 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleImageUpload(file)
                }}
                className="hidden"
              />
              <div className="text-center">
                <Upload className="w-12 h-12 mx-auto text-pink-400 mb-3" />
                <p className="text-sm font-medium text-gray-700 mb-2">
                  이미지를 업로드하거나 붙여넣기 (Ctrl+V)
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 transition-colors"
                >
                  파일 선택
                </button>
                <p className="text-xs text-gray-500 mt-3">
                  {ocrProcessing ? (
                    <span className="text-orange-600 font-medium">🔄 OCR로 축 범위 인식 중...</span>
                  ) : (
                    <>💡 축 범위가 자동으로 인식됩니다 (실패 시 수동 입력 가능)</>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* 저장된 레퍼런스 이미지 목록 */}
          {referenceImages.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-pink-800">저장된 레퍼런스 이미지 ({referenceImages.length})</h4>
              <div className="space-y-3">
                {referenceImages.map((refImg) => (
                  <div key={refImg.id} className="p-4 bg-white border border-pink-200 rounded-lg shadow-sm">
                    <div className="flex items-start gap-4">
                      {/* 썸네일 */}
                      <div className="flex-shrink-0">
                        <img
                          src={refImg.imageData}
                          alt={refImg.name}
                          className="w-24 h-24 object-cover rounded border border-gray-300"
                        />
                      </div>

                      {/* 설정 영역 */}
                      <div className="flex-1 space-y-3">
                        {/* 이름 및 제어 버튼 */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700 truncate max-w-[200px]">
                            {refImg.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setReferenceImages(prev =>
                                  prev.map(img =>
                                    img.id === refImg.id
                                      ? { ...img, visible: !img.visible }
                                      : img
                                  )
                                )
                              }}
                              className={`p-1.5 rounded transition-colors ${
                                refImg.visible
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              }`}
                              title={refImg.visible ? '숨기기' : '표시'}
                            >
                              <EyeIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setReferenceImages(prev => prev.filter(img => img.id !== refImg.id))
                              }}
                              className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                              title="삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* 축 범위 입력 */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">X축 최솟값</label>
                            <input
                              type="number"
                              key={`xMin-${refImg.id}`}
                              defaultValue={refImg.xMin}
                              onBlur={(e) => {
                                const numVal = e.target.value === '' ? 0 : parseFloat(e.target.value)
                                setReferenceImages(prev =>
                                  prev.map(img =>
                                    img.id === refImg.id ? { ...img, xMin: isNaN(numVal) ? 0 : numVal } : img
                                  )
                                )
                              }}
                              className="w-full px-2 py-1 text-sm border rounded"
                              placeholder="예: -10.5"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">X축 최댓값</label>
                            <input
                              type="number"
                              key={`xMax-${refImg.id}`}
                              defaultValue={refImg.xMax}
                              onBlur={(e) => {
                                const numVal = e.target.value === '' ? 0 : parseFloat(e.target.value)
                                setReferenceImages(prev =>
                                  prev.map(img =>
                                    img.id === refImg.id ? { ...img, xMax: isNaN(numVal) ? 0 : numVal } : img
                                  )
                                )
                              }}
                              className="w-full px-2 py-1 text-sm border rounded"
                              placeholder="예: 100"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Y축 최솟값</label>
                            <input
                              type="number"
                              key={`yMin-${refImg.id}`}
                              defaultValue={refImg.yMin}
                              onBlur={(e) => {
                                const numVal = e.target.value === '' ? 0 : parseFloat(e.target.value)
                                setReferenceImages(prev =>
                                  prev.map(img =>
                                    img.id === refImg.id ? { ...img, yMin: isNaN(numVal) ? 0 : numVal } : img
                                  )
                                )
                              }}
                              className="w-full px-2 py-1 text-sm border rounded"
                              placeholder="예: 0"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Y축 최댓값</label>
                            <input
                              type="number"
                              key={`yMax-${refImg.id}`}
                              defaultValue={refImg.yMax}
                              onBlur={(e) => {
                                const numVal = e.target.value === '' ? 0 : parseFloat(e.target.value)
                                setReferenceImages(prev =>
                                  prev.map(img =>
                                    img.id === refImg.id ? { ...img, yMax: isNaN(numVal) ? 0 : numVal } : img
                                  )
                                )
                              }}
                              className="w-full px-2 py-1 text-sm border rounded"
                              placeholder="예: 50"
                            />
                          </div>
                        </div>

                        {/* 동기화 버튼 */}
                        <div className="space-y-2 mt-3">
                          <button
                            onClick={() => {
                              // 레퍼런스 이미지의 축 범위를 그래프에 적용
                              setAxisRange({
                                xMin: refImg.xMin,
                                xMax: refImg.xMax,
                                yMin: refImg.yMin,
                                yMax: refImg.yMax
                              })
                            }}
                            className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                          >
                            🔄 축 범위 동기화
                          </button>
                          <button
                            onClick={() => {
                              const ratio = refImg.cropWidth / refImg.cropHeight
                              setChartAspectRatio(ratio)
                              // maintain1to1Ratio가 켜져 있으면 축 범위가 자동 조정되므로 끄기
                              if (maintain1to1Ratio) {
                                setMaintain1to1Ratio(false)
                              }
                            }}
                            className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
                            title={`비율: ${(refImg.cropWidth / refImg.cropHeight).toFixed(2)}`}
                          >
                            📐 이미지 비율 적용 ({(refImg.cropWidth / refImg.cropHeight).toFixed(2)})
                          </button>
                        </div>

                        {/* 불투명도 슬라이더 */}
                        <div className="mt-3">
                          <label className="flex items-center justify-between text-xs font-medium text-gray-600 mb-1">
                            <span>불투명도</span>
                            <span className="text-pink-600">{refImg.opacity}%</span>
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={refImg.opacity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value)
                              setReferenceImages(prev =>
                                prev.map(img =>
                                  img.id === refImg.id ? { ...img, opacity: val } : img
                                )
                              )
                            }}
                            className="w-full"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 도움말 */}
          <div className="mt-6 pt-6 border-t border-pink-200">
            <h4 className="text-sm font-semibold mb-2">💡 레퍼런스 이미지 사용 팁</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li><strong>영역 선택</strong>: 이미지 업로드 후 드래그하여 그래프 영역만 선택하세요</li>
              <li><strong>자동 인식</strong>: 선택한 영역에서 OCR로 축 범위를 자동 인식합니다</li>
              <li><strong>수동 조정</strong>: 인식 실패 시 또는 정확한 조정이 필요할 때 축 범위를 직접 입력하세요</li>
              <li><strong>축 범위 동기화</strong>: 현재 그래프의 축 범위를 레퍼런스 이미지에 한 번에 적용합니다</li>
              <li><strong>이미지 비율 적용</strong>: 크롭한 이미지의 가로세로 비율을 그래프에 자동으로 적용합니다</li>
              <li><strong>비율 직접 입력</strong>: 원하는 가로세로 비율을 숫자로 입력할 수 있습니다 (예: 1.5)</li>
              <li><strong>불투명도</strong>: 슬라이더로 레퍼런스 이미지의 불투명도를 조절할 수 있습니다</li>
              <li><strong>비교</strong>: 여러 레퍼런스 이미지를 저장하고 표시/숨김으로 비교 가능합니다</li>
              <li><strong>붙여넣기</strong>: Ctrl+V로 클립보드의 이미지를 빠르게 추가할 수 있습니다</li>
            </ul>
          </div>
        </div>
      )}
        </div>

        {/* 오른쪽: 차트 */}
        <div className="flex-1 min-w-0">
          <div ref={chartRef} className="w-full p-4" style={{
        backgroundColor: backgroundColor,
        aspectRatio: chartAspectRatio ? `${chartAspectRatio} / 1` : (maintain1to1Ratio ? '1 / 1' : 'auto'),
        height: chartAspectRatio || maintain1to1Ratio ? 'auto' : '24rem'
      }}>
        {showChartTitle && chartTitle && (
          <div className="text-center mb-2">
            <h3 className="text-lg font-semibold" style={{ fontFamily: styleOptions.fontFamily }}>
              {chartTitle}
            </h3>
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 30, bottom: 60, left: 60 }}>
            {/* 1. 배경색 */}
            <Customized
              component={(props: any) => {
                const { width, height, offset } = props
                if (!width || !height) return null

                return (
                  <rect
                    x={0}
                    y={0}
                    width={width + (offset?.left || 0) + (offset?.right || 0)}
                    height={height + (offset?.top || 0) + (offset?.bottom || 0)}
                    fill={backgroundColor}
                  />
                )
              }}
            />

            {/* 2. 레퍼런스 이미지 오버레이 */}
            {referenceImages
              .filter(img => img.visible)
              .map(img => {
                return (
                  <Customized
                    key={img.id}
                    component={(props: any) => {
                      const { xAxisMap, yAxisMap } = props

                      if (!xAxisMap || !yAxisMap) return null

                      // Recharts는 xAxisMap과 yAxisMap에서 scale을 추출해야 함
                      const xScale = xAxisMap[0]?.scale
                      const yScale = yAxisMap[0]?.scale

                      if (!xScale || !yScale) return null

                      // 이미지의 축 범위를 픽셀 좌표로 변환
                      const x1 = xScale(img.xMin)
                      const x2 = xScale(img.xMax)
                      const y1 = yScale(img.yMax) // Y축은 반대 방향
                      const y2 = yScale(img.yMin)

                      // 로그 스케일 처리
                      const imgX = Math.min(x1, x2)
                      const imgY = Math.min(y1, y2)
                      const imgWidth = Math.abs(x2 - x1)
                      const imgHeight = Math.abs(y2 - y1)

                      return (
                        <g>
                          <image
                            href={img.imageData}
                            x={imgX}
                            y={imgY}
                            width={imgWidth}
                            height={imgHeight}
                            opacity={img.opacity / 100}
                            preserveAspectRatio="none"
                            style={{
                              transition: 'all 0.5s ease-out'
                            }}
                          />
                        </g>
                      )
                    }}
                  />
                )
              })}

            {/* 3. 격자 */}
            {showGridlines && <CartesianGrid strokeDasharray="3 3" />}

            {/* 4. 축 */}
            <XAxis
              type="number"
              dataKey="x"
              scale={xLogScale ? 'log' : 'linear'}
              reversed={invertXAxis}
              domain={getLogSafeDomain(
                axisRange.xMin === 'auto' ? adjusted1to1Range.xMin : axisRange.xMin,
                axisRange.xMax === 'auto' ? adjusted1to1Range.xMax : axisRange.xMax,
                xLogScale
              )}
              ticks={xTicks}
              tickFormatter={formatXAxisLabel}
              tick={{
                fontSize: styleOptions.axisNumberSize,
                fontFamily: styleOptions.fontFamily
              }}
              label={{
                value: getAxisTitle(selectedColumns.x!),
                position: 'insideBottom',
                offset: xAxisLabelOffset,
                style: {
                  textAnchor: 'middle',
                  fontSize: styleOptions.axisTitleSize,
                  fontFamily: styleOptions.fontFamily,
                  fontWeight: styleOptions.axisTitleBold ? 'bold' : 'normal'
                }
              }}
              allowDataOverflow={xLogScale || axisRange.xMin !== 'auto' || axisRange.xMax !== 'auto'}
            />

            <YAxis
              type="number"
              dataKey="y"
              scale={yLogScale ? 'log' : 'linear'}
              reversed={invertYAxis}
              domain={getLogSafeDomain(
                axisRange.yMin === 'auto' ? adjusted1to1Range.yMin : axisRange.yMin,
                axisRange.yMax === 'auto' ? adjusted1to1Range.yMax : axisRange.yMax,
                yLogScale
              )}
              ticks={yTicks}
              tickFormatter={formatYAxisLabel}
              tick={{
                fontSize: styleOptions.axisNumberSize,
                fontFamily: styleOptions.fontFamily
              }}
              label={{
                value: getAxisTitle(selectedColumns.y!),
                angle: -90,
                position: 'insideLeft',
                offset: yAxisLabelOffset,
                style: {
                  textAnchor: 'middle',
                  fontSize: styleOptions.axisTitleSize,
                  fontFamily: styleOptions.fontFamily,
                  fontWeight: styleOptions.axisTitleBold ? 'bold' : 'normal'
                }
              }}
              allowDataOverflow={yLogScale || axisRange.yMin !== 'auto' || axisRange.yMax !== 'auto'}
            />

            <Tooltip
              formatter={(value: any, name: string) => {
                // name이 'x'이면 X축 포맷, 'y'이면 Y축 포맷 사용
                const formattedValue = name === 'x' ? formatXAxisLabel(value) : formatYAxisLabel(value)
                return [formattedValue, name]
              }}
              labelFormatter={() => ''}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '12px'
              }}
            />

            {/* 데이터 포인트 렌더링 */}
            {Object.keys(typeGroups).map(type => {
              if (visibleTypes[type] === false) return null

              return (
                <Scatter
                  key={type}
                  name={type}
                  data={typeGroups[type]}
                  fill={fixedColorMap[type]}
                  shape={(props: any) => (
                    <CustomMarker
                      {...props}
                      shape={plotOptions.shape}
                      size={plotOptions.size}
                      opacity={plotOptions.opacity}
                      strokeWidth={plotOptions.strokeWidth}
                      strokeColor={plotOptions.strokeColor}
                    />
                  )}
                >
                  {showDataLabels && (
                    <LabelList
                      dataKey="type"
                      position="top"
                      style={{
                        fontSize: labelFontSize,
                        fill: '#333',
                        fontFamily: styleOptions.fontFamily
                      }}
                    />
                  )}
                  {xErrorBarEnabled && (
                    <ErrorBar
                      dataKey="errorX"
                      width={4}
                      strokeWidth={2}
                      stroke={fixedColorMap[type]}
                      direction="x"
                    />
                  )}
                  {yErrorBarEnabled && (
                    <ErrorBar
                      dataKey="errorY"
                      width={4}
                      strokeWidth={2}
                      stroke={fixedColorMap[type]}
                      direction="y"
                    />
                  )}
                </Scatter>
              )
            })}

            {/* 1:1 참조선 */}
            {show1to1Line && oneToOneLineSegment && (
              <ReferenceLine
                segment={oneToOneLineSegment}
                stroke="#000000"
                strokeWidth={1.5}
                strokeOpacity={0.6}
                strokeDasharray="10 5"
                label={{
                  value: '1:1',
                  position: 'insideTopRight',
                  fill: '#000000',
                  fontSize: 12
                }}
              />
            )}

            {/* 전체 추세선 */}
            {showOverallTrend && overallTrendSegment && (
              <ReferenceLine
                segment={overallTrendSegment}
                stroke={trendlineStyle.color}
                strokeWidth={trendlineStyle.strokeWidth}
                strokeOpacity={trendlineStyle.opacity}
                strokeDasharray="0"
              />
            )}

            {/* 타입별 추세선들 */}
            {typeRegressionSegments.map(({ type, segment, color }) => (
              <ReferenceLine
                key={`trend-${type}`}
                segment={segment}
                stroke={color}
                strokeWidth={2}
                strokeOpacity={0.8}
                strokeDasharray="5 5"
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 크롭 에디터 모달 */}
      {cropEditorOpen && cropEditorImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
          <div className="bg-white rounded-lg shadow-2xl max-w-5xl max-h-[90vh] w-full mx-4 flex flex-col">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                <CropIcon className="w-6 h-6 text-pink-600" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">그래프 영역 선택</h3>
                  <p className="text-sm text-gray-600">{cropEditorImage.name}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setCropEditorOpen(false)
                  setCropEditorImage(null)
                  setCropImageLoaded(false)
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* 크롭 영역 */}
            <div className="flex-1 overflow-auto p-6">
              <div className="flex justify-center relative">
                <ReactCrop
                  crop={tempCrop}
                  onChange={(c) => setTempCrop(c)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={undefined}
                >
                  <img
                    ref={cropImageRef}
                    src={cropEditorImage.imageData}
                    alt="Crop preview"
                    style={{ maxWidth: '100%', maxHeight: '60vh' }}
                    onLoad={(e) => {
                      // 이미지 로드 시 초기 크롭 설정
                      const img = e.currentTarget
                      const initialCrop: PixelCrop = {
                        unit: 'px',
                        x: img.width * 0.1,
                        y: img.height * 0.1,
                        width: img.width * 0.8,
                        height: img.height * 0.8
                      }
                      setCompletedCrop(initialCrop)
                      setCropImageLoaded(true) // 이미지 로드 완료
                    }}
                  />
                </ReactCrop>

                {/* 돋보기 - 항상 렌더링하여 ref 유지 */}
                <div
                  style={{
                    position: 'fixed',
                    left: magnifierPosition ? magnifierPosition.x + 20 : -9999,
                    top: magnifierPosition ? magnifierPosition.y + 20 : -9999,
                    pointerEvents: 'none',
                    zIndex: 9999,
                    visibility: magnifierPosition ? 'visible' : 'hidden'
                  }}
                >
                  <canvas
                    ref={magnifierRef}
                    width={120}
                    height={120}
                    style={{
                      border: '3px solid #333',
                      borderRadius: '50%',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                      background: 'white'
                    }}
                  />
                </div>
              </div>

              {/* 모서리 선택 버튼 */}
              <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-sm font-semibold text-purple-800 mb-3">⌨️ 키보드로 미세 조정</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSelectedCorner(selectedCorner === 'topLeft' ? null : 'topLeft')}
                    className={`px-3 py-2 text-sm rounded-lg transition-all ${
                      selectedCorner === 'topLeft'
                        ? 'bg-purple-600 text-white font-semibold shadow-lg'
                        : 'bg-white text-gray-700 border border-purple-300 hover:bg-purple-100'
                    }`}
                  >
                    ↖️ 좌상단
                  </button>
                  <button
                    onClick={() => setSelectedCorner(selectedCorner === 'topRight' ? null : 'topRight')}
                    className={`px-3 py-2 text-sm rounded-lg transition-all ${
                      selectedCorner === 'topRight'
                        ? 'bg-purple-600 text-white font-semibold shadow-lg'
                        : 'bg-white text-gray-700 border border-purple-300 hover:bg-purple-100'
                    }`}
                  >
                    ↗️ 우상단
                  </button>
                  <button
                    onClick={() => setSelectedCorner(selectedCorner === 'bottomLeft' ? null : 'bottomLeft')}
                    className={`px-3 py-2 text-sm rounded-lg transition-all ${
                      selectedCorner === 'bottomLeft'
                        ? 'bg-purple-600 text-white font-semibold shadow-lg'
                        : 'bg-white text-gray-700 border border-purple-300 hover:bg-purple-100'
                    }`}
                  >
                    ↙️ 좌하단
                  </button>
                  <button
                    onClick={() => setSelectedCorner(selectedCorner === 'bottomRight' ? null : 'bottomRight')}
                    className={`px-3 py-2 text-sm rounded-lg transition-all ${
                      selectedCorner === 'bottomRight'
                        ? 'bg-purple-600 text-white font-semibold shadow-lg'
                        : 'bg-white text-gray-700 border border-purple-300 hover:bg-purple-100'
                    }`}
                  >
                    ↘️ 우하단
                  </button>
                </div>
                <p className="text-xs text-purple-700 mt-3">
                  {selectedCorner
                    ? `화살표 키(←↑→↓)로 ${selectedCorner === 'topLeft' ? '좌상단' : selectedCorner === 'topRight' ? '우상단' : selectedCorner === 'bottomLeft' ? '좌하단' : '우하단'} 모서리를 조정하세요. Shift를 누르면 더 빠르게 이동합니다.`
                    : '모서리를 선택한 후 화살표 키로 조정하세요.'}
                </p>
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  💡 <strong>사용 방법:</strong> 사각형을 드래그하여 대략적으로 선택한 후, 모서리 버튼을 눌러 키보드로 미세 조정하세요.
                </p>
                <p className="text-sm text-blue-800 mt-2">
                  🔍 <strong>돋보기:</strong> 마우스를 이미지 위에 올리면 3배 확대 미리보기가 표시됩니다.
                  키보드 조정 중에도 계속 작동합니다!
                </p>
              </div>
            </div>

            {/* 모달 푸터 */}
            <div className="flex items-center justify-end gap-3 p-4 border-t">
              <button
                onClick={() => {
                  setCropEditorOpen(false)
                  setCropEditorImage(null)
                  setCropImageLoaded(false)
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleCropConfirm}
                className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
              >
                <Check className="w-4 h-4" />
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
