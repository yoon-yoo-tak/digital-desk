# design/

| 경로 | 내용 |
|---|---|
| `tokens.css` | 색·타입·간격·반경·모션 토큰. 구현 시 renderer에서 그대로 import한다. |
| `icons/*.svg` | 16px 스트로크 아이콘(1.4 stroke, round). `currentColor` 사용. |
| `mockups/*.dc.html` | 화면별 목업 원본. 인라인 스타일에 정확한 px·색 값이 있다. |
| `mockups/canvas.json` | 캔버스 배치 정보(참고용). |

**목업을 보는 법**: 캔버스(https://claude.ai/artifact/A1LD6nTn52nAcR6KbuhWJK)에서 보는 게 기본이다. 개별 `.dc.html`은 캔버스 런타임(`support.js`)용 포맷이지만, 동적 바인딩을 쓰지 않아서 브라우저로 직접 열어도 대부분 그대로 보인다.

| 목업 | 화면 |
|---|---|
| `Main.dc.html` | Quick Search — 결과 + 미리보기 (핵심 화면) |
| `SearchStates.dc.html` | Quick Search — idle / 필터 칩 / 결과 없음 / 일시정지 |
| `Library.dc.html` | 메인 창 — Inbox 타임라인 + Inspector |
| `Desk.dc.html` | 메인 창 — Desk (Pin한 Context 더미 + Pin 아이템) |
| `MenuBar.dc.html` | 메뉴바 — 캡처 중 / 일시정지 |
| `Settings.dc.html` | 설정 — Capture 탭 |
| `Foundations.dc.html` | 토큰·타입·아이콘·행 규격·단축키 |
| `Onboarding.dc.html` | 첫 실행 4단계 |

목업과 `docs/DESIGN.md`가 다르면 **DESIGN.md가 우선**이다(목업은 정적 화면이라 동작·상태가 빠져 있다).
