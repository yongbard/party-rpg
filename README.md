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
- 다음: v1 (로비, 캐릭터 16명, 뽑기·천장, 레벨·승급·특성 트리, 저장).
- 최적화 숙제: JS 번들 6.1MB(gzip 1.8MB, Babylon 전체를 불러옴 → 개별 import), 모델 37MB(gltf-transform 으로 압축).

## 데이터

- 캐릭터·적·웨이브 정의: src/data.ts (v1 에서 data/ JSON 으로 옮긴다)
- 3D 모델·애니메이션: public/assets/ (KayKit, CC0). 출처는 docs/credits.md

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
│   ├── main.ts           엔진(WebGL2, ?gpu=webgpu 로 WebGPU) 생성, 로딩, 초상화 촬영, 렌더 루프
│   ├── data.ts           영웅·적·스킬·필살기·웨이브·진형 정의
│   ├── battle.ts         전투 로직: 대상 선택(위협), 이동, 공격, 피해·치유, 투사체, 컷인, 웨이브
│   ├── unit.ts           유닛 상태와 애니메이션 재생
│   ├── assets.ts         glb 불러오기, 모델 복제(쓰는 애니메이션만 남김)
│   ├── arena.ts          던전 배치(thin instance), 조명·그림자·횃불·안개, 후처리
│   ├── camera.ts         전투 카메라(흔들림·흔들기), 컷인·초상화 카메라
│   ├── fx.ts             이펙트(파티클, 링, 빛기둥, 베기, 보호막, 투사체, 불꽃)
│   ├── hud.ts            DOM UI(카드, HP 바, 피해 숫자, 배너, 컷인, 결과)
│   └── style.css
├── public/assets/        characters/, enemies/(+weapons/), dungeon/  (KayKit glb)
├── docs/
│   ├── design.md         설계 문서
│   └── credits.md        에셋 출처·라이선스
├── logs/                 개발 서버 로그
└── conversations/        대화 기록
```

## 실행

Node 24 (conda 아님). 처음 한 번 npm install.

```
npm run dev       개발 서버 (http://localhost:5173, 같은 네트워크 폰은 http://{PC IP}:5173)
npm run build     dist/ 에 배포용 빌드
```

주소 뒤 옵션: ?fps (FPS 표시), ?gpu=webgpu (WebGPU 시험)

## 경로

- 로컬: C:\Users\USER\Desktop\yongbeom\party_rpg_261116
- 서버: 없음 (로컬 전용)
- 배포: https://yongbard.github.io/party-rpg/ (GitHub Pages, main 에 push 하면 GitHub Actions 가 빌드·배포. push 는 매번 확인받고 한다)
- 저장소: https://github.com/yongbard/party-rpg (공개)
