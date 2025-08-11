'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Settings, Trash2, Copy, Download, MessageCircle, ArrowLeft, Upload } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatConfig {
  model: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo'
  temperature: number
  maxTokens: number
  systemPrompt: string
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [userSessionId, setUserSessionId] = useState('')
  const [config, setConfig] = useState<ChatConfig>({
    model: 'gpt-4o',
    temperature: 0.3, // 논문 검토에 최적화된 낮은 창의성
    maxTokens: 2000,
    systemPrompt: `이 GPT는 사용자가 작성한 영어 문장을 최상위권 SCI 저널에 게재될 수준으로 평가하고 개선하는 역할을 합니다. 사용자가 문장을 입력하면 10점 만점으로 점수를 부여하고, 논문 작성의 관점에서 어색한 부분이나 개선할 수 있는 요소를 한글로 설명합니다. 명확성, 학술적 어조, 문법, 논리적 흐름 등을 고려하여 평가하며, 필요한 경우 대체 문장을 제안하여 사용자가 더 자연스럽고 강력한 표현을 사용할 수 있도록 돕습니다. 단, 사용자의 원래 의도를 유지하면서 수정해야 하며, 과도한 의역이나 단순한 동의어 대체는 피합니다. 기본적으로 모든 피드백은 한글로 제공되며, 영어로 원할 경우 따로 요청할 수 있습니다.

또한, 단어를 대체할 경우 그 이유를 명확하게 설명합니다. 예를 들어, 'significant' 대신 'substantial'을 추천할 때, 'substantial'이 수량적 크기를 강조하는 데 더 적합하다는 이유를 제시합니다. 단순한 동의어 나열이 아니라 문맥에 맞는 최적의 표현을 선택하도록 도와주며, 반복적으로 사용되는 단어나 표현이 있으면 이를 지적하고 적절한 대체어를 제안합니다.

이 GPT는 사용자의 논문 문체와 검토 스타일을 바탕으로 다음과 같은 세부 지침을 따른다:

1. 문장 구조는 유지하되, 가독성을 높이는 리라이팅에 집중한다.
 - 원래 문장을 과도하게 의역하지 않고, 가능한 한 문법·어조·흐름만 다듬는다.
 - 예를 들어, 쉼표 위치, 접속사 교체, 수동태/능동태 전환 등을 통해 정보 밀도를 조절한다.
 - 단락 구성은 논리적 흐름에 따라 재배치할 수 있으나, 주장의 순서를 바꾸지는 않는다.

2. 출처, 수치, 변수 표기를 최대한 보존하며 수정한다.
 - 동위원소 표기나 단위(예: 3He/4He, d13C, 222Rn 등)는 사용자가 지정한 텍스트 스타일에 맞춰 표기한다.
 - δ13C → d13C, ³He/⁴He → 3He/4He, Δ3He → d3He
 - em dash (—) → 일반 하이픈 (-)
 - 첨자는 모두 일반 숫자로 표기한다.

3. 논문용 문장 평가 시스템을 따른다.
 - 사용자 문장을 10점 만점으로 평가하며, 평가 항목은 다음과 같다:
   ▸ 명확성 (Clarity): 2.0점
   ▸ 논리 흐름 (Flow): 2.0점
   ▸ 학술적 어조 (Tone): 2.0점
   ▸ 문법 (Grammar): 2.0점
   ▸ 수치 강조 및 데이터 (Numerical Emphasis & Data): 1.0점
   ▸ 전체 임팩트 (Overall Impact): 1.0점
   🎯 총점: 10.0 / 10.0
 - 감점 요인을 한국어로 설명하고, 필요 시 개선 문장을 제시한다.

4. 수정 시 목적에 따라 톤을 조절한다.
 - 전반적으로 포멀한 학술적 어조를 유지하되, 지나치게 딱딱하지 않고 자연스러운 흐름을 살린다.
 - 사용자 문체와 리듬을 존중하며, 문장을 "더 나은 버전"으로 다듬는 데 초점을 둔다.

5. 표현 반복이나 단조로운 단어 사용을 피한다.
 - 예: significant, show, suggest 등이 반복되면 상황에 맞는 대체어를 제안하되, 단순 치환이 아닌 '의미 중심'으로 교체한다.

6. 논문 유형에 적합한 구조 제안을 병행한다.
 - 인트로: 3~4문단 논리 분리 제안 (배경 → 기법 → 지역특성 → 연구 목적)
 - 결과·토의: 수치, 트렌드, 해석 순으로 정리
 - 초록: 배경, 방법, 주요 수치 기반 결과, 해석과 의의가 모두 반영되었는지 확인

7. 후속 작업을 위한 자동 스타일 반영 규칙
 - 위첨자 자동 제거 및 citation 번호 단순화
 - Top-tier SCI 저널의 표현 스타일에 맞게 변수 표기 및 연결어 구조 등을 정리

이 GPT는 위의 모든 규칙을 기반으로, 사용자의 문체와 과학적 논리 흐름을 유지하면서 SCI급 저널 수준의 표현력을 구현하도록 설계되었다. 문장 하나에도 예리하게 피드백을 주고, 필요 시 점수 기준에 따라 객관적인 평가도 병행한다.`
  })
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 메시지 스크롤 자동 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 로컬 스토리지에서 데이터 불러오기
  useEffect(() => {
    const savedAuth = localStorage.getItem('gpt-shelter-auth')
    const savedSessionId = localStorage.getItem('gpt-shelter-session-id')
    
    if (savedAuth === 'true' && savedSessionId) {
      setIsAuthenticated(true)
      setUserSessionId(savedSessionId)
      loadChatHistory(savedSessionId)
    }
  }, [])

  const handlePasswordSubmit = () => {
    if (passwordInput === 'schol212') {
      const sessionId = userSessionId || prompt('개인 채팅방 비밀번호를 설정하세요:') || 'default'
      setUserSessionId(sessionId)
      setIsAuthenticated(true)
      localStorage.setItem('gpt-shelter-auth', 'true')
      localStorage.setItem('gpt-shelter-session-id', sessionId)
      loadChatHistory(sessionId)
      setPasswordInput('')
    } else {
      alert('비밀번호가 틀렸습니다!')
      setPasswordInput('')
    }
  }

  const loadChatHistory = async (sessionId: string) => {
    try {
      // 1. Supabase에서 최신 데이터 가져오기
      const response = await fetch(`/api/chat-sessions?session_id=${sessionId}`)
      const result = await response.json()
      
      if (response.ok && result.success && result.data) {
        const cloudMessages = result.data.messages
        setMessages(cloudMessages)
        // 클라우드 데이터를 로컬에도 백업
        localStorage.setItem(`gpt-shelter-history-${sessionId}`, JSON.stringify(cloudMessages))
        console.log('✅ 클라우드에서 채팅 히스토리 로드됨')
        return
      } else if (response.status === 503) {
        console.log('⚠️ Supabase 미설정: 로컬 저장만 사용')
      }
    } catch (error) {
      console.error('클라우드 채팅 히스토리 로드 실패:', error)
    }

    // 2. 클라우드 실패 시 로컬 스토리지에서 로드
    const savedHistory = localStorage.getItem(`gpt-shelter-history-${sessionId}`)
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory)
        setMessages(parsed)
        console.log('📱 로컬에서 채팅 히스토리 로드됨')
      } catch (error) {
        console.error('로컬 채팅 히스토리 로드 실패:', error)
      }
    }
  }

  const saveChatHistory = async (updatedMessages: Message[]) => {
    if (userSessionId && isAuthenticated) {
      // 1. 로컬 스토리지에 즉시 저장 (빠른 응답)
      localStorage.setItem(`gpt-shelter-history-${userSessionId}`, JSON.stringify(updatedMessages))
      
      // 2. Supabase에 비동기 저장 (기기 간 동기화)
      try {
        const response = await fetch('/api/chat-sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            session_id: userSessionId,
            messages: updatedMessages
          })
        })
        
        const result = await response.json()
        if (response.ok && result.success) {
          console.log('☁️ 클라우드 동기화 완료')
        } else if (response.status === 503) {
          console.log('⚠️ Supabase 미설정: 로컬 저장만 사용')
        } else {
          console.error('클라우드 동기화 실패:', result.error)
        }
      } catch (error) {
        console.error('클라우드 저장 에러:', error)
      }
    }
  }

  const logout = () => {
    setIsAuthenticated(false)
    setUserSessionId('')
    setMessages([])
    localStorage.removeItem('gpt-shelter-auth')
    localStorage.removeItem('gpt-shelter-session-id')
    setPasswordInput('')
  }

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return
    // API 키 체크를 완화 - 서버 환경변수가 있을 수 있음

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    saveChatHistory(updatedMessages)
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: config.systemPrompt },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMessage.content }
          ],
          config,
          apiKey: apiKey.trim() || undefined // 빈 문자열이면 undefined로 전송
        }),
      })

      if (!response.ok) {
        throw new Error(`API 오류: ${response.status}`)
      }

      const data = await response.json()
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content,
        timestamp: new Date()
      }

      const finalMessages = [...updatedMessages, assistantMessage]
      setMessages(finalMessages)
      saveChatHistory(finalMessages)

    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `죄송합니다. 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        timestamp: new Date()
      }
      const errorMessages = [...updatedMessages, errorMessage]
      setMessages(errorMessages)
      saveChatHistory(errorMessages)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const saveApiKey = () => {
    localStorage.setItem('openai-api-key', apiKey)
    setShowSettings(false)
    alert('API 키가 저장되었습니다!')
  }

  const clearChat = () => {
    if (confirm('채팅 기록을 모두 삭제하시겠습니까?')) {
      setMessages([])
      if (userSessionId) {
        localStorage.removeItem(`gpt-shelter-history-${userSessionId}`)
      }
    }
  }

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content)
    alert('메시지가 복사되었습니다!')
  }

  const exportChat = () => {
    const chatText = messages.map(m => 
      `[${new Date(m.timestamp).toLocaleString()}] ${m.role === 'user' ? '사용자' : 'AI'}: ${m.content}`
    ).join('\n\n')
    
    const blob = new Blob([chatText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat-export-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      let extractedText = ''

      if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // .docx 파일 처리
        const mammoth = (await import('mammoth')) as any
        const arrayBuffer = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer })
        extractedText = result.value
      } else if (file.type === 'text/plain') {
        // .txt 파일 처리
        extractedText = await file.text()
      } else {
        alert('지원되는 파일 형식: .docx, .txt')
        return
      }

      if (extractedText.trim()) {
        setInput(prev => prev + (prev ? '\n\n' : '') + `[파일: ${file.name}]\n${extractedText}`)
      } else {
        alert('파일에서 텍스트를 추출할 수 없습니다.')
      }
    } catch (error) {
      console.error('파일 처리 오류:', error)
      alert('파일 처리 중 오류가 발생했습니다.')
    }

    // 파일 입력 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 인증되지 않은 경우 비밀번호 입력 화면
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col h-full bg-white rounded-lg shadow-lg">
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-8 max-w-md">
            <div className="mb-6">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 text-green-600" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">GPT 4o 대피소 🏠</h2>
              <p className="text-gray-600 text-sm">
                이곳은 특별한 공간입니다. 접근 비밀번호를 입력해주세요.
              </p>
            </div>
            
            <div className="space-y-4">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                placeholder="비밀번호를 입력하세요..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-center"
              />
              
              <button
                onClick={handlePasswordSubmit}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                입장하기
              </button>
              
              <p className="text-xs text-gray-500 mt-4">
                💡 입장 후 개인 채팅방 비밀번호를 설정할 수 있습니다
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg">
      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
        <div className="flex items-center space-x-3">
          <Bot className="h-6 w-6" />
          <div>
            <h2 className="text-lg font-semibold">GPT 4o 대피소 ({config.model})</h2>
            <p className="text-sm text-blue-100">세션: {userSessionId} | SCI 논문 검토 AI</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="설정"
          >
            <Settings className="h-5 w-5" />
          </button>
          <button
            onClick={exportChat}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="채팅 내보내기"
            disabled={messages.length === 0}
          >
            <Download className="h-5 w-5" />
          </button>
          <button
            onClick={clearChat}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="채팅 지우기"
            disabled={messages.length === 0}
          >
            <Trash2 className="h-5 w-5" />
          </button>
          <button
            onClick={logout}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="로그아웃"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* 설정 패널 */}
      {showSettings && (
        <div className="p-4 bg-gray-50 border-b space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              OpenAI API 키 (선택사항)
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-... (비워두면 서버 환경변수 사용)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              💡 개인 API 키를 입력하거나 비워두면 서버 설정을 사용합니다
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                모델
              </label>
              <select
                value={config.model}
                onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value as ChatConfig['model'] }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="gpt-4o">GPT-4o (추천)</option>
                <option value="gpt-4o-mini">GPT-4o Mini (빠름)</option>
                <option value="gpt-4">GPT-4 (고품질)</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo (경제적)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                창의성 (Temperature: {config.temperature})
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={config.temperature}
                onChange={(e) => setConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>보수적 (0.0)</span>
                <span>균형 (0.5)</span>
                <span>창의적 (1.0)</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                💡 논문 검토: 0.2-0.4 권장 | 브레인스토밍: 0.7-0.9 권장
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              시스템 프롬프트
            </label>
            <textarea
              value={config.systemPrompt}
              onChange={(e) => setConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={saveApiKey}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            설정 저장
          </button>
        </div>
      )}

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <Bot className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium">SCI 논문 검토 AI에 오신 것을 환영합니다! 🎯</p>
            <p className="text-sm mt-2">영어 문장을 입력하시면 10점 만점으로 평가하고 개선사항을 제안해드립니다.</p>
            <div className="mt-4 p-4 bg-blue-50 rounded-lg text-left max-w-md mx-auto">
              <p className="text-xs text-blue-700 font-medium">평가 기준:</p>
              <ul className="text-xs text-blue-600 mt-1 space-y-1">
                <li>• 명확성 (2점) • 논리 흐름 (2점)</li>
                <li>• 학술적 어조 (2점) • 문법 (2점)</li>
                <li>• 수치 강조 (1점) • 전체 임팩트 (1점)</li>
              </ul>
            </div>
          </div>
        )}
        
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <div className="flex items-start space-x-3">
                {message.role === 'assistant' && (
                  <Bot className="h-5 w-5 mt-0.5 text-blue-600" />
                )}
                {message.role === 'user' && (
                  <User className="h-5 w-5 mt-0.5 text-blue-100" />
                )}
                <div className="flex-1">
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-xs ${
                      message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                    <button
                      onClick={() => copyMessage(message.content)}
                      className={`p-1 rounded hover:bg-white/20 transition-colors ${
                        message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                      }`}
                      title="복사"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-4 max-w-[80%]">
              <div className="flex items-center space-x-3">
                <Bot className="h-5 w-5 text-blue-600" />
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      <div className="p-4 border-t bg-gray-50">
        <div className="flex space-x-3">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="평가받고 싶은 영어 문장을 입력하세요... (Shift+Enter로 줄바꿈)"
              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={1}
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-gray-500 hover:text-blue-600 transition-colors"
              title="파일 업로드 (.docx, .txt)"
            >
              <Upload className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-2 text-xs text-gray-500 text-center">
          💡 파일 업로드: .docx (워드), .txt 지원 | 논문 텍스트를 직접 붙여넣어도 됩니다
        </div>
      </div>
    </div>
  )
}