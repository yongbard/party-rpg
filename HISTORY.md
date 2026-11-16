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
