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

## 2026-11-17 — 3-1 PoC: Quaternius 파츠 런타임 조립

- 한 일: itch.io 에서 Universal Animation Library[Standard] 15MB, Universal Base Characters[Standard] 123MB, Modular Character Outfits - Fantasy[Standard] 281MB 를 받아 data/quaternius/ 에 풀었다(사용자 승인, CC0). 다운로드는 puppeteer 로 /purchase → "No thanks" → 다운로드 페이지의 버튼이 부르는 /file/{id} API 응답(JSON url)을 가로채 Node 로 저장(networkidle 대기는 itch 에서 멈춤, domcontentloaded 사용).
- 확인: 몸(Superhero_Male)·머리카락·의상 파츠·UAL 마네킹이 모두 같은 65관절 릭(UE 마네킹 본 이름: root, pelvis, spine_01…). poc.html 에서 파츠 메시의 skeleton 을 몸 스켈레톤으로 바꿔 붙이고(파츠 자체 스켈레톤은 버림), UAL 애니메이션 그룹을 본 이름으로 몸 노드에 복제해 재생 → 195/195 대상 연결. Ranger(후드·어깨·몸·팔·다리·부츠) / Peasant 교체 성공. 1명 28k 삼각형·13 드로우콜, 8명 224k·97 드로우콜에서 100fps(헤드리스 Chrome). 베이스 gltf 가 가리키는 텍스처 이름 2개가 실제 파일명과 달라(T_Hair_1_Normal_png.png, T_Eye_Normal_png.png) 복사로 맞춤. 의상을 입히면 몸 메시는 숨기고 머리(Face·Eyes·Eyebrows)만 남긴다(Readme 지침).
- 발견: 무료 Standard 범위가 설명(60~70%)보다 좁다. 몸 2(Superhero 남녀), 헤어 8/20, 의상 2벌(Peasant·Ranger) 파츠 19/62, UAL1 43/120(검·주먹·단순 마법·피격·사망·이동. 활·도끼·지팡이·환호 없음).
- 결과: poc.html, src/poc.ts, data/quaternius/, public/poc/(git 제외), .gitignore

## 2026-11-17 — 무료 추가 팩 3개

- 한 일: 사용자 결정 "무조건 무료, 무료 팩 → AI 생성 순". Characters - Fantasy Races[Standard] 93MB, Bestiary - Dungeon Monsters[Standard] 45MB, Universal Animation Library 2[Standard] 18MB 를 src/tools/fetch-itch.mjs 로 받아 data/quaternius/races, bestiary, ual2 에 풀었다.
- 확인: 엘프·오크 남녀 4종(65관절), 임프·퍼글린 2종(55관절, 손가락 없음), UAL2 애니메이션 43개(검 콤보·방패·던지기 등). Races·Bestiary 는 QAL(게임 안 사용 가능, 에셋 단독 재배포 금지) → 원본은 git 제외 유지.
- 결과: docs/content-design.md 8장(무료 재고와 한계). 무료만으로는 영웅 8~10명·외형 2~3개 수준이라 AI 생성이 주력.

## 2026-11-17 — 3-2 영웅 체계: 조합형 영웅과 등급 사다리

- 한 일:
  - 무기 팩 받기(사용자 승인, 무료 CC0): Binbun RPG Weapons Free 11MB(무기 70), KayKit Fantasy Weapons Bits Free 3MB(31). fetch-itch.mjs 에 PICK·OUT 환경 변수, 파일 이름 앞에 팩 이름(둘 다 "Free" 라 겹쳐 저장된 것을 고침).
  - src/tools/import-quaternius.mjs (npm run import-q): 텍스처 4096 png → 1024 webp, 인간 몸은 머리·목 뼈 가중치 0.5 넘는 삼각형만 남긴 "머리" 판(옷을 입힐 때), 애니메이션은 data.ts 에 나오는 22개만, 무기·애니메이션만 meshopt.
  - 함정: 뼈대 있는 메시를 meshopt(좌표 양자화)로 압축하면 배율이 각 파일의 뼈대 행렬에 들어가, 파츠를 다른 몸의 뼈대로 옮기면 옷이 거대하게 늘어난다 → 몸·헤어·파츠는 압축하지 않음.
  - src/heroModel.ts: 몸 인스턴스의 스켈레톤에 파츠·헤어 메시를 붙이고(파츠 자기 스켈레톤 폐기), 무기는 hand_r, 방패는 hand_l 아래 회전 피벗에. 손 뼈는 손가락 쪽 +Y. 확정 각도: 검·도끼·지팡이 (0,0,-90°), 활 (90°,90°,0), 방패 (-90°,0,90°). KayKit 무기는 0.6배. tint 는 의상 파츠에만, glow 는 무기 발광, aura 는 발밑 파티클.
  - data.ts: 등급 8단계(GRADES, 색, 능력치 배율 희귀=1 기준), Look 타입(6겹), 영웅마다 maxGrade·startGrade·titles·looks. 레온 인간 남·초월(8 외형), 브란 오크 남·전설(5), 세라 인간 여·신화(6), 카일 엘프 남·불멸(7). 애니메이션을 UAL 이름으로(검 콤보, 방패, 단순 마법, 권총 동작을 활에).
  - 저장에 영웅 grade(이전 저장은 startGrade 로 채움). 능력치 = 레벨 배율 × 등급 배율. 로비·전투가 조합형 모델 사용, 영웅 탭에 등급 사다리(칭호 누르면 그 등급 외형을 3D 로 미리보기), 컷인·로비에 지금 등급 칭호.
  - 기존 npm run assets 가 public/assets 전체를 지우던 것을 자기 폴더(characters, enemies, dungeon)만 지우게 고침.
- 확인: 헤드리스 Chrome. 4명 × 등급별 외형(poc.html), 옷·무기·방패·활·지팡이 쥐는 모습, 로비 → 영웅 탭 미리보기 → 1-2 AUTO 3배속 승리, 97fps, 첫 로딩 약 9초(로컬).
- 용량: public/assets/q 약 19MB (몸 6.3, 파츠 8.0, 헤어 1.7, 무기 1.7, 애니 1.2, 머리 0.9). 파츠마다 같은 의상 텍스처가 따로 들어 있어 나중에 텍스처 공유로 줄일 수 있음.
- 남은 것: 적은 KayKit 치비 해골이라 화풍이 다름(3-5 교체). public/assets/characters 의 KayKit 영웅은 더 안 씀.

## 2026-11-17 — 배포 (3-2 영웅 체계)

- 한 일: 커밋 8개(3137056 ~ 46efb47) push (사용자 승인). Actions 배포 성공(46efb47).
- 확인: 공개 주소에서 헤드리스 Chrome 으로 로비 → 영웅 탭 등급 미리보기 → 1-2 AUTO 승리.

## 2026-11-17 — 3-3 장비

- 한 일:
  - KayKit 캐릭터에 뼈로 고정돼 있던 투구·모자·망토 11종을 떼어 냄(import-q 의 gear: 부모 뼈 기준 위치 그대로, 애니메이션·스킨 제거). 사람 Head 뼈에 0.32배, spine_03 에 0.7배로 붙임(poc.html 로 맞춤). 투구를 쓰면 머리카락은 눈썹만, 두건 파츠는 뺌.
  - src/items.ts: 기본형(Binbun 무기 63 + 곡괭이 7, KayKit 무기·방패 23, 투구 6, 망토 5, 갑옷 2, 장신구 5, 문장 3). 기본형마다 minGrade(같은 모델이 낮은·높은 등급 둘 다 나오지 않게), 이름은 등급 접두어(녹슨~왕실). 주옵션 부위별 고정, 부옵션 수 0,0,1,1,2,2,3,4. 장착 규칙: 영웅별 무기군(레온 검·철퇴·도끼, 브란 도끼·망치·창, 세라 지팡이·완드, 카일 활·단검), 방패는 한손 무기일 때만. equippedLook: 등급 외형 위에 장비를 덮어씀(갑옷은 인간 몸일 때만 보임).
  - src/loadout.ts: 모습·능력치 보너스·전투력. Unit 에 장비 보너스(공격·체력·방어·치명·치명 피해·속도·공격%).
  - 저장: items, nextUid, heroes[].equip. 처음·이전 저장에 시작 장비 8개. 스테이지 클리어 드랍(적 레벨별 등급 확률, 첫 클리어 1개 확정, 이후 50%), 결과 화면에 표시.
  - 로비: 영웅 탭 [능력치·스킬]/[장비](8칸, 칸을 누르면 낄 수 있는 장비 목록, 다른 영웅이 낀 것은 빼 옴, 해제), [가방] 탭(부위 필터, 6열 격자, 자세히). 장비를 바꾸면 3D 모델을 다시 조립.
  - 아이콘: game-icons.net SVG 17개(CC BY 3.0), 배경 사각형을 지워 CSS 마스크로 등급 색 칠함.
- 확인: 헤드리스 Chrome. 새 저장 → 레온에게 철퇴·두건·망토 장착(모델 반영, 전투력 433 → 482) → 가방 자세히 → 1-1 승리 → 장비 드랍 1개.
- 결과: src/items.ts, loadout.ts 새로. heroModel.ts, lobby.ts, save.ts, unit.ts, battle.ts, main.ts, hud.ts, style.css, data.ts, tools/import-quaternius.mjs, poc.ts 수정. public/assets/q/gear, public/icons 추가.

## 2026-11-17 — 배포 (3-3 장비)

- 한 일: 커밋 860a618, 9c539e9, 740f7e8 push (사용자 승인). Actions 배포 성공(740f7e8).
- 확인: 공개 주소에서 헤드리스 Chrome 으로 장착(모델 반영)·가방·1-1 승리 드랍.

## 2026-11-17 — 배포판 아이콘 404 수정

- 문제: 공개 주소에서 장비 아이콘이 404 (assets/icons/…). 아이콘 경로를 CSS 변수(--ico: url(icons/…))로 넘기면, 배포판에서는 그 변수를 쓰는 CSS 파일(assets/index-*.css) 기준으로 풀린다. 개발 서버는 CSS 가 페이지 안에 있어 안 드러남.
- 고침: ITEM_ICON 이 document.baseURI 기준 절대 주소를 돌려줌. 빌드 + vite preview 에서 404 없음 확인.

## 2026-11-18 — 배포 (아이콘 404 수정)

- 한 일: 커밋 748c5f9, 1d871b9 push (사용자 승인). Actions 배포 성공(1d871b9).
- 확인: 공개 주소에서 헤드리스 Chrome 으로 가방 아이콘 표시, 404 없음, 1-1 승리.

## 2026-11-18 — 3-4 뽑기

- 한 일: 로비 [소환] 탭과 소환 연출, 영웅 조각과 등급 승격, 등급별 최대 레벨, 장비 분해. 설계는 docs/content-design.md 4장, 이번에 정한 값은 4.1.
  - 소환: 영웅 150 / 10회 1,350, 장비·무기 100 / 900. 10회 보장(영웅 희귀+, 장비·무기 영웅+), 천장(영웅 80회 전설+, 300회 신화+, 장비 60회 전설+). 결과는 연출 전에 저장.
  - 중복 영웅 → 조각(잠재 등급별 10 ~ 80). 승격 = 조각 + 골드, 외형·칭호 바뀜, 초상화 다시 찍음.
  - 최대 레벨 40 / 50 / 60 / 70 / 80 / 90 / 100 / 120 (지금 등급).
  - 분해 → 골드. 가방에 한 개 분해, 일반·고급 일괄 분해.
  - 시작 보석 3,000(기존 저장에도 한 번), 다시 깬 스테이지 보석 1/10.
  - 저장: shards, pity 항목 추가. 처음부터 가진 영웅은 레온·브란·세라·카일 4명으로 고정(앞으로 늘 영웅은 소환으로).
- 고친 것: 3-3 때 빠진 천 옷 아이콘(public/icons/leather-vest.svg, game-icons lorc) 추가.
- 확인: 헤드리스 Chrome(390×844). 영웅 2만 회: 브란 72.3%, 세라 19.6%, 카일 6.2%, 레온 1.9% (표 72 / 20 / 6 / 2). 장비 5천 회: 전설+ 사이 최대 59회(천장 60). 10회 연출·건너뛰기·한 번 더, 브란 승격(고급 → 희귀, 조각 40·골드 3천 차감), 일괄 분해 17개, 1-1 전투 승리·드랍 회귀 확인. npm run build 통과.
- 결과: src/gacha.ts, src/summonView.ts 새로. lobby.ts, save.ts, data.ts, main.ts, hud.ts, style.css 수정.

## 2026-11-18 — 배포 (3-4 뽑기)

- 한 일: 커밋 3b6ca89, 1da2ff1 push (사용자 승인). Actions 배포 성공(1da2ff1).
- 확인: 공개 주소에서 헤드리스 Chrome 으로 새 저장 보석 3,000, 장비 10회(건너뛰기, 천 옷 아이콘 표시), 영웅 10회 연출. 404·오류 없음.
