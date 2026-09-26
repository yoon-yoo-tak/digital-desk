# Roadmap

P0 = ALEN CUP 데모에 반드시 필요(PRODUCT §40). P1 = P0 이후(§41). P2 = 대회 이후(§42).
마일스톤을 마치면 체크하고, `CLAUDE.md`의 "현재 상태"와 "명령어"를 갱신한다.

각 마일스톤 끝에 `/goal`에 붙여 넣을 프롬프트가 있다.

---

## M0 — 레포 준비 ✅

- [x] 디자인 목업, 토큰, 아이콘 (`design/`)
- [x] 기획(`docs/PRODUCT.md`), 디자인 사양(`docs/DESIGN.md`), 기술 설계(`docs/ARCHITECTURE.md`)
- [x] `CLAUDE.md`

---

## M1 — 뼈대, 저장소, 클립보드 캡처, Inbox  `P0` ✅

범위
- [x] electron-vite + React + TS(strict) 스캐폴드. renderer 엔트리는 main-window 1개(나머지는 이후 마일스톤에서 추가)
- [x] 스크립트: `dev` `build` `typecheck` `lint` `test` `build:helper`. `postinstall`에서 네이티브 모듈 재빌드
- [x] `design/tokens.css` import, JetBrains Mono 번들, `design/icons` 기반 `<Icon>` 컴포넌트
- [x] `desk-helper` Swift: build.sh, JSON-lines, `pasteboard` 이벤트 스트림, `frontmost`
- [x] 헬퍼 프로세스 관리(재시작, 없을 때의 폴백 모드)
- [x] SQLite: 마이그레이션 러너, migration 001, itemsRepo(FTS 동기화 포함), assets
- [x] ClipboardWatcher: text / link / image / file-ref, 중복 처리, concealed와 제외 앱 차단, selfWrites 무시
- [x] 메인 창: 툴바, Inbox 타임라인(날짜 그룹, 행 52), Inspector(text/link/image/file)
  - Desk/Archive 탭은 같은 리스트로 Pin/Archive된 항목만 보여준다(Desk 카드 레이아웃은 M4)
  - Inspector의 삭제는 Undo 없이 바로 지운다(Desk 기록과 앱 에셋만. Undo는 M4)
- [x] 메뉴바 트레이: 상태, Open, Pause 5/30/until resumed, Resume, Quit. `pausedUntil` 영속화
- [x] 트레이 템플릿 PNG 생성 스크립트(`design/icons/app-mark*.svg`에서)

완료 기준
- `npm run typecheck && npm test` 통과
- `npm run dev` 상태에서 다른 앱(예: 메모, 터미널)의 텍스트를 복사하면 **1초 안에** Inbox 맨 위에 나타나고, 메타에 해당 앱 이름이 표시된다
- `https://redis.io/docs/` 를 복사하면 `link` 아이템이 되고 `redis.io`가 표시된다
- 같은 텍스트를 두 번 복사하면 아이템은 1개이고 `copied 2×`로 표시된다
- Pause 5분 동안 복사한 것은 기록되지 않고, 재개 후에는 다시 기록된다. 앱을 재시작해도 일시정지 상태가 유지된다
- 클립보드 읽기 권한 프롬프트가 뜨는지 확인한 결과를 `docs/ARCHITECTURE.md` §9에 기록한다

검증 결과 (2026-09-26, macOS 27.0, 개발 빌드. 별도 데이터 폴더 `DESK_USER_DATA` 사용)
- typecheck·lint 통과. 단위·통합 테스트 85개 통과(15회 반복해도 모두 통과)
- TextEdit를 앞에 두고 텍스트 복사 → DB 기록까지 0.03–0.18초, 화면 표시까지 0.42초(osascript 실행 시간 포함). 메타에 `텍스트 편집기` 표시
- `https://redis.io/docs/` → `link`, 도메인 `redis.io`, 제목 `Docs`(링크 제목 가져오기)
- 같은 텍스트 두 번 → 아이템 1개, `copied 2×`
- ConcealedType 마커가 붙은 복사 → 기록 안 됨
- **트레이 메뉴**에서 Pause for 5 minutes 클릭(AppleScript UI 스크립팅) → 복사 무시 → Resume capturing 클릭 → 다시 기록. 앱을 재시작해도 `pausedUntil` 유지
- 툴바 상태 버튼 팝업 메뉴 → Pause for 30 minutes 동작
- Finder식 파일 복사 → `file` 아이템과 썸네일, PNG 이미지 복사 → `image` 아이템(원본과 썸네일), Inspector Copy 버튼 → 다시 캡처되지 않음(self-write)
- 클립보드 권한 프롬프트: 뜨지 않음(개발 빌드, 서명 없는 패키지 .app 모두) → ARCHITECTURE §9
- `npm run build:mac` 패키지 앱 스모크 테스트: 헬퍼 실행, DB 생성, 복사 캡처 확인

```
/goal docs/ROADMAP.md의 M1을 완료해줘. CLAUDE.md와 docs/ARCHITECTURE.md의 스택·구조·스키마를 따르고, 화면은 docs/DESIGN.md §7과 design/mockups/Library.dc.html, 트레이는 §8.2와 MenuBar.dc.html을 따라. 완료 기준을 전부 직접 확인하고, 끝나면 ROADMAP 체크박스와 CLAUDE.md의 "현재 상태"·"명령어"를 갱신해.
```

---

## M2 — Quick Search  `P0` ✅

범위
- [x] Quick Search 창(미리 생성, 전역 단축키 `⌘⇧Space`, 위치·크기·blur 시 숨김·포커스 복귀). DESIGN §6.1
- [x] `src/shared/query`: parseQuery(날짜 표현 ko/en, `type:` `app:` `domain:`), 동의어 사전, 단위 테스트
- [x] searchService: trigram MATCH + 짧은 단어는 LIKE, 점수, 그룹(top/session/other), 하이라이트, 타입별 개수
- [x] UI: 입력(날짜 토큰 하이라이트, 필터 칩, IME 안전 처리), 필터 바, 결과 목록, 미리보기(text/link/image), 푸터
- [x] 상태: idle(On your desk + Recent), 결과 없음(Search all time / Clear filters), 일시정지 스트립, 빈 DB
- [x] 키보드: ↵(타입별 동작), ⌘↵, ⌘Y, ⌘C(선택 텍스트가 없을 때), ⌘P, ⌘1–5, ↑↓, ⌫, Esc
- [x] 메인 창 `⌘K`와 트레이 메뉴에서 패널 열기
- [x] **`npm run seed`**: 현재 시각 기준으로 날짜를 계산한 데모 데이터 생성. 지난주 목요일 14:03~14:16의 Redis 시나리오 5개(screenshot / text / link / pdf / text) + 여러 날에 흩어진 일반 아이템 40개 이상. 샘플 이미지는 `resources/demo/`. `--count 10000` 옵션(벤치용)

완료 기준
- 쿼리 파서 테스트: now=2026-09-26(토)일 때 `지난주` = 09-14~09-21, 표의 모든 표현 통과
- 통합 테스트: 시드 DB에서 `지난주 redis 에러`를 검색하면 screenshot·text·link·pdf가 모두 결과에 나오고, top match는 screenshot이다
- 벤치 테스트: 10k 시드에서 검색 p95 50ms 이하
- 수동: 어떤 앱을 쓰는 중에도 `⌘⇧Space`로 패널이 뜨고, 한글 입력 중에 Enter를 눌러도 오작동하지 않으며, Esc로 원래 앱에 포커스가 돌아간다

검증 결과 (2026-09-26, macOS 27.0, 개발 빌드, `npm run seed`로 만든 별도 데이터 폴더)
- typecheck·lint 통과. 테스트 156개 통과. 쿼리 파서 테이블 테스트: now=2026-09-26(토)일 때 `지난주` = 09-14~09-21을 포함해 표의 표현 전부 통과
- 통합 테스트(`searchService.test.ts`): 시드 DB에서 `지난주 redis 에러`를 검색하면 screenshot·text·link·pdf가 모두 나오고, top match는 `RedisConnectionFailureException` 스크린샷이다. 세션 그룹은 `Same session · Sep 17 14:03–14:16`이다
- 벤치(`search.bench.test.ts`): 10,049개에서 p50 약 8ms, p95 약 29ms(3회 반복 28–31ms)
- 수동 확인
  - TextEdit를 쓰는 중에 ⌘⇧Space를 누르면 패널이 뜬다. TextEdit는 active로 남고 입력은 패널이 받는다
  - Esc를 한 번 누르면 입력이 지워지고, 한 번 더 누르면 패널이 닫힌다. 그 뒤 입력한 글자는 TextEdit 문서에 들어갔다(포커스 복귀 확인)
  - 실제 한국어 2벌식 IME로 `회의록`을 입력하고 `록` 조합 중에 Enter를 눌렀다 → 확정만 되고 실행되지 않았다. 다음 Enter에서 맨 위 결과가 복사되고 패널이 닫혔다
  - 메인 창 ⌘K, 트레이 "Quick Search" 메뉴, ⌘P, ⌘C(패널 유지), ⌘Y(Quick Look이 열린 동안 패널 유지), ⌘1–5, 칩 변환과 ⌫, 날짜 칩 ×, 결과 없음 → ⌘↵ 전체 기간, 일시정지 스트립, idle 화면 확인
- 확인 못 한 것: 네이티브 vibrancy(블러)와 둥근 모서리의 실제 모습. 앱 화면은 CDP로만 캡처해서 네이티브 배경이 찍히지 않는다. 화면 기록 권한 프롬프트 때문에 `screencapture`는 쓰지 않았다. 직접 한 번 확인할 것

```
/goal docs/ROADMAP.md의 M2를 완료해줘. docs/DESIGN.md §6 전체와 design/mockups/Main.dc.html·SearchStates.dc.html이 화면 기준이고, 검색 알고리즘은 docs/ARCHITECTURE.md §7을 따라. 시드 스크립트부터 만들어서 데모 쿼리 "지난주 redis 에러"를 통합 테스트로 고정해. 완료 기준을 전부 확인하고 ROADMAP·CLAUDE.md를 갱신해.
```

---

## M3 — 스크린샷, 다운로드, OCR  `P0` ✅

범위
- [x] 헬퍼: `ocr`(Vision ko+en), `mdmeta`(isScreenCapture, whereFroms), `screenshotLocation`
- [x] ScreenshotWatcher(스크린샷 판정, 스크린샷이 아닌 파일 무시), DownloadWatcher(임시 확장자 무시, WhereFroms → url/domain)
- [x] 썸네일(`nativeImage.createThumbnailFromPath`) + `desk-asset://` 프로토콜
- [x] OCR 큐(동시 1개), 제목 추출(ARCHITECTURE §6.5), FTS 갱신, 완료 시 `items-changed`
- [x] 미리보기와 Inspector: screenshot(이미지 + Text in image), file(썸네일, 경로, 크기, 출처)
- [x] 원본 누락 처리(Missing 표시, Open/Reveal 비활성)

완료 기준
- `⌘⇧4`로 에러 화면을 캡처하면 3초 안에 아이템이 생기고, 10초 안에 OCR 텍스트로 검색된다
- 한국어가 있는 화면을 캡처하면 한국어 단어로 검색된다
- Chrome으로 PDF를 받으면 `file` 아이템이 되고 `domain:`으로 검색되며, `.crdownload`는 한 번도 나타나지 않는다
- Desktop에 스크린샷이 아닌 파일을 두면 기록되지 않는다
- 원본 스크린샷을 지워도 썸네일과 OCR 텍스트는 남는다

추가로 한 것
- [x] 데스크탑에 브라우저가 저장한 파일(`kMDItemWhereFroms` 있음)도 다운로드로 기록한다. 저장 위치를 묻는 설정의 Chrome이 데스크탑을 기본으로 제안하기 때문이다(실측)
- [x] 앱을 재시작하면 OCR 대기(`pending`) 아이템을 다시 처리한다. 헬퍼 시작 시 OCR을 예열한다

검증 결과 (2026-09-26, macOS 27.0, 개발 빌드, 별도 데이터 폴더)
- typecheck·lint 통과. 테스트 187개 통과(파일 규칙, OCR 제목 추출, FileCapture와 OCR 큐 파이프라인 포함)
- **실제 ⌘⇧4 영역 캡처**: TextEdit에 영문 에러와 한국어 문장을 띄워 두고 찍었다
  - 파일이 생긴 뒤 **0.65초** 만에 `screenshot` 아이템이 생겼고, **0.98초** 만에 OCR이 끝나 제목이 `RedisConnectionFailureException`이 됐다
  - `결제 모듈`, `고객 알림`, `연결 오류`(한↔영), `type:screenshot redis 에러`로 모두 검색됐다. 한국어 macOS 파일명(`스크린샷 … 오후 7.55.32.png`)도 인식한다
- **실제 Chrome 다운로드**: 로컬 서버가 PDF를 첨부 파일로 천천히 보내게 했다
  - Downloads에 `file` 아이템이 생기고 `url`과 `domain`(localhost)이 붙었으며 PDF 썸네일이 만들어졌다. `domain:localhost`로 검색된다
  - 임시 파일(Chrome의 숨김 `.com.google.Chrome.*`, 파일시스템으로 재현한 `.crdownload` → 이름 변경)은 아이템이 되지 않았다(0개)
  - 데스크탑에 저장한 Chrome 다운로드도 `file`로 기록됐다
- Desktop에 스크린샷이 아닌 이미지와 텍스트 파일을 두면 기록되지 않는다(`not-captured`)
- 원본 스크린샷을 휴지통으로 옮겨도 썸네일, OCR 텍스트(214자), 검색이 유지되고 `Missing`이 표시되며 Open/Reveal이 비활성화된다(Quick Search 캡처로 확인)
- 참고: macOS 플로팅 썸네일 때문에 파일은 캡처하고 몇 초 뒤(약 5~8초)에 생긴다. 3초/10초 기준은 파일이 생긴 시점부터 쟀다

```
/goal docs/ROADMAP.md의 M3를 완료해줘. docs/ARCHITECTURE.md §5(헬퍼 프로토콜)·§6.2~6.5와 docs/DESIGN.md §6.6·§7.3을 따라. 완료 기준을 실제 스크린샷과 다운로드로 확인하고 ROADMAP·CLAUDE.md를 갱신해.
```

---

## M4 — Desk, 프라이버시, 설정, 온보딩, 데모 준비  `P0 마무리` ✅

범위
- [x] Pin/Unpin(Quick Search, Inspector, ⌘P), Desk 뷰(Pinned items), Archive 뷰와 Archive 액션
- [x] 삭제와 Undo(5초), Delete last 5분 / 1시간(확인 대화상자)
- [x] 보관 기간 작업
- [x] 설정 창: Capture 탭(목업), General / Privacy / Storage / Shortcuts(DESIGN §9), 제외 앱 추가·제거, 단축키 변경
- [x] 온보딩 4단계(첫 실행, 폴더 권한 요청을 온보딩 안에서, 끝나기 전에는 캡처 안 함)
- [x] Dock 정책, 로그인 시 실행, 단일 인스턴스
- [x] `npm run build:mac`으로 서명 없는 .app 생성, 데모 프로필(`--profile=demo`는 별도 userData를 쓰고 시드를 적용)

완료 기준
- 새 프로필로 실행하면 온보딩이 뜨고, 끝낸 뒤부터 캡처가 시작된다
- PRODUCT §40의 P0 체크리스트를 **패키징된 .app에서** 전부 확인한다
- `docs/DEMO.md`에 데모 리허설 절차(시드, 실시간 캡처 4단계, 검색)를 작성한다

구현 메모
- Desk는 "Pinned items" 3열 그리드다. Context 카드 묶음은 P1(M5)이다. Archive는 월별 그룹이고, 행에 마우스를 올리면 Unarchive가 보인다. ⌘E로 보관한다
- 삭제는 바로 지우고 5초 동안 되돌릴 수 있다(토스트, ⌘Z). 앱이 만든 에셋은 되돌리기 시간이 지난 뒤에 지운다. 최근 삭제는 5분 / 1시간 / 전체를 네이티브 확인 창을 거쳐 지운다
- 설정 탭 5개는 모두 즉시 적용된다. 폴더를 바꾸면 감시를 다시 시작하고, 단축키를 바꾸면 다시 등록하며, 실패하면 빨간 테두리로 알린다. 외관은 `nativeTheme`으로 바꾼다. Storage에는 경로, 크기, Reveal이 있다. "Clear thumbnails cache"는 뺐다(썸네일이 원본을 대신하는 경우가 있어서)
- 온보딩을 마치기 전에는 `shouldCapture`가 false다. 트레이도 "Not capturing yet · Finish setup…"을 보여 준다
- `npm run seed`와 데모 프로필은 `onboarded = true`로 둔다

검증 결과 (2026-09-26, macOS 27.0)
- typecheck·lint 통과. 테스트 196개 통과(삭제/되돌리기/보관 기간, 트레이 메뉴 모델, 단축키 형식 등 추가)
- 개발 빌드 확인
  - 새 프로필로 실행하면 온보딩만 뜨고 복사가 기록되지 않는다(`paused-or-excluded`). 트레이는 "Not capturing yet"이다. Start를 누르면 창이 닫히고 바로 기록된다
  - 설정 확인: Clipboard를 끄면 기록되지 않는다. 보관 기간 7일이 DB에 저장된다. 단축키를 바꾸면 다시 등록된다
  - 트레이 "Delete last 5 minutes…" → "Delete 1 item captured in the last 5 minutes?" → 삭제됐다
  - 메인 창: ⌘⌫ → "Deleted from Desk · Undo ⌘Z" → ⌘Z로 복원. ⌘E → Archive에 "September 2026" 그룹과 Unarchive. ⌘P → Desk에 표시
  - Dock: 창이 있으면 보이고, 마지막 창을 닫으면 사라지며 포커스는 이전 앱으로 간다
- **패키지 .app에서 PRODUCT §40 P0 전부 확인**(새 데이터 폴더, 셸에서 직접 실행)
  - Capture: 클립보드 텍스트, URL(제목 "Troubleshooting Redis", redis.io), 실제 ⌘⇧4 스크린샷(파일 생성 후 0.61초에 기록), Chrome 다운로드(저장 창 기본값인 데스크탑에 저장 → `file`, localhost)
  - Processing: 스크린샷 OCR(0.88초, 제목 `RedisConnectionException`, 한국어 포함), 기본 메타데이터(출처 앱, 도메인, 크기, 썸네일), 내용 해시(같은 텍스트 → 1개, 사용 2회)
  - Search: 키워드, OCR 한국어(`결제 서버`), 타입(`type:screenshot`), 날짜(`오늘 redis`, `지난주 redis 에러` → 9개, 1위 에러 스크린샷)
  - UI: 타임라인(55행), TextEdit 사용 중 ⌘⇧Space로 Quick Search, 미리보기(파일명 + Text in image), ⌘P Pin, ⌘⌫ 삭제와 ⌘Z 복원, Desk
  - Privacy: `<userData>/desk.db` 로컬 DB, 트레이 Pause 5분 → 복사 무시 → Resume
  - 온보딩, 데모 프로필 자동 시드, `quit app`과 SIGTERM 정상 종료(재빌드 후 다시 확인)
- 검증 중 찾아서 고친 버그
  - 종료 중 `updateDock`이 파괴된 창에 접근해 main 오류 대화상자가 떴고, 이 때문에 종료가 멈췄다
  - 활성 앱에서는 `dock.hide()`가 반영되지 않았다
  - 서명 없는 앱에서 로그인 항목을 매번 설정해 오류가 났다
- 확인하지 못한 것
  - "Launch at login" 켜기: 서명 없는 앱은 등록이 거부될 수 있다(`Operation not permitted`)
  - 온보딩에서 TCC 폴더 권한 프롬프트가 뜨는 흐름: 셸에서 실행하면 권한이 터미널에 귀속되어 프롬프트가 뜨지 않는다. `open`으로 처음 실행할 때 확인해야 한다
  - 제외 앱 추가 대화상자: 앱 정보를 읽는 `plutil` 방식만 확인했다

```
/goal docs/ROADMAP.md의 M4를 완료해줘. docs/DESIGN.md §7.4·§7.5·§8·§9·§10과 Desk/Settings/Onboarding/MenuBar 목업을 따라. 마지막에 패키징된 .app으로 PRODUCT.md §40 P0 목록을 하나씩 확인하고 docs/DEMO.md를 작성해.
```

---

## M5 — P1

- [ ] Context 그룹핑(PRODUCT §19 점수 방식), `contexts` 테이블, Inbox Context 카드, 이름 붙이기, Context를 Desk에 Pin(더미 카드)
- [ ] Quick Search "Same session" 그룹을 Context 기반으로 전환
- [ ] 자연어 날짜 확장(지난 화요일, N일 전, N월쯤)
- [ ] PDF 본문 추출(헬퍼 PDFKit `pdftext`)
- [ ] 브라우저 확장(Save page / selection to Desk). 로컬 전용 수신 방식은 별도 설계

## P2 (대회 이후)

Semantic Search(선택형 어댑터: Ollama / OpenAI / Claude), Local REST API, MCP 어댑터, Plugin SDK, Context 자동 이름, Rule Engine, 동기화, Windows
