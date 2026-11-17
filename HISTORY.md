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

## 2026-11-17 — 원형 이름 숨김, 화면 크기 대응

- 한 일: 사용자 요청으로 딜탱 유도형·퓨어딜러 같은 원형 이름을 카드·로비 이름표·결과 화면에서 뺐다(data.ts 에는 설계 의도로 남김). 폰에서 "다시 하기"(배포된 v0 은 페이지 새로고침) 뒤 3D 화면 비율이 어긋남 → window resize 대신 ResizeObserver 로 캔버스 크기 변화를 직접 보고 engine.resize.
- 확인: 헤드리스 Chrome 에서 window resize 없이 #app 높이만 바꿔도 캔버스 버퍼 비율 2.00/2.00 유지. 새로고침 없는 다시 하기 뒤에도 비율·유닛·HP 바 정상.
- 결과: src/main.ts, src/hud.ts, src/lobby.ts, src/data.ts

## 2026-11-17 — 배포 (v1 1단계 + 원형 이름 숨김)

- 한 일: 커밋 bb037d3, 7095eb2 를 main 에 push (사용자 승인). Actions 배포 성공(7095eb2).
- 확인: 공개 주소에서 헤드리스 Chrome 으로 로비 표시, 캔버스 크기 변화 대응, 새로고침 없는 다시 하기 정상.

## 2026-11-17 — 필살기 자동 사용, v1 2단계: 영웅 화면과 레벨업

- 한 일: 전투 화면 AUTO 버튼(저장: save.auto). 게이지가 찬 영웅 필살기를 차례로 쓰고, 대상이 필요한 필살기는 보스 → 없으면 HP 가 가장 많은 적. 로비를 탭 구조로: [모험](스테이지, 파티 전투력, 적 레벨 표시) / [영웅](초상화 칩으로 영웅 선택, 카메라가 그 영웅에게 다가감, 레벨·전투력·능력치와 다음 레벨 증가분·필살기·스킬 설명, 레벨업 +1·+5). 레벨업 비용 100×1.15^(Lv-1) 골드, 최대 Lv.40(등급별 최대는 3단계에서). 레벨업 연출(환호 애니메이션, 금빛 링·불꽃, LEVEL UP 글자). 스테이지 적 레벨 1-1:1, 1-2:2, 1-3:4. 카메라는 시점 사이를 부드럽게 따라가게 바꿈(전투·로비 진입만 즉시). 로비에서도 이펙트가 돌게 fx.update 를 로비 루프에 추가.
- 확인: 헤드리스 Chrome, 골드 5,000 저장으로 시작 → 영웅 탭 → 레온 Lv +5 (골드 674 차감, 체력 1,500→2,100, 전투력 433→606) → 세라로 전환 → 1-3(적 Lv.4) AUTO 켜고 3배속, 레온 Lv.6·나머지 Lv.1 로 승리(필살기 컷인 자동 발생 확인).
- 결과: src/lobby.ts(다시 씀), camera.ts, battle.ts, hud.ts, main.ts, data.ts(스킬 desc, levelCost, MAX_LEVEL, power, 스테이지 레벨), save.ts, style.css

## 2026-11-17 — 배포 (필살기 자동, v1 2단계)

- 한 일: 커밋 a9a3210, 554c4a2 push (사용자 승인). Actions 배포 성공(554c4a2). 공개 주소에서 영웅 탭 열림 확인.

## 2026-11-17 — 3단계(뽑기) 설계: 콘텐츠 규모 조사

- 한 일: "영웅·무기·장비 다 뽑기, 색만 바꾸지 말고 진짜 많이" 를 위해 무료 3D 에셋을 조사. Quaternius Universal Base Characters(체형 6·헤어 20, CC0), Modular Character Outfits Fantasy(의상 12벌·파츠 62·색 3, CC0), Characters Fantasy Races(12종, QAL), Bestiary(인간형 몬스터 7, QAL), Universal Animation Library 1·2(250+, CC0), Ultimate Monsters(50, CC0). 무기: Binbun RPG Weapons 70, Polyy.AI 50, KayKit Fantasy Weapons 25+, KayKit Adventurers 25 (모두 CC0). 전부 같은 휴머노이드 릭이라 애니메이션 1벌 공용 가능.
- 결과: docs/content-design.md (목표 수량, 조합형 영웅 정의, 런타임 조립, 장비 부위·출처, 뽑기 표, 데이터·도구, 단계, 결정 사항 4개). design.md 에 참조 추가.

## 2026-11-17 — 3단계 설계 2차: 사용자 결정 반영

- 한 일: 영웅 체계를 "영웅마다 등급 고정" 에서 "영웅은 유니크, 잠재 등급까지 사다리(칭호 8단계·외형 4형)" 로 바꿈. 외형 겹침 금지 규칙(머리·몸통·망토 2개 이상 겹침 금지)을 영웅의 모든 형태에 적용. 방패는 한손 무기군일 때만, 양손 영웅은 장신구 칸 +1. 뽑기 재화는 보석으로 통일(장비 100/900). 목표 영웅 수 60 → 30 (× 4형 = 외형 120).
- 결과: docs/content-design.md 다시 씀.
