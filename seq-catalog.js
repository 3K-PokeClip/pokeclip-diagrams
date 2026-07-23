/* ============================================================================
   PokeClip — 중앙 시퀀스 카탈로그
   ----------------------------------------------------------------------------
   시퀀스 "내용"은 여기 한 곳에만 있다.
   카드(①의 유스케이스, ② IA 화면, ③ 서비스 블록, ④ 실행 단위)는 아무 내용도
   갖지 않는다. 시퀀스가 스스로 "나는 어느 카드에 걸리는가"를 밝히고,
   sequences.js 가 역인덱스를 만든다. 같은 흐름이 카드마다 복제되지 않는다.

     relatedUcIds         ① UC-01 ~ UC-32
     relatedIaNodeIds     ② 표면(ia-…) · 화면(ia-…)
     relatedServiceIds    ③ 논리 Capability · 접점 · 외부 시스템 id
     relatedComponentIds  ④ 실행 단위 · 저장소 · 접점 · 외부 시스템 id

   근거 — 확정 문서만 쓴다
   · ④ v2.7 실행 단위 10 · 저장소 4 · SQS 다섯 큐 · Kafka는 초기 구성에 없음
   · ③ v2.2 논리 Capability 21 · 데이터 소유권 · 도메인 이벤트
   · ① v3.9 UC-01~32 · ② v3.3 표면 4 · 글로벌 메뉴 6
   · ADR-004(DVR 1h / VOD 60일) 005(CMAF · VOD = 매니페스트 확정)
     006(PostgreSQL + JSONB) 010(유튜브 업로드) 011(채팅·하이라이트)
     012(권한 3단계) 013(인프라 · 관리형 STT 배제) 015(CloudFront)
   · 부록 A 장애 시나리오 · 부록 B 추적성 · 부록 C 상태 머신
   근거가 없는 것은 만들어 넣지 않고 TBD로 남긴다.
============================================================================ */
(function (S) {
"use strict";
var P = S.P;

/* ══════════════════════════════════════════════════════════════════════
   공개 웹 · 지원
══════════════════════════════════════════════════════════════════════ */
S.define({

"SEQ-PUB-01": {
  title: "비로그인 공개 웹 — 소개 · 요금 · 플러그인 다운로드",
  trigger: "로그인하지 않은 사람이 공개 웹에 들어온다",
  purpose: "가입 전에 볼 수 있는 것만 보여주고, 플러그인 설치까지 이어주는 경로. " +
           "개인 데이터가 필요한 화면과 그렇지 않은 화면의 경계를 보인다.",
  relatedUcIds: ["UC-04", "UC-10", "UC-31"],
  relatedIaNodeIds: ["ia-public", "ia-landing", "ia-pricing", "ia-download", "ia-terms"],
  relatedServiceIds: ["ac-public", "cm-public"],
  relatedComponentIds: ["web", "core", "pg"],
  participants: P(["streamer", "web", "core", "pg"]),
  steps: [
    { kind:"sync",  from:"streamer", to:"web",  text:"공개 웹 접속 (로그인 없음)" },
    { kind:"sync",  from:"web",  to:"core", text:"공개 콘텐츠 요청 — 소개 · 요금 · 약관" },
    { kind:"store", from:"core", to:"pg",   text:"공개 문서 · 플랜 정보 조회" },
    { kind:"reply", from:"pg",   to:"core", text:"플랜 · 약관 버전" },
    { kind:"reply", from:"core", to:"web",  text:"공개 화면 데이터 (개인 데이터 없음)" },
    { kind:"note",  at:"core",   text:"이 경로에는 계정도 세션도 없다. 종량 요금 기준과 무료 티어는 아직 미정(TBD)이라 화면에도 그대로 TBD로 적는다." },

    { kind:"fragStart", type:"alt", label:"무엇을 하러 왔는가" },
    { kind:"fragCase", label:"플러그인을 받으러" },
    { kind:"sync",  from:"streamer", to:"web", text:"플러그인 다운로드 — OS · OBS 버전 선택" },
    { kind:"reply", from:"web", to:"streamer", text:"설치 파일 · 설치 가이드 · 릴리스 노트" },
    { kind:"note",  at:"web", text:"설치와 Stream Key 등록은 로그인 이후다. 여기서는 파일만 준다." },

    { kind:"fragElse", label:"요금을 보러" },
    { kind:"reply", from:"web", to:"streamer", text:"구독 플랜 비교 · 편집자는 과금 대상이 아님" },

    { kind:"fragElse", label:"문의하러" },
    { kind:"self", from:"web", text:"문의 접수 화면으로 — 가입 전·후 공통 (SEQ-PUB-02)" },
    { kind:"fragEnd" },

    { kind:"sync",  from:"streamer", to:"web",  text:"시작하기 — 구글 로그인으로" },
    { kind:"note",  at:"web", text:"여기서부터는 SEQ-AUTH-01. 약관 동의는 최초 1회이며 로그인 흐름 안에서 받는다." }
  ],
  notes: [
    "요금 안내에 적는 종량 기준은 확정되지 않았다. 문서와 화면 모두 TBD로 유지한다.",
    "서비스 상태 공개 고지는 SEQ-PUB-03에서 따로 다룬다."
  ]
},

"SEQ-PUB-02": {
  title: "문의 접수와 답변 확인",
  trigger: "가입 전 또는 로그인 후에 문의를 남긴다",
  purpose: "가입 전과 후가 같은 접수 창구를 쓰되, 로그인 상태에 따라 접수 상태를 " +
           "어떻게 다시 볼 수 있는지가 갈리는 지점을 보인다.",
  relatedUcIds: ["UC-10"],
  relatedIaNodeIds: ["ia-help-public", "ia-help-settings"],
  relatedServiceIds: ["cm-help", "cm-public", "ac-public"],
  relatedComponentIds: ["web", "core", "pg"],
  participants: P(["streamer", "web", "core", "pg"]),
  steps: [
    { kind:"sync",  from:"streamer", to:"web", text:"문의 작성 — 내용 · 연락 수단" },
    { kind:"sync",  from:"web",  to:"core", text:"문의 접수" },
    { kind:"store", from:"core", to:"pg",   text:"문의 저장 (접수 번호 발급)" },
    { kind:"reply", from:"pg",   to:"core", text:"접수 번호" },
    { kind:"reply", from:"core", to:"web",  text:"접수 완료 · 접수 번호" },

    { kind:"fragStart", type:"alt", label:"로그인 상태" },
    { kind:"fragCase", label:"로그인 후 — 계정에 묶인다" },
    { kind:"sync",  from:"streamer", to:"web",  text:"설정 › 도움말 · 문의에서 접수 상태 확인" },
    { kind:"store", from:"core", to:"pg",   text:"내 문의 목록 조회" },
    { kind:"reply", from:"core", to:"web",  text:"접수 상태 · 답변" },

    { kind:"fragElse", label:"가입 전 — 계정이 없다" },
    { kind:"note", at:"core", text:"계정이 없으므로 접수 번호와 연락 수단이 유일한 단서다. 답변은 그 연락 수단으로 나가고, 웹에서 목록으로 다시 보는 경로는 없다." },
    { kind:"fragEnd" },

    { kind:"note", at:"pg", text:"알림 수신 채널(웹 푸시 · 이메일)은 아직 확정되지 않았다(TBD). 여기서도 '연락 수단'이라고만 적는다." }
  ],
  notes: [
    "자주 묻는 질문은 공개 웹 하나로 통합돼 있고 설정 안에 따로 두지 않는다(② IA)."
  ]
},

"SEQ-PUB-03": {
  title: "서비스 상태 공개 고지 (장애 · 점검)",
  trigger: "기능 단위 장애가 감지되거나 점검이 예정된다",
  purpose: "장애를 사용자에게 어떻게 알리는지. 사용자에게 보이는 상태는 감지 결과 " +
           "그대로가 아니라 운영자가 확정한 값이라는 점을 분명히 한다.",
  relatedUcIds: ["UC-10"],
  relatedIaNodeIds: ["ia-status"],
  relatedServiceIds: ["cm-public"],
  relatedComponentIds: ["core", "pg", "web"],
  participants: P(["ops", "console", "core", "pg", "web"]),
  steps: [
    { kind:"async", from:"ops", to:"console", text:"경보 — 기능별 오류율 · 큐 적체 · 워커 실패" },
    { kind:"self",  from:"console", text:"영향 범위 판단 — 송출 수신 · 편집 · 업로드 중 무엇인가" },

    { kind:"fragStart", type:"alt", label:"공개 고지 여부" },
    { kind:"fragCase", label:"사용자에게 보이는 영향이 있다" },
    { kind:"sync",  from:"console", to:"core", text:"서비스 상태 게시 (기능 · 등급 · 진행 상황)" },
    { kind:"store", from:"core", to:"pg",   text:"상태 공지 저장 · 장애 이력에 append" },
    { kind:"reply", from:"pg",   to:"core", text:"커밋 완료" },
    { kind:"sync",  from:"web",  to:"core", text:"서비스 상태 조회 (비로그인 포함)" },
    { kind:"reply", from:"core", to:"web",  text:"기능별 상태 · 장애 이력 · 진행 상황" },

    { kind:"fragElse", label:"내부에서만 처리된다" },
    { kind:"self", from:"console", text:"공개하지 않고 복구 — 이력에는 남긴다" },
    { kind:"fragEnd" },

    { kind:"note", at:"console", text:"자동 감지가 곧 공개 고지는 아니다. 사이에 사람의 확정이 들어간다. 자동으로 상태 페이지를 흔들면 순단마다 장애로 보인다." },
    { kind:"note", at:"core", text:"복구 뒤에는 같은 항목을 정상으로 되돌리고 이력에 마감 시각을 남긴다." }
  ],
  notes: [
    "운영자 콘솔은 ①·③에서 범위 밖으로 선언돼 있다. 여기서는 '상태를 확정하는 자리'로만 등장하고 내부 화면은 그리지 않는다.",
    "장애 자체의 영향·복구 절차는 부록 A 장애 시나리오에 있다."
  ]
}

});

/* ══════════════════════════════════════════════════════════════════════
   계정 · 인증
══════════════════════════════════════════════════════════════════════ */
S.define({

"SEQ-AUTH-01": {
  title: "구글 로그인과 최초 약관 동의",
  trigger: "공개 웹에서 로그인을 시작한다",
  purpose: "OIDC 로그인으로 세션이 서기까지. 로그인용 Google 연동과 업로드용 " +
           "YouTube 권한이 왜 다른 것인지를 여기서 갈라 둔다.",
  relatedUcIds: ["UC-01"],
  relatedIaNodeIds: ["ia-account", "ia-home"],
  relatedServiceIds: ["cm-auth", "ac-web", "ex-google"],
  relatedComponentIds: ["web", "core", "pg", "redis", "ex-google"],
  participants: P(["streamer", "web", "core", "google", "pg", "redis"]),
  steps: [
    { kind:"sync",  from:"streamer", to:"web",  text:"구글로 로그인" },
    { kind:"sync",  from:"web",  to:"core",   text:"인증 시작 요청" },
    { kind:"reply", from:"core", to:"web",    text:"Google OIDC 인가 URL (state · nonce)" },
    { kind:"sync",  from:"web",  to:"google", text:"인가 요청 — 로그인 범위만" },
    { kind:"reply", from:"google", to:"web",  text:"authorization code" },
    { kind:"sync",  from:"web",  to:"core",   text:"code 전달" },
    { kind:"sync",  from:"core", to:"google", text:"code → ID 토큰 교환 · 검증" },
    { kind:"reply", from:"google", to:"core", text:"ID 토큰 (sub · 이메일)" },
    { kind:"note",  at:"google",  text:"여기서 받는 것은 로그인 정보뿐이다. 유튜브 업로드 권한은 별개의 OAuth 동의이며 UC-03에서 따로 받는다(④에서도 Google과 YouTube는 다른 외부 시스템이다)." },

    { kind:"fragStart", type:"alt", label:"계정 존재 여부" },
    { kind:"fragCase", label:"처음 오는 사람" },
    { kind:"store", from:"core", to:"pg", text:"계정 생성 (google sub 기준)" },
    { kind:"sync",  from:"core", to:"web", text:"약관 동의 요구 (최초 1회)" },
    { kind:"sync",  from:"streamer", to:"web", text:"약관 동의" },
    { kind:"store", from:"core", to:"pg", text:"동의 버전 · 시각 기록" },

    { kind:"fragElse", label:"이미 있는 계정" },
    { kind:"store", from:"core", to:"pg", text:"계정 조회 · 마지막 로그인 갱신" },
    { kind:"fragStart", type:"opt", label:"약관이 그 사이 개정된 경우" },
    { kind:"sync", from:"core", to:"web", text:"변경된 약관 재동의 요구" },
    { kind:"fragEnd" },
    { kind:"fragEnd" },

    { kind:"store", from:"core", to:"redis", text:"세션 저장 (TTL)" },
    { kind:"reply", from:"core", to:"web",   text:"로그인 완료 — 역할(스트리머 · 편집자) 포함" },
    { kind:"note",  at:"web", text:"역할은 계정 속성이 아니라 관계다. 같은 사람이 자기 채널에서는 스트리머, 남의 채널에서는 편집자일 수 있다(UC-05·07)." }
  ],
  notes: [
    "Redis에 있는 것은 세션이지 계정이 아니다. Redis가 비면 다시 로그인하면 되고 계정은 PostgreSQL에 그대로 있다.",
    "로그인 제공자는 Google 하나다. 다른 제공자는 확정된 바 없어 넣지 않는다."
  ]
},

"SEQ-AUTH-02": {
  title: "계정 삭제 — 활성 구독 해지 선행",
  trigger: "설정 › 계정에서 계정 삭제를 요청한다",
  purpose: "돈이 걸린 상태를 남긴 채 계정이 사라지지 않게 막는 순서. " +
           "삭제되는 것과 남는 것을 구분한다.",
  relatedUcIds: ["UC-09"],
  relatedIaNodeIds: ["ia-account"],
  relatedServiceIds: ["cm-auth", "cm-bill", "ac-web"],
  relatedComponentIds: ["web", "core", "pg", "redis"],
  participants: P(["streamer", "web", "core", "pg", "redis"]),
  steps: [
    { kind:"sync",  from:"streamer", to:"web", text:"계정 삭제 요청" },
    { kind:"sync",  from:"web",  to:"core", text:"삭제 가능 여부 확인" },
    { kind:"store", from:"core", to:"pg",   text:"활성 구독 · 진행 중 업로드 · 협업 관계 조회" },
    { kind:"reply", from:"pg",   to:"core", text:"상태 목록" },

    { kind:"fragStart", type:"alt", label:"선행 조건" },
    { kind:"fragCase", label:"활성 구독이 남아 있다" },
    { kind:"reply", from:"core", to:"web", text:"거절 — 구독 해지 먼저 (UC-31로 안내)" },
    { kind:"note",  at:"core", text:"차단이 아니라 순서 강제다. 해지하지 않은 채 계정만 지우면 청구 주체가 사라진다." },

    { kind:"fragElse", label:"선행 조건 충족" },
    { kind:"sync",  from:"core", to:"web",  text:"삭제 결과 안내 후 재확인 요구" },
    { kind:"sync",  from:"streamer", to:"web", text:"확인" },
    { kind:"store", from:"core", to:"pg",   text:"계정 삭제 표시 · 협업 관계 즉시 해제 · audit_log 기록" },
    { kind:"reply", from:"pg",   to:"core", text:"커밋 완료" },
    { kind:"store", from:"core", to:"redis",text:"세션 폐기" },
    { kind:"reply", from:"core", to:"web",  text:"로그아웃 · 삭제 처리 완료" },
    { kind:"fragEnd" },

    { kind:"note", at:"pg", text:"이미 유튜브에 올라간 영상은 우리가 지우지 않는다(UC-28과 같은 규칙). 보관물·클립의 최종 처리 정책은 아직 확정되지 않았다(TBD)." }
  ],
  notes: [
    "삭제 이력은 audit_log에 남는다. 계정 레코드가 사라져도 '누가 언제 지웠는가'는 남아야 한다(④ PostgreSQL).",
    "편집자로 참여 중이던 관계는 삭제와 동시에 끊긴다 — 협업 종료(UC-06)와 같은 효과다."
  ]
}

});

/* ══════════════════════════════════════════════════════════════════════
   채널 연동
══════════════════════════════════════════════════════════════════════ */
S.define({

"SEQ-LINK-01": {
  title: "방송 채널 연동과 해제 (치지직 / SOOP)",
  trigger: "설정에서 방송 채널을 연동하거나 해제한다",
  purpose: "채팅 수집이 어느 채널을 봐야 하는지가 정해지는 지점. " +
           "해제하면 진행 중인 수집이 어떻게 되는지까지 다룬다.",
  relatedUcIds: ["UC-02"],
  relatedIaNodeIds: ["ia-channel", "ia-link"],
  relatedServiceIds: ["cm-link", "ac-web", "ex-chat"],
  relatedComponentIds: ["web", "core", "pg", "chat", "ex-chat"],
  participants: P(["streamer", "web", "core", "plat", "pg", "chat"]),
  steps: [
    { kind:"sync",  from:"streamer", to:"web", text:"방송 채널 연동 — 플랫폼 선택" },
    { kind:"sync",  from:"web",  to:"core", text:"연동 시작" },
    { kind:"sync",  from:"core", to:"plat", text:"채널 소유 확인 (플랫폼 인증)" },
    { kind:"reply", from:"plat", to:"core", text:"채널 식별자 · 표시 이름" },
    { kind:"store", from:"core", to:"pg",   text:"채널 연동 저장 · 연동 이력 audit_log" },
    { kind:"reply", from:"pg",   to:"core", text:"커밋 완료" },
    { kind:"reply", from:"core", to:"web",  text:"연동 완료" },
    { kind:"note",  at:"pg", text:"여기 등록된 채널이 채팅 수집기의 '수집 대상'이다(SEQ-CHAT-01에서 조회한다). 등록이 없으면 방송을 시작해도 볼 채널이 없다." },

    { kind:"fragStart", type:"opt", label:"연동 해제" },
    { kind:"sync",  from:"streamer", to:"web", text:"연동 해제" },
    { kind:"store", from:"core", to:"pg",   text:"연동 해제 기록 (이력 유지)" },

    { kind:"fragStart", type:"alt", label:"그 채널로 방송이 진행 중인가" },
    { kind:"fragCase", label:"진행 중" },
    { kind:"async", from:"core", to:"chat", text:"수집 종료 명령 — 멱등" },
    { kind:"note",  at:"chat", text:"이미 모은 원본은 지우지 않는다. 지금부터 새로 모으지 않을 뿐이다." },
    { kind:"fragElse", label:"진행 중 아님" },
    { kind:"self",  from:"core", text:"할 일 없음" },
    { kind:"fragEnd" },
    { kind:"fragEnd" }
  ],
  notes: [
    "채널 연동은 방송 채널(치지직·SOOP)이고, 업로드 대상 채널(유튜브)은 SEQ-LINK-02다. 서로 다른 외부 시스템이다.",
    "치지직은 공식 Open API가 기본, SOOP은 비공식 WS다(ADR-011). 연동 화면에서는 차이가 드러나지 않는다."
  ]
},

"SEQ-LINK-02": {
  title: "유튜브 채널 연동과 토큰 보관",
  trigger: "업로드 대상 유튜브 채널을 연동한다",
  purpose: "업로드에 쓸 권한을 받고 토큰을 어떻게 보관하는지. " +
           "로그인용 Google 연동과 왜 분리돼 있는지를 보인다.",
  relatedUcIds: ["UC-03"],
  relatedIaNodeIds: ["ia-link"],
  relatedServiceIds: ["cm-link", "ac-web", "ex-yt"],
  relatedComponentIds: ["web", "core", "pg", "ex-yt"],
  participants: P(["streamer", "web", "core", "yt", "pg"]),
  steps: [
    { kind:"sync",  from:"streamer", to:"web", text:"유튜브 채널 연동" },
    { kind:"sync",  from:"web",  to:"core", text:"OAuth 시작 (업로드 범위)" },
    { kind:"reply", from:"core", to:"web",  text:"동의 URL (state)" },
    { kind:"sync",  from:"web",  to:"yt",   text:"업로드 권한 동의" },
    { kind:"reply", from:"yt",   to:"web",  text:"authorization code" },
    { kind:"sync",  from:"core", to:"yt",   text:"code → access · refresh 토큰 교환" },
    { kind:"reply", from:"yt",   to:"core", text:"토큰 · 채널 목록" },
    { kind:"sync",  from:"core", to:"web",  text:"업로드 대상 채널 선택 요구" },
    { kind:"sync",  from:"streamer", to:"web", text:"채널 선택" },
    { kind:"store", from:"core", to:"pg",   text:"refresh token KMS 암호화 저장 · 대상 채널 · 연동 이력" },
    { kind:"reply", from:"pg",   to:"core", text:"커밋 완료" },
    { kind:"reply", from:"core", to:"web",  text:"연동 완료 — 업로드 가능" },
    { kind:"note",  at:"pg", text:"refresh token은 평문으로 두지 않는다. ④ PostgreSQL 항목에 KMS 암호화로 못 박혀 있다. 업로드 워커도 이 토큰을 직접 들고 있지 않고 필요할 때 받아 쓴다." },
    { kind:"note", at:"core", text:"연동은 스트리머의 유튜브 채널에 대한 것이다. 편집자가 그 채널로 올릴 수 있는지는 별개의 권한 단계이며 Gate가 판정한다(ADR-012)." }
  ],
  notes: [
    "업로드는 기본 비공개로 올라간다(ADR-010). 연동 시점에 그 정책이 바뀌지는 않는다."
  ]
},

"SEQ-LINK-03": {
  title: "유튜브 토큰 만료 · 철회와 재인증 (실패 · 복구)",
  trigger: "업로드 도중 토큰이 거부된다",
  purpose: "권한이 사라졌을 때 작업을 잃지 않고 사람에게 넘기는 경로. " +
           "무조건 재시도하지 않는 이유를 보인다.",
  relatedUcIds: ["UC-03", "UC-27"],
  relatedIaNodeIds: ["ia-link", "ia-upstatus"],
  relatedServiceIds: ["cm-link", "mk-upload", "ex-yt"],
  relatedComponentIds: ["w-upload", "core", "pg", "web", "ex-yt"],
  participants: P(["wupload", "core", "pg", "yt", "web"]),
  steps: [
    { kind:"sync",  from:"wupload", to:"core", text:"업로드용 토큰 요청 (uploadAttemptId)" },
    { kind:"store", from:"core", to:"pg", text:"암호화된 refresh token 조회 · 복호화" },
    { kind:"sync",  from:"core", to:"yt", text:"access token 갱신" },

    { kind:"fragStart", type:"alt", label:"갱신 결과" },
    { kind:"fragCase", label:"성공" },
    { kind:"reply", from:"yt", to:"core", text:"access token" },
    { kind:"reply", from:"core", to:"wupload", text:"토큰 전달 — 업로드 계속" },

    { kind:"fragElse", label:"만료 · 철회 · 권한 취소" },
    { kind:"reply", from:"yt", to:"core", text:"invalid_grant" },
    { kind:"store", from:"core", to:"pg", text:"연동 상태를 재인증 필요로 표시 · audit_log" },
    { kind:"reply", from:"core", to:"wupload", text:"토큰 없음 — 재시도하지 말 것" },
    { kind:"self",  from:"wupload", text:"작업을 실패로 끝내지 않고 재인증 대기로 보류" },
    { kind:"note",  at:"wupload", text:"여기서 지수 백오프로 계속 두드려도 권한은 돌아오지 않는다. 사람이 다시 동의해야 풀리는 문제라 큐를 태우는 대신 멈춰 세운다." },
    { kind:"sync",  from:"core", to:"web", text:"업로드 상태에 '재인증 필요' 표시" },
    { kind:"sync",  from:"web", to:"core", text:"재인증 — SEQ-LINK-02 다시 수행" },
    { kind:"store", from:"core", to:"pg", text:"새 토큰 저장 · 보류된 작업 재개 표시" },
    { kind:"reply", from:"core", to:"wupload", text:"재개" },
    { kind:"fragEnd" },

    { kind:"note", at:"pg", text:"보류된 업로드는 uploadAttemptId 그대로 이어진다. 새 시도를 만들면 같은 클립이 두 번 올라갈 수 있다." }
  ],
  notes: [
    "성공 여부가 불명확한 상태에서의 복구는 다른 문제다 — SEQ-UP-05에서 채널 조회로 확정한다.",
    "이 흐름은 DLQ로 보내지 않는다. DLQ는 '재시도로 풀릴 수 있는 실패'를 위한 자리다(부록 A)."
  ]
}

});

/* ══════════════════════════════════════════════════════════════════════
   플러그인
══════════════════════════════════════════════════════════════════════ */
S.define({

"SEQ-PLUG-01": {
  title: "플러그인 설치 · Stream Key 등록 · 연결 테스트",
  trigger: "플러그인을 설치하고 처음 연결한다",
  purpose: "OBS와 서비스가 서로를 알아보게 되기까지. 방송 전에 문제를 " +
           "미리 드러내는 자리를 만든다.",
  relatedUcIds: ["UC-04"],
  relatedIaNodeIds: ["ia-plugin", "ia-download", "ia-set-plugin"],
  relatedServiceIds: ["ac-plugin", "rt-ingest", "cm-public"],
  relatedComponentIds: ["plugin", "web", "core", "pg", "media"],
  participants: P(["streamer", "web", "core", "pg", "plugin", "media"]),
  steps: [
    { kind:"sync",  from:"streamer", to:"web", text:"설정 › 플러그인 — Stream Key 발급" },
    { kind:"sync",  from:"web",  to:"core", text:"Stream Key 발급 요청" },
    { kind:"store", from:"core", to:"pg",   text:"Stream Key 생성 · 계정에 귀속" },
    { kind:"reply", from:"core", to:"web",  text:"Stream Key (1회 노출)" },
    { kind:"sync",  from:"streamer", to:"plugin", text:"플러그인에 Stream Key 입력" },
    { kind:"sync",  from:"plugin", to:"core", text:"연결 확인 (Stream Key)" },
    { kind:"store", from:"core", to:"pg",   text:"Key 검증 · 구독 상태 확인" },
    { kind:"reply", from:"core", to:"plugin", text:"확인 — 오디오 트랙 매핑 규칙 전달" },
    { kind:"self",  from:"plugin", text:"OBS 트랙 → 서비스 트랙 매핑 (영상 1 + 오디오 최대 10)" },

    { kind:"fragStart", type:"opt", label:"송출 테스트" },
    { kind:"sync",  from:"plugin", to:"media", text:"짧은 SRT 테스트 송출" },
    { kind:"reply", from:"media", to:"plugin", text:"수신 확인 · 트랙 인식 결과" },
    { kind:"note",  at:"media", text:"테스트는 방송 세션을 만들지 않는다. 수신 가능 여부와 트랙 매핑만 확인하고 끝난다." },
    { kind:"fragEnd" },

    { kind:"fragStart", type:"alt", label:"연결 상태" },
    { kind:"fragCase", label:"정상" },
    { kind:"async", from:"plugin", to:"core", text:"연결 상태 보고 — 송출 준비 완료" },
    { kind:"reply", from:"core", to:"web",    text:"설정 화면에 '연결됨' 표시" },
    { kind:"fragElse", label:"실패 (Key 오류 · 방화벽 · 버전 불일치)" },
    { kind:"reply", from:"core", to:"plugin", text:"실패 사유" },
    { kind:"note",  at:"plugin", text:"방송 시작 순간이 아니라 설정 단계에서 실패를 드러내는 것이 이 시퀀스의 목적이다." },
    { kind:"fragEnd" }
  ],
  notes: [
    "플러그인은 별도 로그인을 하지 않는다. Stream Key 자체가 인증 수단이다(② IA).",
    "설치 파일 배포는 공개 웹의 몫이다 — SEQ-PUB-01."
  ]
},

"SEQ-PLUG-02": {
  title: "핫키 수동 마킹 → 하이라이트 카드 승격",
  trigger: "방송 중 스트리머가 플러그인 전역 핫키를 누른다",
  purpose: "채팅이 조용해도 사람이 직접 하이라이트를 만드는 경로. " +
           "자동 카드와 같은 자리에 같은 모양으로 들어간다.",
  relatedUcIds: ["UC-12", "UC-20"],
  relatedIaNodeIds: ["ia-plugin", "ia-dash"],
  relatedServiceIds: ["ac-plugin", "rt-card", "rt-buffer"],
  relatedComponentIds: ["plugin", "core", "pg", "redis", "web"],
  participants: P(["streamer", "plugin", "core", "pg", "redis", "web"]),
  steps: [
    { kind:"sync",  from:"streamer", to:"plugin", text:"전역 핫키" },
    { kind:"self",  from:"plugin", text:"누른 시각을 로컬 타임라인에 기록" },
    { kind:"async", from:"plugin", to:"core", text:"수동 마킹 (broadcastId · 누른 시각)" },
    { kind:"self",  from:"core", text:"앞뒤 구간으로 확장 — 되감기 버퍼 안에 드는지 확인" },
    { kind:"store", from:"core", to:"pg", text:"수동 카드 + Outbox 한 트랜잭션 (멱등키: broadcastId + 누른 시각)" },
    { kind:"reply", from:"pg", to:"core", text:"커밋 완료" },
    { kind:"store", from:"core", to:"redis", text:"Outbox Dispatcher → Pub/Sub 팬아웃" },
    { kind:"async", from:"core", to:"web", text:"SSE — 카드 추가" },
    { kind:"note",  at:"web", text:"자동 카드(UC-14)와 같은 목록·같은 모양으로 들어간다. 다른 것은 만든 주체뿐이다." },

    { kind:"fragStart", type:"opt", label:"핫키를 연타한 경우" },
    { kind:"async", from:"plugin", to:"core", text:"수동 마킹 (거의 같은 시각)" },
    { kind:"self",  from:"core", text:"같은 멱등키 — 새 카드를 만들지 않고 무시" },
    { kind:"fragEnd" },

    { kind:"note", at:"plugin", text:"이 핫키는 우리 플러그인의 기능이지 플랫폼 기능이 아니다(① UC-12). OBS가 떠 있어야 동작한다." }
  ],
  notes: [
    "감지는 채팅 기반 서버의 몫이고 플러그인은 신호만 보낸다(③·④ 공통 규칙).",
    "원클릭 자동 업로드도 이 핫키에서 출발할 수 있다 — SEQ-UP-04."
  ]
}

});

/* ══════════════════════════════════════════════════════════════════════
   송출 · 라이브 시청
══════════════════════════════════════════════════════════════════════ */
S.define({

"SEQ-BC-01": {
  title: "송출 시작 — SRT 인제스트 · 트랙 분리 · CMAF 세그먼트",
  trigger: "플러그인에서 PokeClip 동시 송출을 시작한다",
  purpose: "영상이 실제로 들어와 저장되기까지. 방송 상태가 LIVE가 되는 조건이 " +
           "무엇인지, 되감기 1시간이 어디에서 나오는지를 보인다.",
  relatedUcIds: ["UC-11", "UC-04"],
  relatedIaNodeIds: ["ia-plugin", "ia-home"],
  relatedServiceIds: ["ac-plugin", "rt-ingest", "rt-buffer"],
  relatedComponentIds: ["plugin", "media", "core", "pg", "s3"],
  participants: P(["plugin", "core", "pg", "media", "s3"]),
  steps: [
    { kind:"sync",  from:"plugin", to:"core", text:"start (Stream Key · 트랙 구성)" },
    { kind:"self",  from:"core", text:"Stream Key 검증 · 구독/권한 확인" },
    { kind:"reply", from:"core", to:"plugin", text:"송출 승인 — SRT 접속 정보" },
    { kind:"sync",  from:"plugin", to:"media", text:"SRT 송출 (영상 1 + 오디오 최대 10트랙)" },
    { kind:"self",  from:"media", text:"트랙 분리 · monitor audio 생성" },
    { kind:"async", from:"media", to:"core", text:"SRT 인제스트 시작 보고" },
    { kind:"note",  at:"core", text:"LIVE 전이의 트리거는 'SRT 연결 + start' 둘 다다(부록 C). 승인만으로는 LIVE가 되지 않는다 — OBS가 실제로 붙어야 한다." },
    { kind:"store", from:"core", to:"pg", text:"방송 세션 LIVE 확정 (broadcastId · ingestEpoch)" },
    { kind:"reply", from:"pg", to:"core", text:"커밋 완료" },
    { kind:"note",  at:"core", text:"이 시점에 채팅 수집도 함께 켜진다 — SEQ-CHAT-01." },

    { kind:"fragStart", type:"loop", label:"세그먼트 주기마다 (송출하는 동안)" },
    { kind:"self",  from:"media", text:"CMAF 세그먼트화 (트랙별)" },
    { kind:"store", from:"media", to:"s3", text:"세그먼트 PUT — 라이브 1시간 롤링" },
    { kind:"reply", from:"s3", to:"media", text:"저장 완료" },
    { kind:"fragEnd" },

    { kind:"note", at:"s3", text:"되감기 버퍼는 따로 있는 저장소가 아니라 이 롤링 구간이다(ADR-004 DVR 1시간). 1시간이 지난 구간은 라이브에서 되감을 수 없다." },

    { kind:"fragStart", type:"loop", label:"주기적으로" },
    { kind:"async", from:"plugin", to:"core", text:"heartbeat" },
    { kind:"store", from:"core", to:"pg", text:"마지막 heartbeat 시각 갱신" },
    { kind:"fragEnd" },

    { kind:"note", at:"plugin", text:"heartbeat가 끊긴다고 바로 종료가 아니다 — SEQ-BC-02." }
  ],
  notes: [
    "저장 포맷은 CMAF 하나로 통일돼 있다(ADR-005). 라이브와 VOD가 같은 세그먼트를 쓴다.",
    "미디어 서버는 Go + FFmpeg다(④ 확정 스택)."
  ]
},

"SEQ-BC-02": {
  title: "heartbeat 단절과 재연결 유예 (순단 ≠ 종료)",
  trigger: "플러그인 heartbeat가 만료된다",
  purpose: "인터넷이 잠깐 끊긴 것과 방송을 끝낸 것을 구분하는 규칙. " +
           "잘못 끊으면 VOD가 조각나고 카드가 흩어진다.",
  relatedUcIds: ["UC-11"],
  relatedIaNodeIds: ["ia-plugin", "ia-home"],
  relatedServiceIds: ["rt-ingest"],
  relatedComponentIds: ["plugin", "core", "pg", "media", "web"],
  participants: P(["plugin", "core", "pg", "media", "web"]),
  steps: [
    { kind:"self",  from:"core", text:"heartbeat 만료 감지" },
    { kind:"store", from:"core", to:"pg", text:"방송 상태 LIVE → RECONNECTING (유예 시작)" },
    { kind:"async", from:"core", to:"web", text:"SSE — '재연결 중' 표시" },
    { kind:"note",  at:"core", text:"부록 C의 방송 상태다. 채팅 수집기 자신의 상태(COLLECTOR_RECONNECTING)와 이름이 다르다 — 섞지 않는다." },

    { kind:"fragStart", type:"alt", label:"유예 시간 안에 돌아오는가" },
    { kind:"fragCase", label:"돌아온다 — 순단이었다" },
    { kind:"sync",  from:"plugin", to:"core", text:"heartbeat 재개 (같은 broadcastId)" },
    { kind:"sync",  from:"plugin", to:"media", text:"SRT 재연결" },
    { kind:"store", from:"core", to:"pg", text:"RECONNECTING → LIVE 복귀" },
    { kind:"async", from:"core", to:"web", text:"SSE — 정상 표시" },
    { kind:"note",  at:"media", text:"끊긴 동안의 영상은 없다. 세그먼트 타임라인에 공백이 남고, 그 공백은 숨기지 않는다." },

    { kind:"fragElse", label:"돌아오지 않는다 — 비정상 종료로 확정" },
    { kind:"self",  from:"core", text:"유예 만료 → ENDING 확정" },
    { kind:"note",  at:"core", text:"이후는 SEQ-VOD-01(파이널라이즈)과 SEQ-CHAT-05(수집 종료)로 이어진다. 두 흐름 모두 '정상 stop'과 같은 지점에서 합류한다." },
    { kind:"fragEnd" },

    { kind:"fragStart", type:"opt", label:"유예가 끝난 뒤에 플러그인이 돌아온 경우" },
    { kind:"sync",  from:"plugin", to:"core", text:"heartbeat (이미 종료된 broadcastId)" },
    { kind:"reply", from:"core", to:"plugin", text:"이 방송은 끝났다 — 새 방송으로 시작하라" },
    { kind:"note",  at:"plugin", text:"끝난 방송을 되살리지 않는다. 되살리면 VOD 확정과 카드 소속이 어긋난다." },
    { kind:"fragEnd" }
  ],
  notes: [
    "유예 길이는 '얼마나 빨리 VOD를 확정하는가'와 '순단을 얼마나 참아주는가'의 맞바꿈이다.",
    "명시적 stop은 유예 없이 즉시 ENDING이다(부록 C)."
  ]
},

"SEQ-BC-03": {
  title: "라이브 시청과 되감기 (LL-HLS · 서명 URL)",
  trigger: "웹 앱에서 방송을 연다",
  purpose: "영상이 시청자 화면까지 오는 경로와, 원본이 직접 노출되지 않게 하는 장치.",
  relatedUcIds: ["UC-18"],
  relatedIaNodeIds: ["ia-live", "ia-dash"],
  relatedServiceIds: ["rt-play", "rt-buffer", "ac-web"],
  relatedComponentIds: ["web", "cdn", "media", "s3", "core"],
  participants: P(["web", "core", "cdn", "media", "s3"]),
  steps: [
    { kind:"sync",  from:"web",  to:"core", text:"재생 요청 (broadcastId)" },
    { kind:"self",  from:"core", text:"시청 권한 확인 — 소유자 · 승인된 편집자" },
    { kind:"reply", from:"core", to:"web",  text:"매니페스트 URL + 서명 (짧은 만료)" },
    { kind:"sync",  from:"web",  to:"cdn",  text:"매니페스트 요청 (서명 URL)" },
    { kind:"sync",  from:"cdn",  to:"media",text:"오리진 조회 — LL-HLS 매니페스트" },
    { kind:"reply", from:"media",to:"cdn",  text:"매니페스트" },
    { kind:"reply", from:"cdn",  to:"web",  text:"매니페스트 (캐시)" },

    { kind:"fragStart", type:"loop", label:"세그먼트마다" },
    { kind:"sync",  from:"web", to:"cdn", text:"세그먼트 요청" },
    { kind:"fragStart", type:"alt", label:"캐시 여부" },
    { kind:"fragCase", label:"캐시 적중" },
    { kind:"reply", from:"cdn", to:"web", text:"세그먼트" },
    { kind:"fragElse", label:"미적중" },
    { kind:"store", from:"cdn", to:"s3", text:"세그먼트 읽기" },
    { kind:"reply", from:"s3", to:"cdn", text:"세그먼트" },
    { kind:"fragEnd" },
    { kind:"fragEnd" },

    { kind:"note", at:"cdn", text:"서명 URL 없이는 S3 원본에 직접 닿지 못한다(④ 재생 딜리버리). CDN은 ⑤ 클라우드 아키텍처에서 상세해진다." },

    { kind:"fragStart", type:"opt", label:"되감기" },
    { kind:"sync",  from:"web", to:"cdn", text:"과거 시점 세그먼트 요청" },
    { kind:"fragStart", type:"alt", label:"1시간 롤링 안인가" },
    { kind:"fragCase", label:"안에 있다" },
    { kind:"reply", from:"cdn", to:"web", text:"세그먼트 — 되감기 재생" },
    { kind:"fragElse", label:"밖이다" },
    { kind:"reply", from:"cdn", to:"web", text:"없음" },
    { kind:"note",  at:"web", text:"1시간을 넘긴 구간은 방송 중에는 볼 수 없다. 방송이 끝나 VOD가 확정되면 60일 동안 다시 볼 수 있다(SEQ-VOD-02)." },
    { kind:"fragEnd" },
    { kind:"fragEnd" }
  ],
  notes: [
    "되감기 버퍼(③ rt-buffer)는 별도 저장소가 아니라 S3의 1시간 롤링 구간이다.",
    "라이브 대시보드의 카드·채팅량은 이 영상과 별개 경로로 온다 — SEQ-SSE-01."
  ]
}

});

/* ══════════════════════════════════════════════════════════════════════
   채팅 수집 (UC-13 파일럿에서 만든 다섯 흐름)
══════════════════════════════════════════════════════════════════════ */
S.define({

"SEQ-CHAT-01": {
  title: "방송 시작과 채팅 수집 활성화",
  trigger: "스트리머가 OBS 플러그인에서 송출을 시작한다",
  purpose: "방송 하나당 채팅 수집기 인스턴스가 정확히 하나만 활성화되어 " +
           "플랫폼 채팅 WebSocket에 연결되기까지. 중복 연결이 생기지 않는 근거를 보인다.",
  relatedUcIds: ["UC-13", "UC-11", "UC-02"],
  relatedIaNodeIds: ["ia-plugin", "ia-dash"],
  relatedServiceIds: ["rt-ingest", "rt-chat", "cm-link", "ex-chat"],
  relatedComponentIds: ["plugin", "core", "pg", "chat", "redis", "ex-chat"],
  participants: P(["plugin", "core", "pg", "chat", "redis", "plat"]),
  steps: [
    { kind:"sync",  from:"plugin", to:"core",  text:"송출 시작 (start) · Stream Key" },
    { kind:"self",  from:"core",               text:"Stream Key 검증 · 구독/권한 확인" },
    { kind:"reply", from:"core",   to:"plugin",text:"송출 승인 — SRT 접속 허용" },
    { kind:"self",  from:"core",               text:"미디어 서버의 SRT 인제스트 확인" },
    { kind:"note",  at:"core",     text:"LIVE 전이의 트리거는 'SRT 연결 + start' 둘 다다(부록 C). 승인만으로는 LIVE가 되지 않는다." },
    { kind:"store", from:"core",   to:"pg",    text:"방송 세션 LIVE 확정 (broadcastId · ingestEpoch)" },
    { kind:"reply", from:"pg",     to:"core",  text:"커밋 완료" },
    { kind:"async", from:"core",   to:"chat",  text:"수집 시작 명령 (broadcastId) — 멱등" },
    { kind:"sync",  from:"chat",   to:"core",  text:"수집 대상 채널 조회 (온보딩에서 등록한 채널)" },
    { kind:"reply", from:"core",   to:"chat",  text:"플랫폼 · 채널 식별자" },
    { kind:"store", from:"chat",   to:"redis", text:"SET lease:{broadcastId} = instanceId  NX EX 30" },

    { kind:"fragStart", type:"alt", label:"Lease 획득 결과" },
    { kind:"fragCase",  label:"획득 성공 — 이 인스턴스가 담당" },
    { kind:"reply", from:"redis", to:"chat",  text:"OK" },
    { kind:"fragStart", type:"opt", label:"SRT는 켜졌지만 플랫폼 본방이 아직 안 열린 경우 (ADR-011)" },
    { kind:"sync",  from:"chat",  to:"plat",  text:"라이브 여부 폴링" },
    { kind:"reply", from:"plat",  to:"chat",  text:"아직 미개시" },
    { kind:"self",  from:"chat",              text:"백오프 후 재시도 — 그동안에도 Lease는 계속 갱신" },
    { kind:"fragEnd" },
    { kind:"sync",  from:"chat",  to:"plat",  text:"채팅 WebSocket 연결 (치지직 공식 API · 실패 시 비공식 WS 폴백)" },
    { kind:"reply", from:"plat",  to:"chat",  text:"연결 수립 — 채팅 스트림 시작" },
    { kind:"fragStart", type:"loop", label:"10초마다 (수집하는 동안)" },
    { kind:"store", from:"chat",  to:"redis", text:"Lease TTL 연장 (소유자가 나일 때만)" },
    { kind:"fragEnd" },

    { kind:"fragElse",  label:"이미 다른 인스턴스가 보유" },
    { kind:"reply", from:"redis", to:"chat",  text:"NIL — 다른 instanceId 소유" },
    { kind:"self",  from:"chat",              text:"연결하지 않고 대기 — 중복 연결 없음" },
    { kind:"fragEnd" },

    { kind:"fragStart", type:"opt", label:"시작 명령이 유실됐거나 인스턴스가 재시작된 경우 — 주기적 재조정" },
    { kind:"sync",  from:"chat",  to:"core",  text:"활성 방송 목록 조회 (LIVE 상태)" },
    { kind:"reply", from:"core",  to:"chat",  text:"broadcastId 목록" },
    { kind:"store", from:"chat",  to:"redis", text:"담당자 없는 방송의 Lease 획득 시도" },
    { kind:"note",  at:"chat",    text:"명령 한 번이 유실돼도 수집이 스스로 복구된다. 명령은 최선 전달이고, 재조정이 최종 안전망이다." },
    { kind:"fragEnd" }
  ],
  notes: [
    "이 흐름에 Kafka는 없다. 시작 명령은 Core API의 내부 호출이고, 조율은 Redis Lease가 한다.",
    "SQS는 vod-finalize·자막·미리보기·렌더·업로드 다섯 작업 큐 전용이라 채팅 경로에 등장하지 않는다."
  ]
},

"SEQ-CHAT-02": {
  title: "정상 채팅 수집 · 집계 · 보관",
  trigger: "WebSocket으로 채팅 메시지가 들어온다",
  purpose: "메시지를 실시간 집계에 반영하고 원본을 배치로 보관하기까지. " +
           "Redis와 S3의 역할이 어떻게 갈리는지 보인다.",
  relatedUcIds: ["UC-13", "UC-19"],
  relatedIaNodeIds: ["ia-dash"],
  relatedServiceIds: ["rt-chat", "rt-detect", "ex-chat"],
  relatedComponentIds: ["chat", "redis", "detect", "s3", "ex-chat"],
  participants: P(["plat", "chat", "redis", "detect", "s3"]),
  steps: [
    { kind:"fragStart", type:"loop", label:"채팅 메시지마다" },
    { kind:"async", from:"plat",  to:"chat",  text:"채팅 메시지 (WebSocket)" },
    { kind:"self",  from:"chat",              text:"chatCollectorIngestedAt 기록" },
    { kind:"self",  from:"chat",              text:"정규화 — 플랫폼별 반응 시차 보정 후 인제스트 타임라인에 정렬" },
    { kind:"store", from:"chat",  to:"redis", text:"1초 버킷 증가 — 메시지 수 · 고유 채터 수 (TTL 부여)" },
    { kind:"self",  from:"chat",              text:"원본을 로컬 NDJSON 버퍼에 누적 (건당 S3 PUT 하지 않음)" },
    { kind:"fragEnd" },

    { kind:"fragStart", type:"loop", label:"감지기 주기 (독립적으로 계속)" },
    { kind:"store", from:"detect", to:"redis", text:"집계 버킷 읽기 — 롤링 베이스라인 · 멀티윈도우" },
    { kind:"reply", from:"redis",  to:"detect",text:"1초 버킷 시계열" },
    { kind:"fragEnd" },
    { kind:"note", at:"detect", text:"이 시퀀스는 감지기에 입력이 닿는 지점까지다. 피크 판정과 카드 생성은 SEQ-DET-01이다." },

    { kind:"fragStart", type:"loop", label:"30~60초마다" },
    { kind:"store", from:"chat", to:"s3",   text:"NDJSON 배치 PUT — 키: broadcastId / 날짜 / 윈도우 시작" },
    { kind:"reply", from:"s3",   to:"chat", text:"저장 완료" },
    { kind:"self",  from:"chat",            text:"버퍼 비움 (실패하면 비우지 않고 다음 주기에 재시도)" },
    { kind:"fragEnd" },

    { kind:"note", at:"redis", text:"Redis = 실시간 집계·임시 상태. Source of Truth가 아니다. " +
      "S3 = 원본 채팅 아카이브. Redis가 통째로 사라져도 원본은 S3에 남고, 집계는 워밍업부터 다시 만든다." }
  ],
  notes: [
    "건당 S3 PUT을 하지 않는 이유는 요청 비용과 오브젝트 수다. 배치 키에 윈도우 시작 시각을 넣어 재시도해도 같은 객체를 덮어쓴다.",
    "성능 목표는 서버가 통제하는 구간에만 건다 — 수집 시각 → 카드 표시 p95 2초."
  ]
},

"SEQ-CHAT-03": {
  title: "플랫폼 WebSocket 단절과 재연결",
  trigger: "치지직 / SOOP WebSocket이 끊긴다",
  purpose: "중복 수집을 만들지 않으면서 재연결하기까지. 누가 재연결할 자격이 있는지를 Lease로 판정한다.",
  relatedUcIds: ["UC-13"],
  relatedIaNodeIds: ["ia-dash"],
  relatedServiceIds: ["rt-chat", "ex-chat"],
  relatedComponentIds: ["chat", "redis", "core", "ex-chat"],
  participants: P(["plat", "chat", "redis", "core", "ops"]),
  steps: [
    { kind:"async", from:"plat", to:"chat",  text:"연결 끊김 (close · 하트비트 타임아웃)" },
    { kind:"self",  from:"chat",             text:"단절 감지 — 마지막 수집 시각 보존" },
    { kind:"store", from:"chat", to:"redis", text:"GET lease:{broadcastId} — 내가 아직 담당인가" },

    { kind:"fragStart", type:"alt", label:"Lease 소유 여부" },
    { kind:"fragCase", label:"내가 소유 — 재연결할 자격이 있다" },
    { kind:"reply", from:"redis", to:"chat", text:"instanceId = 나" },
    { kind:"store", from:"chat", to:"redis", text:"수집기 상태 COLLECTOR_RECONNECTING · lastIngestedAt 기록" },
    { kind:"fragStart", type:"loop", label:"지수 백오프 (1s → 2s → 4s … 상한까지)" },
    { kind:"sync",  from:"chat", to:"plat",  text:"재연결 시도" },
    { kind:"store", from:"chat", to:"redis", text:"Lease TTL 연장 — 재연결 중에도 담당권 유지" },
    { kind:"fragEnd" },

    { kind:"fragStart", type:"alt", label:"재연결 결과" },
    { kind:"fragCase", label:"성공" },
    { kind:"reply", from:"plat", to:"chat", text:"연결 수립" },
    { kind:"self",  from:"chat",            text:"수집 재개 — 수집기 상태 COLLECTING으로 복귀" },
    { kind:"fragStart", type:"opt", label:"플랫폼이 메시지 ID를 주는 경우" },
    { kind:"self", from:"chat", text:"메시지 ID로 중복 제거" },
    { kind:"fragEnd" },
    { kind:"note", at:"chat", text:"메시지 ID가 없을 때의 확정 정책 — 배치 객체 키(broadcastId + 윈도우 시작)가 멱등이라 " +
      "S3 아카이브에는 중복 객체가 생기지 않는다. 재연결 구간의 집계 중복 가능성은 감지기의 멀티윈도우 합의와 롤링 " +
      "베이스라인이 흡수한다. 메시지 단위 중복 제거는 아직 미확정(TBD)이며, 플랫폼의 과거 메시지 Replay는 가정하지 않는다." },

    { kind:"fragElse", label:"실패가 임계치를 넘음" },
    { kind:"async", from:"chat", to:"ops",  text:"경보 — 재연결 실패 N회 · 방송 식별자 포함" },
    { kind:"sync",  from:"chat", to:"core", text:"수집 중단 상태 보고" },
    { kind:"note",  at:"core", text:"화면에는 '자동 감지 일시 중단 · 핫키로 계속 표시 가능'으로 알린다. 방송 자체는 계속된다." },
    { kind:"fragEnd" },

    { kind:"fragElse", label:"내가 소유가 아님 (인계된 뒤)" },
    { kind:"reply", from:"redis", to:"chat", text:"다른 instanceId" },
    { kind:"self",  from:"chat",             text:"재연결하지 않고 정리 — 중복 수집 방지" },
    { kind:"fragEnd" }
  ],
  notes: [
    "여기서 바꾸는 것은 수집기 자신의 상태다. 방송 상태(LIVE·RECONNECTING·ENDING)는 부록 C의 이름이고 Core API가 PostgreSQL에 기록한다 — 이름을 섞지 않는다.",
    "외부 API의 Replay·과거 메시지 조회 기능은 근거가 없어 가정하지 않는다."
  ]
},

"SEQ-CHAT-04": {
  title: "채팅 수집기 장애와 Lease 인계",
  trigger: "수집 중인 인스턴스가 죽거나 멈춘다",
  purpose: "다른 인스턴스가 수집을 이어받기까지. 무엇이 유실되고 무엇이 유실되지 않는지 숨기지 않는다.",
  relatedUcIds: ["UC-13"],
  relatedIaNodeIds: ["ia-dash"],
  relatedServiceIds: ["rt-chat"],
  relatedComponentIds: ["chat", "redis", "core", "ex-chat"],
  participants: P(["chatA", "redis", "chatB", "core", "plat"]),
  steps: [
    { kind:"store", from:"chatA", to:"redis", text:"Lease TTL 연장 (정상 동작 중)" },
    { kind:"self",  from:"chatA",             text:"프로세스 다운 또는 정지 — 갱신 중단" },

    { kind:"fragStart", type:"opt", label:"TTL이 아직 남아 있는 동안" },
    { kind:"store", from:"chatB", to:"redis", text:"SET lease:{broadcastId} NX — 획득 시도" },
    { kind:"reply", from:"redis", to:"chatB", text:"NIL — A의 Lease가 유효" },
    { kind:"note",  at:"redis", text:"TTL이 남아 있으면 어떤 인스턴스도 탈취하지 않는다. 이 구간(최대 TTL)은 수집 공백이고, 그동안의 채팅은 복구되지 않는다." },
    { kind:"fragEnd" },

    { kind:"self",  from:"redis",             text:"TTL 만료 — Lease 소멸" },
    { kind:"store", from:"chatB", to:"redis", text:"SET lease:{broadcastId} = B  NX EX 30" },
    { kind:"reply", from:"redis", to:"chatB", text:"OK — B가 담당" },
    { kind:"sync",  from:"chatB", to:"core",  text:"이 방송이 아직 LIVE인가 재확인" },
    { kind:"reply", from:"core",  to:"chatB", text:"LIVE (broadcastId · ingestEpoch)" },
    { kind:"sync",  from:"chatB", to:"plat",  text:"채팅 WebSocket 연결" },
    { kind:"reply", from:"plat",  to:"chatB", text:"연결 수립 — 수집 재개" },

    { kind:"fragStart", type:"opt", label:"A가 죽은 게 아니라 멈췄다가 뒤늦게 복구된 경우 — 중복 수집 위험 구간" },
    { kind:"store", from:"chatA", to:"redis", text:"쓰기·갱신 전 Lease 소유 재확인" },
    { kind:"reply", from:"redis", to:"chatA", text:"instanceId = B" },
    { kind:"self",  from:"chatA",             text:"즉시 연결 종료 · 버퍼 폐기 — 중복 수집 차단" },
    { kind:"note",  at:"chatA", text:"완화 방법은 '모든 쓰기 전에 소유권을 확인한다'는 규칙이다. 확인과 쓰기 사이의 아주 짧은 창은 남으며, 그 구간의 중복은 집계에만 영향을 준다." },
    { kind:"fragEnd" },

    { kind:"note", at:"chatB", text:"유실되는 것 — A가 마지막 배치 이후 버퍼에 들고 있던 원본과, 공백 구간의 메시지. " +
      "유실되지 않는 것 — 이미 S3에 올라간 배치와 PostgreSQL의 방송 상태." },
    { kind:"note", at:"redis", text:"이것은 수집기 장애다. Redis 장애는 다른 사건이다 — primary가 죽으면 replica가 자동 승격하고, " +
      "복제 지연분이 유실될 수 있으며 감지는 워밍업부터 다시 시작한다(부록 A · ADR-013)." }
  ],
  notes: [
    "TTL은 '얼마나 빨리 인계하는가'와 '얼마나 중복을 막는가'의 맞바꿈이다. 짧으면 공백이 줄고 탈취 위험이 오른다.",
    "장애 구간의 메시지를 플랫폼에서 되받아오는 것은 가정하지 않는다."
  ]
},

"SEQ-CHAT-05": {
  title: "방송 종료와 아카이브 최종 Flush",
  trigger: "명시적 stop, 또는 heartbeat 만료 후 재연결 유예 실패",
  purpose: "정상 종료와 비정상 단절을 구분해 확정하고, 남은 원본을 잃지 않고 수집을 닫기까지.",
  relatedUcIds: ["UC-13", "UC-11", "UC-15"],
  relatedIaNodeIds: ["ia-plugin", "ia-dash"],
  relatedServiceIds: ["rt-ingest", "rt-chat", "ar-vod"],
  relatedComponentIds: ["plugin", "core", "pg", "chat", "redis", "s3", "ex-chat"],
  participants: P(["plugin", "core", "pg", "chat", "plat", "redis", "s3"]),
  steps: [
    { kind:"fragStart", type:"alt", label:"종료 판정" },
    { kind:"fragCase", label:"정상 종료 — 플러그인의 명시적 stop" },
    { kind:"sync",  from:"plugin", to:"core", text:"stop (broadcastId)" },
    { kind:"self",  from:"core",              text:"즉시 ENDING으로 확정" },

    { kind:"fragElse", label:"비정상 단절 — heartbeat 만료" },
    { kind:"self",  from:"core", text:"heartbeat 만료 → RECONNECTING (유예 시작)" },
    { kind:"note",  at:"core",   text:"유예 안에 플러그인이 돌아오면 LIVE로 복귀하고 이 시퀀스는 진행하지 않는다. 순단은 방송 종료가 아니다." },
    { kind:"self",  from:"core", text:"유예 만료 · 재연결 없음 → ENDING으로 확정" },
    { kind:"fragEnd" },

    { kind:"store", from:"core", to:"pg",   text:"종료 판정을 ENDING으로 확정 기록 (같은 트랜잭션에 Outbox)" },
    { kind:"reply", from:"pg",   to:"core", text:"커밋 완료" },
    { kind:"async", from:"core", to:"chat", text:"수집 종료 명령 (broadcastId) — 멱등" },
    { kind:"sync",  from:"chat", to:"plat", text:"WebSocket 종료" },
    { kind:"store", from:"chat", to:"s3",   text:"잔여 NDJSON 최종 Flush (마지막 윈도우 키)" },

    { kind:"fragStart", type:"alt", label:"Flush 결과" },
    { kind:"fragCase", label:"성공" },
    { kind:"reply", from:"s3",   to:"chat",  text:"저장 완료" },
    { kind:"store", from:"chat", to:"redis", text:"Lease 해제 — 소유자가 나일 때만 DEL (아니면 건드리지 않는다)" },
    { kind:"note",  at:"redis",  text:"집계 버킷은 지우지 않고 TTL로 자연 만료시킨다. 종료 직후에도 채팅량 그래프를 그대로 볼 수 있어야 한다." },

    { kind:"fragElse", label:"실패" },
    { kind:"self",  from:"chat", text:"버퍼 유지 · 재시도 예약 — Lease도 놓지 않는다" },
    { kind:"note",  at:"chat",   text:"Lease를 쥔 채로 남겨야 다른 인스턴스가 같은 방송을 건드리지 않고, 재시도 주체가 하나로 유지된다. 반복 실패는 경보 대상이다." },
    { kind:"fragEnd" },

    { kind:"fragStart", type:"opt", label:"종료 명령이 중복 전달된 경우" },
    { kind:"async", from:"core", to:"chat", text:"수집 종료 명령 (재전송)" },
    { kind:"self",  from:"chat",           text:"이미 종료됨 — 무시 (멱등)" },
    { kind:"fragEnd" }
  ],
  notes: [
    "정상 종료는 즉시, 비정상 단절은 유예를 거친 뒤에만 종료로 확정한다(부록 C 상태 머신).",
    "ENDING 전이는 vod-finalize 작업 발행도 함께 일으킨다(발행은 Core API) — 그 이후는 SEQ-VOD-01이다."
  ]
}

});

/* ══════════════════════════════════════════════════════════════════════
   감지 · 실시간 갱신
══════════════════════════════════════════════════════════════════════ */
S.define({

"SEQ-DET-01": {
  title: "채팅 피크 감지 → 카드 자동 생성 → 화면 반영",
  trigger: "채팅 집계에서 피크가 판정된다",
  purpose: "감지 결과가 카드가 되어 화면에 뜨기까지. 카드 저장과 이벤트 발행이 " +
           "어긋나지 않게 하는 장치(Outbox)를 보인다.",
  relatedUcIds: ["UC-14", "UC-20"],
  relatedIaNodeIds: ["ia-dash"],
  relatedServiceIds: ["rt-detect", "rt-card"],
  relatedComponentIds: ["detect", "redis", "core", "pg", "web"],
  participants: P(["detect", "redis", "core", "pg", "web"]),
  steps: [
    { kind:"store", from:"detect", to:"redis", text:"1초 버킷 시계열 읽기" },
    { kind:"reply", from:"redis", to:"detect", text:"메시지 수 · 고유 채터 수" },
    { kind:"self",  from:"detect", text:"롤링 베이스라인 대비 편차 계산" },
    { kind:"self",  from:"detect", text:"멀티윈도우 합의 — 여러 길이의 창이 같이 튀었는가" },

    { kind:"fragStart", type:"alt", label:"피크 판정" },
    { kind:"fragCase", label:"피크로 인정" },
    { kind:"sync",  from:"detect", to:"core", text:"카드 후보 (멱등키: broadcastId + detectorVersion + peakWindowStart)" },
    { kind:"store", from:"core", to:"pg", text:"카드 + Outbox 한 트랜잭션에 기록" },
    { kind:"reply", from:"pg", to:"core", text:"커밋 완료" },
    { kind:"note",  at:"pg", text:"카드를 저장했는데 이벤트만 유실되면 화면에 영영 안 뜬다. 반대로 이벤트만 나가면 없는 카드를 가리킨다. 그래서 같은 트랜잭션에 넣고, 발행은 커밋 뒤에 Dispatcher가 한다." },
    { kind:"store", from:"core", to:"redis", text:"Outbox Dispatcher → Pub/Sub 발행" },
    { kind:"async", from:"core", to:"web", text:"SSE — 카드 추가" },

    { kind:"fragElse", label:"같은 멱등키가 이미 있다" },
    { kind:"self", from:"core", text:"중복 — 새 카드를 만들지 않는다" },
    { kind:"note", at:"core", text:"감지기가 재시작해 같은 구간을 다시 판정해도 카드가 늘어나지 않는다. detectorVersion이 바뀌면 다른 카드로 본다 — 알고리즘이 달라진 것이기 때문이다." },

    { kind:"fragElse", label:"피크 아님" },
    { kind:"self", from:"detect", text:"넘어간다 — 베이스라인만 갱신" },
    { kind:"fragEnd" },

    { kind:"note", at:"web", text:"성능 목표는 수집 시각 → 카드 표시 p95 2초, 피크 감지 → 카드 표시 p95 1초. '장면 발생 → 3초'는 플랫폼 지연과 시청자 반응 시차가 끼어 서버가 보장할 수 없어 지표에서 뺐다." }
  ],
  notes: [
    "감지 입력은 채팅뿐이다. 영상·음성 분석은 확정된 바 없어 넣지 않는다(③ v2.1).",
    "수동 핫키 카드도 같은 목록에 같은 모양으로 들어간다 — SEQ-PLUG-02."
  ]
},

"SEQ-DET-02": {
  title: "워밍업 · 오탐 억제와 감지 중단 (실패)",
  trigger: "방송 초반이거나 집계 입력이 끊긴다",
  purpose: "감지기가 언제 판정을 미루고 언제 멈추는지. 조용히 틀리는 대신 " +
           "조용히 쉬는 쪽을 고른 이유를 보인다.",
  relatedUcIds: ["UC-14"],
  relatedIaNodeIds: ["ia-dash", "ia-status"],
  relatedServiceIds: ["rt-detect"],
  relatedComponentIds: ["detect", "redis", "core", "web"],
  participants: P(["detect", "redis", "core", "ops", "web"]),
  steps: [
    { kind:"store", from:"detect", to:"redis", text:"집계 버킷 읽기" },

    { kind:"fragStart", type:"alt", label:"감지기 상태" },
    { kind:"fragCase", label:"워밍업 중 — 베이스라인이 아직 없다" },
    { kind:"self", from:"detect", text:"카드 발행 보류 — 통계만 쌓는다" },
    { kind:"note", at:"detect", text:"방송 시작 직후에는 '평소'가 없다. 이때 낸 카드는 대부분 오탐이라 발행을 미룬다. 그 구간은 핫키(UC-12)로 메운다." },

    { kind:"fragElse", label:"집계가 비어 있다 — 수집이 끊겼다" },
    { kind:"reply", from:"redis", to:"detect", text:"최근 버킷 없음" },
    { kind:"self",  from:"detect", text:"감지 일시 중단 — 0을 '조용한 방송'으로 오해하지 않는다" },
    { kind:"async", from:"detect", to:"ops",  text:"경보 — 입력 단절" },
    { kind:"sync",  from:"detect", to:"core", text:"감지 중단 상태 보고" },
    { kind:"async", from:"core", to:"web", text:"SSE — '자동 감지 일시 중단 · 핫키로 계속 표시 가능'" },
    { kind:"note",  at:"web", text:"방송은 계속된다. 없어진 것은 자동 감지뿐이고, 화면은 그 사실을 감추지 않는다." },

    { kind:"fragElse", label:"Redis가 통째로 비었다 (장애 복구 직후)" },
    { kind:"self", from:"detect", text:"베이스라인 폐기 · 워밍업부터 다시" },
    { kind:"note", at:"detect", text:"부록 A · ADR-013 — primary가 죽으면 replica가 자동 승격하고 복제 지연분은 유실될 수 있다. 원본 채팅은 S3에 남지만 집계는 다시 만든다." },
    { kind:"fragEnd" },

    { kind:"fragStart", type:"opt", label:"입력이 돌아온 뒤" },
    { kind:"self",  from:"detect", text:"워밍업 완료 후 감지 재개" },
    { kind:"sync",  from:"detect", to:"core", text:"감지 정상 보고" },
    { kind:"async", from:"core", to:"web", text:"SSE — 정상 표시" },
    { kind:"fragEnd" }
  ],
  notes: [
    "감지를 멈춰도 채팅 원본 보관(SEQ-CHAT-02)과 방송 자체는 계속된다. 세 가지는 서로 독립이다.",
    "기능별 공개 상태 표시는 SEQ-PUB-03이 맡는다."
  ]
},

"SEQ-SSE-01": {
  title: "실시간 갱신 — 다중 서버 SSE 팬아웃",
  trigger: "웹 앱이 라이브 대시보드를 연다",
  purpose: "카드·채팅량·상태가 새로고침 없이 갱신되는 경로. Core API가 여러 대일 때 " +
           "어느 서버에 붙어도 같은 이벤트를 받는 이유를 보인다.",
  relatedUcIds: ["UC-19", "UC-20"],
  relatedIaNodeIds: ["ia-live", "ia-dash"],
  relatedServiceIds: ["rt-card", "ac-web"],
  relatedComponentIds: ["web", "core", "redis"],
  participants: P(["web", "core", "redis", "detect"]),
  steps: [
    { kind:"sync",  from:"web", to:"core", text:"대시보드 진입 — 현재 상태 REST 조회" },
    { kind:"reply", from:"core", to:"web", text:"카드 목록 · 채팅량 스냅샷 · 방송 상태" },
    { kind:"sync",  from:"web", to:"core", text:"SSE 구독 (broadcastId)" },
    { kind:"store", from:"core", to:"redis", text:"이 방송 채널 구독 (Pub/Sub)" },
    { kind:"note",  at:"core", text:"브라우저는 Core API 여러 대 중 아무 한 대에 붙는다. 이벤트를 만든 서버와 다른 서버일 수 있어, 팬아웃을 Redis Pub/Sub이 맡는다." },

    { kind:"fragStart", type:"loop", label:"이벤트가 생길 때마다" },
    { kind:"sync",  from:"detect", to:"core", text:"카드 후보 (다른 인스턴스에 도착)" },
    { kind:"store", from:"core", to:"redis", text:"Outbox Dispatcher → 채널에 발행" },
    { kind:"reply", from:"redis", to:"core", text:"구독 중인 모든 인스턴스로 전달" },
    { kind:"async", from:"core", to:"web", text:"SSE — 카드 추가 · 채팅량 갱신 · 상태 변경" },
    { kind:"fragEnd" },

    { kind:"note", at:"redis", text:"Pub/Sub은 보관하지 않는다. 끊긴 동안의 이벤트는 다시 오지 않으므로, 복구는 REST 스냅샷으로 한다 — SEQ-SSE-02." },
    { kind:"note", at:"web", text:"화면에 처음 그리는 값은 항상 REST 스냅샷이다. SSE는 그 위에 얹는 증분이다. 순서를 뒤집으면 새로고침마다 화면이 비어 보인다." }
  ],
  notes: [
    "Redis는 여기서도 Source of Truth가 아니다. 카드의 원본은 PostgreSQL이다.",
    "지금 구성에 Kafka는 없다. 이벤트 다중 소비·재처리가 필요해지는 성장기의 이야기다 — SEQ-GROW-01."
  ]
},

"SEQ-SSE-02": {
  title: "SSE 끊김과 REST 스냅샷 복구 (실패 · 복구)",
  trigger: "SSE 연결이 끊기거나 Redis Pub/Sub이 멈춘다",
  purpose: "실시간 경로가 죽어도 화면이 거짓말하지 않게 하는 방법. " +
           "'모르는 상태'를 '정상'으로 그리지 않는다.",
  relatedUcIds: ["UC-19", "UC-20"],
  relatedIaNodeIds: ["ia-dash"],
  relatedServiceIds: ["rt-card", "ac-web"],
  relatedComponentIds: ["web", "core", "redis", "pg"],
  participants: P(["web", "core", "redis", "pg"]),
  steps: [
    { kind:"self",  from:"web", text:"SSE 끊김 감지" },
    { kind:"self",  from:"web", text:"화면에 '실시간 연결 끊김' 표시 — 마지막 갱신 시각 함께" },
    { kind:"note",  at:"web", text:"끊긴 걸 숨기고 옛 화면을 그대로 두면 사용자는 '조용한 방송'으로 오해한다. 상태를 드러내는 쪽을 고른다." },

    { kind:"fragStart", type:"loop", label:"지수 백오프 재연결" },
    { kind:"sync",  from:"web", to:"core", text:"SSE 재구독" },
    { kind:"fragEnd" },

    { kind:"fragStart", type:"alt", label:"재연결 결과" },
    { kind:"fragCase", label:"성공" },
    { kind:"sync",  from:"web", to:"core", text:"REST 스냅샷 재조회 (끊긴 동안의 증분을 메운다)" },
    { kind:"store", from:"core", to:"pg", text:"카드 목록 · 방송 상태 조회" },
    { kind:"reply", from:"pg", to:"core", text:"현재 상태 (원본)" },
    { kind:"reply", from:"core", to:"web", text:"스냅샷" },
    { kind:"self",  from:"web", text:"스냅샷으로 덮어쓰고 정상 표시로 복귀" },
    { kind:"note",  at:"pg", text:"Pub/Sub은 놓친 이벤트를 되돌려주지 않는다. 그래서 복구는 반드시 원본(PostgreSQL) 스냅샷으로 한다." },

    { kind:"fragElse", label:"Redis Pub/Sub 자체가 죽었다" },
    { kind:"store", from:"core", to:"redis", text:"발행 실패" },
    { kind:"note",  at:"core", text:"카드는 PostgreSQL에 정상 저장돼 있고 Outbox에도 남아 있다. 팬아웃만 멈춘 것이라, 복구되면 화면은 스냅샷으로 다시 맞춰진다(부록 A)." },
    { kind:"sync",  from:"web", to:"core", text:"폴링 간격으로 REST 조회 (임시)" },
    { kind:"reply", from:"core", to:"web", text:"스냅샷" },
    { kind:"fragEnd" }
  ],
  notes: [
    "실시간이 죽어도 데이터는 잃지 않는다. 잃는 것은 '즉시성'뿐이다.",
    "이 원칙 때문에 화면의 첫 그림은 언제나 REST 스냅샷이다."
  ]
}

});

/* ══════════════════════════════════════════════════════════════════════
   VOD · 아카이브
══════════════════════════════════════════════════════════════════════ */
S.define({

"SEQ-VOD-01": {
  title: "방송 종료 → VOD 파이널라이즈 (매니페스트 확정)",
  trigger: "방송 상태가 ENDING으로 확정된다",
  purpose: "라이브 세그먼트가 VOD가 되기까지. 파일을 옮기지 않고 무엇을 " +
           "확정하는지, 왜 어느 인스턴스가 실행해도 같은지 보인다.",
  relatedUcIds: ["UC-15"],
  relatedIaNodeIds: ["ia-home", "ia-vod"],
  relatedServiceIds: ["ar-vod", "rt-ingest"],
  relatedComponentIds: ["core", "pg", "sqs", "media", "s3"],
  participants: P(["core", "pg", "sqs", "media", "s3"]),
  steps: [
    { kind:"store", from:"core", to:"pg", text:"ENDING 확정 + Outbox 한 트랜잭션" },
    { kind:"reply", from:"pg", to:"core", text:"커밋 완료" },
    { kind:"store", from:"core", to:"sqs", text:"vod-finalize-job 발행 (jobId = broadcastId + ingestEpoch)" },
    { kind:"note",  at:"sqs", text:"SQS 다섯 큐 중 하나다 — vod-finalize · subtitle · preview · render · upload. 각각 전용 DLQ가 붙는다." },
    { kind:"sync",  from:"media", to:"sqs", text:"작업 수신" },
    { kind:"store", from:"media", to:"pg", text:"방송 상태 · 구간 정보 조회" },
    { kind:"reply", from:"pg", to:"media", text:"broadcastId · ingestEpoch · 트랙 구성" },
    { kind:"store", from:"media", to:"s3", text:"세그먼트 목록 조회" },
    { kind:"reply", from:"s3", to:"media", text:"세그먼트 인덱스" },
    { kind:"note",  at:"media", text:"입력은 S3 세그먼트와 PostgreSQL 방송 상태뿐이다. 송출을 받던 인스턴스의 로컬 상태에 기대지 않으므로 어느 인스턴스가 실행해도 결과가 같다(④)." },
    { kind:"self",  from:"media", text:"VOD 매니페스트 확정 — 파일 이동·재인코딩 없음" },
    { kind:"store", from:"media", to:"s3", text:"VOD 매니페스트 PUT · 보관 60일 표시" },
    { kind:"sync",  from:"media", to:"core", text:"완료 보고 (REST)" },
    { kind:"store", from:"core", to:"pg", text:"VOD READY · 만료일 기록" },

    { kind:"fragStart", type:"opt", label:"같은 작업이 다시 배달된 경우" },
    { kind:"sync",  from:"media", to:"sqs", text:"작업 재수신 (같은 jobId)" },
    { kind:"self",  from:"media", text:"이미 READY — 같은 결과로 끝낸다 (멱등)" },
    { kind:"fragEnd" },

    { kind:"fragStart", type:"opt", label:"반복 실패" },
    { kind:"store", from:"sqs", to:"sqs", text:"vod-finalize DLQ로 이동" },
    { kind:"note",  at:"sqs", text:"DLQ에 남아도 원본 세그먼트는 S3에 그대로다. 재실행이 안전한 이유가 여기 있다." },
    { kind:"fragEnd" }
  ],
  notes: [
    "VOD 전환은 재인코딩이 아니라 매니페스트 확정이다(ADR-005). 그래서 빠르고, 실패해도 잃는 게 없다.",
    "발행 주체는 Core API고 소비 주체는 미디어 서버다 — 책임이 갈린다."
  ]
},

"SEQ-VOD-02": {
  title: "VOD 시청과 카드 챕터 이동",
  trigger: "보관된 방송을 다시 본다",
  purpose: "끝난 방송에서도 카드와 채팅량 그래프가 그대로 살아 있는 이유. " +
           "라이브와 같은 편집 진입점을 쓰는 것을 보인다.",
  relatedUcIds: ["UC-21", "UC-19"],
  relatedIaNodeIds: ["ia-vod"],
  relatedServiceIds: ["ar-vod", "rt-play", "rt-card"],
  relatedComponentIds: ["web", "cdn", "s3", "core", "pg"],
  participants: P(["web", "core", "pg", "cdn", "s3"]),
  steps: [
    { kind:"sync",  from:"web", to:"core", text:"VOD 열기 (broadcastId)" },
    { kind:"store", from:"core", to:"pg", text:"VOD 상태 · 카드 목록 · 만료일 조회" },
    { kind:"reply", from:"pg", to:"core", text:"READY · 카드 · 채팅량 시계열" },
    { kind:"reply", from:"core", to:"web", text:"매니페스트 서명 URL + 카드(챕터) + 그래프" },
    { kind:"note",  at:"core", text:"채팅량 그래프는 실시간 Redis 집계가 아니라 보관된 값으로 다시 그린다. Redis의 버킷은 이미 TTL로 사라졌을 수 있다." },
    { kind:"sync",  from:"web", to:"cdn", text:"세그먼트 요청 (서명 URL)" },
    { kind:"store", from:"cdn", to:"s3", text:"세그먼트 읽기 (미적중 시)" },
    { kind:"reply", from:"cdn", to:"web", text:"세그먼트" },

    { kind:"fragStart", type:"opt", label:"카드를 눌러 그 시점으로" },
    { kind:"self",  from:"web", text:"카드 = 챕터 — 해당 시점으로 이동" },
    { kind:"note",  at:"web", text:"라이브와 VOD의 편집 진입은 같다. 카드에서 바로 UC-22로 들어간다 — SEQ-EDIT-01." },
    { kind:"fragEnd" },

    { kind:"fragStart", type:"alt", label:"보관 기간" },
    { kind:"fragCase", label:"60일 안" },
    { kind:"reply", from:"core", to:"web", text:"재생 · 편집 · 재출력 모두 가능" },
    { kind:"fragElse", label:"만료됨" },
    { kind:"reply", from:"core", to:"web", text:"원본 없음 — 만료 안내" },
    { kind:"note",  at:"web", text:"만료 카드는 챕터로만 재활성화된다. 원본 세그먼트가 없으니 새로 렌더할 수는 없다 — SEQ-VOD-03." },
    { kind:"fragEnd" }
  ],
  notes: [
    "VOD 보관은 60일이다(ADR-004). 만료 임박은 알림 대상이다 — SEQ-NOTI-01.",
    "이미 완성된 클립은 별도 보관이라 VOD가 만료돼도 남는다(③ mk-store)."
  ]
},

"SEQ-VOD-03": {
  title: "VOD 60일 만료와 재출력 차단",
  trigger: "보관 기한이 다가오거나 지난다",
  purpose: "만료 전에 알리고, 만료 후에 무엇이 되고 무엇이 안 되는지를 " +
           "화면에서 명확히 갈라 주는 흐름.",
  relatedUcIds: ["UC-15", "UC-16", "UC-23"],
  relatedIaNodeIds: ["ia-vod", "ia-library"],
  relatedServiceIds: ["ar-vod", "cm-noti", "mk-render"],
  relatedComponentIds: ["core", "pg", "s3", "web"],
  participants: P(["core", "pg", "s3", "web", "streamer"]),
  steps: [
    { kind:"self",  from:"core", text:"만료 임박 판정 (주기 작업)" },
    { kind:"store", from:"core", to:"pg", text:"만료 임박 알림 생성" },
    { kind:"async", from:"core", to:"web", text:"알림 — 'VOD 만료 임박 · 필요한 구간은 지금 출력하세요'" },
    { kind:"note",  at:"web", text:"알림 종류별 on/off는 사용자 설정을 따른다(UC-08). 끈 사람에게는 가지 않는다." },

    { kind:"fragStart", type:"opt", label:"만료 전에 출력해 두는 경우" },
    { kind:"sync",  from:"streamer", to:"web", text:"필요한 구간 렌더 (SEQ-EDIT-04)" },
    { kind:"note",  at:"web", text:"완성된 클립은 VOD와 별도로 보관된다. 만료 뒤에도 남는다." },
    { kind:"fragEnd" },

    { kind:"self",  from:"core", text:"보관 기한 도달" },
    { kind:"store", from:"core", to:"s3", text:"VOD 세그먼트 수명 만료 (객체 수명 정책)" },
    { kind:"store", from:"core", to:"pg", text:"VOD 상태 EXPIRED · 카드는 남긴다" },

    { kind:"fragStart", type:"alt", label:"만료 뒤에 무엇을 할 수 있나" },
    { kind:"fragCase", label:"카드 열람 · 챕터 재활성화" },
    { kind:"reply", from:"core", to:"web", text:"가능 — 카드 메타는 PostgreSQL에 남아 있다" },
    { kind:"fragElse", label:"재출력 · 새 편집" },
    { kind:"reply", from:"core", to:"web", text:"불가 — 원본 세그먼트가 없다" },
    { kind:"note",  at:"core", text:"편집기에서 '열 수는 있는데 렌더만 실패'하는 상태를 만들지 않는다. 진입 시점에 막고 이유를 말한다." },
    { kind:"fragEnd" }
  ],
  notes: [
    "EXPIRED는 방송 상태 머신의 종착점이다(부록 C). ENDING은 종착점이 아니다.",
    "재출력 가능 기간은 VOD 보관 60일과 같다(③ mk-render)."
  ]
}

});

/* ══════════════════════════════════════════════════════════════════════
   편집 · 렌더 · 자산
══════════════════════════════════════════════════════════════════════ */
S.define({

"SEQ-EDIT-01": {
  title: "클립 편집 진입과 미리보기 자산 준비",
  trigger: "카드 또는 보관함 편집본에서 편집기로 들어간다",
  purpose: "편집 화면이 열리기까지. 미리보기가 서버 렌더 없이 되는 이유와, " +
           "그래도 워커가 필요한 자산이 무엇인지를 가른다.",
  relatedUcIds: ["UC-22", "UC-20"],
  relatedIaNodeIds: ["ia-clip", "ia-editor"],
  relatedServiceIds: ["mk-edit", "rt-card", "mk-store", "ac-web"],
  relatedComponentIds: ["web", "core", "pg", "sqs", "w-prev", "s3"],
  participants: P(["web", "core", "pg", "sqs", "wprev", "s3"]),
  steps: [
    { kind:"sync",  from:"web", to:"core", text:"편집 진입 (cardId 또는 clipProjectId)" },
    { kind:"self",  from:"core", text:"편집 권한 확인 — 소유자 · 승인된 편집자" },
    { kind:"store", from:"core", to:"pg", text:"카드 · 편집 레시피(JSONB) · 원본 구간 조회" },
    { kind:"reply", from:"pg", to:"core", text:"구간 · 트랙 구성 · 저장된 레시피" },
    { kind:"reply", from:"core", to:"web", text:"편집 상태 + 원본 세그먼트 서명 URL" },
    { kind:"note",  at:"web", text:"구간·트랙·비율 미리보기는 브라우저가 원본 세그먼트를 직접 재생하며 그린다. 서버 렌더를 태우지 않으므로 조작이 즉각적이다(③ mk-edit)." },

    { kind:"fragStart", type:"opt", label:"썸네일 · 웨이브폼이 아직 없는 경우" },
    { kind:"store", from:"core", to:"sqs", text:"preview-job 발행 (jobId 멱등)" },
    { kind:"sync",  from:"wprev", to:"sqs", text:"작업 수신" },
    { kind:"store", from:"wprev", to:"s3", text:"원본 구간 읽기" },
    { kind:"self",  from:"wprev", text:"썸네일 · 구간 웨이브폼 생성 (부산물 RMS로 무음 트랙 판별)" },
    { kind:"store", from:"wprev", to:"s3", text:"미리보기 자산 PUT (임시 산출물)" },
    { kind:"sync",  from:"wprev", to:"core", text:"완료 보고" },
    { kind:"store", from:"core", to:"pg", text:"자산 위치 · 무음 트랙 목록 기록" },
    { kind:"async", from:"core", to:"web", text:"웨이브폼 표시 · 무음 트랙 자동 숨김" },
    { kind:"note",  at:"wprev", text:"무음 트랙 숨김은 별도 기능이 아니라 웨이브폼 계산의 부산물이다. 한 번의 작업으로 둘 다 나온다." },
    { kind:"fragEnd" },

    { kind:"note", at:"pg", text:"편집 상태는 레시피(JSONB)로 저장한다 — 구간·트랙 on/off·볼륨·비율·자막 모드. 영상 자체를 복제하지 않는다(ADR-006)." }
  ],
  notes: [
    "구간은 5초~3분이다(① UC-22). 이 범위 밖은 편집기에서 애초에 못 만든다.",
    "AI 자막은 P2에 붙는 별도 흐름이다 — SEQ-EDIT-02."
  ]
},

"SEQ-EDIT-02": {
  title: "AI 자막 생성과 직접 수정 (P2)",
  trigger: "편집 중 자막 생성을 요청한다",
  purpose: "선택된 오디오 트랙만 STT에 태우는 경로와, 결과가 편집자의 손을 " +
           "거쳐 확정되는 과정. STT 엔진이 아직 미정인 것도 그대로 둔다.",
  relatedUcIds: ["UC-22"],
  relatedIaNodeIds: ["ia-editor"],
  relatedServiceIds: ["mk-stt", "mk-edit"],
  relatedComponentIds: ["web", "core", "sqs", "w-sub", "s3", "pg"],
  participants: P(["web", "core", "sqs", "wsub", "s3", "pg"]),
  steps: [
    { kind:"sync",  from:"web", to:"core", text:"자막 생성 요청 (clipProjectId · 대상 트랙)" },
    { kind:"store", from:"core", to:"sqs", text:"subtitle-job 발행 (jobId 멱등)" },
    { kind:"reply", from:"core", to:"web", text:"접수 — 비동기 처리" },
    { kind:"sync",  from:"wsub", to:"sqs", text:"작업 수신" },
    { kind:"store", from:"wsub", to:"s3", text:"선택된 트랙 구간만 읽기" },
    { kind:"self",  from:"wsub", text:"STT 수행" },
    { kind:"note",  at:"wsub", text:"엔진은 아직 미정(TBD)이다. 후보는 CPU whisper.cpp 또는 EC2 GPU Whisper이고, 관리형 STT는 ADR-013에서 의도적으로 배제했다. Fargate에 GPU가 있다고 전제하지 않는다." },
    { kind:"store", from:"wsub", to:"s3", text:"자막 파일 PUT" },
    { kind:"sync",  from:"wsub", to:"core", text:"완료 보고" },
    { kind:"store", from:"core", to:"pg", text:"자막 위치 · 상태 기록" },
    { kind:"async", from:"core", to:"web", text:"자막 표시 — 편집 가능 상태" },
    { kind:"sync",  from:"web", to:"core", text:"자막 직접 수정 · 3모드 선택 (번인+CC / 번인 / CC)" },
    { kind:"store", from:"core", to:"pg", text:"수정본 · 모드를 레시피에 반영" },

    { kind:"fragStart", type:"opt", label:"제목 추천" },
    { kind:"sync",  from:"web", to:"core", text:"자막 기반 제목 추천 요청" },
    { kind:"reply", from:"core", to:"web", text:"후보 제목" },
    { kind:"note",  at:"core", text:"추천이지 확정이 아니다. 업로드 제목은 사람이 고르거나 템플릿이 정한다(UC-24)." },
    { kind:"fragEnd" },

    { kind:"fragStart", type:"opt", label:"STT 실패" },
    { kind:"sync",  from:"wsub", to:"core", text:"실패 보고 (사유)" },
    { kind:"store", from:"sqs", to:"sqs", text:"재시도 초과 시 subtitle DLQ" },
    { kind:"async", from:"core", to:"web", text:"자막 없이 편집 계속 가능 — 실패 표시" },
    { kind:"note",  at:"web", text:"자막은 부가 기능이다. 실패해도 편집·렌더·업로드는 막지 않는다." },
    { kind:"fragEnd" }
  ],
  notes: [
    "자막 워커는 P2에서 새로 뜨는 유일한 실행 단위다(④). 나머지 P2 기능은 기존 Core 안의 확장이다.",
    "번인 자막은 렌더에서 굽는다 — SEQ-EDIT-04."
  ]
},

"SEQ-EDIT-03": {
  title: "편집본 저장 · 자동 임시 저장 · 불러오기",
  trigger: "편집 중이거나 보관함에서 편집본을 연다",
  purpose: "작업을 잃지 않게 하는 장치와, 저장되는 것이 영상이 아니라 " +
           "레시피라는 사실이 만드는 차이.",
  relatedUcIds: ["UC-23", "UC-22"],
  relatedIaNodeIds: ["ia-editor", "ia-library"],
  relatedServiceIds: ["mk-store", "mk-edit"],
  relatedComponentIds: ["web", "core", "pg", "s3"],
  participants: P(["web", "core", "pg", "s3"]),
  steps: [
    { kind:"fragStart", type:"loop", label:"편집 중 주기적으로" },
    { kind:"async", from:"web", to:"core", text:"자동 임시 저장 (레시피 델타)" },
    { kind:"store", from:"core", to:"pg", text:"임시 레시피 갱신 (JSONB)" },
    { kind:"fragEnd" },
    { kind:"note", at:"pg", text:"저장하는 것은 편집 지시(구간·트랙·볼륨·비율·자막 모드)뿐이다. 영상은 원본 세그먼트를 가리키기만 하므로 용량이 거의 들지 않고 저장이 빠르다." },

    { kind:"sync",  from:"web", to:"core", text:"명시적 저장 (이름 지정)" },
    { kind:"store", from:"core", to:"pg", text:"편집본 확정 저장 · 버전 기록" },
    { kind:"reply", from:"core", to:"web", text:"보관함에 표시" },

    { kind:"fragStart", type:"alt", label:"나중에 다시 열 때" },
    { kind:"fragCase", label:"원본 VOD가 아직 살아 있다 (60일 안)" },
    { kind:"store", from:"core", to:"pg", text:"레시피 + 원본 참조 조회" },
    { kind:"store", from:"core", to:"s3", text:"원본 세그먼트 존재 확인" },
    { kind:"reply", from:"core", to:"web", text:"편집 재개 · 재출력 가능" },

    { kind:"fragElse", label:"원본이 만료됐다" },
    { kind:"reply", from:"core", to:"web", text:"레시피는 있으나 원본 없음 — 열람만" },
    { kind:"note",  at:"web", text:"레시피가 남아 있어도 가리킬 원본이 없으면 다시 만들 수 없다. 이 사실을 여는 순간 말해 준다(SEQ-VOD-03)." },
    { kind:"fragEnd" },

    { kind:"fragStart", type:"opt", label:"이미 렌더된 산출물이 있는 경우" },
    { kind:"store", from:"core", to:"s3", text:"완성 클립 조회 (별도 보관)" },
    { kind:"reply", from:"core", to:"web", text:"기존 산출물 재사용 — 다시 굽지 않는다" },
    { kind:"fragEnd" }
  ],
  notes: [
    "완성 클립은 VOD와 수명이 다르다. VOD 60일이 지나도 이미 만든 클립은 남는다(③ mk-store).",
    "임시 저장과 명시적 저장을 나눈 이유는 '실수로 덮어쓰는 것'과 '창을 닫아 잃는 것'을 둘 다 막기 위해서다."
  ]
},

"SEQ-EDIT-04": {
  title: "렌더 출력 — 구간 · 트랙 · 비율 · 자막 굽기",
  trigger: "편집본을 실제 영상 파일로 만든다",
  purpose: "브라우저 미리보기가 실제 파일이 되는 지점. 렌더를 따로 떼어 " +
           "실행하는 이유(CPU 포화가 업로드를 막지 않게)를 보인다.",
  relatedUcIds: ["UC-22", "UC-23"],
  relatedIaNodeIds: ["ia-editor", "ia-library"],
  relatedServiceIds: ["mk-render", "mk-store"],
  relatedComponentIds: ["web", "core", "pg", "sqs", "w-render", "s3"],
  participants: P(["web", "core", "pg", "sqs", "wrender", "s3"]),
  steps: [
    { kind:"sync",  from:"web", to:"core", text:"렌더 요청 (clipProjectId)" },
    { kind:"store", from:"core", to:"pg", text:"레시피 확정 · renderVersion 부여" },
    { kind:"store", from:"core", to:"sqs", text:"render-job 발행 (jobId = clipProjectId + renderVersion)" },
    { kind:"reply", from:"core", to:"web", text:"접수 — 진행 상태로 표시" },
    { kind:"note",  at:"sqs", text:"렌더는 오래 걸린다. 그래서 render-jobs만 visibility timeout을 길게 잡는다(④ · 부록 A). 짧으면 처리 중인 작업이 다른 워커에 또 배달된다." },

    { kind:"sync",  from:"wrender", to:"sqs", text:"작업 수신" },
    { kind:"store", from:"wrender", to:"s3", text:"원본 세그먼트 · 자막 읽기" },
    { kind:"self",  from:"wrender", text:"구간 자르기 · 트랙 믹스 · 비율 변환 · 자막 번인 (FFmpeg)" },
    { kind:"store", from:"wrender", to:"s3", text:"완성 클립 PUT (별도 보관)" },
    { kind:"sync",  from:"wrender", to:"core", text:"완료 보고 (REST)" },
    { kind:"store", from:"core", to:"pg", text:"클립 자산 등록 · 상태 READY" },
    { kind:"async", from:"core", to:"web", text:"완료 표시 — 업로드 가능" },

    { kind:"fragStart", type:"opt", label:"같은 renderVersion으로 다시 요청" },
    { kind:"self", from:"core", text:"이미 산출물이 있다 — 다시 굽지 않고 그대로 돌려준다 (멱등)" },
    { kind:"note", at:"core", text:"레시피가 바뀌면 renderVersion이 올라가고 그때만 새로 굽는다. 같은 편집을 두 번 눌러도 CPU를 두 번 쓰지 않는다." },
    { kind:"fragEnd" },

    { kind:"note", at:"wrender", text:"렌더 워커와 업로드 워커를 같은 프로세스에 두지 않는 이유가 이것이다. 렌더가 CPU를 다 쓰는 동안에도 업로드는 나가야 한다(④)." }
  ],
  notes: [
    "번인 자막은 여기서 굽고, CC 자막은 업로드 시 유튜브에 따로 등록한다(ADR-010).",
    "실패 처리는 SEQ-EDIT-05다."
  ]
},

"SEQ-EDIT-05": {
  title: "렌더 실패 · 재시도 · DLQ (실패)",
  trigger: "렌더 워커가 작업에 실패한다",
  purpose: "실패를 조용히 삼키지 않고 사람이 볼 수 있는 곳까지 올리는 경로. " +
           "재시도로 풀리는 실패와 아닌 실패를 나눈다.",
  relatedUcIds: ["UC-23"],
  relatedIaNodeIds: ["ia-library", "ia-status"],
  relatedServiceIds: ["mk-render"],
  relatedComponentIds: ["sqs", "w-render", "core", "pg", "web"],
  participants: P(["sqs", "wrender", "core", "pg", "ops", "web"]),
  steps: [
    { kind:"sync",  from:"wrender", to:"sqs", text:"작업 수신" },
    { kind:"self",  from:"wrender", text:"렌더 실패 (원본 손상 · 자원 부족 · 프로세스 종료)" },

    { kind:"fragStart", type:"alt", label:"실패 성격" },
    { kind:"fragCase", label:"일시적 — 자원 부족 · 순단" },
    { kind:"self",  from:"wrender", text:"작업을 반환 (visibility timeout 만료)" },
    { kind:"fragStart", type:"loop", label:"최대 재시도 횟수까지" },
    { kind:"sync",  from:"wrender", to:"sqs", text:"재수신 · 재실행 (jobId 그대로 — 멱등)" },
    { kind:"fragEnd" },
    { kind:"note",  at:"sqs", text:"같은 jobId라 성공하면 결과가 하나만 남는다. 중간에 만들어진 부분 산출물은 임시 경로에 있고 수명 정책으로 사라진다." },

    { kind:"fragElse", label:"영속적 — 원본이 없거나 레시피가 깨졌다" },
    { kind:"store", from:"sqs", to:"sqs", text:"render DLQ로 이동" },
    { kind:"sync",  from:"wrender", to:"core", text:"실패 보고 (사유 · jobId)" },
    { kind:"store", from:"core", to:"pg", text:"클립 상태 FAILED · 사유 기록" },
    { kind:"async", from:"core", to:"web", text:"보관함에 실패 표시 — 사유와 재시도 버튼" },
    { kind:"async", from:"core", to:"ops", text:"DLQ 적체 경보" },
    { kind:"note",  at:"web", text:"사용자에게는 '실패했다'로 끝내지 않고 무엇 때문인지와 다음에 할 수 있는 것을 준다. 원본 만료라면 재시도해도 소용없다는 것까지 말한다." },
    { kind:"fragEnd" },

    { kind:"note", at:"ops", text:"DLQ는 큐마다 따로다(④ · 부록 A). 렌더가 막혀도 업로드·자막·미리보기 큐는 그대로 흐른다." }
  ],
  notes: [
    "재시도로 풀리지 않는 실패를 큐에 계속 두면 정상 작업까지 밀린다. 그래서 성격을 갈라 DLQ로 뺀다.",
    "업로드의 실패는 성격이 다르다 — 권한과 '불명확한 성공'이 얽힌다(SEQ-UP-05)."
  ]
},

"SEQ-EDIT-06": {
  title: "클립 · 편집본 삭제",
  trigger: "보관함에서 삭제한다",
  purpose: "우리가 지울 수 있는 것과 지울 수 없는 것의 경계. " +
           "삭제 이력을 남기는 이유를 보인다.",
  relatedUcIds: ["UC-28"],
  relatedIaNodeIds: ["ia-library"],
  relatedServiceIds: ["mk-store"],
  relatedComponentIds: ["web", "core", "pg", "s3"],
  participants: P(["web", "core", "pg", "s3"]),
  steps: [
    { kind:"sync",  from:"web", to:"core", text:"삭제 요청 (clipAssetId 또는 clipProjectId)" },
    { kind:"self",  from:"core", text:"삭제 권한 확인" },
    { kind:"store", from:"core", to:"pg", text:"삭제 상태 기록 · audit_log에 이력 append" },
    { kind:"reply", from:"pg", to:"core", text:"커밋 완료" },
    { kind:"store", from:"core", to:"s3", text:"산출물 객체 삭제 표시" },
    { kind:"reply", from:"core", to:"web", text:"보관함에서 제거" },

    { kind:"fragStart", type:"alt", label:"이미 유튜브에 올라간 클립인가" },
    { kind:"fragCase", label:"올라갔다" },
    { kind:"note", at:"core", text:"유튜브 영상은 우리가 지우지 않는다(① UC-28). 우리 쪽 사본과 편집본만 사라지고, 업로드 이력은 남는다." },
    { kind:"reply", from:"core", to:"web", text:"안내 — 유튜브에서는 직접 삭제해야 함" },
    { kind:"fragElse", label:"올라가지 않았다" },
    { kind:"self", from:"core", text:"우리 쪽만 정리하면 끝" },
    { kind:"fragEnd" },

    { kind:"fragStart", type:"opt", label:"진행 중인 작업이 있는 경우" },
    { kind:"self", from:"core", text:"렌더·업로드 작업 취소 표시 — 완료 보고가 와도 무시" },
    { kind:"note", at:"core", text:"이미 큐에 있는 작업을 물리적으로 빼내지는 않는다. 워커가 끝내고 보고할 때 '삭제됨'을 보고 결과를 버린다." },
    { kind:"fragEnd" }
  ],
  notes: [
    "삭제 이력은 audit_log에 남는다 — '누가 언제 무엇을 지웠는가'를 나중에 물을 수 있어야 한다(④ PostgreSQL).",
    "계정 삭제 시의 보관물 처리 정책은 아직 확정되지 않았다(TBD · SEQ-AUTH-02)."
  ]
}

});

/* ══════════════════════════════════════════════════════════════════════
   업로드 · 승인 · 템플릿
══════════════════════════════════════════════════════════════════════ */
S.define({

"SEQ-UP-01": {
  title: "유튜브 업로드 — 권한 2단 검사",
  trigger: "완성된 클립을 유튜브에 올린다",
  purpose: "권한을 두 번 확인하는 이유와, 그 사이에 무슨 일이 생길 수 있는지. " +
           "기본 비공개로 올라가는 정책이 어디에서 적용되는지 보인다.",
  relatedUcIds: ["UC-25"],
  relatedIaNodeIds: ["ia-upload", "ia-upstatus"],
  relatedServiceIds: ["mk-upload", "ac-web", "ex-yt"],
  relatedComponentIds: ["web", "core", "gate", "pg", "sqs", "w-upload", "ex-yt"],
  participants: P(["web", "core", "gate", "pg", "sqs", "wupload", "yt"]),
  steps: [
    { kind:"sync",  from:"web", to:"core", text:"업로드 요청 (clipAssetId · 제목 · 설명)" },
    { kind:"sync",  from:"core", to:"gate", text:"1차 검사 — 작업을 만들어도 되는가" },
    { kind:"store", from:"gate", to:"pg", text:"권한 단계 조회 (기본 / +직접 업로드 / +원클릭 자동)" },
    { kind:"reply", from:"pg", to:"gate", text:"권한 단계" },

    { kind:"fragStart", type:"alt", label:"1차 판정" },
    { kind:"fragCase", label:"직접 업로드 권한 있음" },
    { kind:"reply", from:"gate", to:"core", text:"통과" },
    { kind:"store", from:"core", to:"pg", text:"UploadAttempt 생성 (상태 QUEUED)" },
    { kind:"store", from:"core", to:"sqs", text:"upload-job 발행 (jobId = uploadAttemptId)" },
    { kind:"reply", from:"core", to:"web", text:"접수 — 업로드 상태 화면으로" },

    { kind:"fragElse", label:"권한 없음" },
    { kind:"reply", from:"gate", to:"core", text:"차단" },
    { kind:"note",  at:"core", text:"여기서 그냥 막지 않고 승인 대기함으로 보낸다 — SEQ-UP-02. 편집자의 작업이 버려지지 않게 하는 것이 핵심이다." },
    { kind:"fragEnd" },

    { kind:"sync",  from:"wupload", to:"sqs", text:"작업 수신" },
    { kind:"sync",  from:"wupload", to:"gate", text:"2차 검사 — 지금 이 순간에도 권한이 있는가" },
    { kind:"store", from:"gate", to:"pg", text:"권한 재조회 (판정 원본은 PostgreSQL)" },
    { kind:"note",  at:"gate", text:"큐에 들어간 뒤 실제 업로드까지 시간이 뜬다. 그 사이에 권한이 회수되면 1차 판정은 이미 낡았다. 그래서 업로드 직전에 다시 본다(④ 업로드 권한 Gate)." },

    { kind:"fragStart", type:"alt", label:"2차 판정" },
    { kind:"fragCase", label:"통과" },
    { kind:"sync",  from:"wupload", to:"core", text:"업로드용 토큰 요청 (SEQ-LINK-03)" },
    { kind:"reply", from:"core", to:"wupload", text:"access token" },
    { kind:"sync",  from:"wupload", to:"yt", text:"영상 업로드 — 기본 비공개" },
    { kind:"reply", from:"yt", to:"wupload", text:"videoId" },
    { kind:"fragStart", type:"opt", label:"CC 자막 모드인 경우" },
    { kind:"sync",  from:"wupload", to:"yt", text:"자막 트랙 등록" },
    { kind:"fragEnd" },
    { kind:"sync",  from:"wupload", to:"core", text:"완료 보고 (videoId)" },
    { kind:"store", from:"core", to:"pg", text:"UploadAttempt DONE · videoId · audit_log" },
    { kind:"async", from:"core", to:"web", text:"업로드 완료 표시" },

    { kind:"fragElse", label:"그 사이 권한이 회수됨" },
    { kind:"reply", from:"gate", to:"wupload", text:"차단" },
    { kind:"store", from:"core", to:"pg", text:"UploadAttempt BLOCKED · 사유 기록" },
    { kind:"async", from:"core", to:"web", text:"'권한이 회수되어 업로드하지 못했습니다' 표시" },
    { kind:"fragEnd" }
  ],
  notes: [
    "기본 비공개로 올린다(ADR-010). 공개 전환은 사람이 유튜브에서 한다.",
    "실패·불명확 성공의 복구는 SEQ-UP-05다. 여기서는 성공 경로와 권한 차단까지만 다룬다."
  ]
},

"SEQ-UP-02": {
  title: "권한 부족 → 업로드 승인 요청",
  trigger: "권한 없는 편집자가 업로드를 시도한다",
  purpose: "차단 대신 대기함으로 보내는 흐름. 편집자의 작업물이 " +
           "권한 때문에 버려지지 않게 하는 장치.",
  relatedUcIds: ["UC-29", "UC-25", "UC-26"],
  relatedIaNodeIds: ["ia-upload", "ia-approvals"],
  relatedServiceIds: ["mk-upload", "mk-approve", "cm-perm", "cm-noti"],
  relatedComponentIds: ["web", "core", "gate", "pg"],
  participants: P(["editor", "web", "core", "gate", "pg", "streamer"]),
  steps: [
    { kind:"sync",  from:"editor", to:"web", text:"업로드 시도" },
    { kind:"sync",  from:"web", to:"core", text:"업로드 요청" },
    { kind:"sync",  from:"core", to:"gate", text:"1차 검사" },
    { kind:"reply", from:"gate", to:"core", text:"차단 — 기본 권한만 보유" },
    { kind:"store", from:"core", to:"pg", text:"UploadApproval 생성 (대기) · 클립 참조 유지" },
    { kind:"reply", from:"core", to:"web", text:"'승인 대기함으로 보냈습니다' — 실패가 아님" },
    { kind:"note",  at:"core", text:"권한 3단계는 기본 / +직접 업로드 / +원클릭 자동이다(ADR-012). 기본 권한 편집자는 제작은 하되 업로드는 승인을 거친다." },
    { kind:"async", from:"core", to:"streamer", text:"알림 — 승인 요청 도착 (SEQ-NOTI-01)" },

    { kind:"fragStart", type:"opt", label:"대기 중에 권한이 회수된 경우" },
    { kind:"store", from:"core", to:"pg", text:"대기 중인 요청 무효 처리" },
    { kind:"async", from:"core", to:"editor", text:"'권한 회수로 요청이 무효화되었습니다'" },
    { kind:"note",  at:"pg", text:"① UC-29의 예외 흐름이다. 무효 처리를 안 하면 회수된 편집자의 요청이 나중에 승인돼 그대로 올라간다." },
    { kind:"fragEnd" },

    { kind:"note", at:"editor", text:"편집자가 만든 클립 자산은 그대로 남는다. 승인이 나면 다시 만들지 않고 그 산출물을 그대로 올린다 — SEQ-UP-03." }
  ],
  notes: [
    "원클릭 자동 업로드(UC-26)에서 권한이 부족할 때도 같은 자리로 온다.",
    "승인 대기함은 역할별로 다르게 보인다 — 편집자는 '내 요청', 스트리머는 '받은 요청'(② IA)."
  ]
},

"SEQ-UP-03": {
  title: "업로드 승인 / 반려 처리",
  trigger: "스트리머가 승인 대기함에서 요청을 처리한다",
  purpose: "승인이 실제 업로드로 이어지는 경로와, 승인 시점에 다시 " +
           "권한을 확인하는 이유.",
  relatedUcIds: ["UC-30"],
  relatedIaNodeIds: ["ia-approvals"],
  relatedServiceIds: ["mk-approve", "cm-noti"],
  relatedComponentIds: ["web", "core", "gate", "pg", "sqs"],
  participants: P(["streamer", "web", "core", "gate", "pg", "sqs"]),
  steps: [
    { kind:"sync",  from:"streamer", to:"web", text:"승인 대기함 열기" },
    { kind:"store", from:"core", to:"pg", text:"대기 목록 · 클립 미리보기 조회" },
    { kind:"reply", from:"core", to:"web", text:"요청 목록 + 미리보기" },
    { kind:"note",  at:"web", text:"판단 재료를 준다 — 무엇을 올리려는지 보지 않고 승인하게 두지 않는다(① UC-30)." },

    { kind:"fragStart", type:"alt", label:"처리" },
    { kind:"fragCase", label:"승인" },
    { kind:"sync",  from:"streamer", to:"web", text:"승인" },
    { kind:"sync",  from:"core", to:"gate", text:"승인자 자신의 권한 확인" },
    { kind:"reply", from:"gate", to:"core", text:"통과 — 채널 소유자" },
    { kind:"store", from:"core", to:"pg", text:"UploadApproval 승인 · UploadAttempt 생성 · audit_log" },
    { kind:"store", from:"core", to:"sqs", text:"upload-job 발행" },
    { kind:"async", from:"core", to:"web", text:"요청자에게 알림 — 승인됨" },
    { kind:"note",  at:"sqs", text:"여기서부터는 SEQ-UP-01의 2차 검사 이후와 같은 경로다. 승인은 '작업을 만들 자격'을 대신 주는 것이지 별도의 업로드 경로가 아니다." },

    { kind:"fragElse", label:"반려" },
    { kind:"sync",  from:"streamer", to:"web", text:"반려 (사유)" },
    { kind:"store", from:"core", to:"pg", text:"반려 기록 · 처리 이력 append" },
    { kind:"async", from:"core", to:"web", text:"요청자에게 알림 — 반려 · 사유" },
    { kind:"note",  at:"pg", text:"승인도 반려도 이력에 남는다. 나중에 '누가 올렸나'를 물을 수 있어야 한다(③ mk-approve · ④ audit_log)." },
    { kind:"fragEnd" }
  ],
  notes: [
    "승인 권한은 채널 소유자에게 있다. 편집자끼리 서로 승인해 주는 경로는 없다.",
    "권한 회수가 대기 중 요청을 무효화하는 규칙은 SEQ-UP-02·SEQ-COL-02에 있다."
  ]
},

"SEQ-UP-04": {
  title: "원클릭 자동 업로드 (템플릿 전제)",
  trigger: "핫키 또는 카드에서 원클릭을 누른다",
  purpose: "사람이 한 번 누르면 편집 화면 없이 업로드까지 가는 경로. " +
           "'무인 자동'이 아니라 '원클릭'인 이유를 분명히 한다.",
  relatedUcIds: ["UC-26", "UC-24"],
  relatedIaNodeIds: ["ia-upload", "ia-template"],
  relatedServiceIds: ["mk-tpl", "mk-upload", "mk-render", "mk-edit"],
  relatedComponentIds: ["web", "core", "gate", "pg", "sqs", "w-render", "w-upload"],
  participants: P(["web", "core", "gate", "pg", "sqs", "wrender", "wupload"]),
  steps: [
    { kind:"sync",  from:"web", to:"core", text:"원클릭 (cardId) — 카드 버튼 또는 플러그인 핫키" },
    { kind:"note",  at:"web", text:"사람의 클릭이 반드시 한 번 들어간다. 완전 무인 자동 업로드는 별도 개념으로 두지 않는다(ADR-012 · ① UC-26)." },
    { kind:"store", from:"core", to:"pg", text:"지정된 업로드 템플릿 조회" },

    { kind:"fragStart", type:"alt", label:"전제 조건" },
    { kind:"fragCase", label:"템플릿 없음" },
    { kind:"reply", from:"core", to:"web", text:"거절 — 템플릿을 먼저 지정하세요 (UC-24)" },
    { kind:"note",  at:"core", text:"제목·설명·공개 범위를 정할 근거가 없으면 무인으로 진행할 수 없다. 여기서 멈추는 편이 낫다." },

    { kind:"fragElse", label:"템플릿 있음" },
    { kind:"sync",  from:"core", to:"gate", text:"1차 검사 — 원클릭 자동 권한" },

    { kind:"fragStart", type:"alt", label:"권한" },
    { kind:"fragCase", label:"원클릭 자동 권한 있음" },
    { kind:"reply", from:"gate", to:"core", text:"통과" },
    { kind:"self",  from:"core", text:"템플릿으로 레시피 구성 — 편집 화면 없이" },
    { kind:"store", from:"core", to:"sqs", text:"render-job 발행" },
    { kind:"sync",  from:"wrender", to:"sqs", text:"렌더 수행 (SEQ-EDIT-04)" },
    { kind:"sync",  from:"wrender", to:"core", text:"완료 보고" },
    { kind:"store", from:"core", to:"sqs", text:"upload-job 발행" },
    { kind:"sync",  from:"wupload", to:"gate", text:"2차 검사" },
    { kind:"reply", from:"gate", to:"wupload", text:"통과 — 업로드 진행 (SEQ-UP-01)" },

    { kind:"fragElse", label:"권한 부족" },
    { kind:"reply", from:"gate", to:"core", text:"차단 — 승인 대기함으로 (SEQ-UP-02)" },
    { kind:"fragEnd" },
    { kind:"fragEnd" },

    { kind:"note", at:"pg", text:"원클릭 자동 권한은 직접 업로드 권한을 전제로 한다(① UC-07). 순서를 건너뛰어 부여할 수 없다." }
  ],
  notes: [
    "렌더와 업로드는 여전히 각자의 큐를 탄다. 원클릭은 사람의 개입을 줄일 뿐 파이프라인을 바꾸지 않는다.",
    "템플릿 관리는 SEQ-UP-06이다."
  ]
},

"SEQ-UP-05": {
  title: "업로드 실패와 불명확한 성공 복구",
  trigger: "업로드 응답을 받지 못한 채 연결이 끊긴다",
  purpose: "'올라갔는지 모르는' 상태를 다루는 법. 무조건 재업로드가 " +
           "왜 금지인지, 무엇으로 확정하는지를 보인다.",
  relatedUcIds: ["UC-27"],
  relatedIaNodeIds: ["ia-upstatus"],
  relatedServiceIds: ["mk-upload", "ex-yt"],
  relatedComponentIds: ["w-upload", "core", "pg", "web", "ex-yt"],
  participants: P(["wupload", "yt", "core", "pg", "web", "ops"]),
  steps: [
    { kind:"sync",  from:"wupload", to:"yt", text:"영상 업로드" },
    { kind:"self",  from:"wupload", text:"응답 전 연결 끊김 — 성공 여부 불명" },
    { kind:"sync",  from:"wupload", to:"core", text:"불명확 상태 보고" },
    { kind:"store", from:"core", to:"pg", text:"UploadAttempt = RECONCILIATION_REQUIRED" },
    { kind:"note",  at:"pg", text:"부록 C 업로드 상태 머신의 RECONCILING에 해당한다. '실패'로 적으면 재시도가 자동으로 돌아 같은 영상이 두 번 올라간다." },

    { kind:"fragStart", type:"loop", label:"확정 시도 (백오프)" },
    { kind:"sync",  from:"wupload", to:"yt", text:"채널 영상 목록 조회 — 이 클립이 올라갔는가" },
    { kind:"fragEnd" },

    { kind:"fragStart", type:"alt", label:"조회 결과" },
    { kind:"fragCase", label:"올라가 있다" },
    { kind:"reply", from:"yt", to:"wupload", text:"videoId 발견" },
    { kind:"sync",  from:"wupload", to:"core", text:"성공으로 확정 (videoId)" },
    { kind:"store", from:"core", to:"pg", text:"DONE · videoId · audit_log" },
    { kind:"async", from:"core", to:"web", text:"업로드 완료 표시" },

    { kind:"fragElse", label:"없다" },
    { kind:"reply", from:"yt", to:"wupload", text:"해당 영상 없음" },
    { kind:"store", from:"core", to:"pg", text:"FAILED로 확정 — 재시도 가능" },
    { kind:"async", from:"core", to:"web", text:"'실패 — 다시 시도' 표시" },

    { kind:"fragElse", label:"조회 자체가 안 된다 (권한 · 장애)" },
    { kind:"self",  from:"wupload", text:"확정 보류 — 상태를 바꾸지 않는다" },
    { kind:"async", from:"wupload", to:"ops", text:"경보 — 확정 불가 건 누적" },
    { kind:"note",  at:"web", text:"화면에는 '확인 중'으로 둔다. 모르는 것을 성공이나 실패로 단정하지 않는다." },
    { kind:"fragEnd" },

    { kind:"fragStart", type:"opt", label:"사용자가 직접 처리" },
    { kind:"sync",  from:"web", to:"core", text:"수동 재시도 · 취소 · 재인증" },
    { kind:"note",  at:"core", text:"자동으로 풀리지 않는 건은 사람에게 넘긴다. 다만 '무조건 재업로드' 버튼은 두지 않는다(① UC-27)." },
    { kind:"fragEnd" }
  ],
  notes: [
    "중복 업로드는 되돌리기 어렵다. 그래서 확정 절차를 재시도보다 앞에 둔다.",
    "권한 만료로 조회가 막힌 경우는 SEQ-LINK-03의 재인증으로 이어진다."
  ]
},

"SEQ-UP-06": {
  title: "업로드 템플릿 저장 · 지정",
  trigger: "업로드에 쓸 기본값을 미리 정해 둔다",
  purpose: "원클릭 자동 업로드가 성립하는 전제를 만드는 흐름.",
  relatedUcIds: ["UC-24"],
  relatedIaNodeIds: ["ia-template"],
  relatedServiceIds: ["mk-tpl"],
  relatedComponentIds: ["web", "core", "pg"],
  participants: P(["streamer", "web", "core", "pg"]),
  steps: [
    { kind:"sync",  from:"streamer", to:"web", text:"템플릿 작성 — 제목 규칙 · 설명 · 태그 · 공개 범위" },
    { kind:"sync",  from:"web", to:"core", text:"템플릿 저장" },
    { kind:"store", from:"core", to:"pg", text:"템플릿 저장 (채널 귀속)" },
    { kind:"reply", from:"core", to:"web", text:"목록에 표시" },

    { kind:"fragStart", type:"opt", label:"기본 템플릿 지정" },
    { kind:"sync",  from:"streamer", to:"web", text:"원클릭에 쓸 템플릿 지정" },
    { kind:"store", from:"core", to:"pg", text:"지정 갱신" },
    { kind:"note",  at:"pg", text:"지정된 템플릿이 없으면 원클릭은 진행되지 않고 거절된다 — SEQ-UP-04." },
    { kind:"fragEnd" },

    { kind:"fragStart", type:"alt", label:"수정 · 삭제" },
    { kind:"fragCase", label:"수정" },
    { kind:"store", from:"core", to:"pg", text:"템플릿 갱신 — 이미 나간 업로드에는 영향 없음" },
    { kind:"fragElse", label:"지정된 템플릿을 삭제" },
    { kind:"reply", from:"core", to:"web", text:"경고 — 원클릭이 멈춥니다" },
    { kind:"store", from:"core", to:"pg", text:"삭제 · 지정 해제" },
    { kind:"fragEnd" },

    { kind:"note", at:"core", text:"기본 비공개 정책은 템플릿으로 뒤집지 않는다(ADR-010). 템플릿이 정하는 것은 제목·설명·태그다." }
  ],
  notes: [
    "템플릿은 채널 단위다. 편집자도 지정된 템플릿을 쓰지만 소유는 채널에 있다."
  ]
}

});

/* ══════════════════════════════════════════════════════════════════════
   협업 · 권한
══════════════════════════════════════════════════════════════════════ */
S.define({

"SEQ-COL-01": {
  title: "편집자 접근 신청 → 승인 → 권한 부여",
  trigger: "편집자가 스트리머를 찾아 접근을 신청한다",
  purpose: "남의 채널 자산에 손대는 관계가 만들어지는 절차. " +
           "권한 3단계가 어디에서 정해지는지를 보인다.",
  relatedUcIds: ["UC-05", "UC-07", "UC-16"],
  relatedIaNodeIds: ["ia-channel", "ia-request", "ia-editors"],
  relatedServiceIds: ["cm-perm", "cm-noti", "ac-web"],
  relatedComponentIds: ["core", "pg"],
  participants: P(["editor", "core", "pg", "streamer"]),
  steps: [
    { kind:"sync",  from:"editor", to:"core", text:"스트리머 검색 → 접근 요청" },
    { kind:"store", from:"core", to:"pg", text:"요청 저장 (대기)" },
    { kind:"async", from:"core", to:"streamer", text:"알림 — 접근 요청 도착" },
    { kind:"note",  at:"core", text:"신청형이다. 스트리머가 먼저 초대하는 경로는 확정된 바 없어 넣지 않는다(① UC-05)." },

    { kind:"fragStart", type:"alt", label:"스트리머의 처리" },
    { kind:"fragCase", label:"승인 — 권한 단계 지정" },
    { kind:"sync",  from:"streamer", to:"core", text:"승인 + 권한 단계 선택" },

    { kind:"fragStart", type:"alt", label:"선택한 단계 (ADR-012)" },
    { kind:"fragCase", label:"기본 — 제작만" },
    { kind:"note", at:"pg", text:"편집·렌더는 되지만 업로드 시도는 승인 대기함으로 간다(SEQ-UP-02)." },
    { kind:"fragElse", label:"+ 직접 업로드" },
    { kind:"note", at:"pg", text:"승인 없이 바로 올릴 수 있다. Gate 2차 검사는 여전히 통과해야 한다." },
    { kind:"fragElse", label:"+ 원클릭 자동" },
    { kind:"note", at:"pg", text:"직접 업로드를 전제로만 줄 수 있다. 건너뛴 부여는 허용하지 않는다." },
    { kind:"fragEnd" },

    { kind:"store", from:"core", to:"pg", text:"EditorGrant 생성 · 권한 변경 이력 audit_log" },
    { kind:"async", from:"core", to:"editor", text:"알림 — 승인됨 · 부여된 단계" },

    { kind:"fragElse", label:"반려" },
    { kind:"sync",  from:"streamer", to:"core", text:"반려" },
    { kind:"store", from:"core", to:"pg", text:"반려 기록" },
    { kind:"async", from:"core", to:"editor", text:"알림 — 반려" },
    { kind:"fragEnd" },

    { kind:"note", at:"editor", text:"승인 이후 편집자에게 보이는 화면은 역할에 따라 달라진다. 같은 메뉴라도 '내 업로드·내 요청'만 보인다(② IA)." }
  ],
  notes: [
    "권한 단계는 관계에 붙지 계정에 붙지 않는다. 같은 사람이 채널마다 다른 단계를 가질 수 있다.",
    "회수·종료는 SEQ-COL-02다."
  ]
},

"SEQ-COL-02": {
  title: "권한 회수 · 협업 종료와 즉시 차단",
  trigger: "스트리머가 권한을 회수하거나 편집자가 협업을 끝낸다",
  purpose: "관계가 끊기는 순간 무엇이 즉시 막히는지. 이미 진행 중인 " +
           "작업과 대기 중인 요청까지 정리하는 경로를 보인다.",
  relatedUcIds: ["UC-06", "UC-07", "UC-29"],
  relatedIaNodeIds: ["ia-editors", "ia-request"],
  relatedServiceIds: ["cm-perm", "mk-approve"],
  relatedComponentIds: ["core", "pg", "gate", "redis"],
  participants: P(["streamer", "core", "pg", "gate", "redis", "editor"]),
  steps: [
    { kind:"fragStart", type:"alt", label:"누가 끊는가" },
    { kind:"fragCase", label:"스트리머가 회수" },
    { kind:"sync",  from:"streamer", to:"core", text:"편집자 권한 회수" },
    { kind:"fragElse", label:"편집자가 협업 종료" },
    { kind:"sync",  from:"editor", to:"core", text:"협업 종료" },
    { kind:"fragEnd" },

    { kind:"store", from:"core", to:"pg", text:"EditorGrant 무효 · 변경 이력 audit_log" },
    { kind:"reply", from:"pg", to:"core", text:"커밋 완료" },
    { kind:"store", from:"core", to:"redis", text:"해당 사용자 세션 · 권한 캐시 무효화" },
    { kind:"note",  at:"redis", text:"판정 원본은 PostgreSQL이고 Redis에 있는 것은 짧은 캐시다. 캐시를 안 지우면 회수가 캐시 TTL만큼 늦게 먹는다." },

    { kind:"store", from:"core", to:"pg", text:"대기 중인 업로드 승인 요청 무효 처리" },
    { kind:"note",  at:"pg", text:"① UC-29의 예외 흐름 — 대기 중 권한이 회수되면 요청은 무효다. 그대로 두면 나중에 승인돼 그대로 올라간다." },

    { kind:"fragStart", type:"opt", label:"이미 큐에 들어간 업로드 작업이 있는 경우" },
    { kind:"sync",  from:"gate", to:"pg", text:"업로드 직전 2차 검사" },
    { kind:"reply", from:"pg", to:"gate", text:"권한 없음" },
    { kind:"note",  at:"gate", text:"큐에서 작업을 물리적으로 빼내지 않아도 막힌다. 2차 검사가 있는 이유가 바로 이 구간이다(SEQ-UP-01)." },
    { kind:"fragEnd" },

    { kind:"async", from:"core", to:"editor", text:"접근 불가 — 자산 목록에서 해당 채널 제거" },
    { kind:"note",  at:"editor", text:"① UC-06 · UC-07 — 즉시 전면 차단이다. 진행 중이던 편집본도 열리지 않는다." }
  ],
  notes: [
    "이미 유튜브에 올라간 영상은 회수해도 내려가지 않는다. 관계가 끊기는 것과 결과물이 사라지는 것은 다른 문제다.",
    "계정 삭제도 같은 효과를 낸다 — SEQ-AUTH-02."
  ]
}

});

/* ══════════════════════════════════════════════════════════════════════
   알림
══════════════════════════════════════════════════════════════════════ */
S.define({

"SEQ-NOTI-01": {
  title: "서비스 이벤트 알림 발송",
  trigger: "방송 시작 · 승인 요청/결과 · 결제 실패 · VOD 만료 임박",
  purpose: "여러 곳에서 생긴 사건이 하나의 알림 경로로 모이는 구조. " +
           "설정으로 끈 알림이 어디에서 걸러지는지를 보인다.",
  relatedUcIds: ["UC-16"],
  relatedIaNodeIds: ["ia-noti", "ia-inbox"],
  relatedServiceIds: ["cm-noti"],
  relatedComponentIds: ["core", "pg", "redis", "web"],
  participants: P(["core", "pg", "redis", "web"]),
  steps: [
    { kind:"self",  from:"core", text:"알림 대상 사건 발생 (방송 시작 · 승인 · 결제 실패 · VOD 만료 임박)" },
    { kind:"store", from:"core", to:"pg", text:"사건 + Outbox 한 트랜잭션" },
    { kind:"reply", from:"pg", to:"core", text:"커밋 완료" },
    { kind:"store", from:"core", to:"pg", text:"수신자의 알림 설정 조회 (종류별 on/off)" },

    { kind:"fragStart", type:"alt", label:"이 종류를 받기로 했는가" },
    { kind:"fragCase", label:"켜져 있다" },
    { kind:"store", from:"core", to:"pg", text:"알림 레코드 생성 (알림함)" },
    { kind:"store", from:"core", to:"redis", text:"Pub/Sub 팬아웃" },
    { kind:"async", from:"core", to:"web", text:"SSE — 알림함 배지 갱신" },

    { kind:"fragElse", label:"꺼져 있다" },
    { kind:"self", from:"core", text:"발송하지 않는다 — 사건 기록은 남는다" },
    { kind:"note", at:"core", text:"거르는 자리는 발송 직전이다. 사건 자체를 안 만들면 나중에 설정을 켜도 이력이 비어 있다." },
    { kind:"fragEnd" },

    { kind:"fragStart", type:"opt", label:"사용자가 알림함을 열 때" },
    { kind:"sync",  from:"web", to:"core", text:"알림 목록 조회 (REST 스냅샷)" },
    { kind:"reply", from:"core", to:"web", text:"목록 · 읽음 상태" },
    { kind:"sync",  from:"web", to:"core", text:"읽음 표시" },
    { kind:"store", from:"core", to:"pg", text:"읽음 갱신" },
    { kind:"fragEnd" },

    { kind:"note", at:"pg", text:"수신 채널(웹 푸시 · 이메일)은 아직 확정되지 않았다(TBD). 지금 확정된 것은 앱 안의 알림함뿐이다." }
  ],
  notes: [
    "알림도 Outbox를 거친다. '사건은 났는데 알림만 안 갔다'와 '알림은 갔는데 사건이 없다'를 둘 다 막는다.",
    "알림은 P3에 붙는다(① UC-16 · ② 글로벌 메뉴 5)."
  ]
},

"SEQ-NOTI-02": {
  title: "알림 설정 변경과 발송 필터 반영",
  trigger: "설정 › 알림에서 종류별로 켜고 끈다",
  purpose: "설정이 실제 발송에 언제부터 먹는지. 이미 쌓인 알림은 어떻게 되는지.",
  relatedUcIds: ["UC-08"],
  relatedIaNodeIds: ["ia-settings", "ia-set-noti"],
  relatedServiceIds: ["cm-noti"],
  relatedComponentIds: ["web", "core", "pg"],
  participants: P(["streamer", "web", "core", "pg"]),
  steps: [
    { kind:"sync",  from:"streamer", to:"web", text:"알림 설정 열기" },
    { kind:"store", from:"core", to:"pg", text:"현재 설정 조회 (종류별)" },
    { kind:"reply", from:"core", to:"web", text:"방송 시작 · 승인 · 결제 실패 · VOD 만료 임박" },
    { kind:"sync",  from:"streamer", to:"web", text:"일부 종류 끄기" },
    { kind:"store", from:"core", to:"pg", text:"설정 저장" },
    { kind:"reply", from:"core", to:"web", text:"저장됨" },
    { kind:"note",  at:"core", text:"다음 발송부터 적용된다. 이미 알림함에 있는 것은 지우지 않는다 — 지우면 사용자가 못 본 알림이 사라진다." },

    { kind:"fragStart", type:"opt", label:"수신 채널 선택" },
    { kind:"self", from:"web", text:"웹 푸시 · 이메일 — 미정(TBD)" },
    { kind:"note", at:"web", text:"채널이 확정되지 않아 화면에도 TBD로 둔다. 없는 기능을 있는 것처럼 그리지 않는다(② IA)." },
    { kind:"fragEnd" },

    { kind:"note", at:"pg", text:"설정은 계정 단위다. 여러 채널에 편집자로 참여해도 알림 설정은 하나다." }
  ],
  notes: [
    "끈 알림은 발송 직전에 걸러진다 — SEQ-NOTI-01의 판정 지점."
  ]
}

});

/* ══════════════════════════════════════════════════════════════════════
   구독 · 과금
══════════════════════════════════════════════════════════════════════ */
S.define({

"SEQ-BILL-01": {
  title: "구독 가입과 정기 갱신",
  trigger: "요금제를 고르거나 결제 주기가 도래한다",
  purpose: "돈을 받는 경로. 결제 자체는 외부 PG가 하고 우리가 무엇을 " +
           "들고 있는지를 가른다.",
  relatedUcIds: ["UC-31", "UC-17"],
  relatedIaNodeIds: ["ia-billing", "ia-pricing"],
  relatedServiceIds: ["cm-bill", "ex-pg"],
  relatedComponentIds: ["web", "core", "pg", "ex-pg"],
  participants: P(["streamer", "web", "core", "pg", "pay"]),
  steps: [
    { kind:"sync",  from:"streamer", to:"web", text:"플랜 선택 · 결제 수단 등록" },
    { kind:"sync",  from:"web", to:"pay", text:"결제 수단 등록 (PG 화면)" },
    { kind:"reply", from:"pay", to:"web", text:"결제 수단 토큰" },
    { kind:"sync",  from:"web", to:"core", text:"구독 생성 (플랜 · 결제 수단 토큰)" },
    { kind:"store", from:"core", to:"pg", text:"Subscription 저장 (카드 번호는 저장하지 않는다)" },
    { kind:"note",  at:"pg", text:"카드 정보는 PG가 들고 우리는 토큰만 가진다. 결제 시스템은 외부 시스템이고 우리 배포 경계 밖이다(④)." },
    { kind:"sync",  from:"core", to:"pay", text:"최초 결제 요청" },
    { kind:"reply", from:"pay", to:"core", text:"승인" },
    { kind:"store", from:"core", to:"pg", text:"구독 ACTIVE · 다음 청구일 기록" },
    { kind:"reply", from:"core", to:"web", text:"구독 완료" },

    { kind:"fragStart", type:"loop", label:"결제 주기마다 (자동)" },
    { kind:"self",  from:"core", text:"청구일 도래 판정" },
    { kind:"store", from:"core", to:"pg", text:"이번 주기 사용량 집계 (종량분)" },
    { kind:"sync",  from:"core", to:"pay", text:"정기 결제 + 종량 청구" },
    { kind:"fragStart", type:"alt", label:"결과" },
    { kind:"fragCase", label:"승인" },
    { kind:"store", from:"core", to:"pg", text:"청구 내역 기록 · 다음 청구일 갱신" },
    { kind:"fragElse", label:"실패" },
    { kind:"note", at:"core", text:"여기서 바로 끊지 않는다 — 복구 유예가 있다(SEQ-BILL-02)." },
    { kind:"fragEnd" },
    { kind:"fragEnd" },

    { kind:"note", at:"pg", text:"종량 과금의 계측 대상과 단가는 아직 확정되지 않았다(TBD). 계측 자체는 내부에서 하고 청구만 PG가 한다." }
  ],
  notes: [
    "과금 주체는 스트리머 단독이다. 편집자는 과금 대상이 아니다(② IA · ③ cm-bill).",
    "결제는 P3다. 시스템 층에서 P3에 새로 붙는 유일한 요소가 PG 연동이다(④)."
  ]
},

"SEQ-BILL-02": {
  title: "결제 실패와 복구 (실패)",
  trigger: "정기 결제가 거절된다",
  purpose: "돈이 안 들어왔을 때 바로 끊지 않고 되돌릴 기회를 주는 절차. " +
           "그래도 끊길 때 무엇이 남는지.",
  relatedUcIds: ["UC-17", "UC-31", "UC-16"],
  relatedIaNodeIds: ["ia-billing", "ia-inbox"],
  relatedServiceIds: ["cm-bill", "cm-noti", "ex-pg"],
  relatedComponentIds: ["core", "pg", "web", "ex-pg"],
  participants: P(["core", "pay", "pg", "web", "streamer"]),
  steps: [
    { kind:"sync",  from:"core", to:"pay", text:"정기 결제 요청" },
    { kind:"reply", from:"pay", to:"core", text:"거절 (한도 · 만료 · 정지)" },
    { kind:"store", from:"core", to:"pg", text:"구독 상태 PAST_DUE · 실패 사유 기록" },
    { kind:"async", from:"core", to:"web", text:"알림 — 결제 실패 · 복구 방법 (SEQ-NOTI-01)" },
    { kind:"note",  at:"core", text:"즉시 정지하지 않는다. 카드 만료 같은 흔한 사유는 몇 분이면 고쳐지는데 그 사이 방송을 끊으면 손해가 훨씬 크다." },

    { kind:"fragStart", type:"loop", label:"유예 기간 안에서 재시도" },
    { kind:"sync",  from:"core", to:"pay", text:"재청구" },
    { kind:"fragEnd" },

    { kind:"fragStart", type:"alt", label:"유예 안에 해결되는가" },
    { kind:"fragCase", label:"사용자가 결제 수단을 고쳤다" },
    { kind:"sync",  from:"streamer", to:"web", text:"결제 수단 변경" },
    { kind:"sync",  from:"core", to:"pay", text:"즉시 재청구" },
    { kind:"reply", from:"pay", to:"core", text:"승인" },
    { kind:"store", from:"core", to:"pg", text:"ACTIVE 복귀 · 청구 내역 기록" },
    { kind:"async", from:"core", to:"web", text:"정상 복구 안내" },

    { kind:"fragElse", label:"유예가 끝났다" },
    { kind:"store", from:"core", to:"pg", text:"구독 정지 · audit_log" },
    { kind:"async", from:"core", to:"web", text:"정지 안내 — 무엇이 막히고 무엇이 남는지" },
    { kind:"note",  at:"pg", text:"이미 만든 클립과 보관물이 즉시 사라지지는 않는다. 다만 새 방송 송출은 Stream Key 검증 단계에서 막힌다(SEQ-BC-01의 구독 확인)." },
    { kind:"fragEnd" },

    { kind:"note", at:"streamer", text:"활성 구독이 남아 있으면 계정 삭제도 막힌다(SEQ-AUTH-02). 정지와 해지는 다른 상태다." }
  ],
  notes: [
    "유예 길이와 정지 시 제한 범위의 구체값은 확정되지 않았다(TBD).",
    "결제 실패는 알림 대상 사건이다(① UC-16)."
  ]
},

"SEQ-BILL-03": {
  title: "사용량 계측과 종량 청구 조회",
  trigger: "사용량 화면을 열거나 청구 주기가 돈다",
  purpose: "무엇을 세는지가 아직 정해지지 않았다는 사실을 포함해, " +
           "계측과 청구의 경계를 보인다.",
  relatedUcIds: ["UC-32", "UC-17"],
  relatedIaNodeIds: ["ia-billing"],
  relatedServiceIds: ["cm-bill"],
  relatedComponentIds: ["core", "pg", "web"],
  participants: P(["core", "pg", "web", "streamer"]),
  steps: [
    { kind:"fragStart", type:"loop", label:"과금 대상 행위가 일어날 때마다" },
    { kind:"self",  from:"core", text:"사용량 기록 (계측은 내부에서 한다)" },
    { kind:"store", from:"core", to:"pg", text:"사용량 이벤트 append" },
    { kind:"fragEnd" },
    { kind:"note", at:"pg", text:"무엇을 세는지 — 계측 대상과 단가는 아직 확정되지 않았다(TBD). 그래서 이 시퀀스는 '어디에 쌓이는가'까지만 확정한다." },

    { kind:"sync",  from:"streamer", to:"web", text:"사용량 · 청구 내역 조회" },
    { kind:"sync",  from:"web", to:"core", text:"조회 요청 (기간)" },

    { kind:"fragStart", type:"alt", label:"무엇을 보는가" },
    { kind:"fragCase", label:"진행 중인 주기" },
    { kind:"store", from:"core", to:"pg", text:"이번 주기 누적 집계" },
    { kind:"reply", from:"core", to:"web", text:"실시간 사용량 (확정 전 · 변동 가능)" },
    { kind:"note",  at:"web", text:"확정 금액이 아니라 누적치다. 화면에서 그 차이를 분명히 적는다 — 청구서로 오해하면 분쟁이 된다." },

    { kind:"fragElse", label:"지난 주기" },
    { kind:"store", from:"core", to:"pg", text:"확정된 청구 내역 조회" },
    { kind:"reply", from:"core", to:"web", text:"기간별 청구 내역 (확정값)" },
    { kind:"fragEnd" },

    { kind:"note", at:"core", text:"계측은 우리가, 청구는 PG가 한다. 이 시퀀스에 결제 시스템이 등장하지 않는 이유다 — 조회 경로에는 외부가 끼지 않는다." }
  ],
  notes: [
    "종량 기준이 확정되면 이 시퀀스의 '사용량 이벤트'가 무엇인지가 함께 확정된다.",
    "청구 실행은 SEQ-BILL-01의 주기 루프에 있다."
  ]
}

});

/* ══════════════════════════════════════════════════════════════════════
   운영 · 아키텍처 진화
══════════════════════════════════════════════════════════════════════ */
S.define({

"SEQ-OPS-01": {
  title: "감사 로그 기록과 조회 (audit_log)",
  trigger: "권한 · 승인 · 업로드 · 연동 · 삭제가 일어난다",
  purpose: "'누가 언제 무엇을 했는가'를 나중에 물을 수 있게 하는 장치. " +
           "여러 흐름이 공통으로 지나가는 자리다.",
  relatedUcIds: ["UC-07", "UC-30", "UC-27", "UC-02", "UC-28"],
  relatedIaNodeIds: ["ia-console"],
  relatedServiceIds: ["cm-perm", "ac-console"],
  relatedComponentIds: ["core", "pg"],
  participants: P(["core", "pg", "console"]),
  steps: [
    { kind:"fragStart", type:"alt", label:"기록 대상 (④ audit_log)" },
    { kind:"fragCase", label:"권한 변경 — 부여 · 회수 · 단계 조정" },
    { kind:"store", from:"core", to:"pg", text:"행위자 · 대상 · 이전/이후 값 · 시각" },
    { kind:"fragElse", label:"업로드 승인 · 반려" },
    { kind:"store", from:"core", to:"pg", text:"요청자 · 승인자 · 클립 · 판단" },
    { kind:"fragElse", label:"업로드 실행" },
    { kind:"store", from:"core", to:"pg", text:"누가 어느 채널에 무엇을 올렸는가 · videoId" },
    { kind:"fragElse", label:"연동 · 해제" },
    { kind:"store", from:"core", to:"pg", text:"플랫폼 · 채널 · 연동/해제 시각" },
    { kind:"fragElse", label:"삭제" },
    { kind:"store", from:"core", to:"pg", text:"삭제한 사람 · 대상 · 시각" },
    { kind:"fragEnd" },

    { kind:"note", at:"pg", text:"업무 트랜잭션과 같은 저장소에 남긴다. 별도 로그 시스템을 전제하지 않는다 — 확정된 것은 PostgreSQL의 audit_log뿐이다(④)." },
    { kind:"note", at:"core", text:"append만 하고 수정하지 않는다. 고칠 수 있는 이력은 이력이 아니다." },

    { kind:"fragStart", type:"opt", label:"조회" },
    { kind:"sync",  from:"console", to:"core", text:"이력 조회 (대상 · 기간)" },
    { kind:"store", from:"core", to:"pg", text:"audit_log 조회" },
    { kind:"reply", from:"core", to:"console", text:"시간순 이력" },
    { kind:"note",  at:"console", text:"운영자 콘솔은 ①·③에서 범위 밖으로 선언돼 있다. 위치와 접근 경로만 표시하고 내부 화면은 별도 설계로 남긴다." },
    { kind:"fragEnd" }
  ],
  notes: [
    "삭제된 계정·클립에 대해서도 이력은 남는다. 대상 레코드가 사라져도 '무슨 일이 있었는가'는 답할 수 있어야 한다.",
    "이 흐름은 다른 시퀀스들이 공통으로 지나가는 자리라, 각 시퀀스에서는 'audit_log 기록' 한 줄로만 나타난다."
  ]
},

"SEQ-GROW-01": {
  title: "성장기 이벤트 버스 도입 조건 (Kafka)",
  trigger: "이벤트 소비자 다종화 · 재처리 요구 · Redis 집계 처리량 한계",
  purpose: "지금 Kafka가 없는 이유와, 있어야 할 때가 언제인지. " +
           "도입해도 무엇은 옮기지 않는지를 못 박는다.",
  relatedUcIds: [],
  relatedIaNodeIds: [],
  relatedServiceIds: [],
  relatedComponentIds: ["kafka", "core", "redis", "sqs", "detect"],
  participants: P(["core", "redis", "sqs", "kafka", "detect"]),
  steps: [
    { kind:"note", at:"core", text:"지금(초기 구성) — 이벤트 팬아웃은 Redis Pub/Sub, 비동기 작업은 SQS+DLQ 다섯 큐. Kafka는 실행 단위 수에 포함되지 않는다." },
    { kind:"store", from:"core", to:"redis", text:"현재: Outbox Dispatcher → Pub/Sub 팬아웃" },
    { kind:"store", from:"core", to:"sqs",   text:"현재: 작업 발행 (vod-finalize · subtitle · preview · render · upload)" },

    { kind:"fragStart", type:"alt", label:"도입 조건 (④에 명시된 네 가지)" },
    { kind:"fragCase", label:"이벤트 소비자가 여러 종류로 늘어난다" },
    { kind:"self", from:"core", text:"한 사건을 여러 소비자가 각자 속도로 읽어야 한다" },
    { kind:"fragElse", label:"이벤트 재처리가 필요하다" },
    { kind:"self", from:"redis", text:"Pub/Sub은 보관하지 않아 놓친 것을 되돌릴 수 없다" },
    { kind:"fragElse", label:"Redis 집계 처리량이 한계에 닿는다" },
    { kind:"self", from:"redis", text:"방송 수 증가로 집계 쓰기가 병목이 된다" },
    { kind:"fragElse", label:"이벤트 보관 · Replay 요구가 생긴다" },
    { kind:"self", from:"core", text:"과거 이벤트를 다시 흘려 상태를 재구성해야 한다" },
    { kind:"fragEnd" },

    { kind:"note", at:"kafka", text:"조건을 만족하면 도입한다. 그때도 '이벤트 전용'이다 — 자막·렌더·업로드 작업은 그대로 SQS+DLQ가 소유한다(④)." },
    { kind:"store", from:"core",  to:"kafka",  text:"성장기: 도메인 이벤트 발행 (보관 · Replay 가능)" },
    { kind:"sync",  from:"detect",to:"kafka",  text:"성장기: 이벤트 구독 (여러 소비자 중 하나)" },
    { kind:"store", from:"core",  to:"sqs",    text:"성장기에도 유지: 작업 큐는 SQS+DLQ" },
    { kind:"note",  at:"sqs", text:"작업 큐를 Kafka로 옮기지 않는 이유 — 작업은 '한 번만 처리되고 실패하면 DLQ로 가는 것'이고, 이벤트는 '여러 번 읽히고 보관되는 것'이다. 성질이 다르다." },

    { kind:"note", at:"redis", text:"Kafka가 들어와도 Redis의 실시간 집계와 세션은 그대로다. 대체가 아니라 추가다." }
  ],
  notes: [
    "다이어그램에서 점선 회색 상자가 성장기 요소다. 단계(P1·P2·P3) 축 밖이라 필터를 걸어도 항상 보인다.",
    "지금 이 시퀀스는 '아직 하지 않은 결정'을 적어 둔 것이다. 다른 시퀀스에는 Kafka가 등장하지 않는다."
  ]
}

});

/* == END CATALOG == */
})(window.PokeClipSequences);
