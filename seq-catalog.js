/* ============================================================================
   PokeClip — 중앙 시퀀스 카탈로그 (단순화판)
   ----------------------------------------------------------------------------
   시퀀스 "내용"은 여기 한 곳에만 있다. 카드(① UC · ② 화면 · ③ 블록 · ④ 실행 단위)는
   아무 내용도 갖지 않고 relatedXxxIds 로 "나는 어느 카드에 걸리는가"만 밝힌다.
   sequences.js 가 그걸로 역인덱스를 만든다. 같은 흐름이 카드마다 복제되지 않는다.

     relatedUcIds         ① UC-01 ~ UC-32
     relatedIaNodeIds     ② 표면 · 화면
     relatedServiceIds    ③ 논리 Capability · 접점 · 외부
     relatedComponentIds  ④ 실행 단위 · 저장소 · 접점 · 외부

   읽기 쉽게 만드는 규칙 (이 판의 방침)
   · 참여자 최대 5, 단계 10 안팎, 중첩 상자(alt 안의 opt…)는 두지 않는다.
   · 화살표 글씨는 기술 명령이 아니라 평이한 우리말로 쓴다.
     (예: "SET lease NX EX 30" → "이 방송 담당 예약 (30초, 나만)")
   · 곁가지(실패·재시도의 세부)는 별도 시퀀스이거나 덧붙임(notes) 한 줄로.

   근거 — 확정 문서만 쓴다
   · ④ v2.8 실행 단위 10 · 저장소 4 · SQS 다섯 큐 (별도 이벤트 버스 없음)
   · ③ v2.2 · ① v3.9 · ② v3.3
   · ADR-004(DVR 1h/VOD 60일) 005(CMAF·VOD=매니페스트 확정) 006(PostgreSQL+JSONB)
     010(유튜브 업로드·기본 비공개) 011(채팅·하이라이트) 012(권한 3단계)
     013(관리형 STT 배제) 015(CloudFront)
   · 부록 A 장애 · 부록 B 추적성 · 부록 C 상태 머신
   근거가 없는 것은 만들어 넣지 않고 TBD로 남긴다.
============================================================================ */
(function (S) {
"use strict";
var P = S.P;

/* ══ 공개 웹 · 지원 ══════════════════════════════════════════════════════ */
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
    { kind:"sync",  from:"web",  to:"core", text:"소개 · 요금 · 약관 요청" },
    { kind:"store", from:"core", to:"pg",   text:"공개 문서 조회" },
    { kind:"reply", from:"core", to:"web",  text:"공개 화면 (개인 데이터 없음)" },
    { kind:"note",  at:"core",   text:"여기엔 계정도 세션도 없다. 종량 요금·무료 티어는 아직 미정(TBD)이라 화면에도 그대로 둔다." },
    { kind:"fragStart", type:"opt", label:"플러그인을 받으러 왔다면" },
    { kind:"sync",  from:"streamer", to:"web", text:"플러그인 다운로드" },
    { kind:"reply", from:"web", to:"streamer", text:"설치 파일 · 가이드" },
    { kind:"fragEnd" },
    { kind:"sync",  from:"streamer", to:"web", text:"시작하기 — 구글 로그인으로 (다음은 SEQ-AUTH-01)" }
  ],
  notes: ["설치와 Stream Key 등록은 로그인 이후다. 여기서는 파일만 준다."]
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
    { kind:"sync",  from:"streamer", to:"web", text:"문의 작성" },
    { kind:"sync",  from:"web",  to:"core", text:"접수" },
    { kind:"store", from:"core", to:"pg",   text:"저장 · 접수번호 발급" },
    { kind:"reply", from:"core", to:"web",  text:"접수 완료 · 번호" },
    { kind:"fragStart", type:"alt", label:"로그인 상태" },
    { kind:"fragCase", label:"로그인 후 — 계정에 묶인다" },
    { kind:"sync",  from:"streamer", to:"web", text:"설정에서 접수 상태 확인" },
    { kind:"store", from:"core", to:"pg", text:"내 문의 조회" },
    { kind:"reply", from:"core", to:"web", text:"상태 · 답변" },
    { kind:"fragElse", label:"가입 전 — 계정이 없다" },
    { kind:"note", at:"core", text:"계정이 없어 접수번호·연락 수단이 유일한 단서다. 답변은 그 연락 수단으로 나간다." },
    { kind:"fragEnd" }
  ],
  notes: ["알림 수신 채널(웹 푸시·이메일)은 아직 미정(TBD)이라 '연락 수단'이라고만 적는다."]
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
  participants: P(["console", "core", "pg", "web"]),
  steps: [
    { kind:"sync",  from:"console", to:"core", text:"서비스 상태 게시 (기능 · 등급)" },
    { kind:"store", from:"core", to:"pg", text:"상태 공지 저장 · 장애 이력에 남김" },
    { kind:"sync",  from:"web",  to:"core", text:"서비스 상태 조회 (비로그인 포함)" },
    { kind:"reply", from:"core", to:"web", text:"기능별 상태 · 진행 상황" },
    { kind:"note",  at:"console", text:"자동 감지가 곧 공개 고지는 아니다. 사이에 사람의 확정이 들어간다 — 순단마다 장애로 보이지 않게." },
    { kind:"fragStart", type:"opt", label:"복구되면" },
    { kind:"store", from:"core", to:"pg", text:"정상으로 되돌리고 마감 시각 기록" },
    { kind:"fragEnd" }
  ],
  notes: ["운영자 콘솔은 ①·③에서 범위 밖으로 선언돼 있다. '상태를 확정하는 자리'로만 등장한다.",
          "장애 자체의 영향·복구는 부록 A에 있다."]
}

});

/* ══ 계정 · 인증 ═════════════════════════════════════════════════════════ */
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
  participants: P(["web", "core", "google", "pg", "redis"]),
  steps: [
    { kind:"sync",  from:"web",  to:"core",   text:"구글로 로그인 시작" },
    { kind:"reply", from:"core", to:"web",    text:"구글 인가 URL" },
    { kind:"sync",  from:"web",  to:"google", text:"로그인 (로그인 범위만)" },
    { kind:"reply", from:"google", to:"core", text:"인증 코드 → ID 토큰 검증" },
    { kind:"note",  at:"google",  text:"여기서 받는 건 로그인 정보뿐. 유튜브 업로드 권한은 별개의 동의다(UC-03 · SEQ-LINK-02)." },
    { kind:"fragStart", type:"alt", label:"계정 존재 여부" },
    { kind:"fragCase", label:"처음 온 사람" },
    { kind:"store", from:"core", to:"pg", text:"계정 생성 · 약관 동의 기록 (최초 1회)" },
    { kind:"fragElse", label:"기존 계정" },
    { kind:"store", from:"core", to:"pg", text:"계정 조회" },
    { kind:"fragEnd" },
    { kind:"store", from:"core", to:"redis", text:"세션 저장 (임시)" },
    { kind:"reply", from:"core", to:"web", text:"로그인 완료 — 역할 포함" }
  ],
  notes: ["세션은 Redis(임시), 계정은 PostgreSQL(원본). Redis가 비면 다시 로그인하면 되고 계정은 그대로다.",
          "역할(스트리머·편집자)은 계정 속성이 아니라 채널과의 관계다."]
},

"SEQ-AUTH-02": {
  title: "계정 삭제 — 활성 구독 해지 선행",
  trigger: "설정 › 계정에서 계정 삭제를 요청한다",
  purpose: "돈이 걸린 상태를 남긴 채 계정이 사라지지 않게 막는 순서. " +
           "삭제되는 것과 남는 것을 구분한다.",
  relatedUcIds: ["UC-09"],
  relatedIaNodeIds: ["ia-account"],
  relatedServiceIds: ["cm-auth", "cm-bill", "ac-web"],
  relatedComponentIds: ["web", "core", "pg"],
  participants: P(["streamer", "web", "core", "pg"]),
  steps: [
    { kind:"sync",  from:"streamer", to:"web", text:"계정 삭제 요청" },
    { kind:"store", from:"core", to:"pg", text:"활성 구독 · 협업 관계 확인" },
    { kind:"fragStart", type:"alt", label:"선행 조건" },
    { kind:"fragCase", label:"활성 구독이 남아 있다" },
    { kind:"reply", from:"core", to:"web", text:"거절 — 구독 해지 먼저 (UC-31)" },
    { kind:"note",  at:"core", text:"차단이 아니라 순서 강제다. 해지 없이 지우면 청구 주체가 사라진다." },
    { kind:"fragElse", label:"조건 충족" },
    { kind:"store", from:"core", to:"pg", text:"계정 삭제 표시 · 협업 즉시 해제 · 이력 기록" },
    { kind:"reply", from:"core", to:"web", text:"로그아웃 · 삭제 완료" },
    { kind:"fragEnd" },
    { kind:"note", at:"pg", text:"세션은 함께 폐기한다. 이미 유튜브에 올라간 영상은 우리가 지우지 않는다(UC-28). 보관물 최종 처리는 미정(TBD)." }
  ],
  notes: ["삭제 이력은 audit_log에 남는다 — 레코드가 사라져도 '누가 언제 지웠나'는 남아야 한다."]
}

});

/* ══ 채널 연동 ═══════════════════════════════════════════════════════════ */
S.define({

"SEQ-LINK-01": {
  title: "방송 채널 연동과 해제 (치지직 / SOOP)",
  trigger: "설정에서 방송 채널을 연동하거나 해제한다",
  purpose: "채팅 수집이 어느 채널을 봐야 하는지가 정해지는 지점. " +
           "해제하면 진행 중인 수집이 어떻게 되는지까지 다룬다.",
  relatedUcIds: ["UC-02"],
  relatedIaNodeIds: ["ia-channel", "ia-link"],
  relatedServiceIds: ["cm-link", "ac-web", "ex-chat"],
  relatedComponentIds: ["core", "pg", "chat", "ex-chat"],
  participants: P(["streamer", "core", "plat", "pg", "chat"]),
  steps: [
    { kind:"sync",  from:"streamer", to:"core", text:"방송 채널 연동 — 플랫폼 선택" },
    { kind:"sync",  from:"core", to:"plat", text:"채널 소유 확인" },
    { kind:"reply", from:"plat", to:"core", text:"채널 식별자" },
    { kind:"store", from:"core", to:"pg", text:"연동 저장 · 이력 기록" },
    { kind:"note",  at:"pg", text:"여기 등록된 채널이 채팅 수집기의 '수집 대상'이다(SEQ-CHAT-01에서 조회). 없으면 볼 채널이 없다." },
    { kind:"fragStart", type:"opt", label:"연동 해제 — 그 채널로 방송 중이면" },
    { kind:"sync",  from:"streamer", to:"core", text:"연동 해제" },
    { kind:"async", from:"core", to:"chat", text:"수집 종료 (지금부터 새로 안 모음)" },
    { kind:"note",  at:"chat", text:"이미 모은 원본은 지우지 않는다." },
    { kind:"fragEnd" }
  ],
  notes: ["방송 채널(치지직·SOOP)과 업로드 채널(유튜브 · SEQ-LINK-02)은 서로 다른 외부 시스템이다."]
},

"SEQ-LINK-02": {
  title: "유튜브 채널 연동과 토큰 보관",
  trigger: "업로드 대상 유튜브 채널을 연동한다",
  purpose: "업로드에 쓸 권한을 받고 토큰을 어떻게 보관하는지. " +
           "로그인용 Google 연동과 왜 분리돼 있는지를 보인다.",
  relatedUcIds: ["UC-03"],
  relatedIaNodeIds: ["ia-link"],
  relatedServiceIds: ["cm-link", "ac-web", "ex-yt"],
  relatedComponentIds: ["core", "pg", "ex-yt"],
  participants: P(["streamer", "core", "yt", "pg"]),
  steps: [
    { kind:"sync",  from:"streamer", to:"core", text:"유튜브 채널 연동 (업로드 권한)" },
    { kind:"sync",  from:"core", to:"yt", text:"동의 요청 → 토큰 교환" },
    { kind:"reply", from:"yt", to:"core", text:"토큰 · 채널 목록" },
    { kind:"sync",  from:"streamer", to:"core", text:"업로드 대상 채널 선택" },
    { kind:"store", from:"core", to:"pg", text:"토큰 암호화 저장 (KMS) · 대상 채널 · 이력" },
    { kind:"reply", from:"core", to:"streamer", text:"연동 완료 — 업로드 가능" },
    { kind:"note",  at:"pg", text:"토큰은 평문으로 두지 않는다(④ PostgreSQL, KMS 암호화). 업로드 워커도 직접 들고 있지 않고 필요할 때 받아 쓴다." }
  ],
  notes: ["편집자가 이 채널로 올릴 수 있는지는 별개의 권한 단계이며 Gate가 판정한다(ADR-012)."]
},

"SEQ-LINK-03": {
  title: "유튜브 토큰 만료 · 철회와 재인증 (실패 · 복구)",
  trigger: "업로드 도중 토큰이 거부된다",
  purpose: "권한이 사라졌을 때 작업을 잃지 않고 사람에게 넘기는 경로. " +
           "무조건 재시도하지 않는 이유를 보인다.",
  relatedUcIds: ["UC-03", "UC-27"],
  relatedIaNodeIds: ["ia-link", "ia-upstatus"],
  relatedServiceIds: ["cm-link", "mk-upload", "ex-yt"],
  relatedComponentIds: ["w-upload", "core", "pg", "ex-yt"],
  participants: P(["wupload", "core", "pg", "yt"]),
  steps: [
    { kind:"sync",  from:"wupload", to:"core", text:"업로드용 토큰 요청" },
    { kind:"store", from:"core", to:"pg", text:"암호화 토큰 조회 · 복호화" },
    { kind:"sync",  from:"core", to:"yt", text:"토큰 갱신" },
    { kind:"fragStart", type:"alt", label:"갱신 결과" },
    { kind:"fragCase", label:"성공" },
    { kind:"reply", from:"core", to:"wupload", text:"토큰 전달 — 업로드 계속" },
    { kind:"fragElse", label:"만료 · 철회" },
    { kind:"store", from:"core", to:"pg", text:"'재인증 필요' 표시 · 작업 보류" },
    { kind:"reply", from:"core", to:"wupload", text:"토큰 없음 — 재시도하지 말 것" },
    { kind:"note",  at:"wupload", text:"백오프로 계속 두드려도 권한은 안 돌아온다. 사람이 다시 동의해야 풀리는 문제라 큐를 태우지 않고 멈춰 세운다(재인증은 SEQ-LINK-02)." },
    { kind:"fragEnd" }
  ],
  notes: ["보류된 업로드는 같은 attempt로 이어진다. 새 시도를 만들면 같은 클립이 두 번 올라갈 수 있다.",
          "이 실패는 DLQ로 보내지 않는다 — DLQ는 '재시도로 풀리는 실패'용이다."]
}

});

/* ══ 플러그인 ════════════════════════════════════════════════════════════ */
S.define({

"SEQ-PLUG-01": {
  title: "플러그인 설치 · Stream Key 등록 · 연결 테스트",
  trigger: "플러그인을 설치하고 처음 연결한다",
  purpose: "OBS와 서비스가 서로를 알아보게 되기까지. 방송 전에 문제를 " +
           "미리 드러내는 자리를 만든다.",
  relatedUcIds: ["UC-04"],
  relatedIaNodeIds: ["ia-plugin", "ia-download", "ia-set-plugin"],
  relatedServiceIds: ["ac-plugin", "rt-ingest", "cm-public"],
  relatedComponentIds: ["plugin", "core", "pg", "media"],
  participants: P(["plugin", "core", "pg", "media"]),
  steps: [
    { kind:"sync",  from:"plugin", to:"core", text:"Stream Key 등록 · 연결 확인" },
    { kind:"store", from:"core", to:"pg", text:"Key 검증 · 구독 상태 확인" },
    { kind:"reply", from:"core", to:"plugin", text:"확인 · 오디오 트랙 매핑 규칙" },
    { kind:"fragStart", type:"opt", label:"송출 테스트" },
    { kind:"sync",  from:"plugin", to:"media", text:"짧은 테스트 송출" },
    { kind:"reply", from:"media", to:"plugin", text:"수신 확인 · 트랙 인식 결과" },
    { kind:"note",  at:"media", text:"테스트는 방송 세션을 만들지 않는다. 수신 가능 여부와 트랙 매핑만 확인한다." },
    { kind:"fragEnd" },
    { kind:"note", at:"plugin", text:"방송 시작 순간이 아니라 설정 단계에서 실패(Key 오류·방화벽·버전)를 미리 드러내는 게 목적이다." }
  ],
  notes: ["플러그인은 별도 로그인을 하지 않는다. Stream Key 자체가 인증 수단이다."]
},

"SEQ-PLUG-02": {
  title: "핫키 수동 마킹 → 하이라이트 카드 승격",
  trigger: "방송 중 스트리머가 플러그인 전역 핫키를 누른다",
  purpose: "채팅이 조용해도 사람이 직접 하이라이트를 만드는 경로. " +
           "자동 카드와 같은 자리에 같은 모양으로 들어간다.",
  relatedUcIds: ["UC-12", "UC-20"],
  relatedIaNodeIds: ["ia-plugin", "ia-dash"],
  relatedServiceIds: ["ac-plugin", "rt-card", "rt-buffer"],
  relatedComponentIds: ["plugin", "core", "pg", "redis"],
  participants: P(["plugin", "core", "pg", "redis"]),
  steps: [
    { kind:"async", from:"plugin", to:"core", text:"수동 마킹 (누른 시각)" },
    { kind:"self",  from:"core", text:"앞뒤 구간으로 확장 (되감기 버퍼 안)" },
    { kind:"store", from:"core", to:"pg", text:"수동 카드 저장 (멱등키: 방송+누른 시각)" },
    { kind:"store", from:"core", to:"redis", text:"화면으로 실시간 전달 (Pub/Sub)" },
    { kind:"note",  at:"redis", text:"자동 카드(UC-14)와 같은 목록·같은 모양으로 들어간다. 다른 건 만든 주체뿐." },
    { kind:"fragStart", type:"opt", label:"핫키를 연타하면" },
    { kind:"self", from:"core", text:"같은 멱등키 — 새 카드 안 만들고 무시" },
    { kind:"fragEnd" }
  ],
  notes: ["이 핫키는 우리 플러그인 기능이지 플랫폼 기능이 아니다. 감지는 채팅 기반 서버 몫이고 플러그인은 신호만 보낸다."]
}

});

/* ══ 송출 · 라이브 시청 ══════════════════════════════════════════════════ */
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
  participants: P(["plugin", "core", "media", "pg", "s3"]),
  steps: [
    { kind:"sync",  from:"plugin", to:"core", text:"송출 시작 (start)" },
    { kind:"reply", from:"core", to:"plugin", text:"승인 · SRT 접속 정보" },
    { kind:"sync",  from:"plugin", to:"media", text:"SRT 송출 (영상 1 + 오디오 최대 10)" },
    { kind:"self",  from:"media", text:"트랙 분리 · monitor audio 생성" },
    { kind:"note",  at:"core", text:"LIVE가 되는 조건은 'SRT 연결 + start' 둘 다다(부록 C). 승인만으로는 LIVE가 아니다." },
    { kind:"store", from:"core", to:"pg", text:"방송 LIVE 확정 · 채팅 수집도 함께 시작(SEQ-CHAT-01)" },
    { kind:"fragStart", type:"loop", label:"세그먼트 주기마다" },
    { kind:"store", from:"media", to:"s3", text:"CMAF 조각 저장 (라이브 1시간 롤링)" },
    { kind:"fragEnd" },
    { kind:"note", at:"s3", text:"되감기 버퍼는 별도 저장소가 아니라 이 1시간 롤링 구간이다(ADR-004). heartbeat가 끊긴다고 바로 종료는 아니다 — SEQ-BC-02." }
  ],
  notes: ["저장 포맷은 CMAF 하나로 통일(ADR-005) — 라이브와 VOD가 같은 조각을 쓴다. 미디어 서버는 Go+FFmpeg."]
},

"SEQ-BC-02": {
  title: "heartbeat 단절과 재연결 유예 (순단 ≠ 종료)",
  trigger: "플러그인 heartbeat가 만료된다",
  purpose: "인터넷이 잠깐 끊긴 것과 방송을 끝낸 것을 구분하는 규칙. " +
           "잘못 끊으면 VOD가 조각나고 카드가 흩어진다.",
  relatedUcIds: ["UC-11"],
  relatedIaNodeIds: ["ia-plugin", "ia-home"],
  relatedServiceIds: ["rt-ingest"],
  relatedComponentIds: ["plugin", "core", "pg", "media"],
  participants: P(["plugin", "core", "pg", "media"]),
  steps: [
    { kind:"self",  from:"core", text:"heartbeat 만료 감지" },
    { kind:"store", from:"core", to:"pg", text:"방송 LIVE → RECONNECTING (유예 시작)" },
    { kind:"fragStart", type:"alt", label:"유예 안에 돌아오는가" },
    { kind:"fragCase", label:"돌아온다 — 순단이었다" },
    { kind:"sync",  from:"plugin", to:"media", text:"SRT 재연결 (같은 방송)" },
    { kind:"store", from:"core", to:"pg", text:"RECONNECTING → LIVE 복귀" },
    { kind:"note",  at:"media", text:"끊긴 동안의 영상은 없다. 세그먼트에 공백이 남고, 숨기지 않는다." },
    { kind:"fragElse", label:"안 돌아온다 — 비정상 종료" },
    { kind:"store", from:"core", to:"pg", text:"유예 만료 → ENDING 확정 (SEQ-VOD-01 · SEQ-CHAT-05로)" },
    { kind:"fragEnd" },
    { kind:"note", at:"plugin", text:"유예가 끝난 뒤 돌아오면 그 방송은 이미 끝났다 — 되살리지 않고 새 방송으로 시작한다." }
  ],
  notes: ["명시적 stop은 유예 없이 즉시 ENDING이다(부록 C). 유예 길이는 'VOD 확정 속도 ↔ 순단 관용'의 맞바꿈이다."]
},

"SEQ-BC-03": {
  title: "라이브 시청과 되감기 (LL-HLS · 서명 URL)",
  trigger: "웹 앱에서 방송을 연다",
  purpose: "영상이 시청자 화면까지 오는 경로와, 원본이 직접 노출되지 않게 하는 장치.",
  relatedUcIds: ["UC-18"],
  relatedIaNodeIds: ["ia-live", "ia-dash"],
  relatedServiceIds: ["rt-play", "rt-buffer", "ac-web"],
  relatedComponentIds: ["web", "cdn", "media", "s3"],
  participants: P(["web", "cdn", "media", "s3"]),
  steps: [
    { kind:"sync",  from:"web", to:"cdn", text:"재생 요청 (서명 URL)" },
    { kind:"sync",  from:"cdn", to:"media", text:"오리진 조회 (LL-HLS 매니페스트)" },
    { kind:"reply", from:"media", to:"cdn", text:"매니페스트" },
    { kind:"reply", from:"cdn", to:"web", text:"매니페스트 (캐시)" },
    { kind:"fragStart", type:"loop", label:"세그먼트마다 — 미적중이면" },
    { kind:"store", from:"cdn", to:"s3", text:"세그먼트 읽기" },
    { kind:"reply", from:"cdn", to:"web", text:"세그먼트" },
    { kind:"fragEnd" },
    { kind:"note", at:"cdn", text:"서명 URL 없이는 S3 원본에 직접 못 닿는다(④ 재생 딜리버리). 시청 권한은 Core가 확인해 서명 URL을 내준다." },
    { kind:"note", at:"web", text:"되감기는 1시간 롤링 안에서만. 그 밖은 방송 중엔 못 보고, 방송이 끝나 VOD가 확정되면 60일간 다시 본다(SEQ-VOD-02)." }
  ],
  notes: ["라이브 대시보드의 카드·채팅량은 이 영상과 별개 경로로 온다 — SEQ-SSE-01."]
}

});

/* ══ 채팅 수집 ═══════════════════════════════════════════════════════════ */
S.define({

"SEQ-CHAT-01": {
  title: "방송 시작과 채팅 수집 활성화",
  trigger: "스트리머가 OBS 플러그인에서 송출을 시작한다",
  purpose: "방송 하나당 채팅 수집기 인스턴스가 정확히 하나만 활성화되어 " +
           "플랫폼 채팅에 연결되기까지. 중복 연결이 생기지 않는 근거를 보인다.",
  relatedUcIds: ["UC-13", "UC-11", "UC-02"],
  relatedIaNodeIds: ["ia-plugin", "ia-dash"],
  relatedServiceIds: ["rt-ingest", "rt-chat", "cm-link", "ex-chat"],
  relatedComponentIds: ["plugin", "core", "chat", "redis", "ex-chat"],
  participants: P(["plugin", "core", "chat", "redis", "plat"]),
  steps: [
    { kind:"sync",  from:"plugin", to:"core", text:"송출 시작 → 방송 LIVE 확정" },
    { kind:"async", from:"core", to:"chat", text:"수집 시작 명령 (멱등)" },
    { kind:"reply", from:"core", to:"chat", text:"수집 대상 채널 (온보딩에서 등록)" },
    { kind:"store", from:"chat", to:"redis", text:"이 방송 담당 예약 (Lease · 30초, 나만)" },
    { kind:"fragStart", type:"alt", label:"담당 예약 결과" },
    { kind:"fragCase", label:"내가 담당" },
    { kind:"sync",  from:"chat", to:"plat", text:"채팅 연결 (치지직 공식 API · 실패 시 비공식 폴백)" },
    { kind:"reply", from:"plat", to:"chat", text:"연결 수립 — 스트림 시작" },
    { kind:"store", from:"chat", to:"redis", text:"담당 예약 주기적 연장" },
    { kind:"fragElse", label:"이미 다른 인스턴스가 담당" },
    { kind:"self",  from:"chat", text:"연결하지 않고 대기 — 중복 없음" },
    { kind:"fragEnd" },
    { kind:"note", at:"chat", text:"시작 명령이 유실돼도 수집기가 주기적으로 담당 없는 방송을 스스로 이어받는다(재조정이 최종 안전망). 본방 미개시면 폴링+백오프로 기다린다(ADR-011)." }
  ],
  notes: ["이 흐름에 별도 메시지 브로커는 없다 — 조율은 Redis 예약(Lease), 명령은 Core의 내부 호출.",
          "SQS는 작업 큐 전용이라 채팅 경로엔 등장하지 않는다."]
},

"SEQ-CHAT-02": {
  title: "정상 채팅 수집 · 집계 · 보관",
  trigger: "채팅 메시지가 들어온다",
  purpose: "메시지를 실시간 집계에 반영하고 원본을 배치로 보관하기까지. " +
           "Redis와 S3의 역할이 어떻게 갈리는지 보인다.",
  relatedUcIds: ["UC-13", "UC-19"],
  relatedIaNodeIds: ["ia-dash"],
  relatedServiceIds: ["rt-chat", "rt-detect", "ex-chat"],
  relatedComponentIds: ["chat", "redis", "detect", "s3", "ex-chat"],
  participants: P(["plat", "chat", "redis", "s3", "detect"]),
  steps: [
    { kind:"fragStart", type:"loop", label:"채팅 메시지마다" },
    { kind:"async", from:"plat", to:"chat", text:"채팅 메시지" },
    { kind:"self",  from:"chat", text:"시차 보정 · 정규화" },
    { kind:"store", from:"chat", to:"redis", text:"1초 단위로 채팅 수 세기" },
    { kind:"self",  from:"chat", text:"원본은 버퍼에 쌓기 (건당 저장 안 함)" },
    { kind:"fragEnd" },
    { kind:"store", from:"detect", to:"redis", text:"집계 읽기 (감지기 · SEQ-DET-01)" },
    { kind:"store", from:"chat", to:"s3", text:"30~60초마다 원본 배치 저장 (같은 키로 재시도해도 덮어씀)" },
    { kind:"note", at:"redis", text:"Redis = 실시간 집계(원본 아님). S3 = 원본 아카이브. Redis가 통째로 사라져도 원본은 S3에 남고 집계는 워밍업부터 다시 만든다." }
  ],
  notes: ["건당 저장을 안 하는 이유는 요청 비용·오브젝트 수다. 성능 목표는 수집 시각 → 카드 표시 p95 2초."]
},

"SEQ-CHAT-03": {
  title: "플랫폼 WebSocket 단절과 재연결",
  trigger: "치지직 / SOOP 연결이 끊긴다",
  purpose: "중복 수집을 만들지 않으면서 재연결하기까지. 누가 재연결할 자격이 있는지를 담당 예약(Lease)으로 판정한다.",
  relatedUcIds: ["UC-13"],
  relatedIaNodeIds: ["ia-dash"],
  relatedServiceIds: ["rt-chat", "ex-chat"],
  relatedComponentIds: ["chat", "redis", "core", "ex-chat"],
  participants: P(["plat", "chat", "redis", "core"]),
  steps: [
    { kind:"async", from:"plat", to:"chat", text:"연결 끊김" },
    { kind:"store", from:"chat", to:"redis", text:"내가 아직 담당인가 확인" },
    { kind:"fragStart", type:"alt", label:"담당 여부" },
    { kind:"fragCase", label:"내가 담당 — 재연결 자격 있음" },
    { kind:"self",  from:"chat", text:"지수 백오프로 재연결 · 그동안 담당 예약 연장" },
    { kind:"sync",  from:"chat", to:"plat", text:"재연결" },
    { kind:"note",  at:"chat", text:"재연결 구간의 집계 중복은 감지기의 멀티윈도우·롤링 베이스라인이 흡수한다. S3 아카이브는 키가 멱등이라 중복 객체가 안 생긴다. 메시지 단위 중복 제거는 미정(TBD)." },
    { kind:"fragElse", label:"임계 넘게 실패" },
    { kind:"sync",  from:"chat", to:"core", text:"수집 중단 보고 (화면엔 '자동 감지 일시 중단')" },
    { kind:"fragElse", label:"내가 담당이 아님 (인계된 뒤)" },
    { kind:"self",  from:"chat", text:"재연결하지 않고 정리 — 중복 방지" },
    { kind:"fragEnd" }
  ],
  notes: ["여기서 바꾸는 건 수집기 자신의 상태다. 방송 상태(부록 C)는 Core가 PostgreSQL에 기록한다 — 이름을 섞지 않는다.",
          "외부 API의 과거 메시지 Replay는 가정하지 않는다."]
},

"SEQ-CHAT-04": {
  title: "채팅 수집기 장애와 Lease 인계",
  trigger: "수집 중인 인스턴스가 죽거나 멈춘다",
  purpose: "다른 인스턴스가 수집을 이어받기까지. 무엇이 유실되고 무엇이 유실되지 않는지 숨기지 않는다.",
  relatedUcIds: ["UC-13"],
  relatedIaNodeIds: ["ia-dash"],
  relatedServiceIds: ["rt-chat"],
  relatedComponentIds: ["chat", "redis", "core"],
  participants: P(["chatA", "redis", "chatB", "core"]),
  steps: [
    { kind:"self",  from:"chatA", text:"프로세스 다운 — 담당 예약 연장 중단" },
    { kind:"store", from:"chatB", to:"redis", text:"담당 획득 시도" },
    { kind:"reply", from:"redis", to:"chatB", text:"아직 A 예약 유효 → 실패 · TTL 지나면 성공" },
    { kind:"note",  at:"redis", text:"예약이 살아 있는 동안엔 아무도 탈취하지 않는다. 이 구간(최대 TTL)은 수집 공백이고 그동안의 채팅은 복구되지 않는다." },
    { kind:"sync",  from:"chatB", to:"core", text:"이 방송 아직 LIVE인가 재확인" },
    { kind:"sync",  from:"chatB", to:"redis", text:"담당 확정 후 수집 재개" },
    { kind:"note",  at:"chatB", text:"유실 = A가 버퍼에 들고 있던 원본 + 공백 구간. 유실 안 됨 = 이미 S3에 올라간 배치 + PostgreSQL의 방송 상태. A가 늦게 살아나도 '쓰기 전 담당 재확인' 규칙으로 즉시 종료한다." },
    { kind:"note",  at:"redis", text:"이건 수집기 장애다. Redis 장애는 다른 사건 — replica 자동 승격, 복제 지연분 유실, 감지는 워밍업 재시작(부록 A)." }
  ],
  notes: ["TTL은 '인계 속도 ↔ 중복 방지'의 맞바꿈이다. 장애 구간 메시지를 플랫폼에서 되받는 것은 가정하지 않는다."]
},

"SEQ-CHAT-05": {
  title: "방송 종료와 아카이브 최종 Flush",
  trigger: "명시적 stop, 또는 heartbeat 만료 후 재연결 유예 실패",
  purpose: "정상 종료와 비정상 단절을 구분해 확정하고, 남은 원본을 잃지 않고 수집을 닫기까지.",
  relatedUcIds: ["UC-13", "UC-11", "UC-15"],
  relatedIaNodeIds: ["ia-plugin", "ia-dash"],
  relatedServiceIds: ["rt-ingest", "rt-chat", "ar-vod"],
  relatedComponentIds: ["plugin", "core", "chat", "ex-chat", "s3"],
  participants: P(["plugin", "core", "chat", "plat", "s3"]),
  steps: [
    { kind:"fragStart", type:"alt", label:"종료 판정" },
    { kind:"fragCase", label:"정상 종료 — 명시적 stop" },
    { kind:"sync",  from:"plugin", to:"core", text:"stop" },
    { kind:"fragElse", label:"비정상 — heartbeat 만료 후 유예 실패" },
    { kind:"self",  from:"core", text:"유예 만료 → 종료 확정 (순단은 종료 아님)" },
    { kind:"fragEnd" },
    { kind:"self",  from:"core", text:"ENDING 확정 기록 (PostgreSQL · Outbox 함께)" },
    { kind:"async", from:"core", to:"chat", text:"수집 종료 명령 (멱등)" },
    { kind:"sync",  from:"chat", to:"plat", text:"연결 종료" },
    { kind:"store", from:"chat", to:"s3", text:"잔여 원본 최종 저장 (실패하면 재시도·담당 예약 유지)" },
    { kind:"note", at:"chat", text:"집계는 지우지 않고 TTL로 자연 만료 — 종료 직후에도 채팅량 그래프를 그대로 본다. 담당 예약은 내가 소유일 때만 해제." }
  ],
  notes: ["정상 종료는 즉시, 비정상 단절은 유예를 거친 뒤에만 확정한다(부록 C).",
          "ENDING은 vod-finalize 작업 발행도 함께 일으킨다 — 이후는 SEQ-VOD-01."]
}

});

/* ══ 감지 · 실시간 갱신 ══════════════════════════════════════════════════ */
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
    { kind:"store", from:"detect", to:"redis", text:"1초 집계 읽기" },
    { kind:"self",  from:"detect", text:"평소 대비 편차 · 멀티윈도우 합의로 피크 판정" },
    { kind:"fragStart", type:"alt", label:"판정" },
    { kind:"fragCase", label:"피크로 인정" },
    { kind:"sync",  from:"detect", to:"core", text:"카드 후보 (멱등키)" },
    { kind:"store", from:"core", to:"pg", text:"카드 저장 (알림도 같은 묶음으로 — Outbox)" },
    { kind:"store", from:"core", to:"redis", text:"화면으로 발행 (Pub/Sub)" },
    { kind:"async", from:"core", to:"web", text:"카드 추가" },
    { kind:"fragElse", label:"같은 멱등키가 이미 있음" },
    { kind:"self", from:"core", text:"중복 — 새 카드 안 만듦" },
    { kind:"fragEnd" },
    { kind:"note", at:"pg", text:"카드만 저장되고 알림이 유실되면 화면에 영영 안 뜬다. 반대면 없는 카드를 가리킨다. 그래서 한 묶음(트랜잭션)에 넣고 발행은 커밋 뒤에 한다." }
  ],
  notes: ["감지 입력은 채팅뿐이다. 성능 목표 — 피크 감지 → 카드 표시 p95 1초.",
          "수동 핫키 카드도 같은 목록에 같은 모양으로 들어간다(SEQ-PLUG-02)."]
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
  participants: P(["detect", "redis", "core", "web"]),
  steps: [
    { kind:"store", from:"detect", to:"redis", text:"집계 읽기" },
    { kind:"fragStart", type:"alt", label:"감지기 상태" },
    { kind:"fragCase", label:"워밍업 중 — '평소'가 아직 없다" },
    { kind:"self", from:"detect", text:"카드 발행 보류 (통계만 쌓기)" },
    { kind:"note", at:"detect", text:"방송 시작 직후엔 대부분 오탐이라 미룬다. 그 구간은 핫키(UC-12)로 메운다." },
    { kind:"fragElse", label:"집계가 비었다 — 수집 끊김" },
    { kind:"sync", from:"detect", to:"core", text:"감지 일시 중단 (0을 '조용한 방송'으로 오해 안 함)" },
    { kind:"async", from:"core", to:"web", text:"'자동 감지 일시 중단 · 핫키로 계속 가능'" },
    { kind:"fragElse", label:"Redis가 비었다 (장애 복구 직후)" },
    { kind:"self", from:"detect", text:"베이스라인 버리고 워밍업부터 다시" },
    { kind:"fragEnd" },
    { kind:"note", at:"web", text:"방송·원본 보관은 계속된다. 없어진 건 자동 감지뿐이고 화면은 그 사실을 감추지 않는다." }
  ],
  notes: ["기능별 공개 상태 표시는 SEQ-PUB-03이 맡는다."]
},

"SEQ-SSE-01": {
  title: "실시간 갱신 — 다중 서버 SSE 팬아웃",
  trigger: "웹 앱이 라이브 대시보드를 연다",
  purpose: "카드·채팅량·상태가 새로고침 없이 갱신되는 경로. Core가 여러 대일 때 " +
           "어느 서버에 붙어도 같은 이벤트를 받는 이유를 보인다.",
  relatedUcIds: ["UC-19", "UC-20"],
  relatedIaNodeIds: ["ia-live", "ia-dash"],
  relatedServiceIds: ["rt-card", "ac-web"],
  relatedComponentIds: ["web", "core", "redis"],
  participants: P(["web", "core", "redis", "detect"]),
  steps: [
    { kind:"sync",  from:"web", to:"core", text:"현재 상태 조회 (스냅샷)" },
    { kind:"reply", from:"core", to:"web", text:"카드 목록 · 채팅량 · 방송 상태" },
    { kind:"store", from:"core", to:"redis", text:"이 방송 실시간 구독 (Pub/Sub)" },
    { kind:"note",  at:"core", text:"브라우저는 Core 여러 대 중 아무 데나 붙는다. 이벤트를 만든 서버와 다를 수 있어 팬아웃을 Redis가 맡는다." },
    { kind:"fragStart", type:"loop", label:"이벤트가 생길 때마다" },
    { kind:"sync",  from:"detect", to:"core", text:"카드 후보 (다른 인스턴스에 도착)" },
    { kind:"store", from:"core", to:"redis", text:"구독 중인 모든 서버로 발행" },
    { kind:"async", from:"core", to:"web", text:"카드 추가 · 채팅량 갱신" },
    { kind:"fragEnd" },
    { kind:"note", at:"web", text:"화면 첫 그림은 항상 스냅샷이고 SSE는 그 위 증분이다. 순서를 뒤집으면 새로고침마다 화면이 비어 보인다." }
  ],
  notes: ["Redis는 여기서도 원본이 아니다 — 카드 원본은 PostgreSQL. 끊김 복구는 SEQ-SSE-02."]
},

"SEQ-SSE-02": {
  title: "SSE 끊김과 스냅샷 복구 (실패 · 복구)",
  trigger: "SSE 연결이 끊기거나 Redis Pub/Sub이 멈춘다",
  purpose: "실시간 경로가 죽어도 화면이 거짓말하지 않게 하는 방법. " +
           "'모르는 상태'를 '정상'으로 그리지 않는다.",
  relatedUcIds: ["UC-19", "UC-20"],
  relatedIaNodeIds: ["ia-dash"],
  relatedServiceIds: ["rt-card", "ac-web"],
  relatedComponentIds: ["web", "core", "redis", "pg"],
  participants: P(["web", "core", "pg", "redis"]),
  steps: [
    { kind:"self",  from:"web", text:"끊김 감지 → '실시간 연결 끊김' 표시 (마지막 갱신 시각과 함께)" },
    { kind:"note",  at:"web", text:"끊긴 걸 숨기고 옛 화면을 두면 '조용한 방송'으로 오해한다. 상태를 드러내는 쪽을 고른다." },
    { kind:"self",  from:"web", text:"지수 백오프로 재연결" },
    { kind:"fragStart", type:"alt", label:"복구" },
    { kind:"fragCase", label:"재연결 성공" },
    { kind:"sync",  from:"web", to:"core", text:"스냅샷 재조회 (끊긴 동안 증분을 메움)" },
    { kind:"store", from:"core", to:"pg", text:"카드 목록 · 방송 상태 (원본)" },
    { kind:"reply", from:"core", to:"web", text:"스냅샷 → 화면 덮어쓰고 정상 복귀" },
    { kind:"fragElse", label:"Redis Pub/Sub 자체가 죽음" },
    { kind:"store", from:"redis", to:"redis", text:"발행 실패 — 팬아웃만 멈춤" },
    { kind:"note",  at:"core", text:"카드는 PostgreSQL·Outbox에 정상 저장돼 있다. 복구되면 화면은 스냅샷으로 다시 맞춰진다(부록 A)." },
    { kind:"fragEnd" }
  ],
  notes: ["Pub/Sub은 놓친 이벤트를 되돌려주지 않는다. 그래서 복구는 반드시 원본(PostgreSQL) 스냅샷으로 한다."]
}

});

/* ══ VOD · 아카이브 ══════════════════════════════════════════════════════ */
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
    { kind:"store", from:"core", to:"pg", text:"ENDING 확정 (같은 트랜잭션에 Outbox)" },
    { kind:"store", from:"core", to:"sqs", text:"vod-finalize 작업 발행 (jobId 멱등)" },
    { kind:"note",  at:"sqs", text:"SQS 다섯 큐 중 하나 — vod-finalize · subtitle · preview · render · upload. 각각 전용 DLQ." },
    { kind:"sync",  from:"media", to:"sqs", text:"작업 수신" },
    { kind:"store", from:"media", to:"s3", text:"세그먼트 목록 읽기" },
    { kind:"self",  from:"media", text:"VOD 매니페스트 확정 (파일 이동·재인코딩 없음)" },
    { kind:"store", from:"media", to:"s3", text:"매니페스트 저장 · 보관 60일" },
    { kind:"store", from:"core", to:"pg", text:"VOD READY · 만료일 기록" },
    { kind:"note",  at:"media", text:"입력은 S3 세그먼트 + PostgreSQL 방송 상태뿐이다. 로컬 상태에 안 기대니 어느 인스턴스가 실행해도 결과가 같다(멱등). 반복 실패는 vod-finalize DLQ로." }
  ],
  notes: ["VOD 전환은 재인코딩이 아니라 매니페스트 확정(ADR-005) — 빠르고 실패해도 잃는 게 없다.",
          "발행은 Core, 소비는 미디어 서버 — 책임이 갈린다."]
},

"SEQ-VOD-02": {
  title: "VOD 시청과 카드 챕터 이동",
  trigger: "보관된 방송을 다시 본다",
  purpose: "끝난 방송에서도 카드와 채팅량 그래프가 그대로 살아 있는 이유. " +
           "라이브와 같은 편집 진입점을 쓰는 것을 보인다.",
  relatedUcIds: ["UC-21", "UC-19"],
  relatedIaNodeIds: ["ia-vod"],
  relatedServiceIds: ["ar-vod", "rt-play", "rt-card"],
  relatedComponentIds: ["web", "cdn", "core", "pg"],
  participants: P(["web", "core", "pg", "cdn"]),
  steps: [
    { kind:"sync",  from:"web", to:"core", text:"VOD 열기" },
    { kind:"store", from:"core", to:"pg", text:"VOD 상태 · 카드 목록 · 만료일 조회" },
    { kind:"fragStart", type:"alt", label:"보관 기간" },
    { kind:"fragCase", label:"60일 안" },
    { kind:"reply", from:"core", to:"web", text:"매니페스트 서명 URL + 카드(챕터) + 채팅량" },
    { kind:"sync",  from:"web", to:"cdn", text:"세그먼트 재생 (서명 URL)" },
    { kind:"note",  at:"web", text:"카드를 누르면 그 시점으로 — 라이브와 VOD의 편집 진입은 같다(SEQ-EDIT-01)." },
    { kind:"fragElse", label:"만료됨" },
    { kind:"reply", from:"core", to:"web", text:"원본 없음 — 카드 열람만, 재출력 불가(SEQ-VOD-03)" },
    { kind:"fragEnd" },
    { kind:"note", at:"pg", text:"채팅량 그래프는 실시간 Redis가 아니라 보관된 값으로 다시 그린다 — Redis 버킷은 이미 TTL로 사라졌을 수 있다." }
  ],
  notes: ["세그먼트는 CDN이 S3에서 읽어 캐시한다. 이미 완성된 클립은 별도 보관이라 VOD가 만료돼도 남는다."]
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
  participants: P(["core", "pg", "s3", "web"]),
  steps: [
    { kind:"self",  from:"core", text:"만료 임박 판정 (주기 작업)" },
    { kind:"async", from:"core", to:"web", text:"알림 — 'VOD 만료 임박, 필요한 구간은 지금 출력'" },
    { kind:"note",  at:"web", text:"알림 on/off는 사용자 설정을 따른다(UC-08). 만료 전에 출력해 둔 완성 클립은 만료 뒤에도 남는다." },
    { kind:"self",  from:"core", text:"보관 기한 도달" },
    { kind:"store", from:"core", to:"s3", text:"VOD 세그먼트 수명 만료" },
    { kind:"store", from:"core", to:"pg", text:"VOD EXPIRED · 카드는 남김" },
    { kind:"note",  at:"core", text:"만료 뒤 — 카드 열람·챕터는 가능(메타는 PostgreSQL에 남음), 재출력·새 편집은 불가(원본 세그먼트가 없음). 편집기 진입 시점에 막고 이유를 말한다." }
  ],
  notes: ["EXPIRED는 방송 상태 머신의 종착점(부록 C). 재출력 가능 기간은 VOD 보관 60일과 같다."]
}

});

/* ══ 편집 · 렌더 · 자산 ══════════════════════════════════════════════════ */
S.define({

"SEQ-EDIT-01": {
  title: "클립 편집 진입과 미리보기 자산 준비",
  trigger: "카드 또는 보관함 편집본에서 편집기로 들어간다",
  purpose: "편집 화면이 열리기까지. 미리보기가 서버 렌더 없이 되는 이유와, " +
           "그래도 워커가 필요한 자산이 무엇인지를 가른다.",
  relatedUcIds: ["UC-22", "UC-20"],
  relatedIaNodeIds: ["ia-clip", "ia-editor"],
  relatedServiceIds: ["mk-edit", "rt-card", "mk-store", "ac-web"],
  relatedComponentIds: ["web", "core", "pg", "w-prev", "s3"],
  participants: P(["web", "core", "pg", "wprev", "s3"]),
  steps: [
    { kind:"sync",  from:"web", to:"core", text:"편집 진입" },
    { kind:"store", from:"core", to:"pg", text:"카드 · 편집 레시피(JSONB) · 원본 구간 조회" },
    { kind:"reply", from:"core", to:"web", text:"편집 상태 + 원본 세그먼트 서명 URL" },
    { kind:"note",  at:"web", text:"구간·트랙·비율 미리보기는 브라우저가 원본을 직접 재생해 그린다 — 서버 렌더를 안 태우니 즉각적이다." },
    { kind:"fragStart", type:"opt", label:"썸네일·파형이 아직 없으면" },
    { kind:"sync",  from:"wprev", to:"s3", text:"원본 읽어 썸네일 · 파형 만들기 (작업 큐 경유)" },
    { kind:"async", from:"core", to:"web", text:"파형 표시 · 무음 트랙 자동 숨김" },
    { kind:"note",  at:"wprev", text:"무음 트랙 숨김은 별도 기능이 아니라 파형 계산의 부산물이다 — 한 작업으로 둘 다 나온다." },
    { kind:"fragEnd" },
    { kind:"note", at:"pg", text:"편집 상태는 레시피(JSONB)로 저장한다 — 구간·트랙·볼륨·비율·자막 모드. 영상 자체를 복제하지 않는다." }
  ],
  notes: ["구간은 5초~3분(UC-22). AI 자막은 P2에 붙는 별도 흐름 — SEQ-EDIT-02."]
},

"SEQ-EDIT-02": {
  title: "AI 자막 생성과 직접 수정 (P2)",
  trigger: "편집 중 자막 생성을 요청한다",
  purpose: "선택된 오디오 트랙만 STT에 태우는 경로와, 결과가 편집자의 손을 " +
           "거쳐 확정되는 과정. STT 엔진이 아직 미정인 것도 그대로 둔다.",
  relatedUcIds: ["UC-22"],
  relatedIaNodeIds: ["ia-editor"],
  relatedServiceIds: ["mk-stt", "mk-edit"],
  relatedComponentIds: ["web", "core", "sqs", "w-sub", "s3"],
  participants: P(["web", "core", "sqs", "wsub", "s3"]),
  steps: [
    { kind:"sync",  from:"web", to:"core", text:"자막 생성 요청 (대상 트랙)" },
    { kind:"store", from:"core", to:"sqs", text:"subtitle 작업 발행 (비동기)" },
    { kind:"sync",  from:"wsub", to:"s3", text:"선택된 트랙 구간만 읽기" },
    { kind:"self",  from:"wsub", text:"STT 수행 → 자막 파일 저장" },
    { kind:"async", from:"core", to:"web", text:"자막 표시 — 편집 가능" },
    { kind:"sync",  from:"web", to:"core", text:"직접 수정 · 3모드 선택 (번인+CC / 번인 / CC)" },
    { kind:"note",  at:"wsub", text:"STT 엔진은 미정(TBD) — 후보 CPU whisper.cpp / EC2 GPU Whisper. 관리형 STT는 ADR-013에서 배제, Fargate GPU는 전제하지 않는다." },
    { kind:"note",  at:"web", text:"자막은 부가 기능이다. 실패해도 편집·렌더·업로드는 막지 않는다. 번인 자막은 렌더에서 굽는다(SEQ-EDIT-04)." }
  ],
  notes: ["자막 워커는 P2에서 새로 뜨는 유일한 실행 단위다(④). 제목 추천도 자막 기반이지만 확정은 사람·템플릿이 한다."]
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
    { kind:"async", from:"web", to:"core", text:"편집 중 자동 임시 저장 (레시피 델타)" },
    { kind:"store", from:"core", to:"pg", text:"임시 레시피 갱신 (JSONB)" },
    { kind:"note",  at:"pg", text:"저장하는 건 편집 지시(구간·트랙·볼륨·비율·자막)뿐. 영상은 원본을 가리키기만 하므로 용량이 거의 안 들고 저장이 빠르다." },
    { kind:"sync",  from:"web", to:"core", text:"명시적 저장 (이름 지정)" },
    { kind:"store", from:"core", to:"pg", text:"편집본 확정 · 버전 기록" },
    { kind:"fragStart", type:"alt", label:"나중에 다시 열 때" },
    { kind:"fragCase", label:"원본 VOD가 살아 있음 (60일 안)" },
    { kind:"store", from:"core", to:"s3", text:"원본 존재 확인 → 편집 재개 · 재출력 가능" },
    { kind:"fragElse", label:"원본 만료" },
    { kind:"reply", from:"core", to:"web", text:"레시피는 있으나 원본 없음 — 열람만" },
    { kind:"fragEnd" }
  ],
  notes: ["완성 클립은 VOD와 수명이 다르다 — VOD 60일이 지나도 이미 만든 클립은 남는다.",
          "임시 저장과 명시적 저장을 나눈 건 '덮어쓰기'와 '창 닫아 잃기'를 둘 다 막기 위해서다."]
},

"SEQ-EDIT-04": {
  title: "렌더 출력 — 구간 · 트랙 · 비율 · 자막 굽기",
  trigger: "편집본을 실제 영상 파일로 만든다",
  purpose: "브라우저 미리보기가 실제 파일이 되는 지점. 렌더를 따로 떼어 " +
           "실행하는 이유(CPU 포화가 업로드를 막지 않게)를 보인다.",
  relatedUcIds: ["UC-22", "UC-23"],
  relatedIaNodeIds: ["ia-editor", "ia-library"],
  relatedServiceIds: ["mk-render", "mk-store"],
  relatedComponentIds: ["web", "core", "sqs", "w-render", "s3"],
  participants: P(["web", "core", "sqs", "wrender", "s3"]),
  steps: [
    { kind:"sync",  from:"web", to:"core", text:"렌더 요청" },
    { kind:"store", from:"core", to:"sqs", text:"render 작업 발행 (jobId = 편집본+버전)" },
    { kind:"note",  at:"sqs", text:"렌더는 오래 걸려 render 큐만 처리 시간을 길게 잡는다 — 짧으면 처리 중인 작업이 다른 워커에 또 배달된다." },
    { kind:"sync",  from:"wrender", to:"s3", text:"원본 · 자막 읽기" },
    { kind:"self",  from:"wrender", text:"구간 자르기 · 트랙 믹스 · 비율 · 자막 번인 (FFmpeg)" },
    { kind:"store", from:"wrender", to:"s3", text:"완성 클립 저장 (별도 보관)" },
    { kind:"async", from:"core", to:"web", text:"완료 — 업로드 가능" },
    { kind:"note",  at:"wrender", text:"같은 버전으로 다시 요청하면 다시 굽지 않고 그대로 돌려준다(멱등). 렌더 워커와 업로드 워커를 따로 둔 이유 — 렌더가 CPU를 다 써도 업로드는 나가야 한다." }
  ],
  notes: ["번인 자막은 여기서 굽고, CC 자막은 업로드 시 유튜브에 따로 등록한다. 실패 처리는 SEQ-EDIT-05."]
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
  participants: P(["wrender", "sqs", "core", "pg", "web"]),
  steps: [
    { kind:"self",  from:"wrender", text:"렌더 실패 (원본 손상 · 자원 부족 · 프로세스 종료)" },
    { kind:"fragStart", type:"alt", label:"실패 성격" },
    { kind:"fragCase", label:"일시적 — 자원 부족·순단" },
    { kind:"sync",  from:"wrender", to:"sqs", text:"작업 반환 → 재시도 (같은 jobId · 멱등)" },
    { kind:"note",  at:"sqs", text:"같은 jobId라 성공하면 결과가 하나만 남는다. 중간 부분 산출물은 임시 경로라 수명 정책으로 사라진다." },
    { kind:"fragElse", label:"영속적 — 원본 없음·레시피 깨짐" },
    { kind:"store", from:"sqs", to:"sqs", text:"render DLQ로 이동" },
    { kind:"store", from:"core", to:"pg", text:"클립 FAILED · 사유 기록" },
    { kind:"async", from:"core", to:"web", text:"보관함에 실패 표시 — 사유 · 재시도 버튼" },
    { kind:"fragEnd" },
    { kind:"note", at:"web", text:"'실패'로 끝내지 않고 이유와 다음 할 일을 준다. 원본 만료라면 재시도해도 소용없다는 것까지 말한다. DLQ는 큐마다 따로라 렌더가 막혀도 다른 큐는 흐른다." }
  ],
  notes: ["재시도로 안 풀리는 실패를 큐에 계속 두면 정상 작업까지 밀린다 — 그래서 DLQ로 뺀다."]
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
    { kind:"sync",  from:"web", to:"core", text:"삭제 요청" },
    { kind:"store", from:"core", to:"pg", text:"삭제 상태 기록 · 이력 남김" },
    { kind:"store", from:"core", to:"s3", text:"산출물 삭제 표시" },
    { kind:"fragStart", type:"alt", label:"이미 유튜브에 올라간 클립인가" },
    { kind:"fragCase", label:"올라갔다" },
    { kind:"reply", from:"core", to:"web", text:"안내 — 유튜브에선 직접 삭제해야 함" },
    { kind:"note", at:"core", text:"유튜브 영상은 우리가 지우지 않는다(UC-28). 우리 쪽 사본·편집본만 사라지고 업로드 이력은 남는다." },
    { kind:"fragElse", label:"안 올라갔다" },
    { kind:"self", from:"core", text:"우리 쪽만 정리하면 끝" },
    { kind:"fragEnd" },
    { kind:"note", at:"core", text:"진행 중인 렌더·업로드 작업은 취소 표시만 하고, 워커가 끝내고 보고할 때 '삭제됨'을 보고 결과를 버린다." }
  ],
  notes: ["삭제 이력은 audit_log에 남는다. 계정 삭제 시 보관물 처리 정책은 미정(TBD · SEQ-AUTH-02)."]
}

});

/* ══ 업로드 · 승인 · 템플릿 ══════════════════════════════════════════════ */
S.define({

"SEQ-UP-01": {
  title: "유튜브 업로드 — 권한 2단 검사",
  trigger: "완성된 클립을 유튜브에 올린다",
  purpose: "권한을 두 번 확인하는 이유와, 그 사이에 무슨 일이 생길 수 있는지. " +
           "기본 비공개로 올라가는 정책이 어디에서 적용되는지 보인다.",
  relatedUcIds: ["UC-25"],
  relatedIaNodeIds: ["ia-upload", "ia-upstatus"],
  relatedServiceIds: ["mk-upload", "ac-web", "ex-yt"],
  relatedComponentIds: ["core", "gate", "sqs", "w-upload", "ex-yt"],
  participants: P(["core", "gate", "sqs", "wupload", "yt"]),
  steps: [
    { kind:"sync",  from:"core", to:"gate", text:"1차 검사 — 작업을 만들어도 되나" },
    { kind:"fragStart", type:"alt", label:"1차 판정" },
    { kind:"fragCase", label:"직접 업로드 권한 있음" },
    { kind:"store", from:"core", to:"sqs", text:"upload 작업 발행" },
    { kind:"sync",  from:"wupload", to:"gate", text:"2차 검사 — 지금도 권한이 있나" },
    { kind:"sync",  from:"wupload", to:"yt", text:"영상 업로드 — 기본 비공개 (+ CC 자막이면 등록)" },
    { kind:"reply", from:"wupload", to:"core", text:"완료 (videoId) → 기록 · 이력" },
    { kind:"fragElse", label:"권한 없음" },
    { kind:"reply", from:"gate", to:"core", text:"차단 → 승인 대기함으로 (SEQ-UP-02)" },
    { kind:"fragEnd" },
    { kind:"note", at:"gate", text:"큐에 들어간 뒤 실제 업로드까지 시간이 뜬다. 그 사이 권한이 회수되면 1차 판정은 낡았다 — 그래서 업로드 직전 2차로 다시 본다. 판정 원본은 PostgreSQL." }
  ],
  notes: ["기본 비공개로 올린다(ADR-010). 공개 전환은 사람이 유튜브에서.",
          "실패·불명확 성공 복구는 SEQ-UP-05. 토큰 만료는 SEQ-LINK-03."]
},

"SEQ-UP-02": {
  title: "권한 부족 → 업로드 승인 요청",
  trigger: "권한 없는 편집자가 업로드를 시도한다",
  purpose: "차단 대신 대기함으로 보내는 흐름. 편집자의 작업물이 " +
           "권한 때문에 버려지지 않게 하는 장치.",
  relatedUcIds: ["UC-29", "UC-25", "UC-26"],
  relatedIaNodeIds: ["ia-upload", "ia-approvals"],
  relatedServiceIds: ["mk-upload", "mk-approve", "cm-perm", "cm-noti"],
  relatedComponentIds: ["core", "gate", "pg"],
  participants: P(["editor", "core", "gate", "pg"]),
  steps: [
    { kind:"sync",  from:"editor", to:"core", text:"업로드 시도" },
    { kind:"sync",  from:"core", to:"gate", text:"1차 검사" },
    { kind:"reply", from:"gate", to:"core", text:"차단 — 기본 권한만 보유" },
    { kind:"store", from:"core", to:"pg", text:"승인 대기 생성 · 클립 참조 유지" },
    { kind:"reply", from:"core", to:"editor", text:"'승인 대기함으로 보냈습니다' — 실패 아님" },
    { kind:"note",  at:"core", text:"권한 3단계 = 기본 / +직접 업로드 / +원클릭 자동(ADR-012). 기본 권한 편집자는 제작은 하되 업로드는 승인을 거친다. 스트리머에게 알림이 간다(SEQ-NOTI-01)." },
    { kind:"fragStart", type:"opt", label:"대기 중 권한이 회수되면" },
    { kind:"store", from:"core", to:"pg", text:"대기 요청 무효 처리" },
    { kind:"note",  at:"pg", text:"무효 처리를 안 하면 회수된 편집자 요청이 나중에 승인돼 그대로 올라간다(UC-29 예외)." },
    { kind:"fragEnd" }
  ],
  notes: ["승인이 나면 클립을 다시 만들지 않고 그 산출물을 그대로 올린다(SEQ-UP-03). 대기함은 역할별로 다르게 보인다."]
},

"SEQ-UP-03": {
  title: "업로드 승인 / 반려 처리",
  trigger: "스트리머가 승인 대기함에서 요청을 처리한다",
  purpose: "승인이 실제 업로드로 이어지는 경로와, 승인 시점에 다시 " +
           "권한을 확인하는 이유.",
  relatedUcIds: ["UC-30"],
  relatedIaNodeIds: ["ia-approvals"],
  relatedServiceIds: ["mk-approve", "cm-noti"],
  relatedComponentIds: ["core", "gate", "pg", "sqs"],
  participants: P(["streamer", "core", "gate", "pg", "sqs"]),
  steps: [
    { kind:"sync",  from:"streamer", to:"core", text:"승인 대기함 열기 (클립 미리보기로 판단)" },
    { kind:"fragStart", type:"alt", label:"처리" },
    { kind:"fragCase", label:"승인" },
    { kind:"sync",  from:"core", to:"gate", text:"승인자 권한 확인 (채널 소유자)" },
    { kind:"store", from:"core", to:"pg", text:"승인 기록 · 이력" },
    { kind:"store", from:"core", to:"sqs", text:"upload 작업 발행 (이후는 SEQ-UP-01의 2차 검사)" },
    { kind:"fragElse", label:"반려" },
    { kind:"store", from:"core", to:"pg", text:"반려 · 사유 기록 → 요청자에게 알림" },
    { kind:"fragEnd" },
    { kind:"note", at:"pg", text:"승인도 반려도 이력에 남는다 — 나중에 '누가 올렸나'를 물을 수 있어야 한다. 승인은 '작업을 만들 자격'을 대신 주는 것이지 별도 업로드 경로가 아니다." }
  ],
  notes: ["승인 권한은 채널 소유자에게 있다 — 편집자끼리 서로 승인해 주는 경로는 없다."]
},

"SEQ-UP-04": {
  title: "원클릭 자동 업로드 (템플릿 전제)",
  trigger: "핫키 또는 카드에서 원클릭을 누른다",
  purpose: "사람이 한 번 누르면 편집 화면 없이 업로드까지 가는 경로. " +
           "'무인 자동'이 아니라 '원클릭'인 이유를 분명히 한다.",
  relatedUcIds: ["UC-26", "UC-24"],
  relatedIaNodeIds: ["ia-upload", "ia-template"],
  relatedServiceIds: ["mk-tpl", "mk-upload", "mk-render", "mk-edit"],
  relatedComponentIds: ["core", "gate", "sqs"],
  participants: P(["streamer", "core", "gate", "sqs"]),
  steps: [
    { kind:"sync",  from:"streamer", to:"core", text:"원클릭 (카드 버튼 또는 핫키)" },
    { kind:"note",  at:"streamer", text:"사람의 클릭이 반드시 한 번 들어간다 — 완전 무인 자동 업로드는 두지 않는다(ADR-012 · UC-26)." },
    { kind:"self",  from:"core", text:"지정된 템플릿으로 레시피 구성 (편집 화면 없이)" },
    { kind:"sync",  from:"core", to:"gate", text:"원클릭 자동 권한 확인" },
    { kind:"fragStart", type:"alt", label:"전제 조건" },
    { kind:"fragCase", label:"템플릿 있음 · 권한 있음" },
    { kind:"store", from:"core", to:"sqs", text:"render → upload 작업 발행 (SEQ-EDIT-04 · SEQ-UP-01)" },
    { kind:"fragElse", label:"템플릿 없음" },
    { kind:"reply", from:"core", to:"streamer", text:"거절 — 템플릿을 먼저 지정 (UC-24)" },
    { kind:"fragElse", label:"권한 부족" },
    { kind:"reply", from:"gate", to:"core", text:"차단 → 승인 대기함으로 (SEQ-UP-02)" },
    { kind:"fragEnd" },
    { kind:"note", at:"core", text:"원클릭 자동 권한은 직접 업로드를 전제로만 준다(UC-07). 렌더·업로드는 여전히 각자의 큐를 탄다 — 원클릭은 사람 개입만 줄일 뿐 파이프라인을 안 바꾼다." }
  ],
  notes: ["템플릿 없으면 무인 진행할 근거(제목·설명·공개 범위)가 없어 여기서 멈춘다. 템플릿 관리는 SEQ-UP-06."]
},

"SEQ-UP-05": {
  title: "업로드 실패와 불명확한 성공 복구",
  trigger: "업로드 응답을 받지 못한 채 연결이 끊긴다",
  purpose: "'올라갔는지 모르는' 상태를 다루는 법. 무조건 재업로드가 " +
           "왜 금지인지, 무엇으로 확정하는지를 보인다.",
  relatedUcIds: ["UC-27"],
  relatedIaNodeIds: ["ia-upstatus"],
  relatedServiceIds: ["mk-upload", "ex-yt"],
  relatedComponentIds: ["w-upload", "core", "pg", "ex-yt"],
  participants: P(["wupload", "yt", "core", "pg"]),
  steps: [
    { kind:"sync",  from:"wupload", to:"yt", text:"영상 업로드" },
    { kind:"self",  from:"wupload", text:"응답 전 연결 끊김 — 성공 여부 불명" },
    { kind:"store", from:"core", to:"pg", text:"'확인 필요' 상태로 표시 (실패로 적지 않음)" },
    { kind:"note",  at:"pg", text:"'실패'로 적으면 재시도가 자동으로 돌아 같은 영상이 두 번 올라간다(부록 C의 RECONCILING)." },
    { kind:"sync",  from:"wupload", to:"yt", text:"채널 영상 목록 조회 — 올라갔나 확정" },
    { kind:"fragStart", type:"alt", label:"조회 결과" },
    { kind:"fragCase", label:"올라가 있음" },
    { kind:"store", from:"core", to:"pg", text:"성공으로 확정 (videoId)" },
    { kind:"fragElse", label:"없음" },
    { kind:"store", from:"core", to:"pg", text:"실패로 확정 — 재시도 가능" },
    { kind:"fragElse", label:"조회 자체가 안 됨 (권한·장애)" },
    { kind:"self",  from:"wupload", text:"확정 보류 — 상태 안 바꿈, '확인 중'으로 둠" },
    { kind:"fragEnd" }
  ],
  notes: ["중복 업로드는 되돌리기 어려워 확정 절차를 재시도보다 앞에 둔다. '무조건 재업로드' 버튼은 두지 않는다(UC-27).",
          "권한 만료로 조회가 막힌 경우는 SEQ-LINK-03 재인증으로."]
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
    { kind:"sync",  from:"streamer", to:"web", text:"템플릿 작성 (제목 규칙 · 설명 · 태그 · 공개 범위)" },
    { kind:"store", from:"core", to:"pg", text:"템플릿 저장 (채널 귀속)" },
    { kind:"fragStart", type:"opt", label:"원클릭에 쓸 템플릿 지정" },
    { kind:"sync",  from:"streamer", to:"web", text:"기본 템플릿 지정" },
    { kind:"store", from:"core", to:"pg", text:"지정 갱신" },
    { kind:"note",  at:"pg", text:"지정된 템플릿이 없으면 원클릭은 거절된다(SEQ-UP-04)." },
    { kind:"fragEnd" },
    { kind:"note", at:"core", text:"기본 비공개 정책은 템플릿으로 못 뒤집는다(ADR-010) — 템플릿이 정하는 건 제목·설명·태그다." }
  ],
  notes: ["템플릿은 채널 단위다. 편집자도 지정된 템플릿을 쓰지만 소유는 채널에 있다."]
}

});

/* ══ 협업 · 권한 ═════════════════════════════════════════════════════════ */
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
    { kind:"store", from:"core", to:"pg", text:"요청 저장 (대기) → 스트리머에게 알림" },
    { kind:"fragStart", type:"alt", label:"스트리머의 처리" },
    { kind:"fragCase", label:"승인 + 권한 단계 지정" },
    { kind:"sync",  from:"streamer", to:"core", text:"승인 · 단계 선택 (기본 / +직접 업로드 / +원클릭)" },
    { kind:"store", from:"core", to:"pg", text:"권한 부여 · 변경 이력 기록 → 편집자에게 알림" },
    { kind:"fragElse", label:"반려" },
    { kind:"store", from:"core", to:"pg", text:"반려 기록 → 편집자에게 알림" },
    { kind:"fragEnd" },
    { kind:"note", at:"pg", text:"단계는 관계에 붙지 계정에 안 붙는다 — 같은 사람이 채널마다 다른 단계를 가질 수 있다. +원클릭은 +직접 업로드를 전제로만 준다(ADR-012)." }
  ],
  notes: ["신청형이다 — 스트리머가 먼저 초대하는 경로는 근거가 없어 넣지 않는다. 회수·종료는 SEQ-COL-02."]
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
  participants: P(["streamer", "core", "pg", "gate", "redis"]),
  steps: [
    { kind:"sync",  from:"streamer", to:"core", text:"권한 회수 (또는 편집자의 협업 종료)" },
    { kind:"store", from:"core", to:"pg", text:"권한 무효 · 대기 중 승인 요청 무효 · 이력" },
    { kind:"store", from:"core", to:"redis", text:"세션 · 권한 캐시 무효화" },
    { kind:"note",  at:"redis", text:"판정 원본은 PostgreSQL, Redis엔 짧은 캐시. 캐시를 안 지우면 회수가 캐시 TTL만큼 늦게 먹는다." },
    { kind:"fragStart", type:"opt", label:"이미 큐에 들어간 업로드 작업이 있으면" },
    { kind:"sync",  from:"gate", to:"pg", text:"업로드 직전 2차 검사 → 권한 없음 → 차단" },
    { kind:"note",  at:"gate", text:"큐에서 작업을 빼내지 않아도 막힌다 — 2차 검사가 있는 이유가 이 구간이다(SEQ-UP-01)." },
    { kind:"fragEnd" },
    { kind:"note", at:"core", text:"즉시 전면 차단이다(UC-06·07) — 진행 중이던 편집본도 안 열린다. 이미 유튜브에 올라간 영상은 안 내려간다. 계정 삭제도 같은 효과(SEQ-AUTH-02)." }
  ],
  notes: ["대기 중 요청 무효화를 안 하면 회수된 편집자 요청이 나중에 승인돼 올라간다(UC-29 예외)."]
}

});

/* ══ 알림 ════════════════════════════════════════════════════════════════ */
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
    { kind:"self",  from:"core", text:"알림 대상 사건 발생" },
    { kind:"store", from:"core", to:"pg", text:"사건 기록 (Outbox) · 수신자 알림 설정 조회" },
    { kind:"fragStart", type:"alt", label:"이 종류를 받기로 했나" },
    { kind:"fragCase", label:"켜져 있음" },
    { kind:"store", from:"core", to:"pg", text:"알림함에 추가" },
    { kind:"store", from:"core", to:"redis", text:"화면으로 발행 (Pub/Sub)" },
    { kind:"async", from:"core", to:"web", text:"알림함 배지 갱신" },
    { kind:"fragElse", label:"꺼져 있음" },
    { kind:"self", from:"core", text:"발송 안 함 — 사건 기록은 남김" },
    { kind:"fragEnd" },
    { kind:"note", at:"core", text:"거르는 자리는 발송 직전이다 — 사건 자체를 안 만들면 나중에 설정을 켜도 이력이 빈다. 알림도 Outbox를 거쳐 '사건-알림' 어긋남을 막는다." }
  ],
  notes: ["수신 채널(웹 푸시·이메일)은 미정(TBD) — 지금 확정된 건 앱 안의 알림함뿐. 알림은 P3에 붙는다."]
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
    { kind:"sync",  from:"streamer", to:"web", text:"알림 설정 열기 · 일부 끄기" },
    { kind:"store", from:"core", to:"pg", text:"설정 저장" },
    { kind:"reply", from:"core", to:"web", text:"저장됨" },
    { kind:"note",  at:"core", text:"다음 발송부터 적용된다 — 이미 알림함에 있는 건 지우지 않는다(못 본 알림이 사라지지 않게)." },
    { kind:"note",  at:"web", text:"수신 채널(웹 푸시·이메일)은 미정(TBD)이라 화면에도 TBD로 둔다 — 없는 기능을 있는 것처럼 그리지 않는다." }
  ],
  notes: ["끈 알림은 발송 직전에 걸러진다(SEQ-NOTI-01). 설정은 계정 단위다."]
}

});

/* ══ 구독 · 과금 ═════════════════════════════════════════════════════════ */
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
  participants: P(["web", "core", "pay", "pg"]),
  steps: [
    { kind:"sync",  from:"web", to:"pay", text:"결제 수단 등록 (PG 화면)" },
    { kind:"reply", from:"pay", to:"web", text:"결제 수단 토큰" },
    { kind:"sync",  from:"web", to:"core", text:"구독 생성 (플랜 · 토큰)" },
    { kind:"store", from:"core", to:"pg", text:"구독 저장 (카드 번호는 저장 안 함)" },
    { kind:"note",  at:"pg", text:"카드 정보는 PG가 들고 우리는 토큰만 가진다. 결제 시스템은 우리 배포 경계 밖이다." },
    { kind:"sync",  from:"core", to:"pay", text:"최초 결제 → 구독 ACTIVE · 다음 청구일 기록" },
    { kind:"fragStart", type:"loop", label:"결제 주기마다 (자동)" },
    { kind:"store", from:"core", to:"pg", text:"사용량 집계 (종량분)" },
    { kind:"sync",  from:"core", to:"pay", text:"정기 결제 + 종량 청구 (실패 시 SEQ-BILL-02)" },
    { kind:"fragEnd" },
    { kind:"note", at:"pg", text:"종량 과금의 계측 대상·단가는 미정(TBD). 계측은 내부에서 하고 청구만 PG가 한다." }
  ],
  notes: ["과금 주체는 스트리머 단독 — 편집자는 과금 대상이 아니다. 결제는 P3(시스템에 새로 붙는 유일한 P3 요소가 PG 연동)."]
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
  participants: P(["core", "pay", "pg", "web"]),
  steps: [
    { kind:"sync",  from:"core", to:"pay", text:"정기 결제 → 거절 (한도·만료·정지)" },
    { kind:"store", from:"core", to:"pg", text:"구독 PAST_DUE · 사유 기록" },
    { kind:"async", from:"core", to:"web", text:"알림 — 결제 실패 · 복구 방법" },
    { kind:"note",  at:"core", text:"즉시 정지하지 않는다 — 카드 만료 같은 흔한 사유는 금방 고쳐지는데 그 사이 방송을 끊으면 손해가 더 크다. 유예 안에서 재시도한다." },
    { kind:"fragStart", type:"alt", label:"유예 안에 해결되나" },
    { kind:"fragCase", label:"결제 수단 고침" },
    { kind:"sync",  from:"core", to:"pay", text:"즉시 재청구 → ACTIVE 복귀" },
    { kind:"fragElse", label:"유예 만료" },
    { kind:"store", from:"core", to:"pg", text:"구독 정지 · 이력" },
    { kind:"note",  at:"pg", text:"이미 만든 클립·보관물은 즉시 사라지지 않는다. 다만 새 방송 송출은 Stream Key 검증에서 막힌다(SEQ-BC-01)." },
    { kind:"fragEnd" }
  ],
  notes: ["유예 길이·정지 시 제한 범위의 구체값은 미정(TBD). 정지와 해지는 다른 상태다 — 활성 구독이 남으면 계정 삭제도 막힌다(SEQ-AUTH-02)."]
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
  participants: P(["streamer", "web", "core", "pg"]),
  steps: [
    { kind:"self",  from:"core", text:"과금 대상 행위마다 사용량 기록 (계측은 내부)" },
    { kind:"store", from:"core", to:"pg", text:"사용량 이벤트 쌓기" },
    { kind:"note",  at:"pg", text:"무엇을 세는지 — 계측 대상·단가는 미정(TBD). 그래서 이 시퀀스는 '어디에 쌓이나'까지만 확정한다." },
    { kind:"sync",  from:"streamer", to:"web", text:"사용량 · 청구 내역 조회" },
    { kind:"fragStart", type:"alt", label:"무엇을 보나" },
    { kind:"fragCase", label:"진행 중인 주기" },
    { kind:"reply", from:"core", to:"web", text:"실시간 누적 (확정 전 · 변동 가능)" },
    { kind:"fragElse", label:"지난 주기" },
    { kind:"reply", from:"core", to:"web", text:"확정된 청구 내역" },
    { kind:"fragEnd" },
    { kind:"note", at:"web", text:"진행 중 주기는 청구서가 아니라 누적치다 — 화면에서 그 차이를 분명히 적는다(오해하면 분쟁). 계측은 우리가, 청구는 PG가." }
  ],
  notes: ["종량 기준이 확정되면 '사용량 이벤트'가 무엇인지도 함께 확정된다. 청구 실행은 SEQ-BILL-01의 주기 루프에 있다."]
}

});

/* ══ 운영 ════════════════════════════════════════════════════════════════ */
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
    { kind:"store", from:"core", to:"pg", text:"권한 변경 · 승인/반려 · 업로드 · 연동 · 삭제를 이력에 남김" },
    { kind:"note",  at:"pg", text:"업무 트랜잭션과 같은 저장소(PostgreSQL의 audit_log)에 남긴다 — 별도 로그 시스템을 전제하지 않는다. append만 하고 수정하지 않는다(고칠 수 있는 이력은 이력이 아니다)." },
    { kind:"fragStart", type:"opt", label:"조회" },
    { kind:"sync",  from:"console", to:"core", text:"이력 조회 (대상 · 기간)" },
    { kind:"reply", from:"core", to:"console", text:"시간순 이력" },
    { kind:"note",  at:"console", text:"운영자 콘솔은 ①·③에서 범위 밖 — 위치와 접근 경로만 표시하고 내부 화면은 별도 설계로 남긴다." },
    { kind:"fragEnd" }
  ],
  notes: ["삭제된 계정·클립에 대해서도 이력은 남는다. 이 흐름은 다른 시퀀스들이 공통으로 지나가는 자리라 각 시퀀스엔 'audit_log 기록' 한 줄로만 나타난다."]
}

});

/* == END CATALOG == */
})(window.PokeClipSequences);
