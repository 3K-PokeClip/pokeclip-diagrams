# 시퀀스 다이어그램 — 검증 상태 재현 주소

브라우저에서 직접 확인한 상태들이다. 이미지 파일이 아니라 **재현 주소**로 남긴다 —
로컬 서버(`http://localhost:8770`)나 배포본
(`https://3k-pokeclip.github.io/pokeclip-diagrams/`)에서 그대로 열린다.
주소가 곧 상태라서 새로고침해도, 링크를 보내도 같은 화면이 뜬다.

## 문서별 기본 · 서랍 · 시퀀스

| 상태 | 재현 주소 |
|---|---|
| ④ 기본 (회귀 확인) | `04-system-architecture.html` |
| ④ 채팅 수집기 서랍 | `04-system-architecture.html?diagram=system&card=chat` |
| ④ 렌더 실패·DLQ 시퀀스 | `04-system-architecture.html?diagram=system&card=w-render&sequence=SEQ-EDIT-05` |
| ③ 채팅 수집 블록 서랍 | `03-service-architecture.html?diagram=service&card=rt-chat` |
| ③ 업로드 2단 검사 | `03-service-architecture.html?diagram=service&card=mk-upload&sequence=SEQ-UP-01` |
| ① UC-13 서랍 | `01-usecase.html?diagram=usecase&card=UC-13` |
| ① WebSocket 단절과 재연결 | `01-usecase.html?diagram=usecase&card=UC-13&sequence=SEQ-CHAT-03` |
| ① 업로드 승인 요청 | `01-usecase.html?diagram=usecase&card=UC-29&sequence=SEQ-UP-02` |
| ② 라이브 대시보드 서랍 | `02-ia.html?diagram=ia&card=ia-dash` |
| ② SSE 끊김과 스냅샷 복구 | `02-ia.html?diagram=ia&card=ia-dash&sequence=SEQ-SSE-02` |

## 예외 · 회귀

| 상태 | 재현 주소 |
|---|---|
| 카탈로그에 없는 Sequence ID (오류 상태) | `04-system-architecture.html?diagram=system&card=w-render&sequence=SEQ-NOPE-99` |
| 없는 카드 ID (서랍이 열리지 않고 기존 기능은 그대로) | `04-system-architecture.html?diagram=system&card=nope&p=1` |
| P1 전용 뷰 (기존 기능 회귀) | `01-usecase.html?p=1` · `04-system-architecture.html?p=1` |

## 검증 방법

브라우저 콘솔에서 돌린다. 문제를 배열로 돌려주고, 빈 배열이면 통과다.

```js
const v = await import('/tools/verify.js');
await v.verify(20);          // ④는 20, ③은 29, ①②는 32

const r = await import('/tools/regress.js');
await r.regress('system');   // 'system' | 'service' | 'usecase' | 'ia'
```

`verify()` 가 보는 것 — 45개 시퀀스 전체의 글자 겹침·경계 넘침·프래그먼트 이탈,
카드별 서랍 열림과 화면 안 위치, 배지 숫자와 목록 수 일치, 시퀀스별 SVG 렌더와
URL 반영, 목록 복귀, 포커스 복귀, `aria-*` 갱신, 키보드 Enter·Tab 트랩·Esc 2단,
44px 최소 클릭 크기, 확대·이동 상태 보존.

`regress()` 가 보는 것 — 외부 리소스·CSP·iframe이 새로 생기지 않았는지, 호버 강조가
"켜지되 전부는 아닌지", 단계 칩과 흐름 칩, 확대·맞춤 버튼, Esc 고정 해제.

카탈로그 자체는 브라우저 없이도 본다.

```bash
node tools/check-catalog.js
```

확인 해상도: 2560×1440 · 1920×1080 · 1440×900
