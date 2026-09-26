# Digital Desk — 기술 설계

제품 기준은 `docs/PRODUCT.md`, 화면·동작은 `docs/DESIGN.md`다. 이 문서는 **어떻게 만드는지**를 다룬다.
여기 적힌 결정은 이유와 함께 바꿀 수 있다. 바꿀 때는 이 문서도 같이 고친다.

---

## 1. 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 앱 | Electron 44 + **electron-vite 5**(Vite 7) | main / preload / renderer(다중 엔트리). electron-vite 5가 Vite 8을 지원하지 않아 Vite 7, `@vitejs/plugin-react` 5를 쓴다 |
| UI | React + TypeScript(strict) | UI 라이브러리 없음. CSS Modules와 `design/tokens.css`만 쓴다 |
| 상태 | React state + 필요 시 `zustand` | |
| DB | `better-sqlite3` 13 + FTS5(**trigram** 토크나이저) | 13부터 N-API 프리빌드라 Node(vitest)와 Electron에서 같은 바이너리가 로드된다. 번들 SQLite 3.53 |
| 파일 감시 | `chokidar` | |
| 네이티브 | **`desk-helper`** — Swift CLI, 상주 자식 프로세스 | 앞 앱 감지, 클립보드 변경 감지, OCR(Vision), Spotlight 메타데이터 |
| 테스트 | `vitest` | 순수 로직은 반드시 단위 테스트 |
| 타입 | TypeScript 6.0 | typescript-eslint가 TS 6.1 미만까지만 지원해서 7.x는 쓰지 않는다 |
| 패키징 | `electron-builder` (mac, 서명 없음 OK) | |
| 패키지 매니저 | npm | |

### 왜 Swift 헬퍼인가 (PRODUCT §34의 tesseract.js 대신)

- Electron만으로는 **어느 앱에서 복사했는지**(frontmost app)를 알 수 없다. `NSWorkspace.frontmostApplication`은 권한 없이 쓸 수 있다.
- `NSPasteboard.changeCount`로 변경을 감지하면 매번 내용을 읽어 비교하는 폴링보다 싸고 정확하다. 또 비밀번호 관리자가 붙이는 `org.nspasteboard.ConcealedType` 마커를 볼 수 있다.
- **Vision OCR**은 온디바이스이고, 한국어+영어 품질이 tesseract.js보다 확연히 좋다. 모델 다운로드도 필요 없다(tesseract.js는 기본 설정에서 CDN으로 언어 데이터를 받는데, 이는 local-first 위반이다).
- `kMDItemIsScreenCapture`와 `kMDItemWhereFroms`(다운로드 출처 URL)를 읽을 수 있다.
- OCR은 `OcrEngine` 인터페이스 뒤에 둔다. Vision에 문제가 생기면 tesseract.js(언어 데이터 번들)로 교체할 수 있다.

### Electron 44 clipboard API

Electron 44의 `clipboard`는 W3C 방식의 **비동기** API다: `readText()` / `read()`가 Promise를 반환하고 `ClipboardItem`을 쓴다. `readImage`, `writeImage`, `writeBuffer`, `availableFormats`는 없다.
- 이미지 읽기와 쓰기: `clipboard.read()`에서 `image/png` Blob을 꺼내 쓰고, 쓸 때는 `clipboard.write([new ClipboardItem({ 'image/png': blob })])`를 쓴다(`capture/electronClipboard.ts`).
- 파일 복사(Finder처럼 붙여넣기 가능하게): 헬퍼의 `writeFiles` 명령이 NSPasteboard에 NSURL로 쓴다.
- macOS 원시 타입은 `electron application/osclipboard;format="<UTI>"` 형식으로 조회한다.

---

## 2. 디렉터리 구조

```
native/desk-helper/        Swift 소스 + build.sh (→ resources/bin/desk-helper, git 제외)
scripts/                   build-tray-icons.mjs (design/icons → resources/tray/*Template.png, git 제외)
                           make-demo-assets.mjs (resources/demo/*.png·pdf 생성, 결과물은 커밋)
resources/                 bin/, tray/, demo/(시드용 샘플 이미지)
src/
  shared/                  main·renderer 공용 순수 코드
    types.ts               DeskItem, ItemType, SearchResponse …
    ipc.ts                 IPC 채널 이름과 타입 계약
    query/                 parseQuery, dateExpressions, synonyms  (+ *.test.ts)
    format/                시간 표기(DESIGN §5)                  (+ *.test.ts)
  main/
    index.ts               앱 부트스트랩, 단일 인스턴스, Dock 정책
    clock.ts               벽시계를 읽는 유일한 곳(Clock 주입)
    paths.ts               userData(DESK_USER_DATA, dev 분리), resources 경로
    captureMenu.ts         메뉴바·상태 버튼 공용 메뉴 모델(순수) + Electron 템플릿 변환
    actions/               itemActions.ts (open / copy / reveal / quickLook)
    windows/               quickSearch.ts, mainWindow.ts, settings.ts(M4), onboarding.ts(M4)
    tray.ts
    helper/                desk-helper 프로세스 관리 + JSON-lines 클라이언트
    capture/               classify.ts(순수), clipboardWatcher.ts, electronClipboard.ts(리더·폴백 폴러), captureState.ts(pause)
                           screenshotWatcher.ts, downloadWatcher.ts (M3)
    indexing/              ocrQueue.ts, titles.ts(제목 추출), linkTitles.ts, thumbnails.ts
    search/                searchService.ts, ranking.ts, sessions.ts  (+ *.test.ts, search.bench.test.ts)
    seed/                  demoData.ts(순수, 날짜는 now 기준), runSeed.ts(`npm run seed`, Electron 안에서 실행)
    storage/               db.ts, migrations.ts, ids.ts(monotonic ULID), itemsRepo.ts, settingsRepo.ts, assets.ts, retention.ts(M4)
    ipc/                   핸들러 등록
    protocol.ts            desk-asset:// 프로토콜
  preload/index.ts         contextBridge로 window.desk 노출
  renderer/
    shared/                tokens.css import, Icon, Row, Kbd, Button, 포맷터
    quick-search/          index.html, QuickSearch.tsx, model.ts(순수 규칙 + 테스트), SearchInput, FilterBar, Results, Preview, Parts
    main-window/           index.html + Inbox / Desk / Archive / Inspector
    settings/              index.html
    onboarding/            index.html
design/  docs/
```

---

## 3. 프로세스와 IPC

```
desk-helper (Swift) ⇄ stdin/stdout JSON lines ⇄ Electron main ─ IPC ─ preload(window.desk) ─ renderers
```

- 보안 설정: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, 엄격한 CSP(`default-src 'self'; img-src 'self' desk-asset: data:`)를 쓴다. 외부 URL 탐색은 차단하고 `shell.openExternal`로 넘긴다.
- renderer는 파일 경로에 직접 접근하지 않는다. 썸네일과 이미지는 `desk-asset://thumb/<id>.png`, `desk-asset://image/<id>.png`로 요청하고, 파일은 `protocol.handle`에서 앱 데이터 폴더 안의 것만 서빙한다(경로 탈출 방지).

### `window.desk` 계약 (src/shared/ipc.ts)

```ts
search(query: string, opts?: { allTime?: boolean }): Promise<SearchResponse>
listItems(view: 'inbox' | 'desk' | 'archive', cursor?: string): Promise<Page<DeskItem>>
getItem(id: string): Promise<DeskItem | null>
act(id: string, action: 'open' | 'reveal' | 'copy' | 'quickLook' | 'copyUrl'): Promise<void>
setPinned(id: string, pinned: boolean): Promise<void>
setArchived(id: string, archived: boolean): Promise<void>
deleteItem(id: string): Promise<{ undoToken: string }>
undoDelete(token: string): Promise<void>
capture: { status(): Promise<CaptureStatus>; pause(minutes: number | null): Promise<void>; resume(): Promise<void>; deleteRecent(minutes: number): Promise<number> }
settings: { get(): Promise<Settings>; set(patch: Partial<Settings>): Promise<void> }
ui: { openQuickSearch(): void; hideQuickSearch(): void; openMain(view?): void; openSettings(tab?): void }
on(event: 'items-changed' | 'capture-status' | 'settings-changed', cb): Unsubscribe
```

`SearchResponse = { parsed: ParsedQuery; groups: { kind: 'top' | 'session' | 'other'; label?: string; items: SearchHit[] }[]; typeCounts: Record<ItemType, number>; apps: string[]; total: number }`
`SearchHit = DeskItem & { score: number; highlights: { field: 'title' | 'text' | 'ocr' | 'url' | 'fileName'; ranges: [number, number][] }[]; excerpt?: string }`

---

## 4. 데이터

저장 위치: `app.getPath('userData')` = `~/Library/Application Support/Digital Desk/`

```
desk.db            SQLite (WAL)
assets/images/     클립보드 이미지 원본(PNG)
assets/thumbs/     썸네일(최대 640px 긴 변, PNG)
```

### 스키마 (migration 001)

```sql
CREATE TABLE items (
  id               TEXT PRIMARY KEY,         -- ULID
  type             TEXT NOT NULL CHECK (type IN ('text','link','image','file','screenshot')),
  title            TEXT,
  text             TEXT,                     -- 클립보드 텍스트(최대 200KB, 초과분 잘라냄)
  ocr_text         TEXT,
  file_path        TEXT,                     -- 원본 경로(스크린샷·다운로드·복사된 파일)
  file_name        TEXT,                     -- basename, 검색용
  url              TEXT,
  domain           TEXT,                     -- url 또는 WhereFroms에서 추출
  source_app       TEXT,                     -- 표시 이름
  source_bundle_id TEXT,
  created_at       INTEGER NOT NULL,         -- epoch ms, 원본이 생긴 시각(파일 birthtime 등)
  captured_at      INTEGER NOT NULL,         -- epoch ms, Desk가 기록한 시각
  last_used_at     INTEGER NOT NULL,         -- 중복 복사 시 갱신. 타임라인 정렬 기준
  use_count        INTEGER NOT NULL DEFAULT 1,
  preview_path     TEXT,                     -- assets/ 기준 상대 경로
  content_hash     TEXT,
  pinned           INTEGER NOT NULL DEFAULT 0,
  archived         INTEGER NOT NULL DEFAULT 0,
  ocr_status       TEXT CHECK (ocr_status IN ('pending','done','failed','skipped')),
  metadata_json    TEXT NOT NULL DEFAULT '{}'  -- width,height,size,mime,whereFroms,missing …
);
CREATE INDEX items_last_used ON items(last_used_at DESC);
CREATE INDEX items_captured  ON items(captured_at);
CREATE INDEX items_hash      ON items(content_hash);
CREATE INDEX items_pinned    ON items(pinned) WHERE pinned = 1;

CREATE VIRTUAL TABLE items_fts USING fts5(
  title, text, ocr_text, file_name, url, domain, source_app,
  tokenize = 'trigram case_sensitive 0'
);
-- items_fts.rowid = items.rowid. 트리거 없이 itemsRepo가 같은 트랜잭션에서 insert/update/delete한다.

CREATE TABLE settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL);
```

P1에서 추가할 테이블: `contexts(id, name, started_at, ended_at, pinned)`, `context_items(context_id, item_id)`.

### 규칙

- 모든 시간은 epoch ms(INTEGER)로 저장한다. 날짜 경계 계산은 **로컬 타임존** 기준이다.
- 스크린샷과 다운로드 파일은 **복사하지 않고 경로만 참조**한다. 썸네일과 OCR은 보관한다. 클립보드 이미지만 assets에 원본을 저장한다(PRODUCT §17).
- 아이템을 삭제하면 DB 행, FTS 행, 앱이 만든 assets 파일을 지운다. **사용자 디스크의 원본 파일은 절대 건드리지 않는다.**

---

## 5. desk-helper 프로토콜

stdout은 한 줄에 JSON 하나다. 요청에는 `id`가 붙고, 응답은 같은 `id`로 온다. 이벤트에는 `event` 필드가 붙는다.

```jsonc
// 시작 직후 1회. changeCount는 기준점일 뿐 캡처하지 않는다
{"event":"ready","version":1,"changeCount":79,"pid":64530}

// 이후 스트리밍 (250ms 폴링). 타입 이름만 보고 내용은 읽지 않는다
{"event":"pasteboard","changeCount":812,"app":{"name":"IntelliJ IDEA","bundleId":"com.jetbrains.intellij","pid":1},
 "types":["public.utf8-plain-text"],"concealed":false,"transient":false,"at":1790414605085}

// 요청 → 응답 (M1 구현)
{"id":1,"cmd":"ping"}                          → {"id":1,"ok":true,"version":1}
{"id":2,"cmd":"frontmost"}                     → {"id":2,"ok":true,"app":{"name":"…","bundleId":"…"}}
{"id":3,"cmd":"pasteboardFiles"}               → {"id":3,"ok":true,"paths":["/…/a.pdf"],"changeCount":812}  // 캡처하기로 결정한 뒤에만 호출
{"id":4,"cmd":"writeFiles","paths":["/…/a.pdf"]} → {"id":4,"ok":true,"changeCount":813}                   // Finder식 파일 복사

// 요청 → 응답 (M3)
{"id":2,"cmd":"ocr","path":"/…/x.png"}         → {"id":2,"ok":true,"lines":[{"text":"…","confidence":0.98}],"ms":412}
{"id":3,"cmd":"mdmeta","path":"/…/x.pdf"}      → {"id":3,"ok":true,"isScreenCapture":false,"whereFroms":["https://…","https://referrer…"]}
{"id":4,"cmd":"screenshotLocation"}            → {"id":4,"ok":true,"path":"/Users/…/Desktop"}
```

- OCR: `VNRecognizeTextRequest`, `recognitionLevel = .accurate`, `recognitionLanguages = ["ko-KR","en-US"]`, `usesLanguageCorrection = true`. 전용 직렬 큐에서 돌려서 클립보드 폴링을 막지 않는다. 줄은 위에서 아래 순서로 준다.
  - **첫 인식 비용(실측, macOS 27)**: 새로 설치한(빌드한) 바이너리에서 첫 인식은 약 25초 걸린다. 그 뒤로는 1440×900 캡처 기준 약 0.6초이고, 프로세스를 다시 띄워도 빠르다. 그래서 헬퍼는 시작하자마자 작은 이미지로 한 번 인식해 두고(`{"event":"ocrReady","ms":…}`), 이 비용을 사용자의 첫 스크린샷이 치르지 않게 한다. OCR 요청의 타임아웃은 60초다.
  - 조사 과정에서 "백그라운드 큐에서 Vision이 멈춘다"고 오판했었다. 원인은 이 첫 인식 비용이었다. CPU 전용 모드는 쓰지 않는다.
- `mdmeta`는 먼저 `com.apple.metadata:kMDItemIsScreenCapture` / `kMDItemWhereFroms` **확장 속성(xattr)**을 읽는다. screencapture와 브라우저가 파일을 쓸 때 바로 붙여 주기 때문에 Spotlight 인덱싱을 기다릴 필요가 없다. 확장 속성이 없으면 `MDItemCopyAttribute`로 한 번 더 확인한다.
- `screenshotLocation`은 `com.apple.screencapture`의 `location` 값을 쓰고, 없으면 `~/Desktop`을 쓴다.
- stdin이 닫히면(앱 종료) 헬퍼도 즉시 종료한다. 고아 프로세스가 남지 않는다.
- `concealed`는 `org.nspasteboard.ConcealedType`/`com.agilebits.onepassword`, `transient`는 `org.nspasteboard.TransientType`/`AutoGeneratedType` 마커가 있을 때 true다.
- main은 헬퍼가 죽으면 지수 백오프로 재시작한다(최대 5회/분). 헬퍼가 없어도 앱은 동작해야 한다. 이 경우 클립보드는 Electron `clipboard`로 폴링하는 모드로 떨어지고 앱 이름은 `Unknown`이 된다. OCR은 `ocr_status='skipped'`로 둔다.
- 빌드는 `native/desk-helper/build.sh`(`swiftc -O`, arm64+x86_64 universal, 소스가 바뀌었을 때만 다시 빌드)로 한다. x86_64 링크 때 `libswiftCompatibilityPacks.a` 경고가 나오지만 무해하다. `npm run build:helper`로 호출하고 `predev`와 `prebuild`에 연결한다. electron-builder의 `extraResources`로 포함한다.

---

## 6. 캡처 파이프라인

공통 규칙: **일시정지 중이거나 제외 앱이면 내용을 읽지도 않는다.** 캡처 이벤트는 `captureState.shouldCapture(app)`를 먼저 통과해야 한다. 일시정지 중에 생긴 파일은 나중에 소급해서 기록하지 않는다.

### 6.1 Clipboard

1. 헬퍼의 `pasteboard` 이벤트를 받는다. 아래 경우는 버린다.
   - `concealed`나 `transient`가 true인 경우
   - 제외 앱인 경우
   - 일시정지 중인 경우
   - 앱이 직접 쓴 변경인 경우. Copy 액션 직전에 쓸 내용의 해시를 `markSelfWrite`로 등록하고, 3초 안에 같은 해시가 들어오면 한 번 무시한다. 이미지는 클립보드에서 다시 읽은 PNG로 해시한다(재인코딩되기 때문)
   - 위 판정은 **내용을 읽기 전에** 한다(concealed, 제외 앱, 일시정지). 앱 자체 쓰기 판정만 읽은 뒤에 한다
2. 형식 우선순위: **파일 → 텍스트 → 이미지**
   - **파일 URL**(`public.file-url`) → 헬퍼 `pasteboardFiles`로 경로를 받아 파일마다 `file` 아이템을 만든다(경로 참조, 이미지 파일이면 썸네일). Finder 복사에 같이 붙는 파일명 텍스트나 아이콘 이미지는 무시된다.
   - **텍스트** → trim한 결과가 공백 없는 `http(s)://` URL 하나뿐이면 `link`, 아니면 `text`(최대 200KB, `metadata.mono`로 코드 여부 표시).
   - **이미지**(`image/png`) → 텍스트가 없을 때만 `image` 아이템을 만든다. PNG 원본과 썸네일을 assets에 저장하고, 해시는 PNG 바이트로 만든다. 20MB를 넘으면 건너뛴다.
   - *변경 이유:* 처음에는 이미지를 텍스트보다 먼저 봤다. 하지만 Numbers, Excel, 일부 에디터는 텍스트를 복사할 때 렌더링된 이미지를 같이 넣는다. 그래서 텍스트를 우선한다. 순수 이미지 복사(Chrome 이미지 복사, ⌃⌘⇧4)에는 텍스트가 없어서 영향이 없다.
3. **중복 처리**: 정규화(trim, CRLF→LF, 줄 끝 공백 제거)한 뒤 SHA-256을 만든다. 최근 24시간 안에 같은 해시가 있으면 새로 만들지 않고 `last_used_at`과 `use_count`만 갱신한다(출처 앱도 최신 값으로 바꾼다). 파일은 경로로 해시한다.
   - 이벤트는 들어온 순서대로 하나씩 처리한다(큐). 아이템 ID는 monotonic ULID라서 같은 밀리초에 여러 개가 생겨도 순서가 안정적이다.
4. 텍스트 제목은 첫 번째 비어 있지 않은 줄(최대 120자)이다. 링크 제목은 6.4를 따른다.

기본 제외 앱(bundle id): `com.1password.1password`, `com.agilebits.onepassword7`, `com.apple.keychainaccess`, `com.apple.Passwords`, `com.bitwarden.desktop`, `com.lastpass.LastPass`

### 6.2 Screenshots

- 폴더는 설정값을 쓰고, 없으면 헬퍼의 `screenshotLocation`, 그것도 없으면 `~/Desktop`을 쓴다. chokidar 설정은 `depth: 0, ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 400 }`이다.
- 새 이미지 파일(`png jpg jpeg heic tiff gif webp bmp`)이 생기면 스크린샷인지 판정한다.
  - 헬퍼 `mdmeta`의 `isScreenCapture`를 본다(xattr이라 보통 첫 조회에서 나온다). 없으면 500ms 간격으로 최대 6번 다시 본다.
  - 판정이 안 나면 파일명 패턴으로 보조 판정한다: `^(Screenshot|Screen Shot|스크린샷|화면 캡처)[ _]`. 한국어 macOS의 이름은 `스크린샷 2026-09-26 오후 7.55.32.png`이다.
- **스크린샷이 아닌 파일은 무시한다.** Desktop 전체를 수집하지 않는다(PRODUCT §39).
  - **예외: 브라우저가 저장한 파일.** `kMDItemWhereFroms`가 있는 파일은 다운로드로 기록한다(`file`, url/domain 포함). Chrome에서 "다운로드 전에 저장 위치 확인"이 켜져 있으면 기본 위치로 **데스크탑**을 제안하는데(M3 실측), 이 경우를 Downloads만 감시해서는 놓치기 때문이다. 확장 속성만 읽으므로 다른 파일의 내용은 보지 않는다.
- 원본이 삭제되면(`unlink`) 해당 아이템에 `metadata.missing = true`를 표시한다. 썸네일과 OCR 텍스트는 남기고 검색도 계속 된다.
- 앱을 다시 켤 때 `ocr_status='pending'`인 아이템은 다시 OCR 큐에 넣는다.
- 파일이 생기는 시점: macOS의 플로팅 썸네일이 켜져 있으면, 캡처하고 몇 초 뒤(실측 약 5~8초)에 파일이 생긴다. 아이템은 파일이 생긴 뒤 0.65초, OCR은 0.98초 만에 끝났다(M3 실측).
- 처리 순서: 아이템 생성(`ocr_status='pending'`, 제목 = 파일명) → 썸네일 → OCR 큐 → 제목 추출(6.5) → FTS 갱신 → `items-changed` 이벤트
- 앱 이름은 파일이 감지된 시점의 앞 앱이다(`frontmost`).

### 6.3 Downloads

- `~/Downloads`(설정 `downloadsFolder`, 없으면 `app.getPath('downloads')`)를 `depth: 0`으로 감시한다. 다음은 무시한다: 점으로 시작하는 파일, `.crdownload`, `.download`(Safari 번들 디렉터리), `.part`, `.partial`, `.tmp`, `.opdownload`, `.aria2`, 디렉터리 전체.
- `awaitWriteFinish: { stabilityThreshold: 1000 }`을 쓴다. Chrome이 `.crdownload`를 최종 이름으로 바꾸면 최종 이름으로 `add` 이벤트가 온다.
- 실측: 저장 위치를 묻는 설정의 Chrome은 `.crdownload`가 아니라 **숨김 임시 파일**(`.com.google.Chrome.XXXXXX`)에 받아 두었다가, 사용자가 위치를 고르면 최종 이름으로 옮긴다. 점으로 시작하는 파일이라 무시된다.
- 헬퍼 `mdmeta`의 `whereFroms[0]`을 `url`로, 그 호스트를 `domain`으로 저장한다. 그래서 `domain:redis.io`로 다운로드 파일도 찾을 수 있다.
- 타입은 `file`, 제목은 파일명이다. 이미지 확장자면 썸네일을 만든다. PDF도 `createThumbnailFromPath`로 썸네일을 만든다.
- PDF 본문 추출은 P1이다(헬퍼에 PDFKit `pdftext` 명령을 추가할 예정).

### 6.4 링크 제목

- 설정 `fetchLinkTitles`(기본 ON)일 때만 가져온다. `net.fetch`로 GET하고, 타임아웃 3초, 앞부분 64KB만 읽어서 `<title>` 또는 `og:title`을 쓴다.
- **가져오지 않는 대상**: `localhost`, `.local`, IP 리터럴(사설·루프백·링크로컬), 포트가 지정된 호스트, 사용자 정보가 포함된 URL(`user:pass@`)
- 실패하면 제목 없이 둔다. 이때 UI는 도메인과 경로를 제목으로 대신 쓴다.

### 6.5 스크린샷 제목 추출 (OCR 결과로)

1. OCR 줄 중에 `\b[A-Z][A-Za-z0-9]+(Exception|Error)\b`에 매칭되는 토큰이 있으면 첫 번째 것을 제목으로 쓴다.
2. 없으면 `오류|에러|실패|Error|Failed|Warning`을 포함한 첫 줄(8~80자)을 쓴다.
3. 없으면 8~80자이면서 글자 비율이 60% 이상인 첫 줄을 쓴다.
4. 그래도 없으면 파일명을 유지한다.

### 6.6 일시정지, 최근 삭제, 보관 기간

- `pausedUntil: number | null | 'indefinite'`는 settings에 저장해서 재시작 후에도 유지한다. 해제 시각이 되면 자동으로 재개한다(타이머 사용, 앱 시작 시 재평가).
- **Delete recent N분**: `captured_at >= now - N분`인 아이템을 전부 지운다. 원본 파일은 지우지 않는다.
- **Retention**: 앱 시작 시와 6시간마다 실행한다. `pinned=0 AND archived=0`이면서 `last_used_at < now - N일`인 것 중, `text`/`link`/`image`는 행째 삭제한다(image는 assets 포함). `screenshot`/`file`은 **메타데이터를 무기한 유지**한다(PRODUCT §30). 단 원본 파일이 사라진 경우 썸네일은 유지한다.

---

## 7. 검색

### 7.1 쿼리 파싱 (`src/shared/query`, 순수 함수, `now`를 주입받음)

```ts
parseQuery(input: string, now: Date): {
  dateRange: { from; to; label; start; end } | null  // start/end = 입력 안의 위치(하이라이트, 칩 × 삭제용)
  filters: { type?: ItemType; app?: string; domain?: string }
  terms: string[]           // 날짜·필터를 뺀 나머지 토큰
}
```

renderer도 같은 함수를 호출해서 입력창의 날짜 단어를 표시하고, 날짜 칩 ×를 누르면 그 범위를 지운다.

- **날짜 표현**(한국어/영어). 주는 **월요일 시작**, 범위는 `[from, to)`다.
  - `오늘/today`, `어제/yesterday`, `그제·그저께/day before yesterday`
  - `이번주·이번 주/this week`, `지난주·지난 주·저번주/last week`, `last-week`
  - `이번달·이번 달/this month`, `지난달·지난 달·저번달/last month`
  - 예시(now = 2026-09-26 토요일): `지난주` → 2026-09-14 00:00 ~ 2026-09-21 00:00, 라벨 `Last week · Sep 14 – 20`
  - 한국어 표현은 띄어쓰기를 선택으로 본다(`이번 주` = `이번주`). 뒤에 조사(`에|에서|의|쯤|부터|까지|동안`)가 붙어도 인식한다(`지난주에`). 영어 표현은 띄어쓰기가 필요하다(`lastweek`는 날짜로 보지 않음). 앞뒤 경계가 필요하다(`지난주말`, `todays`는 날짜가 아님)
  - 날짜 범위는 `captured_at` **또는** `last_used_at`이 범위 안에 있으면 만족한다. 지난주에 복사하고 오늘 다시 복사한 것도 "지난주"로 찾을 수 있어야 하기 때문이다
  - P1: `지난 화요일/last tuesday`, `N일 전/N days ago`, `N월(쯤)/in August`
- **필터**: `type:` 값은 `screenshot|text|link|file|image`이고 한국어 별칭(`스크린샷|텍스트|링크|파일|이미지`)도 받는다. `app:` 값은 source_app에 대해 대소문자를 무시한 접두 일치이며, 공백이 있으면 따옴표로 감싼다. `domain:` 값은 domain에 대한 접미 일치다.
- 모든 날짜 표현과 필터 목록은 테이블 주도(table-driven) 방식으로 테스트한다.

### 7.2 동의어 (한↔영, AI 없음)

`src/shared/query/synonyms.ts`의 작은 사전이다. 각 term은 **동의어 그룹**으로 확장된다.

```
에러·오류 ↔ error, exception, fail   연결·접속 ↔ connection, connect   타임아웃·시간초과 ↔ timeout
다운로드 ↔ download   스크린샷·캡처 ↔ screenshot   설정 ↔ config, configuration, settings
로그인 ↔ login, signin   권한 ↔ permission   메모리 ↔ memory   서버 ↔ server
```

이 사전 덕분에 `redis 에러`가 영문 OCR의 `RedisConnectionFailureException`에 매칭된다. 데모의 핵심 경로이므로 테스트로 고정한다.

- 영어 복수형은 단수형으로도 찾아본다(`errors` → 에러 그룹).
- 한국어 단어가 조사로 끝나면 조사를 뗀 형태도 그룹에 추가한다(`에러가` → `에러가, 에러, …`). 단, 떼고 나서 두 글자 이상 남을 때만 적용한다(`사과`는 그대로 둔다).

### 7.3 매칭

- 각 동의어 그룹은 그룹 안의 단어들 중 **하나라도** 매칭되면 매칭된 것으로 본다.
- 3자 이상인 단어는 FTS5 trigram `MATCH`로 찾는다. 단어는 따옴표로 감싸 이스케이프한다. 부분 문자열 매칭이므로 `redis`가 `RedisConnectionFailureException` 안에서도 걸린다.
- 3자 미만인 단어(예: `에러`, `db`)는 trigram이 처리하지 못하므로, 날짜와 필터로 좁힌 행을 컬럼별 `instr()`로 훑는다. 라틴 문자가 없는 단어는 `lower()`를 생략한다(한글에는 대소문자가 없다). 10k 행에서 약 8ms 걸린다.
- 후보는 가벼운 컬럼만 읽어서 점수를 매기고, 화면에 보일 상위 50개만 전체 행을 다시 읽는다. 매칭이 수천 건인 넓은 쿼리에서 53ms → 28ms로 줄었다.
- **후보 조건**: 동의어 그룹 중 **1개 이상** 매칭하고, 날짜·필터 조건을 만족해야 한다. AND로 묶지 않는 이유는 `redis-troubleshooting-guide.pdf`처럼 일부 단어만 매칭되는 아이템도 결과에 나와야 하기 때문이다. 대신 모든 그룹을 매칭한 아이템이 큰 가산점을 받아 위로 올라온다.
- 날짜 조건이 있는데 결과가 0개면 UI가 "Search all time"을 제안한다(`opts.allTime`).

### 7.4 점수 (결정적, PRODUCT §37)

그룹별로, 매칭된 필드 중 **가장 높은 가중치 하나만** 더한다. 같은 그룹이 다른 필드에서도 매칭되면 필드 하나당 **+1**을 더하되, 그룹당 최대 +2까지만 준다. 여러 곳에서 언급될수록 그 주제에 가깝다는 뜻이다. 이 규칙 덕분에 제목과 OCR 모두에 `Redis…Exception`이 있는 에러 스크린샷이 제목에만 있는 문서 링크보다 위에 온다.

- `text` 아이템의 title은 본문 첫 줄이라 title로 치지 않고 text(+7)로 계산한다. 그렇지 않으면 같은 내용이 두 번 점수를 받는다.
- `link` 아이템의 text는 URL과 같아서 url 필드로만 계산한다.

| 필드 | 점수 |
|---|---|
| title 완전 일치(대소문자 무시) | +10 |
| file_name | +8 |
| title(부분) | +8 |
| ocr_text | +7 |
| text | +7 |
| url / domain | +5 |
| source_app | +3 |

추가 보정:

| 조건 | 점수 |
|---|---|
| 모든 그룹 매칭 | +15 |
| 최신성 | `+4 × exp(-age일 / 7)` |
| pinned | +3 |
| archived | −2 |

동점이면 `last_used_at` 내림차순으로 정렬한다. 결과는 최대 50개다.

### 7.5 그룹과 하이라이트

- 그룹 구성은 DESIGN §6.5를 따른다(`search/sessions.ts`).
- 하이라이트: main은 실제로 매칭된 단어 목록(`matchWords`)만 보낸다. renderer가 화면에 보이는 문자열(제목, 발췌, OCR, URL)에서 대소문자 구분 없이 직접 칠한다(`src/shared/query/highlight.ts`). 처음에는 main이 범위를 계산하려 했지만, 링크의 대체 제목처럼 renderer가 만드는 문자열이 있어서 이렇게 바꿨다.
- 발췌(`excerpt`): text는 매칭된 첫 줄(행 제목으로 쓴다), screenshot은 첫 매칭 줄의 앞 한 줄부터 최대 6줄(미리보기에서는 3줄까지만 보인다).
- 응답 형태: `SearchResponse { groups: { kind, label, hits: { item, score, excerpt }[] }[], total, typeCounts, apps, matchWords, dateRange, filters, terms, tookMs }` (`src/shared/types.ts`).
- 세션: P1 Context가 생기기 전까지는 Top match의 `captured_at` ±20분 안에 있는 매칭 결과를 같은 세션으로 본다. 세션 그룹은 시간순으로 정렬한다.

### 7.6 성능 목표

- 시드 데이터 10k 아이템 기준으로 검색 p95 50ms 이하. 벤치 테스트(`search.bench.test.ts`)로 확인한다. 측정값은 p50 약 8ms, p95 약 29ms다(M2, Apple Silicon). 합성 데이터는 단어 종류가 적어 쿼리 하나가 수천 건에 매칭되므로, 실제 데이터보다 어려운 조건이다.
- 패널 표시는 단축키부터 100ms 이하.

---

## 8. 창 관리 요약

| 창 | 생성 시점 | 비고 |
|---|---|---|
| Quick Search | 앱 시작 시(숨김) | DESIGN §6.1. `type: 'panel'`이라 앱을 활성화하지 않는다(앞 앱이 active로 남은 채 키 입력만 받는다). 그래서 숨기기만 해도 포커스가 돌아간다 |
| Main | 필요할 때 생성, 닫으면 파괴 | `hiddenInset` |
| Settings | 필요할 때, 1개만 | `⌘,` |
| Onboarding | 첫 실행 시 | 끝나면 파괴 |
| Tray | 앱 시작 시 | DESIGN §8.2 |

- 단일 인스턴스(`requestSingleInstanceLock`)로 동작한다.
- 로그인 시 실행 설정: `app.setLoginItemSettings`

## 9. macOS 권한과 주의점

| 항목 | 내용 |
|---|---|
| Files & Folders (Desktop, Downloads) | 처음 접근할 때 TCC 프롬프트가 뜬다. 온보딩 3단계에서 의도적으로 접근해서 이때 뜨게 한다. dev 모드에서는 터미널에 권한이 귀속된다. M3에서 터미널(Ghostty)로 dev를 실행했을 때는 프롬프트 없이 감시됐다(이미 권한이 있던 것으로 보인다). 서명 없는 패키지 앱에서는 M4 온보딩과 함께 확인한다 |
| 클립보드 읽기 | **확인함(2026-09-26, macOS 27.0 / 26A428, 개발 빌드 Electron 44)**: TextEdit·Finder에서 복사한 텍스트, 링크, 파일, 이미지를 읽을 때 붙여넣기 허용 프롬프트가 **뜨지 않았다**. 헬퍼는 타입 이름과 changeCount만 보고, 내용은 캡처하기로 결정한 뒤 Electron(main)이 읽는다. 서명 없는 패키지 .app(`npm run build:mac`)에서도 같은 결과였다. 서명과 공증을 거친 배포본은 따로 확인이 필요하다 |
| 화면 기록 | 앱은 화면 기록 권한이 필요 없다. (개발 중 `screencapture`로 화면을 찍으면 **터미널 앱**에 권한 프롬프트가 뜬다. 앱 화면 확인은 `--remoteDebuggingPort` + CDP `Page.captureScreenshot`으로 한다) |
| 손쉬운 사용 | 앱은 필요 없다. E2E 확인용 AppleScript UI 스크립팅(트레이 메뉴 클릭)만 터미널에 이 권한이 필요하다 |
| 전역 단축키 | `⌘⇧Space`는 다른 앱이나 입력기 설정과 충돌할 수 있다. 등록에 실패하면 설정에 경고를 띄우고 사용자가 바꾸게 한다 |
| 네이티브 모듈 | `better-sqlite3` 13은 N-API라 재빌드 없이 Node와 Electron 모두에서 로드된다. `postinstall`의 `electron-builder install-app-deps`는 앞으로 추가될 네이티브 모듈을 위해 둔다 |
| 데이터 위치 | 패키지 앱은 `~/Library/Application Support/Digital Desk`, 개발 실행은 `… /Digital Desk (Dev)`를 쓴다. `DESK_USER_DATA=<dir>`로 덮어쓸 수 있다(테스트, 데모 프로필) |
| 서명 | 데모용 로컬 빌드는 서명 없이 만든다. 배포하려면 notarization이 필요하다(범위 밖) |
| 로그인 시 실행 | 서명 없는 앱에서 `setLoginItemSettings`는 `Operation not permitted`로 거부될 수 있다. 그래서 값이 바뀔 때만 호출한다(M4 실측). 서명한 빌드에서 다시 확인이 필요하다 |
| 종료 | SIGTERM을 받으면 `app.quit()`으로 정상 종료 경로를 탄다. 종료 정리 코드는 한 번만 실행되게 막아 둔다. **main의 잡히지 않은 예외는 오류 대화상자가 되어 종료를 막는다**(M4에서 `updateDock`이 파괴된 창에 접근해서 실제로 일어났다) |

## 10. 테스트 전략

- **단위 테스트(vitest, 필수)**: `parseQuery`와 날짜 표현 전부(고정 now), 동의어 확장, 점수·정렬, 세션 그룹핑, 해시 정규화, 스크린샷 제목 추출, 링크 URL 판정과 사설 주소 차단, 보관 기간 선정 쿼리, 시간 표기
- **통합 테스트**: 임시 파일 DB로 itemsRepo와 searchService 전체 경로를 테스트한다. 데모 쿼리 `지난주 redis 에러`를 시드 데이터로 검증한다.
- **수동 확인**: 각 마일스톤의 완료 기준(`docs/ROADMAP.md`)을 `npm run dev`로 실제 확인한다.
