# party_rpg_261116

## JIRA 주소

없음 (취미 프로젝트)

## 목적

모바일 세로 화면 웹에서 혼자 즐기는 3D 실시간 자동 전투 파티 RPG.
캐릭터는 뽑기(8등급)로 모으고, 장비·특성 트리·행동 방침으로 같은 캐릭터를 다르게 쓸 수 있다.
전투는 자동으로 흐르고 플레이어는 필살기 탭으로 끼어든다. 턴제·로그라이트는 쓰지 않는다.
상세 설계: docs/design.md

## 현재 상태

- 2026-11-16: 설계 확정 → v0(3D 전투 프로토타입) 완성. 처음부터 승리까지 돈다.
  - 영웅 4명: 레온(딜탱 유도형), 브란(퓨어딜러), 세라(딜힐), 카일(원거리 퓨어딜러). 스킬 1~2개 + 필살기.
  - 적: 해골 병사·전사·궁수·술사 + 보스 해골 군주 바르크(광역기 예고). 웨이브 3개.
  - 필살기 탭 → 컷인(카메라 클로즈업, 다른 유닛 숨김). 카일은 탭 후 적을 골라 쏜다.
  - 배속 1·2·3×, 일시정지, 결과 화면(영웅별 피해·치유·받은 피해).
  - 헤드리스 Chrome(390×844)에서 60~90fps.
- 2026-11-16: GitHub Pages 에 배포. 폰에서 https://yongbard.github.io/party-rpg/ 로 연다.
- 2026-11-17: v1 1단계 — 저장(localStorage)과 로비. 로비 → 1장 스테이지 3개(1-1, 1-2, 1-3 보스) 선택 → 전투 → 결과(골드, 첫 클리어 보석) → 로비. 다음 스테이지는 앞 스테이지를 깨야 열린다.
- 2026-11-17: 필살기 자동 사용(전투 화면 AUTO, 저장됨). v1 2단계 — 로비 아래 탭 [모험]/[영웅]. 영웅 탭은 카메라가 영웅에게 다가가고 레벨·전투력·능력치(다음 레벨 증가분)·필살기·스킬 설명, 골드 레벨업(+1, +5, 최대 Lv.40). 스테이지 적 레벨 1·2·4.
- 2026-11-17: 3단계(뽑기) 설계. 영웅·무기·장비 전부 뽑기, 색만 바꾸지 않고 수백 개를 만들려고 Quaternius 조합형 체계(체형 18 × 헤어 20 × 의상 파츠 62, 공용 애니메이션 250+, 무기 팩 160+)를 조사해 docs/content-design.md 에 정리. 사용자 결정 반영(영웅은 유니크 + 등급별 성장 스토리·외형 4형, 무료 우선·부족하면 AI, 망토·방패 추가·방패는 한손 무기만, 뽑기 재화 보석 하나). 남은 결정: 잠재 등급 모델(제안 A).
- 2026-11-17: 3-1 PoC 성공. Quaternius 베이스 몸 + 머리카락 + 의상 파츠 6개를 한 스켈레톤으로 런타임 조립하고 UAL 애니메이션 재생(poc.html). 8명 동시 100fps(헤드리스 Chrome). 무료 Standard 는 몸 2·헤어 8·의상 2벌·애니메이션 43개뿐이라 수량은 유료 Source 나 추가 팩이 필요.
- 다음: 추가 에셋 확보 결정 → 3-2 영웅 체계 → 3-3 장비 → 3-4 뽑기 → 3-5 확장 → 특성 트리.
- 2026-11-17: 로딩 최적화. 모델 37MB → 4.2MB (쓰는 애니메이션만 남기고 meshopt 압축). 첫 로딩 총량 약 5.5MB.
- 남은 최적화: JS 번들 6.1MB(gzip 1.3MB, Babylon 전체를 불러옴 → 모듈별 import 로 줄일 수 있음).

## 데이터

- 캐릭터·적·스테이지 정의: src/data.ts
- 플레이 기록: 브라우저 localStorage (기기마다 따로). 지우려면 브라우저 사이트 데이터 삭제
- 3D 모델 원본: data/kaykit/ (KayKit, CC0, 33MB). 출처는 docs/credits.md
- 게임이 쓰는 모델: public/assets/ — npm run assets 가 원본에서 만든다(직접 고치지 않는다). 애니메이션을 새로 쓰면 src/data.ts 에 이름을 적고 다시 돌린다.

## 모델(출처)

해당 없음 (ML 모델 없음)

## 폴더 구조

```
party_rpg_261116/
├── README.md, HISTORY.md
├── index.html            진입 HTML (세로 화면 틀, 글꼴)
├── package.json          npm 스크립트 (dev, build, preview)
├── tsconfig.json, vite.config.ts, .gitignore
├── .github/workflows/deploy.yml   main push → 빌드 → GitHub Pages 배포
├── src/
│   ├── main.ts           엔진 생성, 로딩, 초상화 촬영, 로비 ↔ 전투 전환·보상 지급, 렌더 루프
│   ├── data.ts           영웅·적·스킬·필살기, 스테이지·웨이브, 진형, 레벨 배율
│   ├── save.ts           저장 (localStorage 키 party-rpg-save): 골드, 보석, 영웅 레벨, 파티, 클리어
│   ├── lobby.ts          로비: 3D 파티 줄 세우기, 재화, [모험] 스테이지 선택·출전, [영웅] 능력치·스킬·레벨업
│   ├── battle.ts         전투 로직: 대상 선택(위협), 이동, 공격, 피해·치유, 투사체, 컷인, 웨이브
│   ├── unit.ts           유닛 상태와 애니메이션 재생
│   ├── assets.ts         glb 불러오기, 모델 복제(쓰는 애니메이션만 남김)
│   ├── arena.ts          던전 배치(thin instance), 조명·그림자·횃불·안개, 후처리
│   ├── camera.ts         카메라 시점(전투·로비·영웅 확대, 부드럽게 전환), 흔들기, 컷인·초상화
│   ├── fx.ts             이펙트(파티클, 링, 빛기둥, 베기, 보호막, 투사체, 불꽃)
│   ├── hud.ts            DOM UI(카드, HP 바, 피해 숫자, 배너, 컷인, 결과)
│   ├── style.css
│   └── tools/optimize-assets.mjs   원본 모델 → 게임용 모델 (애니메이션 고르기, meshopt 압축)
├── data/kaykit/          원본 모델 characters/, enemies/(+weapons/), dungeon/
├── data/quaternius/      zips/(받은 원본), base/, outfits/, ual/ (풀어 둔 것)
├── poc.html, src/poc.ts  기술 검증 페이지: /poc.html?outfit=Ranger|Peasant&anim=Sword_Idle&n=8&fps (public/poc 는 git 제외)
├── public/assets/        게임용 압축 모델 (npm run assets 결과)
├── public/meshopt_decoder.js   모델 압축 해제기 (npm run assets 가 복사)
├── docs/
│   ├── design.md         설계 문서
│   ├── content-design.md 콘텐츠 규모·조합형 캐릭터·장비·뽑기 설계 (2026-11-17)
│   └── credits.md        에셋 출처·라이선스
├── logs/                 개발 서버 로그
└── conversations/        대화 기록
```

## 실행

Node 24 (conda 아님). 처음 한 번 npm install.

```
npm run dev       개발 서버 (http://localhost:5173, 같은 네트워크 폰은 http://{PC IP}:5173)
npm run build     dist/ 에 배포용 빌드
npm run assets    data/kaykit 원본 → public/assets 게임용 모델 (모델·애니메이션을 바꿨을 때)
```

주소 뒤 옵션: ?fps (FPS 표시), ?gpu=webgpu (WebGPU 시험)

## 경로

- 로컬: C:\Users\USER\Desktop\yongbeom\party_rpg_261116
- 서버: 없음 (로컬 전용)
- 배포: https://yongbard.github.io/party-rpg/ (GitHub Pages, main 에 push 하면 GitHub Actions 가 빌드·배포. push 는 매번 확인받고 한다)
- 저장소: https://github.com/yongbard/party-rpg (공개)
