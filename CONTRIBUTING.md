# 🤝 기여 가이드 (Contributing Guide)

이 프로젝트에 기여해주셔서 감사합니다! 이 가이드는 새로운 기능을 추가하거나 버그를 수정할 때 따라야 할 절차를 설명합니다.

---

## 📝 새 기능 추가 시 체크리스트

새로운 기능을 추가할 때는 **반드시** 다음 단계를 따라주세요:

### 1. 코드 작성
- [ ] 기능 구현 (`src/components/ScatterPlot.tsx` 등)
- [ ] 타입 정의 추가 (필요시 `src/types/geochem.ts`)
- [ ] 로컬 테스트 완료

### 2. 문서 업데이트 (중요!)

#### 2.1 FEATURES.md 업데이트
```markdown
## X. 해당 섹션

### X.X 새 기능 이름
- **위치**: 기능이 어디 있는지
- **기능**: 무엇을 하는지
- **사용 방법**: 어떻게 사용하는지
- **주의사항**: 알아야 할 점
```

**파일 위치**: `FEATURES.md`
**업데이트 위치**: 해당하는 섹션에 추가 (예: 차트 스타일이면 "3. 차트 스타일 설정")

#### 2.2 README.md 업데이트
```markdown
### 📈 고급 시각화 (또는 해당 카테고리)
- **새 기능 이름**: 간단한 설명 (1줄)
```

**파일 위치**: `README.md`
**업데이트 위치**: "🚀 주요 기능" 섹션의 적절한 카테고리

#### 2.3 CHANGELOG.md 업데이트
```markdown
## [0.x.x] - YYYY-MM-DD

### ✨ Added (또는 적절한 카테고리)
- **새 기능 이름**: 사용자 관점에서의 설명
```

**파일 위치**: `CHANGELOG.md`
**업데이트 위치**: 맨 위에 새 버전 섹션 추가 (또는 현재 버전에 추가)

### 3. Git 커밋

```bash
git add .
git commit -m "Add [기능명]: 간단한 설명

- 주요 변경사항 1
- 주요 변경사항 2

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin main
```

---

## 🔍 문서 업데이트 상세 가이드

### FEATURES.md 작성 가이드

**목적**: 모든 기능의 상세한 사용법을 제공

**작성 원칙**:
1. **명확성**: 초보자도 이해할 수 있게
2. **위치 정보**: UI에서 어디 있는지 명시
3. **예시 제공**: 가능한 한 구체적인 예시
4. **주의사항**: 제약사항이나 알아야 할 점

**템플릿**:
```markdown
### X.X 기능 이름
- **위치**: [차트 스타일 패널] → [서브메뉴]
- **기능**: 이 기능이 하는 일
- **사용 방법**:
  1. 단계 1
  2. 단계 2
- **옵션**:
  - 옵션 1: 설명
  - 옵션 2: 설명
- **예시**: 구체적인 사용 예시
- **주의**: 알아야 할 점이나 제약사항
```

### README.md 작성 가이드

**목적**: 프로젝트 개요 및 빠른 참조

**작성 원칙**:
1. **간결성**: 1-2줄로 요약
2. **카테고리**: 적절한 카테고리에 배치
3. **사용자 중심**: 기술적 세부사항 최소화

**카테고리**:
- 📁 데이터 관리
- 📊 통계 분석
- 📈 고급 시각화
- 🎨 차트 커스터마이징
- 💾 내보내기
- 🖥️ 사용자 경험

### CHANGELOG.md 작성 가이드

**목적**: 버전별 변경사항 추적

**카테고리**:
- `✨ Added`: 새로운 기능
- `🎨 Changed`: 기존 기능의 변경
- `🐛 Fixed`: 버그 수정
- `🔒 Security`: 보안 관련
- `📝 Deprecated`: 곧 제거될 기능
- `🗑️ Removed`: 제거된 기능

**작성 원칙**:
1. **사용자 관점**: 코드가 아닌 기능 중심
2. **명확성**: 무엇이 바뀌었는지 분명히
3. **날짜**: YYYY-MM-DD 형식

---

## 📂 주요 파일 구조

```
geochemistry-analyzer/
├── README.md              # 프로젝트 개요 및 빠른 시작
├── FEATURES.md            # 모든 기능의 상세 사용법 ⭐
├── CHANGELOG.md           # 버전별 변경사항 ⭐
├── CONTRIBUTING.md        # 이 파일 - 기여 가이드
├── src/
│   ├── components/
│   │   └── ScatterPlot.tsx  # 주요 차트 컴포넌트 ⭐
│   ├── types/
│   │   └── geochem.ts       # 타입 정의
│   └── lib/
│       └── statistics.ts    # 통계 함수
└── package.json
```

**⭐ = 자주 수정하는 파일**

---

## 🎯 실전 예시: 새 기능 추가하기

### 예시: "히스토그램 오버레이" 기능 추가

#### 1단계: 코드 작성
```typescript
// src/components/ScatterPlot.tsx
const [showHistogram, setShowHistogram] = useState(false)
// ... 히스토그램 로직 구현
```

#### 2단계: FEATURES.md 업데이트
```markdown
### 4.7 히스토그램 오버레이
- **위치**: 플롯 스타일 패널 → 하단
- **기능**: X축 또는 Y축 데이터 분포를 히스토그램으로 표시
- **사용 방법**:
  1. "히스토그램 표시" 체크박스 클릭
  2. 축 선택 (X축/Y축)
  3. 빈(bin) 개수 조정
- **옵션**:
  - 빈 개수: 5-50개
  - 히스토그램 위치: 상단/우측
  - 투명도: 0.1-1.0
```

#### 3단계: README.md 업데이트
```markdown
### 🎨 차트 커스터마이징
- **히스토그램 오버레이**: X/Y축 데이터 분포 시각화
```

#### 4단계: CHANGELOG.md 업데이트
```markdown
## [0.6.0] - 2024-12-01

### ✨ Added
- **히스토그램 오버레이**: 축에 데이터 분포 히스토그램 표시 기능
```

#### 5단계: Git 커밋
```bash
git add FEATURES.md README.md CHANGELOG.md src/components/ScatterPlot.tsx
git commit -m "Add histogram overlay feature

- Add histogram display for X/Y axis distributions
- Configurable bin count (5-50)
- Adjustable transparency

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin main
```

---

## ⚠️ 주의사항

### 반드시 지킬 것
1. ✅ 코드 변경 시 **반드시** 문서 업데이트
2. ✅ 기능 삭제 시 CHANGELOG에 `Removed` 카테고리로 기록
3. ✅ 버전 번호는 Semantic Versioning 준수
4. ✅ 커밋 메시지는 명확하고 구체적으로

### 하지 말아야 할 것
1. ❌ 문서 없이 코드만 커밋
2. ❌ 변경사항을 CHANGELOG에 기록 안 함
3. ❌ 모호한 커밋 메시지 ("fix bug", "update" 등)
4. ❌ 기존 기능 삭제 시 문서에서만 지우고 CHANGELOG에 기록 안 함

---

## 🔄 다른 대화창에서 작업할 때

다른 Claude Code 대화창에서 이 프로젝트를 수정할 때:

1. **먼저 읽기**: `FEATURES.md`와 `CHANGELOG.md` 읽고 현재 상태 파악
2. **기능 추가 후**: 위의 체크리스트 따라 문서 업데이트
3. **중복 방지**: FEATURES.md에서 비슷한 기능 있는지 확인

### 빠른 확인 명령어
```bash
# 최근 변경사항 확인
git log --oneline -10

# 현재 기능 목록 확인
cat FEATURES.md | grep "###"

# 최신 버전 확인
head -20 CHANGELOG.md
```

---

## 💡 팁

### 문서 작성 팁
- 사용자가 "어디서" "어떻게" 사용하는지 명확히
- 기술 용어보다는 일반 용어 사용
- 스크린샷 추가하면 더 좋음 (선택사항)

### 버전 관리 팁
- 작은 기능: 0.X.1 (Patch)
- 새로운 기능: 0.X.0 (Minor)
- 대규모 변경: X.0.0 (Major)

### 커밋 메시지 팁
```
좋은 예시:
✅ "Add logarithmic scale for X/Y axes"
✅ "Fix type column color bug in ScatterPlot"
✅ "Update axis label positioning controls"

나쁜 예시:
❌ "update"
❌ "fix bug"
❌ "changes"
```

---

## 📞 질문이나 문제가 있나요?

- GitHub Issues를 통해 질문하세요
- 문서가 불명확하면 이슈로 알려주세요
- 개선 제안은 언제나 환영합니다!

---

**마지막 업데이트**: 2024-11-24
**작성자**: Claude Code 👨‍💻
