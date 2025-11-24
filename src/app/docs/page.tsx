'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { ArrowLeft, BookOpen, FileText, History } from 'lucide-react'
import Link from 'next/link'

type DocType = 'features' | 'changelog' | 'readme'

export default function DocsPage() {
  const [activeDoc, setActiveDoc] = useState<DocType>('features')
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDoc = async () => {
      setLoading(true)
      try {
        let filename = ''
        switch (activeDoc) {
          case 'features':
            filename = 'FEATURES.md'
            break
          case 'changelog':
            filename = 'CHANGELOG.md'
            break
          case 'readme':
            filename = 'README.md'
            break
        }

        const response = await fetch(`/${filename}`)
        const text = await response.text()
        setContent(text)
      } catch (error) {
        console.error('Failed to load document:', error)
        setContent('# 문서를 불러올 수 없습니다\n\n문서 파일을 찾을 수 없거나 로드 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchDoc()
  }, [activeDoc])

  const tabs: Array<{ id: DocType; label: string; icon: any; description: string }> = [
    {
      id: 'features',
      label: '기능 가이드',
      icon: BookOpen,
      description: '모든 기능의 상세 사용법'
    },
    {
      id: 'changelog',
      label: '변경 이력',
      icon: History,
      description: '버전별 업데이트 내역'
    },
    {
      id: 'readme',
      label: '프로젝트 소개',
      icon: FileText,
      description: '프로젝트 개요 및 시작하기'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* 헤더 */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-medium">메인으로</span>
              </Link>
              <div className="h-8 w-px bg-gray-300"></div>
              <h1 className="text-xl font-bold text-gray-900">
                지구화학 데이터 분석기 - 문서
              </h1>
            </div>
            <div className="text-sm text-gray-500">
              v0.5.7
            </div>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-2 py-4 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeDoc === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveDoc(tab.id)}
                  className={`flex items-center gap-3 px-6 py-3 rounded-lg transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-semibold">{tab.label}</div>
                    <div className={`text-xs ${isActive ? 'text-blue-100' : 'text-gray-500'}`}>
                      {tab.description}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 컨텐츠 영역 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-600">문서를 불러오는 중...</p>
              </div>
            </div>
          ) : (
            <div className="prose prose-slate max-w-none p-8 lg:p-12">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                components={{
                  // 헤딩 스타일
                  h1: ({ node, ...props }) => (
                    <h1 className="text-4xl font-bold mb-6 pb-4 border-b-4 border-blue-600 text-gray-900" {...props} />
                  ),
                  h2: ({ node, ...props }) => (
                    <h2 className="text-3xl font-bold mt-12 mb-4 pb-2 border-b-2 border-gray-300 text-gray-800" {...props} />
                  ),
                  h3: ({ node, ...props }) => (
                    <h3 className="text-2xl font-semibold mt-8 mb-3 text-gray-800" {...props} />
                  ),
                  h4: ({ node, ...props }) => (
                    <h4 className="text-xl font-semibold mt-6 mb-2 text-gray-700" {...props} />
                  ),
                  // 리스트 스타일
                  ul: ({ node, ...props }) => (
                    <ul className="list-disc list-inside space-y-2 my-4 text-gray-700" {...props} />
                  ),
                  ol: ({ node, ...props }) => (
                    <ol className="list-decimal list-inside space-y-2 my-4 text-gray-700" {...props} />
                  ),
                  li: ({ node, ...props }) => (
                    <li className="ml-4 leading-relaxed" {...props} />
                  ),
                  // 코드 블록
                  code: ({ node, inline, ...props }: any) => (
                    inline ? (
                      <code className="bg-blue-50 text-blue-800 px-2 py-1 rounded text-sm font-mono border border-blue-200" {...props} />
                    ) : (
                      <code className="block bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono my-4" {...props} />
                    )
                  ),
                  pre: ({ node, ...props }) => (
                    <pre className="bg-gray-900 rounded-lg overflow-hidden my-4" {...props} />
                  ),
                  // 링크 스타일
                  a: ({ node, ...props }) => (
                    <a className="text-blue-600 hover:text-blue-800 underline decoration-2 decoration-blue-300 hover:decoration-blue-600 transition-colors" {...props} />
                  ),
                  // 인용구
                  blockquote: ({ node, ...props }) => (
                    <blockquote className="border-l-4 border-yellow-400 bg-yellow-50 pl-4 py-2 my-4 italic text-gray-700" {...props} />
                  ),
                  // 테이블
                  table: ({ node, ...props }) => (
                    <div className="overflow-x-auto my-4">
                      <table className="min-w-full divide-y divide-gray-300 border border-gray-300" {...props} />
                    </div>
                  ),
                  thead: ({ node, ...props }) => (
                    <thead className="bg-gray-100" {...props} />
                  ),
                  th: ({ node, ...props }) => (
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b border-gray-300" {...props} />
                  ),
                  td: ({ node, ...props }) => (
                    <td className="px-4 py-3 text-sm text-gray-700 border-b border-gray-200" {...props} />
                  ),
                  // 수평선
                  hr: ({ node, ...props }) => (
                    <hr className="my-8 border-t-2 border-gray-300" {...props} />
                  ),
                  // 문단
                  p: ({ node, ...props }) => (
                    <p className="my-4 leading-relaxed text-gray-700" {...props} />
                  ),
                  // 강조
                  strong: ({ node, ...props }) => (
                    <strong className="font-bold text-gray-900" {...props} />
                  ),
                  em: ({ node, ...props }) => (
                    <em className="italic text-gray-800" {...props} />
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>

      {/* 푸터 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-sm text-gray-500">
          <p>지구화학 데이터 분석기 © 2024</p>
          <p className="mt-1">
            문제가 있거나 개선 제안이 있으시면{' '}
            <a
              href="https://github.com/sooneeujuro/geochemistry-analyzer/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              GitHub Issues
            </a>
            에 남겨주세요
          </p>
        </div>
      </div>
    </div>
  )
}
