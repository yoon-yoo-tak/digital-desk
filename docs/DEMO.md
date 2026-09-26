# 데모 리허설 (ALEN CUP)

PRODUCT §43의 시연을 그대로 재현하기 위한 절차다. 2026-09-26에 패키지 앱(`npm run build:mac`, 서명 없음)으로 전 과정을 확인했다.

- 발표 시간: 약 3분
- 필요한 것: 이 Mac, Chrome, 에디터나 TextEdit(에러 화면용)

---

## 0. 꼭 알아둘 것

| 항목 | 내용 |
|---|---|
| **시드 날짜는 시드한 시점 기준** | "지난주 Redis 시나리오"는 **시드한 날이 속한 주의 전주 목요일 14:03–14:16**에 만들어진다. 발표 주보다 전에 시드하면 "지난주"가 비어 버린다. **발표 당일(또는 같은 주 중)에 다시 시드한다.** |
| 스크린샷이 늦게 보임 | macOS 플로팅 썸네일이 켜져 있으면 파일이 5~8초 뒤에 저장된다. ⌘⇧5 › 옵션 › "플로팅 썸네일 보기"를 끄면 곧바로 저장된다(권장) |
| 첫 OCR | 새로 설치한 앱은 첫 글자 인식 준비에 약 25초가 걸린다. 앱은 시작하자마자 이 준비를 해 두므로, 발표 전에 **한 번 실행해서 30초 이상 켜 둔다** |
| Chrome 저장 창 | "다운로드 전에 저장 위치 확인"이 켜져 있으면 저장 창이 뜬다. 기본 위치인 데스크탑에 저장해도 기록된다. 흐름을 짧게 하려면 이 옵션을 끈다 |
| 폴더 권한 | `open`이나 Finder로 앱을 처음 실행하면 macOS가 데스크탑과 다운로드 폴더 접근을 묻는다. 리허설 때 **허용**해 둔다(온보딩 3단계에서 뜬다) |
| 단축키 | ⌘⇧Space가 다른 앱(입력기 전환 등)과 겹치면 Settings › Shortcuts의 칸이 빨간 테두리가 된다. 다른 조합으로 바꾼다 |

---

## 1. 준비 (발표 당일)

```bash
npm install
npm run build:mac:dir                 # → release/mac-arm64/Digital Desk.app (빠른 로컬 빌드)
```

(또는 Releases의 dmg를 설치했다면 아래 경로를 `/Applications/Digital Desk.app`으로 바꿔 쓴다.)

데모 전용 프로필로 실행한다. 데이터 폴더는 `~/Library/Application Support/Digital Desk (Demo)`이다. 처음 실행하면 데모 데이터 49개가 자동으로 들어가고 온보딩은 건너뛴다.

```bash
open "release/mac-arm64/Digital Desk.app" --args --profile=demo
```

데모 데이터를 **다시 채울 때**(발표 당일 아침): 앱을 종료(메뉴바 › Quit)한 뒤 다음을 실행한다.

```bash
"release/mac-arm64/Digital Desk.app/Contents/MacOS/Digital Desk" --profile=demo --seed --reset
```

개발 빌드로 할 때는 `npm run demo`(실행)와 `npm run seed -- --reset`(개발 데이터 폴더 재시드)을 쓴다.

확인 목록:
- [ ] 메뉴바에 트레이 아이콘이 있고, 메뉴에 `Capturing · Clipboard · Screenshots · Downloads`가 보인다
- [ ] ⌘⇧Space → `지난주 redis 에러` → Top match가 `RedisConnectionFailureException` 스크린샷이다
- [ ] 에러 화면을 준비했다(에디터에 스택 트레이스를 띄우거나, `resources/demo/redis-error.png`를 미리보기로 연다)
- [ ] 브라우저 탭에 Redis troubleshooting 문서를 열어 두었다: https://redis.io/docs/latest/operate/oss_and_stack/management/troubleshooting/
- [ ] 받을 PDF 링크를 준비했다(아무 PDF나 괜찮다)

---

## 2. 시연 순서

### ① Before (30초)
Desktop, Downloads, Chrome 방문 기록, Finder 검색을 차례로 보여 준다.
> "며칠 전에 Redis 연결 에러를 봤습니다. 캡처도 했고 문서도 읽었는데, 어디에 있는지 기억이 안 납니다."

### ② Capture (60초) — Digital Desk는 건드리지 않는다
1. ⌘⇧4로 에러 화면을 캡처한다
2. 에러 메시지 한 줄을 드래그해서 ⌘C
3. 브라우저 주소창에서 Redis 문서 URL을 ⌘C
4. PDF를 다운로드한다

> "평소처럼 했을 뿐입니다. 저장 버튼도, 폴더도, 태그도 없습니다."

(선택) 메뉴바 › Open Digital Desk로 Inbox에 방금 것 4개가 쌓인 것을 보여 준다. 스크린샷 제목은 OCR로 읽은 예외 이름이다.

### ③ Later (60초)
1. 아무 앱에서나 **⌘⇧Space** → `지난주 redis 에러`
   - `지난주`가 주황색으로 표시되고, `Last week · …` 칩이 나타난다
   - **Top match**는 지난주 목요일의 에러 스크린샷이다. 오른쪽 미리보기의 "Text in image"에 `Exception`, `Redis`가 하이라이트된다
   - **Same session** 아래에 같은 오후에 복사한 에러, 문서 링크, 설정 스크린샷, PDF가 시간순으로 나온다
   - > "Redis 에러를 '에러'라고 한국어로 찾았는데, 영문 Exception까지 찾습니다. AI 없이 로컬에서요."
2. `오늘 redis` → 방금 캡처한 4개가 나온다
3. ↵로 연다. ⌘Y는 Quick Look, ⌘C는 복사다. Esc를 두 번 누르면 원래 앱으로 돌아간다

### ④ 메시지
> **You don't need to remember where you saved it.**

---

## 3. 문제가 생기면

| 증상 | 확인 | 조치 |
|---|---|---|
| `지난주 redis 에러`가 비어 있다 | 시드한 날짜 | 발표 주에 `--seed --reset`로 다시 시드한다 |
| 방금 찍은 스크린샷이 안 보인다 | 플로팅 썸네일이 떠 있는지 | 몇 초 기다리거나 썸네일을 스와이프해서 넘긴다 |
| 스크린샷 제목이 파일명 그대로다 | 첫 OCR 준비 중(설치 직후) | 30초 뒤 다시 확인한다. 아니면 Settings › Capture › Read text in screenshots가 켜져 있는지 본다 |
| 다운로드가 안 보인다 | 저장한 위치 | 다운로드 폴더와 데스크탑(브라우저가 받은 파일)만 기록한다. 다른 폴더는 기록하지 않는다 |
| 아무것도 기록되지 않는다 | 메뉴바 아이콘이 점선인지(일시정지) | 메뉴바 › Resume capturing 또는 ⌥⌘P |
| ⌘⇧Space가 안 된다 | Settings › Shortcuts의 빨간 테두리 | 다른 조합으로 바꾼다. 메뉴바 › Quick Search로도 열 수 있다 |

---

## 4. 끝나고 정리

- 시연 중에 만든 스크린샷과 PDF는 데스크탑과 다운로드 폴더에 있다. 휴지통으로 옮긴다
- 데모 프로필의 데이터 지우기: 앱 종료 후 `~/Library/Application Support/Digital Desk (Demo)` 폴더를 지운다
