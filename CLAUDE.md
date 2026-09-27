# Digital Desk

복사하고, 캡처하고, 다운로드한 것을 자동으로 모아두고 나중에 검색으로 다시 찾게 해주는 **macOS 전용** 로컬 앱이다. 목표는 ALEN CUP 출품 MVP다.
핵심 문장은 **Capture first. Organize never. Find later.**

## 문서 지도

| 문서 | 언제 읽나 |
|---|---|
| `docs/PRODUCT.md` | 제품 판단이 필요할 때(원본 기획, 범위의 최종 기준) |
| `docs/DESIGN.md` | UI를 만들 때. 동작, 상태, 키보드. **목업보다 우선** |
| `design/mockups/*.dc.html` | 픽셀 값(크기, 색, 간격). 화면별 목업 목록은 `design/README.md` |
| `design/tokens.css`, `design/icons/` | 색·타입·간격 토큰, 아이콘. 그대로 import해서 쓴다 |
| `docs/ARCHITECTURE.md` | 스택, 디렉터리, 스키마, 헬퍼 프로토콜, 캡처 파이프라인, 검색 알고리즘 |
| `docs/ROADMAP.md` | 마일스톤별 범위와 완료 기준 |

## 현재 상태

- **M1 완료**(2026-09-26): 클립보드 캡처(text/link/image/file), SQLite+FTS 저장, Inbox 타임라인과 Inspector, 메뉴바 트레이와 일시정지.
- **M2 완료**(2026-09-26): Quick Search 패널(⌘⇧Space, 메인 창 ⌘K, 트레이), 쿼리 파서(날짜 표현, `type:`/`app:`/`domain:`, 한↔영 동의어), 로컬 검색(trigram FTS + 짧은 단어 스캔, 결정적 점수, Top/Same session/Other 그룹), `npm run seed`. 데모 쿼리 `지난주 redis 에러`는 `src/main/search/searchService.test.ts`로 고정되어 있다. 검증 결과는 `docs/ROADMAP.md`의 각 마일스톤에 있다.
- **M3 완료**(2026-09-26): 스크린샷 폴더와 Downloads 감시(chokidar), 헬퍼 `ocr`(Vision ko+en)/`mdmeta`(xattr 우선)/`screenshotLocation`, OCR 큐와 제목 추출, 원본 삭제 시 Missing, 데스크탑에 저장된 브라우저 다운로드도 기록.
- **M4 완료**(2026-09-26): Desk/Archive, 삭제 되돌리기와 최근 삭제, 보관 기간, 설정 창(5탭), 온보딩(끝나기 전에는 캡처 안 함), Dock 정책, 전역 단축키 설정, 데모 프로필. 패키지 .app에서 PRODUCT §40 P0를 전부 확인했다. 시연 절차는 `docs/DEMO.md`에 있다.
- **P0 완료.** 다음은 M5(P1: Context 그룹핑, PDF 본문, 자연어 날짜 확장, 브라우저 확장)다.
- **신뢰성 보강(2026-09-27)**: 링크 제목은 DNS 주소를 소켓에 고정하고 리다이렉트를 재검증한다(공개 IPv4만). 헬퍼 장애·출처 미확인 시 클립보드를 읽지 않는다. 최근 삭제에 재복사·Undo 대기 항목을 포함하고, 필터 검색의 500개 후보 제한을 제거했다. 중복 캡처 시 FTS를 원자적으로 갱신하며 migration 002로 기존 인덱스를 복구한다. 검증 기록은 `docs/ROADMAP.md`의 신뢰성 보강 항목을 참조한다.
- 트레이 헤더에는 실제로 동작하는 소스만 표시한다(`IMPLEMENTED_SOURCES`, `src/main/captureMenu.ts`). 지금은 셋 다 동작한다.

## 명령어

| 명령 | 내용 |
|---|---|
| `npm run dev` | 헬퍼와 트레이 아이콘을 빌드한 뒤(`predev`) 개발 실행. 데이터는 `~/Library/Application Support/Digital Desk (Dev)` |
| `npm run build` | 헬퍼·아이콘·main/preload/renderer 번들(`out/`) |
| `npm run build:mac` | 배포용 universal `.dmg`(`release/Digital-Desk-<version>-universal.dmg`, ad-hoc 서명) |
| `npm run build:mac:dir` | 빠른 로컬 확인용 `.app`(`release/mac-arm64/`, Apple Silicon만) |
| 릴리스 | `npm version patch && git push --follow-tags` → GitHub Actions(`release.yml`)가 dmg를 빌드해 Release에 올린다. 노트는 `docs/releases/v<버전>.md`. CI(`ci.yml`)는 master push와 PR마다 typecheck·lint·test를 돈다 |
| `npm run make-icon` | `build/icon.png`(앱 아이콘) 다시 생성 |
| `npm run typecheck` / `npm run lint` / `npm test` | tsc(node+web) / eslint / vitest(단위+SQLite 통합) |
| `npm run build:helper` | `native/desk-helper` → `resources/bin/desk-helper`(소스가 바뀌었을 때만 다시 빌드, `FORCE=1`이면 강제) |
| `npm run build:tray-icons` | `design/icons/app-mark*.svg` → `resources/tray/*Template.png` |
| `npm run seed [-- --reset] [-- --count N]` | 현재 시각 기준 데모 데이터(지난주 목요일 Redis 시나리오 + 일반 아이템 40여 개 + 선택적으로 N개). `DESK_USER_DATA`가 없으면 개발 데이터 폴더에 넣는다. 패키지 앱에서는 `DESK_USER_DATA` 없이는 거부한다. `--reset`은 그 폴더의 아이템과 에셋을 비운다 |
| `npm run demo` | 데모 프로필(`--profile=demo`, 데이터는 `Digital Desk (Demo)`)로 실행한다. 비어 있으면 자동으로 시드한다. 패키지 앱: `open "release/mac-arm64/Digital Desk.app" --args --profile=demo` |
| `npm run demo-assets` | `resources/demo/`의 샘플 PNG와 PDF를 다시 생성한다(내용을 바꿀 때만) |

앱을 직접 확인할 때:
- 별도 데이터로 실행: `DESK_USER_DATA=<dir> npx electron-vite dev --remoteDebuggingPort 9222`
- 앱 화면 캡처와 조작: CDP(`http://127.0.0.1:9222/json/list` → `Page.captureScreenshot`, `Runtime.evaluate`로 `window.desk.*` 호출). **`screencapture`는 쓰지 않는다**(터미널에 화면 기록 권한 프롬프트가 뜬다).
- 캡처 동작은 main 로그의 `[capture] clipboard created|touched|skipped (…) from <앱>`으로 확인한다. 로그에 내용은 남기지 않는다.
- 트레이 메뉴는 AppleScript UI 스크립팅으로 누를 수 있다(`menu bar 2` of process "Electron").
- 테스트로 클립보드를 바꿨다면 끝난 뒤 원래 내용을 복원한다.
- Quick Search 조작: 패널 페이지(`quick-search`)에 CDP `Input.insertText`(입력)와 `Input.dispatchKeyEvent`(⌘키, Enter, Esc)를 보낸다. 패널 열기는 main-window 페이지에서 `window.desk.ui.openQuickSearch()`를 부른다. 이 방식은 사용자 화면의 다른 앱에 키가 가지 않는다.
- **전역 키 입력(System Events, CGEvent)은 꼭 필요할 때만** 쓴다(⌘⇧Space, 포커스 복귀, 실제 IME). 사용자가 같은 Mac을 쓰고 있을 수 있고, 패널은 blur되면 닫히며, 키가 다른 앱으로 들어간다. 실제 IME 테스트에는 key down/up을 보내는 CGEvent가 필요하다(System Events `key code`로는 한글 조합이 깨진다).
- 테스트용 `DESK_USER_DATA` 폴더에는 사용자가 실제로 복사한 내용이 섞여 들어갈 수 있다. 확인이 끝나면 지운다.
- 개발 실행도 **실제** `~/Desktop`(스크린샷 폴더)과 `~/Downloads`를 감시한다. 테스트 파일은 `desk-test-` 접두어로 만들고, 끝나면 Finder로 휴지통에 옮긴다(`rm` 대신, 되돌릴 수 있게).
- 실제 스크린샷 테스트: ⌘⇧4를 CGEvent로 보내고 마우스 드래그로 영역을 지정한다. `screencapture` CLI는 쓰지 않는다. 파일은 플로팅 썸네일 때문에 몇 초 뒤에 생긴다.
- 실제 다운로드 테스트: 로컬 서버가 `Content-Disposition: attachment`로 천천히 보내게 하고 Chrome으로 연다. 이 Mac의 Chrome은 저장 위치를 묻는다. 저장 대화상자의 위치는 "폴더로 이동"(⌘⇧G) 시트의 텍스트 필드에 AX로 값을 넣어 바꾼다(한국어 IME에서는 `~`가 제대로 입력되지 않는다). **Chrome은 마지막 저장 위치를 기억하므로, 테스트 뒤에는 원래 위치(데스크탑)로 되돌려 둔다.**
- 패키지 앱 검증: `npm run build:mac:dir` 후 `DESK_USER_DATA=<dir> "release/mac-arm64/Digital Desk.app/Contents/MacOS/Digital Desk" --remote-debugging-port=9222`로 셸에서 실행하면 CDP를 쓸 수 있다(TCC 권한은 터미널에 귀속된다). 종료는 `osascript -e 'quit app "Digital Desk"'`로 한다.
- main 프로세스에서 잡히지 않은 예외는 Electron 오류 **대화상자**가 되어 종료까지 막는다. 종료 중에는 창이 파괴되므로 `isDestroyed()`를 확인한다.
- OCR은 새로 빌드한 헬퍼의 첫 인식에 약 25초가 걸린다(예열로 가림). `npm run build:helper`로 다시 빌드한 직후 OCR이 느린 것은 정상이다.
- 의존성을 바꾼 뒤에는 `npx -y npm@latest install --package-lock-only`로 lock을 다시 만든다. 로컬 npm(11.6)은 optional 의존성 일부를 lock에서 빼먹고, CI 러너의 더 새로운 npm은 그런 lock으로 `npm ci`를 거부한다.

## 스택 (결정됨 — 바꾸려면 ARCHITECTURE.md와 같이 고칠 것)

Electron 44 + electron-vite 5(Vite 7) · React 19 · TypeScript 6(strict) · better-sqlite3 13 + FTS5(trigram) · chokidar · **Swift `desk-helper`**(앞 앱 감지, NSPasteboard 감시, Vision OCR, Spotlight 메타데이터) · vitest · npm.
Electron 44의 `clipboard`는 **비동기 W3C 방식**(`read()`/`ClipboardItem`)이다. `readImage`/`writeBuffer`는 없다(ARCHITECTURE §1).
UI 라이브러리와 Tailwind는 쓰지 않는다. CSS Modules와 `design/tokens.css`의 CSS 변수만 쓴다.

## 제품 원칙 (모든 기능에 적용, PRODUCT §46–47)

1. **정리를 요구하지 않는다.** 폴더, 태그, 저장 버튼을 만들지 않는다.
2. **흔적만, 감시는 안 한다.** 사용자가 복사·캡처·다운로드한 것만 기록한다. 화면 녹화, 브라우저 기록, 파일시스템 전체 인덱싱은 하지 않는다. Desktop 폴더에서도 **스크린샷만** 기록한다.
3. **검색이 구조보다 먼저다.** 목표 흐름은 `Shortcut → Type → Enter` 3단계다.
4. **로컬이 기본이다.** 서버, 계정, 텔레메트리를 두지 않는다. 런타임에 CDN을 쓰지 않는다(폰트와 OCR 모델도 번들이나 OS 기능을 쓴다). 네트워크 요청은 설정으로 끌 수 있는 링크 제목 가져오기 하나뿐이다.
5. **AI는 확장이지 의존성이 아니다.** P0/P1에는 LLM이나 임베딩이 없다. 자연어 날짜 해석과 한↔영 동의어는 규칙과 사전으로 처리한다.
6. **조용하다.** 캡처 알림, 토스트, 배지를 두지 않는다.

## 구현 규칙

- **사용자 원본 파일은 절대 수정·이동·삭제하지 않는다.** 아이템 삭제는 DB 행과 앱이 만든 assets만 지운다.
- 캡처는 `captureState.shouldCapture(app)`를 먼저 통과해야 한다. 일시정지 중이거나, 제외 앱이거나, 출처 앱(bundle id)을 확인할 수 없거나(헬퍼 중단 포함), `concealed` 클립보드면 **내용을 읽지도 않는다.** 헬퍼 없이 클립보드를 읽는 폴백은 만들지 않는다(ARCHITECTURE §5).
- 순수 로직(쿼리 파싱, 날짜, 동의어, 점수, 세션, 제목 추출, 해시, 시간 표기)은 `src/shared` 또는 main의 순수 모듈에 두고 **단위 테스트를 같이 쓴다.** 현재 시각은 인자로 주입받는다(`now`). `Date.now()`를 직접 부르지 않는다.
- 날짜 경계는 로컬 타임존이고, 주는 **월요일**에 시작한다. DB 시간은 epoch ms다.
- renderer는 Node와 파일 경로에 직접 접근하지 않는다. `window.desk`(preload)와 `desk-asset://` 프로토콜만 쓴다. `contextIsolation`과 `sandbox`는 항상 켠다.
- IPC 타입 계약은 `src/shared/ipc.ts` 한 곳에만 둔다.
- UI 색·간격·반경은 토큰 변수만 쓴다. hex를 하드코딩하지 않는다. 아이콘은 `design/icons`의 것만 쓰고 이모지는 쓰지 않는다.
- Quick Search 입력은 **한글 IME 조합 중**에 Enter 실행, 칩 변환, 선택 이동을 하지 않는다(DESIGN §6.3).
- Quick Search에서는 Space를 Quick Look에 쓰지 않는다. `⌘Y`를 쓴다.
- UI 문구는 영어이고 `strings.ts`에 모은다. 검색 입력은 한국어와 영어를 모두 지원한다.
- 범위 밖 기능(PRODUCT §39)은 요청이 없으면 만들지 않는다.

## 작업 방식

- 마일스톤 단위로 작업한다. 끝나면 `docs/ROADMAP.md`의 완료 기준을 **직접 실행해서 확인**하고, 체크박스와 이 파일의 "현재 상태"·"명령어"를 갱신한다.
- 설계와 다르게 구현해야 하면 해당 문서(DESIGN/ARCHITECTURE)를 같이 고치고, 왜 바꿨는지 한 줄 남긴다.
- macOS 권한(TCC)이나 클립보드 프롬프트처럼 실기기에서만 확인할 수 있는 것은 확인 결과를 `docs/ARCHITECTURE.md` §9에 기록한다.
