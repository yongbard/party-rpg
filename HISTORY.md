# HISTORY

## 2026-11-16 15:00 — 프로젝트 시작, 설계 확정

- 한 일: 게임 후보 비교 → 파티 RPG(실시간 자동 전투 + 필살기 탭)로 결정. 뽑기·등급 8단계·장비 고유 효과·특성 트리·콘텐츠·에셋·기술 설계를 정리.
- 사용한 데이터: 없음
- 모델·설정: 없음
- 결과: docs/design.md, README.md, 프로젝트 폴더 생성, project_index/projects.xlsx 취미 탭에 등록

## 2026-11-16 17:00 — v0 3D 전투 프로토타입

- 한 일: Vite + TypeScript + Babylon.js 9.36 프로젝트 생성. 실시간 자동 전투, 필살기 탭·컷인, 웨이브 3개(마지막 보스), 배속·일시정지, 결과 화면. 영웅 초상화는 로딩 때 3D 장면에서 직접 찍는다.
- 사용한 데이터: KayKit 에셋(CC0) — 영웅 5종(4종 사용), 해골 4종, 해골 무기 6종, 던전 소품 20종. public/assets/ 37MB. 출처 docs/credits.md
- 설정: WebGL2 기본(?gpu=webgpu 선택), 그림자 PCF 2048(모바일 1024), 글로우 레이어, 블룸·ACES 톤매핑·비네트·그레인, 안개 EXP2, 횃불 점광원 4개.
- 확인: 헤드리스 Chrome(puppeteer-core, 390×844, DPR 2)으로 스크린샷. 60~90fps. 3배속·필살기 자동으로 3웨이브 승리(보스전 포함). 고친 것: 근접 적이 컷인 카메라를 가림 → 컷인 중 다른 유닛 숨김. 큰 이펙트가 글로우로 화면을 하얗게 덮음 → 글로우에서 제외. 초상화 카메라가 앞 영웅 몸 안에 들어감 → 촬영 때 다른 영웅 숨김. 화면 위 빈 공간 → 벽 2층.
- 결과: src/*.ts, index.html, docs/credits.md, README 갱신. 남은 숙제: 번들 6.1MB·모델 37MB 최적화, 밸런스(카일 필살기 비중이 큼).

## 2026-11-16 17:40 — GitHub Pages 배포

- 한 일: 사내망 밖 폰에서 보려고 공개 배포. git 저장소 생성, 커밋 dda04c8, 공개 저장소 yongbard/party-rpg 생성, Pages 출처를 GitHub Actions 로 설정, main push (사용자 승인).
- 설정: .github/workflows/deploy.yml (npm ci → npm run build → upload-pages-artifact → deploy-pages). 첫 실행 run 43826682872 성공.
- 확인: https://yongbard.github.io/party-rpg/ 를 헤드리스 Chrome 으로 열어 2웨이브까지 진행 확인(100fps).
- 결과: README 경로 항목에 배포 주소·저장소 추가. 이 기록 변경은 로컬 커밋만 하고 push 하지 않았다.

## 2026-11-17 — 로딩 최적화 (모델 37MB → 4.2MB)

- 한 일: 원본 모델을 data/kaykit/ 로 옮기고, src/tools/optimize-assets.mjs (npm run assets) 가 public/assets/ 에 게임용 모델을 만들게 했다. 모델마다 src/data.ts 의 animsByModel 이 고른 애니메이션만 남김(76~95개 → 6~11개), resample·dedup·prune, meshopt 압축(level medium). 쓰지 않는 Rogue.glb 는 뺐다. 무기 .gltf 는 .glb 로 합쳤다.
- 함정: 애니메이션만 dispose 하면 샘플러가 남아 키프레임 배열이 그대로 남는다(처음엔 18.7MB). 샘플러·채널까지 지우고 prune 으로 정리. 키프레임 시간 배열은 애니메이션끼리 공유되므로 직접 지우면 안 된다.
- 설정: Babylon MeshoptCompression 디코더를 CDN 대신 public/meshopt_decoder.js (meshoptimizer 패키지에서 복사) 로 지정.
- 확인: 개발 서버와 배포용 빌드(vite preview) 모두 헤드리스 Chrome 에서 전투·애니메이션·무기·필살기 정상. 캐릭터 3.6MB → 0.4~0.6MB, 합계 33.4MB → 4.2MB. 빌드 dist 13MB, 메인 JS 6.1MB(gzip 1.3MB).
- 결과: data/kaykit/, public/assets/, public/meshopt_decoder.js, src/tools/optimize-assets.mjs, package.json(assets 스크립트, devDependencies @gltf-transform/core·functions·extensions, meshoptimizer), src/main.ts.

## 2026-11-17 — v1 1단계: 저장과 로비

- 한 일: 로비 화면(3D 파티 4명이 카메라를 보고 섬, 이름·레벨·원형 표시, 골드·보석, 1장 스테이지 목록, 출전). 전투를 Battle 객체 단위로 만들고 끝나면 dispose(유닛·투사체·이펙트·HUD 정리) — 페이지 새로고침 없이 로비 ↔ 전투 반복. 결과 화면에 보상과 "로비로"/"다시 하기". 저장(src/save.ts, localStorage). 스테이지 3개(1-1 웨이브 1, 1-2 웨이브 2, 1-3 웨이브 3 보스), 첫 클리어 보석 150/150/300, 골드 300/500/900. 영웅·적 레벨 배율(heroMul 1+0.08×(Lv-1), enemyMul 1+0.1×(Lv-1)) 연결. 모델 생성을 makeModel 로 빼서 로비와 전투가 같이 씀. 카메라 시점 프리셋(battle, lobby).
- 고친 것: 오른손 좌표계에서 카메라 기준 왼쪽이 +x 라 로비 줄과 전투 진형이 카드 순서와 좌우 반대였다 → 둘 다 x 부호를 뒤집음. 보스 스테이지 버튼의 boss 클래스가 전투 보스 HP 바 스타일(absolute)을 받아 겹침 → is-boss 로 이름 변경.
- 확인: 헤드리스 Chrome 에서 로비 → 1-1 → 승리(보상 지급) → 로비(재화·클리어 반영, 1-2 열림), 그리고 1-3 보스 스테이지를 레벨 1 파티로 승리(3배속, 필살기 자동).
- 결과: src/save.ts, src/lobby.ts 새로 만듦. src/main.ts, battle.ts, data.ts, unit.ts, hud.ts, camera.ts, fx.ts, style.css 수정. 설계 문서 저장 방식 localStorage 로 고침.
