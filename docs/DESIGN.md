# Digital Desk — 디자인 사양

목업(`design/mockups/`)은 **어떻게 보이는지**, 이 문서는 **어떻게 동작하는지**를 정의한다. 둘이 충돌하면 이 문서가 우선이다.
토큰 값은 `design/tokens.css`에만 있다. 여기서 색 hex를 다시 적지 않는다.

---

## 1. 시각 원칙

- **조용한 유틸리티.** Spotlight·Finder·Raycast 계열. 대시보드, 통계, 차트, 진행률, 큰 사이드바를 쓰지 않는다.
- **색은 하나.** 앰버 액센트는 ① 검색 매칭 하이라이트 ② 캡처 상태 점 ③ 주 버튼 ④ 인식된 날짜 표현에만 쓴다.
- **타입 구분은 아이콘으로만.** Item 타입별 색을 두지 않는다. 스크린샷·이미지는 아이콘 대신 썸네일을 보여준다.
- **알림 없음.** 캡처될 때 토스트, 배지, 소리를 쓰지 않는다. 캡처 상태는 메뉴바 아이콘과 푸터의 "● Capturing"으로만 드러낸다.
- **리스트 우선.** 카드 그리드는 Desk(적은 수의 Pin 묶음)에서만 쓴다. Inbox와 검색 결과는 항상 리스트다.
- **이모지 금지.** 아이콘은 `design/icons/`의 SVG만 쓴다.

## 2. 표면(surface)

| 표면 | 테마 | 사용처 |
|---|---|---|
| `panel` | 항상 다크, vibrancy | Quick Search |
| `window` | 라이트(디자인됨). 시스템 다크 모드는 토큰만 정의되어 있음(목업 없음, 잠정) | 메인 창, 설정, 온보딩 |

각 renderer의 `<html>`에 `data-surface="panel"` 또는 `data-surface="window"`를 지정하고, 컴포넌트는 의미 토큰(`--text`, `--fill`, `--accent`…)만 참조한다.

## 3. 타이포그래피

- UI: 시스템 폰트(SF Pro, 한글은 Apple SD Gothic Neo 폴백).
- 모노(JetBrains Mono → SF Mono 폴백): 복사한 코드·텍스트가 행 제목일 때, OCR 텍스트, 파일 경로, 필터 문법 예시.
  - JetBrains Mono는 **번들**한다(`@fontsource/jetbrains-mono` 등). Google Fonts를 런타임에 불러오지 않는다(local-first 원칙).
- 크기 체계는 `tokens.css`의 `--fs-*` 값. 시간과 숫자는 `font-variant-numeric: tabular-nums`로 표시한다.
- 행 제목은 한 줄로 쓰고 넘치면 말줄임(…) 처리한다. 두 줄로 줄바꿈하지 않는다.

**텍스트 아이템의 모노 판정**: 복사한 텍스트가 다음 중 하나에 해당하면 모노로 표시한다. 여러 줄이면서 들여쓰기가 있거나, `{ } ; = ( ) < > $` 중 두 개 이상을 포함하거나, 공백 없이 `.`이나 `_`로 이어진 식별자(예: `o.s.d.redis.…`)이거나, SQL 키워드로 시작하는 경우. 판정이 애매하면 UI 폰트로 표시한다.

## 4. 아이콘

`design/icons/`의 16×16 SVG를 쓴다. 32px 타일(`--icon-tile`, radius 7) 가운데에 놓고 색은 `--icon`이다.

| 파일 | 용도 |
|---|---|
| `type-text` `type-link` `type-image` `type-file` `type-screenshot` | Item 타입 |
| `context` | Context / 같은 세션 |
| `app-mark` / `app-mark-paused` | 메뉴바 트레이(템플릿 이미지로 변환), 온보딩 |
| `search` `calendar` `pin` `trash` `lock` `download` `chevron-down` `close` `pause` | UI |

- 메뉴바 아이콘은 macOS **템플릿 이미지**로 만든다(검정+알파, 파일명 `…Template.png`, 16px @1x와 32px @2x). SVG에서 빌드 스크립트로 생성한다.
- 스크린샷·이미지 행에는 아이콘 대신 **32×32 썸네일**(radius 6, 1px `--border`)을 쓴다.

## 5. 시간 표기

| 조건 | 행/결과 | Inspector |
|---|---|---|
| 오늘 | `14:03` | `Today, 14:03` |
| 어제 | `Yesterday 14:03`(검색 결과) / 날짜 그룹 안에서는 `14:03` | `Yesterday, 14:03` |
| 최근 7일 | `Thu 14:03` | `Thu, Sep 17, 14:03` |
| 그 이전, 올해 | `Sep 3` | `Sep 3, 14:03` |
| 작년 이전 | `2025-09-03` | `Sep 3, 2025, 14:03` |

- 타임라인의 날짜 그룹 헤더는 `TODAY  Sat, Sep 26` / `YESTERDAY  Fri, Sep 25` / `THU  Sep 24`이다. 캡스 라벨 뒤에 날짜를 보통 굵기로 붙인다.
- UI 문구는 영어로 쓴다(목업 기준). 사용자 입력과 검색은 한국어와 영어를 모두 지원한다. 문자열은 한 파일(`strings.ts`)에 모아서 나중에 i18n할 수 있게 둔다.

---

## 6. Quick Search (핵심)

목업: `Main.dc.html`(결과), `SearchStates.dc.html`(상태 4종)

### 6.1 창

- **미리 만들어 두고 숨겨 둔다.** 단축키를 누를 때 `BrowserWindow`를 새로 만들지 않는다. 목표는 단축키부터 표시까지 100ms 이하다.
- Electron 옵션(기준값):
  `frame:false, resizable:false, movable:false, show:false, alwaysOnTop:true, skipTaskbar:true, fullscreenable:false, type:'panel', vibrancy:'hud', visualEffectState:'active', roundedCorners:true, hasShadow:true, backgroundColor:'#00000000'` (`transparent`는 쓰지 않는다. vibrancy와 둥근 모서리는 네이티브에 맡긴다)
  `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })`
- **위치**: 커서가 있는 디스플레이의 가로 중앙, 창 상단이 화면 높이의 22% 지점에 오게 한다.
- **크기**: 결과가 있을 때 `860 × 588`. idle과 결과 없음 상태에서는 `760`폭에 내용 높이(최대 588)를 쓴다. 크기를 바꿀 때 상단 가장자리는 고정한다.
- **열기**: 전역 단축키 `⌘⇧Space`(설정에서 변경 가능). 메인 창의 `⌘K`와 메뉴바 "Quick Search"도 같은 패널을 연다. 앱 안에 두 번째 검색 UI를 만들지 않는다.
- **닫기**: 포커스를 잃으면(blur) 숨긴다. 단 Quick Look이 떠 있는 동안은 예외다. `Esc`는 입력이 있으면 지우고, 비어 있으면 숨긴다.
- **포커스**: `type:'panel'`은 앱을 활성화하지 않는 패널이다. 쓰던 앱(예: TextEdit)이 active인 채로 패널만 키 입력을 받으므로, 숨기면 포커스가 그 앱으로 바로 돌아간다. `app.hide()`는 쓰지 않는다(열려 있는 메인 창까지 숨겨지기 때문이다). M2에서 실제로 확인했다.
- **다시 열기**: 60초 안에 다시 열면 직전 쿼리와 선택을 복원하고 입력 전체를 선택 상태로 둔다(바로 새로 입력할 수 있게). 60초가 지났으면 idle 상태로 연다.
- **애니메이션**: 열 때만 `--dur-open` 동안 fade와 scale 0.98→1을 준다. `prefers-reduced-motion`이면 애니메이션 없이 연다.

### 6.2 영역

```
┌ input 64 ─────────────────────────────────────────────┐
├ filter bar 44 (쿼리가 있을 때만) ──────────────────────┤
├ list 392 ────────────┬ preview (나머지) ───────────────┤
├ footer 36 ────────────────────────────────────────────┤
```

### 6.3 입력창

- placeholder는 `Search your desk…`, 22px이다. 캐럿 색은 `--accent`이다.
- **입력할 때마다 파싱한다**(파서는 `src/shared`에 두고 renderer에서도 호출한다):
  - **날짜 표현**(예: `지난주`)은 입력창 안에서 `--accent-text` 색과 점선 밑줄로 표시하고, 필터 바 맨 앞에 날짜 칩(`Last week · Sep 14 – 20`)을 띄운다. 칩의 ×를 누르면 입력에서 해당 표현을 지운다.
  - **필터 접두어**(`type:` `app:` `domain:`)는 값을 입력하고 공백을 치면 입력창 왼쪽의 칩(`type Screenshot`)으로 바뀐다. 입력이 빈 상태에서 `⌫`를 누르면 마지막 칩이 입력 텍스트(`type:screenshot`)로 되돌아와 고칠 수 있다. 칩을 클릭하면 지워진다.
  - 입력창 글자는 투명하게 두고, 같은 글꼴의 미러 레이어를 아래에 깔아 날짜 단어만 색을 입힌다(input 요소는 일부만 스타일을 줄 수 없기 때문이다).
- **한글 IME**: 조합 중에는(`compositionstart`~`compositionend`, 또는 `e.nativeEvent.isComposing`) 다음을 하지 않는다.
  - Enter로 실행하기, 칩으로 바꾸기, 선택 이동
  - 검색 호출은 조합 중에도 해도 되지만, 조합이 끝난 값으로 **반드시 한 번 더** 검색한다.
  - **주의(실측)**: macOS의 Chromium은 조합 중 Enter를 한 번 누르면 `keydown(isComposing)` → `compositionend` → `keydown Enter(isComposing:false)` 순서로 **Enter를 두 번** 보낸다. 두 번째 Enter는 음절 확정용이므로, `compositionend` 뒤 100ms 안에 오는 Enter와 Esc는 무시한다. 결과적으로 조합 중 첫 Enter는 확정만 하고, 다음 Enter에서 실행된다.
  - Enter를 눌렀는데 마지막 응답이 지금 입력과 다르면(디바운스 대기 중), 한 번 더 검색한 뒤 그 결과로 실행한다.
- 검색은 입력이 멈춘 뒤 60ms 디바운스로 호출하고, 응답은 마지막 요청 것만 반영한다(순서가 뒤바뀐 응답은 버린다).
- 오른쪽 끝에 결과 수 `6 results`를 `--text-3`으로 표시한다.

### 6.4 필터 바

순서: `[날짜 칩]` | `All n` `Screenshot n` `Text n` `Link n` `File n` `Image n` … `Any app ▾`

- 타입 개수는 **날짜·텍스트 조건을 적용한 뒤 타입 필터를 적용하기 전**의 개수다. 개수가 0인 타입은 숨긴다.
- 타입 칩을 클릭하거나 `⌘1`~`⌘5`를 누르면 해당 타입만 보인다. 같은 칩을 다시 누르면 `All`로 돌아간다.
- `Any app ▾`는 결과에 등장한 앱 목록 드롭다운이다.

### 6.5 결과 목록

**그룹**(비어 있는 그룹은 헤더도 숨긴다):
1. **Top match**: 1위 결과 1개.
2. **Same session · Thu 14:03–14:16**: 매칭된 결과 중 Top match와 같은 세션에 속한 것들. 헤더 오른쪽에 `n more`를 표시한다.
   - 세션 판정: P1의 Context가 있으면 같은 Context를 쓴다. 그 전(M2 구현)에는 Top match의 `captured_at` 기준 ±20분 안에 있는 매칭 결과를 같은 세션으로 보고 **시간순**으로 보여준다.
3. **Other matches**: 나머지를 점수순으로 보여준다.

**행** (`--row-h-panel` 48):
`[아이콘 타일 또는 썸네일 32] gap 12 [제목 14/500 · 메타 12 --text-2] [시간 12 --text-3]`
- 메타: `타입 표기 · 앱`. 링크는 `domain · 앱`, 다운로드 파일은 `PDF · Downloads`처럼 확장자 대문자와 폴더명이다.
- 타입 표기는 `Screenshot`, `Copied`(clipboard text), `Copied image`, 링크는 도메인, 파일은 확장자다.
- 매칭 하이라이트는 `--match` 배경에 radius 3이다. 제목, 모노 텍스트, OCR 발췌에 적용한다.
- 선택된 행은 `--fill-strong` 배경이다. 왼쪽 보더나 액센트 바는 쓰지 않는다.
- 결과는 최대 50개이며 목록은 스크롤된다. 선택 행이 가려지면 `scrollIntoView({block:'nearest'})`로 보이게 한다.

**선택**: `↑` `↓`로 이동하고 끝에서 순환하지 않는다. 마우스 호버로는 선택이 바뀌지 않고, 클릭하면 선택된다. 더블클릭은 Enter와 같다.

### 6.6 미리보기 패널(선택 아이템)

| 타입 | 내용(위→아래) |
|---|---|
| screenshot / image | 이미지(높이 **168**, `object-fit: contain`, radius 10) → 제목 15/600 + `타입 · 앱 · 요일, 날짜, 시간` → **Text in image** 박스(OCR 발췌, **매칭된 첫 줄부터** 3줄, 모노. 그 앞 줄을 넣으면 OCR이 함께 읽은 눈금자나 툴바 숫자가 보여서 뺐다) → `Original` 경로 · `Session` |
| text | 전문(모노 또는 UI, 최대 높이까지 스크롤, `white-space: pre-wrap`) → `Copied · 앱 · 시각` · `Copied n×`(use_count>1일 때) |
| link | 도메인 파비콘 없음(네트워크 금지 원칙). 큰 제목 → URL 전체(모노, 줄바꿈 허용) → `domain · 앱 · 시각` |
| file | macOS 썸네일(`nativeImage.createThumbnailFromPath`, PDF 첫 페이지 포함) → 파일명 → `경로`, `크기`, `다운로드 출처(kMDItemWhereFroms의 도메인)` |

하단 버튼: 주 버튼(타입별 Enter 동작의 이름) · 보조 버튼 1~2개 · Pin 아이콘 버튼. 버튼 줄은 항상 하단에 고정하고, 내용이 길면 내용 쪽을 자른다.
*목업(Main.dc.html)의 수치(이미지 208, OCR 여러 줄)를 그대로 합치면 본문 높이 444px를 넘어서 버튼이 잘린다. 그래서 이미지 168, OCR 3줄로 줄였다.*
원본 파일이 사라진 경우 이미지 영역에 저장된 썸네일을 보여주고, `Original` 줄에 `Missing` 표시를 붙인다. `Open`과 `Reveal` 버튼은 비활성화한다.

### 6.7 키보드 (입력창에 포커스가 있는 상태 기준)

| 키 | 동작 |
|---|---|
| `↵` | 타입별 기본 동작(아래 표). 실행하면 패널을 숨긴다 |
| `⌘↵` | 파일/스크린샷/이미지는 Finder에서 보기, 링크는 URL 복사. 결과가 없으면 "Search all time" |
| `⌘Y` | Quick Look(`BrowserWindow.previewFile`). **Space를 쓰지 않는다**(입력창에서는 공백 문자이기 때문) |
| `⌘C` | 입력창에 선택된 텍스트가 **없을 때만** 아이템을 복사한다. 선택된 텍스트가 있으면 기본 복사. 패널은 닫지 않고 푸터에 `Copied`를 1.2초 표시한다 |
| `⌘P` | Pin 토글(푸터에 `Pinned to Desk` / `Unpinned` 표시) |
| `⌘1`~`⌘5` | 타입 필터 (Screenshot, Text, Link, File, Image) |
| `↑` `↓` | 선택 이동 |
| `⌫`(입력이 비었을 때) | 마지막 칩 해제 |
| `Esc` | 입력 지우기 → 한 번 더 누르면 숨김 |

타입별 `↵` 동작:

| 타입 | `↵` | 주 버튼 이름 |
|---|---|---|
| text | 클립보드에 복사하고 닫기 | Copy |
| link | 기본 브라우저로 열기 | Open |
| screenshot / image / file | 기본 앱으로 열기(`shell.openPath`) | Open |

클립보드 이미지 아이템을 복사할 때는 PNG 이미지로 클립보드에 넣는다. 앱이 직접 쓴 클립보드 변경은 캡처하지 않는다(8.1 참고).

Quick Search에는 삭제 단축키를 두지 않는다(입력창의 `⌘⌫`와 충돌). 삭제는 메인 창에서 한다.

### 6.8 상태

| 상태 | 표현 |
|---|---|
| **Idle**(입력 없음) | 760폭. `On your desk`(Pin한 Context/아이템 칩, 최대 3개) → `Recent`(최근 4개 행, 첫 행 선택) → 푸터에 `● Capturing`과 문법 힌트 `Try yesterday, type:link, app:Figma` |
| **결과** | `Main.dc.html` |
| **결과 없음** | 760폭. `Nothing from {기간} matches "{텍스트}".` 날짜 조건이 있으면 `Search all time ⌘↵` 버튼을 보여준다. 타입/앱 칩이 있으면 `Clear filters` 버튼을 보여준다. 둘 다 없으면 문장만 표시한다 |
| **일시정지** | 입력창 아래 44px 스트립(`--accent-tint` 0.10): `Capture paused · resumes at 14:52` + `Resume now`. "until resumed"이면 `Capture paused`만 표시한다. 검색은 평소처럼 된다 |
| **첫 실행 직후 빈 DB** | idle 자리에 `Nothing here yet. Copy something, take a screenshot, or download a file.` |

검색 중 로딩 표시는 하지 않는다(로컬 검색은 50ms 이하가 목표다). 새 결과가 올 때까지 이전 결과를 유지한다.

### 6.9 푸터

왼쪽은 캡처 상태(`●` `--accent` + `Capturing` / `❚❚ Paused`)이다. 오른쪽은 선택된 아이템 타입에 맞는 단축키 힌트 최대 5개이며, 키캡 스타일(`.kbd`)을 쓴다. 선택된 아이템이 없으면(결과 없음) 힌트를 표시하지 않는다. idle에서는 힌트 대신 문법 예시를 보여준다.

---

## 7. 메인 창

목업: `Library.dc.html`(Inbox), `Desk.dc.html`(Desk)

### 7.1 창과 툴바

- 기본 크기 `1280 × 800`, 최소 `900 × 560`이다. `titleBarStyle: 'hiddenInset'`으로 신호등 버튼을 툴바(높이 52)에 겹쳐 놓는다.
- 툴바: 신호등 → 세그먼트 컨트롤 `Inbox | Desk | Archive`(`⌘1`~`⌘3`) → (여백) → 캡처 상태 알약(클릭하면 메뉴바 메뉴와 같은 일시정지 메뉴) → 검색 필드처럼 생긴 버튼(`Search ⌘K`, 클릭하면 Quick Search가 열림)
- 사이드바는 두지 않는다.

### 7.2 Inbox

- 시간 역순 리스트이며 날짜 그룹 헤더가 있다. 행 높이는 52, 구성은 `[시간 40] [아이콘/썸네일 32] [제목 13.5/500 · 메타 12]`이다. 시간을 맨 앞에 두는 것이 PRODUCT §21의 요구다.
- Pin된 아이템은 행 오른쪽 끝에 채워진 핀 아이콘(`--accent`)을 표시한다.
- **Context 카드**(P1): 같은 Context의 아이템은 흰 카드(border, radius 10) 안에 묶는다. 헤더 구성은 `⌄ [context 아이콘] Context · Sep 26 · 14:03`(또는 사용자가 붙인 이름) `5 items · IntelliJ IDEA, Chrome` … `Name…` `Pin to Desk`이다. 접으면 헤더만 남는다. P1 전에는 카드 없이 평평한 리스트로 둔다.
- 선택된 행은 `--selected` 배경이다. `↑↓`로 이동하고, `↵`는 6.7의 기본 동작, `Space`는 Quick Look이다(여기는 리스트 포커스이므로 Space를 쓸 수 있다). `⌘⌫`는 삭제(확인 없이 삭제하고 5초 동안 Undo 가능), `⌘P`는 Pin, `⌘E`는 Archive이다.
- 무한 스크롤로 100개씩 불러온다.
- 비어 있을 때: 가운데에 `Nothing here yet.`와 함께 `Copy something, take a screenshot, or download a file.`을 표시한다.

### 7.3 Inspector (오른쪽 360)

위에서 아래로: 미리보기(높이 180) → 제목 15/600 + `타입 · 날짜` → 메타 그리드(`Source`, `Original`, `Size`, `Context`. 값이 없는 줄은 생략) → OCR/본문 섹션 → (여백) → `[Open(주)] [Copy] [Pin] [🗑]`
메타데이터는 이 정도만 보여준다(PRODUCT §23 "필요할 때만"). 해시, ID 같은 내부 값은 보여주지 않는다.

### 7.4 Desk

- 위쪽은 **Pin한 Context 더미**다. 3열 그리드(gap 20)이며, 카드 하단에 두 겹의 그림자 선을 넣어 종이가 쌓인 것처럼 보이게 한다.
  - 카드 구성: 이름 15/600, `개수 · 날짜 범위`, 아이템 최대 4개(행 40), `+n more`
  - 이름이 없는 Context는 점선 테두리로 표시하고, `Name this context`(주) · `Unpin` 버튼을 둔다.
- 아래쪽은 **Pinned items**다. 개별로 Pin한 아이템을 3열 칩 행(높이 48)으로 보여준다.
- P1(Context)이 구현되기 전에는 Pinned items만 보인다.
- 비어 있을 때: `Pin things you're working on to keep them here. ⌘P`

### 7.5 Archive (목업 없음)

- Inbox와 같은 행 컴포넌트를 쓰고, **월 단위** 그룹으로 묶는다. Context 카드는 쓰지 않는다.
- 행 호버 시 `Unarchive` 버튼을 보여준다.
- Archive된 아이템도 Quick Search 결과에 포함된다(PRODUCT §18).

---

## 8. 캡처가 사용자에게 보이는 방식

### 8.1 조용함

- 캡처할 때 UI 피드백이 없다. 메인 창이 열려 있으면 새 행이 맨 위에 **애니메이션 없이** 추가된다. 스크롤 위치가 맨 위가 아니면 위치를 유지한다.
- 앱이 Copy 액션으로 직접 클립보드에 쓴 내용은 다시 캡처하지 않는다.

### 8.2 메뉴바 (`MenuBar.dc.html`)

- 헬퍼가 중단되어 클립보드 수집을 보장할 수 없으면 메뉴 헤더·메인 창 상태·Quick Search 푸터에 `Clipboard unavailable`을 표시한다. 메뉴에는 계속 동작하는 파일 수집 소스와 앱 재시작 안내를 함께 표시한다. 사용자 Pause와 온보딩 상태가 이 안내보다 우선한다. 변경 이유: 개인정보 보호를 위해 헬퍼 없는 폴백 수집을 제거했으므로 실제 상태를 알린다.

- 트레이 아이콘: 캡처 중일 때 `app-mark`, 일시정지일 때 `app-mark-paused`(점선)이다. 템플릿 이미지를 쓴다.
- 메뉴(캡처 중): 상태 헤더(`● Capturing` + `Clipboard · Screenshots · Downloads`에서 켜진 소스만) → `Quick Search ⌘⇧Space` · `Open Digital Desk` → `Pause for 5 minutes` · `Pause for 30 minutes` · `Pause until resumed ⌥⌘P` → `Delete last 5 minutes…` · `Delete last hour…` → `Settings… ⌘,` · `Quit Digital Desk ⌘Q`
- 메뉴(일시정지): 상태 헤더(`❚❚ Paused` + `Nothing is being captured until 14:52`) → `Resume capturing ⌥⌘P` · `Extend pause by 30 minutes` → `Quick Search` · `Open Digital Desk` → `Settings…`
- `⌥⌘P`는 전역 단축키로도 등록한다(일시정지 토글).
- `Delete last …`는 확인 대화상자를 띄운다: `Delete 7 items captured in the last 5 minutes? Files on disk are not touched.` → `Delete` / `Cancel`

### 8.3 Dock

평소에는 Dock 아이콘을 숨기고(`app.dock.hide()`) 메뉴바 앱으로 동작한다. 메인 창, 설정 창, 온보딩 창이 열려 있는 동안에만 Dock에 표시한다.
- 실측(macOS 27): 앱이 활성 상태이면 `dock.hide()`를 불러도 아이콘이 남는다. 그래서 마지막 창이 닫히면 `app.hide()`로 포커스를 이전 앱에 넘긴다. Quick Search 패널이 떠 있을 때는 넘기지 않는다.

---

## 9. 설정 (`Settings.dc.html`)

창 크기 760 × 자동 높이. 툴바에 아이콘 탭 5개가 있다. 목업에는 Capture 탭만 있고, 나머지 탭은 같은 그룹 박스 패턴으로 만든다.

| 탭 | 내용 |
|---|---|
| General | Launch at login · Quick Search 단축키 표시(변경은 Shortcuts 탭) · Appearance(System/Light/Dark, 메인 창만 해당) |
| **Capture** | Sources(Clipboard / Screenshots 폴더 + Change… / Downloads 폴더 + Change… / Read text in screenshots) · Never capture from(앱 목록 + −) · Keep unpinned items(7/30/90 days/Forever) |
| Privacy | Fetch link titles(토글, 기본 ON, 설명: "Loads the page title for copied public links. Local and private addresses are never fetched.") · Last 5 minutes… / Last hour… / Everything…(모두 네이티브 확인 창을 거친다) · 데이터가 이 Mac에만 있다는 안내 |
| Storage | 데이터 위치(`~/Library/Application Support/Digital Desk`, Reveal in Finder) · 항목 수 · DB/에셋 사용량. "Clear thumbnails cache"는 넣지 않았다(원본이 지워진 스크린샷은 썸네일이 유일한 이미지이기 때문) |
| Shortcuts | Quick Search · Pause/Resume. 녹화 방식의 단축키 입력 필드 |

- 토글은 34×20 스위치(`--accent`)이며, 접근성을 위해 `role="switch"`와 `aria-checked`를 단다.
- 설정은 저장 버튼 없이 즉시 적용한다.

## 10. 온보딩 (`Onboarding.dc.html`)

- 처음 실행할 때만 띄운다. 480 × 460 창이고 신호등은 닫기만 활성화한다. 하단에 점 4개 페이지 표시와 오른쪽 주 버튼이 있다.
1. `Digital Desk remembers the things you touch.` → Continue
2. Clipboard 설명과 로컬 보관 안내(자물쇠 박스), `Password managers and Keychain are never captured.` → Continue
3. 폴더 확인. 스크린샷 위치는 `defaults read com.apple.screencapture location`으로 감지하고, 없으면 `~/Desktop`을 쓴다. Downloads는 `~/Downloads`다. **이 단계에서 폴더에 실제로 접근해서** macOS의 Files & Folders 권한 요청이 온보딩 흐름 안에서 뜨게 한다. 권한이 거부되면 해당 행에 `Access denied — Open System Settings` 링크를 표시한다.
4. `You're ready.` + `⌘⇧Space` 키캡 → `Start using Digital Desk`(액센트 버튼). 누르면 창을 닫고 캡처를 시작한다.
- 온보딩을 마치기 전에는 캡처하지 않는다.

## 11. 접근성

- 검색 결과는 `role="listbox"`/`role="option"`과 `aria-selected`를 쓴다. 입력창은 `aria-activedescendant`로 선택된 행을 가리킨다.
- 포커스 링은 `--focus-ring` 2px, offset 2이며, 키보드 포커스(`:focus-visible`)일 때만 표시한다.
- 텍스트 대비는 토큰 기준 4.5:1 이상이다(`--text-3`은 보조 정보에만 쓴다).
- 아이콘만 있는 버튼에는 `aria-label`을 단다.
- `prefers-reduced-motion`을 존중한다.

## 12. 목업과 원본 기획의 차이(의도된 결정)

| 항목 | 결정 | 이유 |
|---|---|---|
| Quick Look 키 | `⌘Y`(Quick Search), `Space`(메인 창 리스트) | 입력창에서 Space는 공백 문자 |
| PRODUCT §10 예시 날짜 Sep 21 | 목업은 Sep 17 | "지난주"(Sep 14–20) 범위와 맞춤 |
| "Include Archive" 버튼 | 제거 | 검색은 항상 Archive를 포함함(§18) |
| 메인 창 하단 탭(PRODUCT §21) | 툴바 세그먼트 컨트롤 | macOS 관례, 세로 공간 절약 |
| 링크 파비콘 | 표시하지 않음 | 외부 요청 최소화 |
| Google Fonts | 번들 | local-first |
