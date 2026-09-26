# Digital Desk

> 원본 기획 문서. 구현 중 판단이 필요할 때의 기준 문서다.
> 구현 결정·범위는 `CLAUDE.md`, 디자인 사양은 `docs/DESIGN.md`, 단계별 작업은 `docs/ROADMAP.md`를 따른다.

## 1. 한 문장 정의

**컴퓨터를 사용하면서 복사하고, 캡처하고, 다운로드하고, 저장한 디지털 조각들을 자동으로 모아두고 나중에 다시 찾게 해주는 개인용 Digital Desk.**

제품의 핵심 문장은 다음과 같다.

> **Capture first. Organize never. Find later.**

한국어 표현으로는:

> **일단 지나가세요. 필요할 때 다시 찾으세요.**

또는

> **정리하지 않아도 다시 찾을 수 있는 디지털 책상.**

---

# 2. 우리가 해결하려는 문제

컴퓨터로 일하다 보면 계속 작은 정보들이 발생한다.

- 에러 화면을 스크린샷으로 찍는다.
- 에러 메시지를 복사한다.
- StackOverflow나 공식 문서를 연다.
- PDF를 하나 다운로드한다.
- Slack에서 받은 코드를 복사한다.
- 나중에 읽으려고 링크를 저장한다.
- 임시로 메모를 한다.

각 행동 자체는 어렵지 않다.

문제는 **나중에 다시 찾을 때** 발생한다.

사용자는 생각한다.

> 분명 며칠 전에 봤는데?

그 뒤에는 보통 다음과 같은 일이 발생한다.

```text
Downloads 확인
→ Desktop 확인
→ Chrome History 확인
→ Finder 검색
→ 메모 검색
→ Slack 검색
→ 다시 Google 검색
```

정보를 저장하지 않았던 것이 아니다.

**어디에 저장되었는지를 기억하지 못하는 것**이 문제다.

Digital Desk는 이를 해결한다.

---

# 3. Digital Desk의 핵심 관점

기존 프로그램들은 대부분 정보를 다음처럼 본다.

```text
Clipboard Manager
→ 내가 복사한 것

File Manager
→ 내가 저장한 파일

Bookmark Manager
→ 내가 저장한 링크

Screenshot Manager
→ 내가 찍은 이미지
```

Digital Desk에서는 이들을 모두 같은 것으로 본다.

```text
Digital Item
```

즉,

```text
Clipboard
Screenshot
Downloaded File
Link
Image
Note
```

는 서로 다른 프로그램의 데이터가 아니라,

> **내가 어떤 일을 하면서 남긴 흔적**

이다.

따라서 Digital Desk의 데이터 모델은 파일 중심이 아니라 **Item 중심**이다.

---

# 4. 경쟁 제품과 가장 중요한 차이

## Raycast / Paste와의 차이

Raycast와 Paste는 기본적으로 Clipboard Manager다.

Digital Desk에서는 Clipboard가 여러 입력 채널 중 하나다.

```text
Clipboard
Screenshot
Download
Link
File
Note
        ↓
   Digital Desk
```

따라서 핵심 질문도 다르다.

Clipboard Manager:

> 내가 전에 복사했던 게 뭐였지?

Digital Desk:

> 내가 지난주 Redis 문제 볼 때 봤던 게 뭐였지?

---

# 5. Dropover와의 차이

Dropover의 핵심은:

> 지금 A에서 B로 옮길 파일을 잠시 올려놓는다.

Digital Desk의 핵심은:

> 지나간 뒤에도 그 흔적을 다시 찾을 수 있다.

즉,

```text
Dropover
Temporary Transfer

Digital Desk
Temporary Memory
```

이다.

Shelf 자체가 목적이 아니라 **나중에 회수 가능한 작업 기억**이 목적이다.

---

# 6. Eagle / Fabric / Notion과의 차이

이런 도구들은 대체로 사용자가 자료를 **보관하기로 결정**해야 한다.

Digital Desk에서는 이 결정 자체를 줄인다.

```text
기존 방식

정보 발견
→ 저장할까?
→ 어디에 저장하지?
→ 폴더 선택
→ 태그 입력
→ 저장


Digital Desk

정보 발견
→ 평소처럼 복사/캡처/다운로드
→ 끝
```

Digital Desk의 철학은 Knowledge Management가 아니다.

**Knowledge Capture 이전의 단계**를 담당한다.

---

# 7. screenpipe / Recall 계열과의 차이

이 구분은 매우 중요하다.

Digital Desk는 사용자의 화면을 계속 녹화하지 않는다.

Digital Desk가 기억하는 것은 기본적으로 사용자가 만들어낸 **명확한 Artifact**다.

```text
복사했다
캡처했다
다운로드했다
Desk에 넣었다
```

즉,

```text
Everything I saw
```

가 아니라

```text
Things I touched
```

를 기억한다.

이 차이에는 여러 장점이 있다.

### 프라이버시

사용자의 모든 화면을 저장하지 않는다.

### 저장 공간

몇 초마다 스크린샷을 찍을 필요가 없다.

### 노이즈

하루 동안 화면에 나타난 수만 개의 정보가 아니라 실제로 사용자가 상호작용한 정보가 중심이다.

### 심리적 부담

"모든 화면이 기록되고 있다"가 아니라

"내가 남긴 작업 흔적이 모인다."

에 가깝다.

---

# 8. 제품 포지셔닝

Digital Desk는 다음 중 어느 하나도 아니다.

```text
❌ Clipboard Manager
❌ File Manager
❌ Bookmark Manager
❌ Note App
❌ Screen Recorder
❌ AI Chat
❌ Knowledge Base
❌ Launcher
```

하지만 이들 사이에 흩어져 있던 **임시 정보**를 연결한다.

따라서 포지셔닝은:

> **A local-first inbox for the things you touch on your computer.**

또는

> **Your temporary memory for digital work.**

로 잡는다.

---

# 9. 핵심 사용자

Digital Desk는 특정 직업에 종속시키지 않는다.

주요 대상은 하루 종일 PC를 이용하는 사람이다.

예:

- 개발자
- 디자이너
- 학생
- 기획자
- 연구자
- 사무직
- 콘텐츠 작업자

다만 MVP 데모에서는 개발자 Workflow를 이용하기 좋다.

개발 과정에서

```text
Screenshot
Error Message
Documentation
Code
Downloads
```

가 자주 발생하기 때문이다.

제품 자체는 일반적인 Desktop Utility로 만든다.

---

# 10. 가장 중요한 사용자 경험

Digital Desk가 성공하려면 사용자가 **저장이라는 행동을 추가로 하지 않아야 한다.**

예를 들어 사용자가

```text
Cmd + C
```

한다.

Digital Desk:

```text
Clipboard Item 생성
```

사용자가 스크린샷을 찍는다.

Digital Desk:

```text
Screenshot Item 생성
OCR 실행
```

파일을 다운로드한다.

Digital Desk:

```text
Download Item 생성
```

URL을 복사한다.

Digital Desk:

```text
Link Item 생성
```

사용자는 Digital Desk를 의식하지 않아도 된다.

그리고 나중에만 사용한다.

```text
Cmd + Shift + Space
```

검색창:

> 지난주 redis 에러

결과:

```text
Screenshot
RedisConnectionFailureException
Sep 21 · IntelliJ

Clipboard
RedisConnectionFailureException...
Sep 21 · IntelliJ

Link
Redis timeout documentation
Sep 21 · Chrome

PDF
Redis troubleshooting guide.pdf
Sep 21 · Downloads
```

이 경험이 Digital Desk의 핵심이다.

---

# 11. AI 없이도 "지난주 redis 에러"를 가능하게 한다

여기서 중요한 설계 결정이 있다.

자연어 검색 = LLM이라고 생각하지 않는다.

예를 들어

```text
지난주 redis 에러
```

를 입력했을 때

검색 엔진은 먼저 시간 표현을 해석한다.

```text
지난주
→ 2026-09-14 ~ 2026-09-20
```

나머지:

```text
redis 에러
```

는 Full Text Search로 검색한다.

따라서 기본 검색은 매우 빠르고 로컬에서 동작한다.

지원할 수 있는 시간 표현:

```text
오늘
어제
그제
이번주
지난주
이번달
지난달

today
yesterday
this week
last week
this month
last month
```

추후에는

```text
지난 화요일
3일 전
8월쯤
```

등으로 확장할 수 있다.

---

# 12. 검색 구조

검색은 3단계로 설계한다.

## Layer 1 — Keyword Search

SQLite FTS 기반.

검색 대상:

```text
title
text
ocrText
fileName
url
domain
sourceApp
```

가장 빠르고 기본적인 검색이다.

---

## Layer 2 — Structured Search

사용자가 필터를 적용할 수 있다.

예:

```text
redis type:screenshot

spring app:IntelliJ

domain:github.com

type:file

last-week error
```

UI에서는 직접 syntax를 몰라도 Filter Chip으로 사용할 수 있다.

```text
[Last Week] [Screenshot] Redis
```

---

## Layer 3 — Semantic Search

Optional.

Digital Desk 자체에는 반드시 포함시키지 않는다.

사용자가 원하는 방식으로 연결한다.

예:

```text
OpenAI
Claude
Gemini
Ollama
Local embedding model
Custom script
```

그러면 다음과 같은 검색이 가능해진다.

> 며칠 전에 서버 연결 안 되던 문제

실제 데이터에는

```text
RedisConnectionFailureException
```

만 존재하더라도 의미 기반으로 찾을 수 있다.

---

# 13. AI 전략

Digital Desk의 중요한 원칙:

> **AI-ready, AI-optional.**

AI가 없어도 제품은 완전하게 사용할 수 있어야 한다.

기본:

```text
Capture
OCR
Metadata
FTS
Timeline
Context
```

AI 연결 후:

```text
Semantic Search
Auto Summary
Auto Tags
Context Naming
Classification
Question Answering
Automation
```

이렇게 설계한다.

---

# 14. AI 연결 구조

장기적으로 Digital Desk는 Local API를 제공한다.

예:

```http
GET /api/items
GET /api/items/{id}
GET /api/search?q=redis
GET /api/contexts
POST /api/items/{id}/tags
```

그리고 별도의 MCP Adapter를 제공할 수 있다.

그러면 사용자는 Claude Code나 Codex에서:

> Digital Desk에서 지난주 Redis 관련 자료 찾아줘.

라고 요청할 수 있다.

AI가 Digital Desk의 검색 API를 호출한다.

중요한 점은

**AI에게 모든 데이터를 무조건 넘기지 않는 것**이다.

검색 결과 중 필요한 Item만 제공한다.

---

# 15. Extension 구조

장기적으로 Digital Desk는 작은 Platform 역할도 할 수 있다.

Extension interface 예:

```ts
interface DeskPlugin {
    onCapture?(item: DeskItem): Promise<void>;

    enrich?(item: DeskItem): Promise<Metadata>;

    search?(query: string): Promise<SearchResult[]>;

    actions?(item: DeskItem): DeskAction[];
}
```

예:

```text
OCR Plugin
Secret Detector
Code Detector
AI Search
Ollama Search
Git Context
PDF Parser
Image Analyzer
Translation
```

하지만 ALEN CUP 버전에서는 Plugin Marketplace 같은 것은 만들지 않는다.

**확장 가능한 구조만 확보한다.**

---

# 16. 핵심 데이터 타입

MVP에서는 5개만 둔다.

```text
TEXT
LINK
IMAGE
FILE
SCREENSHOT
```

Note는 TEXT로 표현할 수 있다.

각 Item은 내부적으로 동일한 구조를 갖는다.

```ts
interface DeskItem {
    id: string;

    type:
        | "text"
        | "link"
        | "image"
        | "file"
        | "screenshot";

    title?: string;

    text?: string;

    ocrText?: string;

    filePath?: string;

    url?: string;

    sourceApp?: string;

    createdAt: Date;

    capturedAt: Date;

    previewPath?: string;

    contentHash?: string;

    pinned: boolean;

    archived: boolean;

    metadata: Record<string, unknown>;
}
```

---

# 17. Binary 데이터 정책

Digital Desk가 모든 파일을 복사해 저장해서는 안 된다.

파일 종류에 따라 다르게 처리한다.

## Clipboard Image

Digital Desk가 직접 보관.

## Screenshot

원본 파일 참조 + Thumbnail 생성.

필요하면 삭제되었을 경우를 대비해 Preview만 유지.

## Downloaded File

원본 파일 경로만 기록.

```text
~/Downloads/example.pdf
```

## Link

URL + Metadata 저장.

## Text

Local DB에 저장.

이렇게 하면 저장 공간을 최소화할 수 있다.

---

# 18. Inbox / Desk / Archive

Digital Desk의 정보 구조는 세 단계만 둔다.

## Inbox

최근 발생한 모든 Item.

아무 정리도 필요 없다.

```text
Screenshot
Clipboard
Download
Link
```

시간순으로 나타난다.

---

## Desk

사용자가 현재 관심 있는 것을 Pin한다.

예:

```text
ALEN CUP
Redis Error
Travel
Tax Documents
```

단순 Pin Item도 가능하고 Context 전체를 Pin할 수도 있다.

---

## Archive

오래된 자료.

평소 UI에서는 감춘다.

검색하면 언제든 나온다.

즉:

```text
Inbox
↓
Desk
↓
Archive
```

라는 물리적인 책상 모델을 사용한다.

---

# 19. Context

Digital Desk의 가장 중요한 발전 요소 중 하나다.

컴퓨터에서는 하나의 작업을 할 때 여러 Artifact가 연속적으로 발생한다.

예:

```text
14:03 Screenshot
14:05 Error clipboard
14:07 StackOverflow link
14:12 application.yml
14:16 Redis documentation
```

Digital Desk는 이것들을 독립적인 5개의 기록으로만 보지 않는다.

하나의 **Context** 후보로 볼 수 있다.

```text
Context

14:03 ~ 14:16

5 items
```

초기에는 AI가 없어도 된다.

Context 점수를 계산하는 요소:

```text
시간 근접성
Source App
Domain
File Directory
공통 Keyword
```

예:

```text
same app         +2
within 5 min     +3
same domain      +2
shared keyword   +1
```

일정 threshold 이상이면 하나의 Context로 묶는다.

---

# 20. Context 이름

MVP에서는 자동 이름 생성까지 하지 않아도 된다.

처음에는:

```text
Context · Sep 26 · 14:03
```

정도로 표시한다.

사용자가 직접:

```text
Redis Connection Error
```

로 이름 붙일 수 있다.

AI Plugin을 연결하면 추후 자동 이름을 생성할 수 있다.

---

# 21. 메인 화면

기본 UI는 Dashboard처럼 복잡하면 안 된다.

Digital Desk는 Desktop Utility다.

예:

```text
┌───────────────────────────────────────────────────┐
│ Digital Desk                              ⌘K     │
├───────────────────────────────────────────────────┤
│                                                   │
│  Search your desk...                              │
│                                                   │
├───────────────────────────────────────────────────┤
│ TODAY                                             │
│                                                   │
│  14:32                                            │
│  🖼 Screenshot                                    │
│  RedisConnectionFailureException                  │
│  IntelliJ                                         │
│                                                   │
│  14:21                                            │
│  📋 Clipboard                                     │
│  SELECT * FROM employee...                        │
│  IntelliJ                                         │
│                                                   │
│  13:52                                            │
│  🔗 redis.io                                      │
│  Redis eviction policies                          │
│  Chrome                                           │
│                                                   │
│  11:32                                            │
│  📄 ALEN_CUP.pdf                                  │
│  Downloads                                        │
│                                                   │
├───────────────────────────────────────────────────┤
│ Inbox              Desk              Archive      │
└───────────────────────────────────────────────────┘
```

---

# 22. Quick Search

Digital Desk에서 가장 중요한 UI다.

Global Shortcut:

```text
Cmd + Shift + Space
```

또는

```text
Cmd + K
```

앱 내부.

화면:

```text
┌──────────────────────────────────────────────┐
│ 🔎 지난주 redis 에러                        │
├──────────────────────────────────────────────┤
│                                              │
│ 🖼 RedisConnectionFailureException           │
│    Screenshot · IntelliJ · Sep 21            │
│                                              │
│ 📋 RedisConnectionFailureException...        │
│    Clipboard · IntelliJ · Sep 21             │
│                                              │
│ 🔗 Redis timeout documentation              │
│    redis.io · Sep 21                         │
│                                              │
└──────────────────────────────────────────────┘
```

Enter:

```text
Open
```

Cmd+Enter:

```text
Reveal original
```

Space:

```text
Quick Look
```

같은 Keyboard-first UX를 제공할 수 있다.

---

# 23. Item Detail

Item을 선택하면 오른쪽 Inspector를 보여준다.

```text
Preview

RedisConnectionFailureException...

──────────────

Type
Screenshot

Captured
Sep 21, 14:03

Source
IntelliJ

Original
~/Desktop/Screenshot...

OCR
RedisConnectionFailureException
Unable to connect...

──────────────

[Open]
[Copy]
[Pin]
[Delete]
```

Metadata는 필요할 때만 보이게 한다.

---

# 24. Capture Source

ALEN CUP MVP에서는 다음 세 가지가 핵심이다.

### 1. Clipboard

감지 대상:

```text
Text
URL
Image
File
```

### 2. Screenshot Folder

OS Screenshot 폴더 변경 감지.

파일이 생성되면 Item 등록.

OCR 실행.

### 3. Downloads Folder

새 파일 생성 감지.

파일명/확장자/시간/경로 저장.

이 세 개만으로도 Digital Desk 컨셉은 충분히 전달된다.

---

# 25. Browser Extension

브라우저 Extension은 P1로 둔다.

버튼:

```text
Save to Digital Desk
```

저장 정보:

```text
URL
Title
Selected Text
Favicon
Timestamp
```

우클릭:

```text
Save page to Desk
Save selection to Desk
```

이후 Chrome뿐 아니라 다른 Browser로 확장 가능하다.

---

# 26. Privacy

Digital Desk는 Local-first를 기본 철학으로 둔다.

기본 상태에서는 서버가 없다.

```text
Desktop
   ↓
SQLite
   ↓
Local Assets
```

Cloud account도 요구하지 않는다.

---

# 27. Capture 제외 기능

특정 앱에서는 Clipboard를 기록하지 않도록 한다.

기본 후보:

```text
Password Manager
Keychain
Banking App
```

사용자가 직접 추가할 수 있다.

```text
Do not capture from:

[1Password]
[Keychain Access]
[Company Security App]
```

---

# 28. Private Mode

Menu Bar:

```text
Digital Desk
● Capturing
```

클릭:

```text
Pause for 5 minutes
Pause for 30 minutes
Pause until resumed
```

Global Shortcut으로도 제공할 수 있다.

이는 단순 기능을 넘어 제품에 대한 신뢰를 만든다.

---

# 29. 즉시 삭제

민감한 내용을 실수로 복사했을 때:

```text
Delete last 5 minutes
```

같은 기능도 유용하다.

---

# 30. Retention

모든 데이터를 영구 보관할 필요가 없다.

예:

```text
Clipboard
30 days

Screenshots
Metadata unlimited

Downloads
Metadata unlimited

Archived
user-controlled
```

설정에서:

```text
Keep temporary items

7 days
30 days
90 days
Forever
```

로 선택할 수 있다.

Digital Desk는 Archive Tool이 아니라 **Temporary Memory**이기 때문에 자동 만료 개념과 잘 어울린다.

---

# 31. 디자인 방향

Digital Desk는 생산성 SaaS처럼 보이면 안 된다.

피해야 할 것:

```text
Dashboard
Charts
Statistics
Progress
Gamification
Huge Sidebar
```

더 가까운 분위기:

```text
Spotlight
Finder
Raycast
Arc
Linear
macOS Quick Look
```

즉:

> 조용하고 빠른 Desktop Utility

가 되어야 한다.

---

# 32. Visual Language

카드 UI보다 Timeline/List 기반이 좋다.

이유는 데이터가 많아질 것이기 때문이다.

기본:

```text
Icon
Title
Preview
Source
Time
```

만 보여준다.

색상은 Type을 지나치게 강조하지 않는다.

Screenshot / Clipboard / File 등의 아이콘으로 충분하다.

---

# 33. 제품을 켰을 때 느껴야 하는 감정

Digital Desk의 UX 목표는:

> 관리해야 할 새로운 앱이 하나 생겼다.

가 아니다.

> 내 컴퓨터가 조금 더 잘 기억하기 시작했다.

여야 한다.

따라서 Notification도 최소화한다.

Capture될 때마다 알림을 띄우지 않는다.

조용히 저장한다.

---

# 34. 기술 구조 — ALEN CUP 버전 추천

빠르게 완성하기 위해서는 다음 구성이 현실적이다.

```text
Electron
React
TypeScript
SQLite
better-sqlite3
SQLite FTS5
chokidar
tesseract.js
```

구조:

```text
Electron Main
│
├── Capture Service
│   ├── ClipboardWatcher
│   ├── ScreenshotWatcher
│   └── DownloadWatcher
│
├── Index Service
│   ├── TextExtractor
│   ├── OCRService
│   └── SearchIndexer
│
├── Storage
│   ├── SQLite
│   └── Assets
│
└── IPC
       ↓
React Renderer
```

ALEN CUP 단계에서는 Electron의 앱 크기나 메모리 사용량보다 **개발 속도와 완성도**가 중요하다.

향후 필요하다면 Tauri/Native로 이동할 수 있다.

---

# 35. Database

기본 테이블:

```sql
items
-----
id
type
title
text
ocr_text
file_path
url
source_app
created_at
captured_at
preview_path
content_hash
pinned
archived
metadata_json
```

FTS:

```sql
items_fts
---------
title
text
ocr_text
file_path
url
source_app
```

추후:

```text
contexts
context_items
tags
item_tags
```

추가.

---

# 36. 중복 처리

Clipboard에서는 같은 값을 여러 번 복사할 수 있다.

따라서 content hash를 만든다.

예:

```text
SHA256(normalized content)
```

같은 내용이 짧은 시간 안에 다시 들어오면 새 Item을 만들지 않고

```text
lastUsedAt
useCount
```

를 갱신한다.

Screenshot/File도 hash 기반 중복 감지가 가능하다.

---

# 37. Search Ranking

검색 결과 점수는 단순하게 시작한다.

예:

```text
Exact Title Match       +10
OCR Match                +7
Text Match               +7
File Name Match          +8
Source Match             +3

Recent item bonus
Pinned item bonus
```

중요한 것은 AI Ranking을 만들려 하지 않는 것이다.

MVP에서는 deterministic ranking이 오히려 안정적이다.

---

# 38. 첫 실행 경험

Onboarding은 매우 짧아야 한다.

### Screen 1

```text
Digital Desk remembers
the things you touch.
```

### Screen 2

권한 설명:

```text
Clipboard

Digital Desk watches your clipboard
so you can find copied items later.

Everything stays on this device.
```

### Screen 3

Folder 선택:

```text
Screenshots
Downloads
```

자동 감지가 가능하면 Default Path 제안.

### Screen 4

완료.

```text
You're ready.

Copy something.
Take a screenshot.
Download a file.

We'll remember it.
```

---

# 39. 처음부터 만들지 않을 것

이게 매우 중요하다.

ALEN CUP MVP에서 제외:

```text
❌ Cloud Sync
❌ Login
❌ Account
❌ Team collaboration
❌ Continuous screen recording
❌ Audio recording
❌ Browser history 전체 수집
❌ File system 전체 indexing
❌ AI Chat
❌ Built-in LLM
❌ Plugin Marketplace
❌ Complex Rule Engine
❌ Mobile App
❌ Vector DB
❌ Multi-device sync
```

제품 컨셉을 보여주는 데 필요하지 않다.

---

# 40. MVP P0

반드시 동작해야 한다.

### Capture

```text
Clipboard Text
Clipboard URL
Screenshot
Download
```

### Processing

```text
Screenshot OCR
Basic Metadata
Content Hash
```

### Search

```text
Keyword
OCR
Date
Type
```

### UI

```text
Timeline
Quick Search
Preview
Pin
Delete
```

### Privacy

```text
Local DB
Pause Capture
```

이 정도면 제품으로서 충분하다.

---

# 41. P1

P0 완성 후 추가.

```text
Browser Extension

Context Grouping

Natural Date Query

Archive

Excluded Apps

Delete Recent History

PDF Text Extraction
```

---

# 42. P2

대회 이후 발전.

```text
Semantic Search

MCP

Local REST API

Ollama

OpenAI / Claude Adapter

Plugin SDK

Context Auto Naming

Rule Engine

Cross-device Sync

Windows Support
```

---

# 43. 앨런컵 데모 시나리오

Digital Desk의 장점은 데모가 매우 쉽다는 것이다.

## Before

화면에:

```text
Desktop
Downloads
Chrome History
Finder
```

를 보여준다.

나레이션:

> 며칠 전에 Redis 연결 에러를 봤습니다.
> 캡처도 했고 문서도 읽었는데 어디에 있는지 기억이 안 납니다.

---

## Capture

실시간으로:

1. Redis 에러 화면 Screenshot
2. 에러 메시지 Copy
3. Redis docs URL Copy
4. PDF Download

한다.

Digital Desk는 아무 상호작용 없이 Timeline에 기록한다.

---

## Later

Digital Desk Quick Search 실행.

```text
지난주 redis 에러
```

입력.

결과:

```text
Screenshot
Clipboard
URL
PDF
```

가 한 번에 나온다.

---

## 메시지

마지막 화면:

> **You don't need to remember where you saved it.**

또는

> **Digital Desk remembers where your work went.**

이 한 장이면 충분하다.

---

# 44. 심사 기준과 연결

## 문제 이해 — 30

문제:

> 컴퓨터에서 일하면서 필요한 정보를 이미 저장하고 있지만 저장 위치가 서로 달라 다시 찾기 어렵다.

대상이 명확하다.

> PC로 여러 앱을 오가며 일하는 사람.

---

## 해결의 효용 — 50

기존:

```text
Screenshot folder
Downloads
Browser history
Clipboard manager
Finder
Notes
```

각각 검색.

Digital Desk:

```text
Cmd + Shift + Space
↓
Search
```

하나로 줄어든다.

---

## 사용 편의성 — 20

가장 강한 지점이다.

사용자가 새로운 저장 습관을 배울 필요가 없다.

```text
평소처럼 Copy
평소처럼 Screenshot
평소처럼 Download
```

Digital Desk가 자동으로 기억한다.

---

# 45. 공개투표를 위한 설명

기술 설명부터 하면 안 된다.

나쁜 설명:

> SQLite FTS와 OCR, MCP 기반 확장형 Local-first Knowledge Management Tool입니다.

좋은 설명:

> **분명 며칠 전에 봤는데 어디 있었는지 기억 안 난 적 있나요?**

> Digital Desk는 내가 복사하고, 캡처하고, 다운로드했던 것들을 자동으로 한 곳에 모아줍니다.

> 그냥 평소처럼 컴퓨터를 쓰세요.

> 나중에 검색하면 됩니다.

이후 기술을 설명한다.

---

# 46. 프로젝트 철학

Digital Desk를 개발하면서 모든 기능에 다음 질문을 적용한다.

### 1.

이 기능 때문에 사용자가 정보를 **정리해야 하는가?**

그렇다면 가능한 한 제거한다.

### 2.

이 기능 때문에 사용자가 **추가 행동**을 해야 하는가?

그렇다면 자동화할 방법을 찾는다.

### 3.

AI가 없어도 동작하는가?

아니라면 AI 의존성을 다시 검토한다.

### 4.

사용자 데이터를 불필요하게 많이 수집하는가?

그렇다면 Capture 범위를 줄인다.

### 5.

검색 결과까지 몇 번의 행동이 필요한가?

가능하면:

```text
Shortcut
→ Type
→ Enter
```

안에서 끝낸다.

---

# 47. 제품의 가장 중요한 5가지 원칙

**1. Capture without organizing**

정리를 요구하지 않는다.

**2. Artifacts, not surveillance**

사용자의 모든 화면이 아니라 사용자가 만들어낸 흔적을 기억한다.

**3. Search before structure**

폴더보다 검색이 먼저다.

**4. Local by default**

개인 작업 기록은 기본적으로 로컬에 존재한다.

**5. AI is an extension, not a dependency**

AI는 Digital Desk를 더 강하게 만들 수 있지만 Digital Desk 자체가 AI 제품일 필요는 없다.

---

# 48. 최종적으로 Digital Desk가 되고 싶은 것

Digital Desk의 장기적인 모습은

```text
파일 관리 프로그램
```

도 아니고,

```text
AI Agent
```

도 아니다.

컴퓨터 위에서 존재하는 하나의 **Personal Context Layer**에 가깝다.

```text
              User

               ↓

         Digital Desk

     ┌─────────┼─────────┐
     ↓         ↓         ↓

 Clipboard  Screenshot  Files
 Browser    Downloads   Notes

               ↓

        Context / Search

               ↓

     ┌─────────┼─────────┐
     ↓         ↓         ↓

   Human     Claude     Codex
             Ollama    Plugins
```

Digital Desk는 정보를 해석하는 AI가 아니라

**AI와 인간 모두가 사용할 수 있는 개인 작업 기억의 기반**이 된다.

그러나 첫 번째 버전에서는 거기까지 만들지 않는다.

첫 번째 버전이 증명해야 할 것은 단 하나다.

> **“분명 봤는데 어디 있었지?”라는 순간을 실제로 줄여줄 수 있는가.**

그것이 Digital Desk의 MVP이고, ALEN CUP에서 보여줘야 할 핵심이다.
