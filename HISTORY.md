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

## 2026-11-18 — 3-5 확장 1부: 영웅 12명, 편성, 픽업

- 한 일:
  - 영웅 12명 추가(src/heroes.ts): 도린·미아·푸그(잠재 희귀), 하겐·리아·고르가·킥스(영웅), 진·노라·엘라(전설), 모르간(신화), 가르쉬(불멸). 등급별 칭호·외형(모두 53형), 스킬 1~2개 + 필살기. 전투에 공격력·공격 속도 강화(battle.buff), 지속 피해(battle.dot) 추가.
  - 체형 재료: Quaternius 엘프 여자·오크 여자·사람 전신·임프·퍼글린을 처음 씀. 맨몸에 가까운 체형은 의상 파츠를 입힘. 임프·퍼글린 몸에 붙은 무기(Imp_Mace, Puglin_Stick) 숨김, 퍼글린 투구 맞춤(크기 0.55).
  - 애니메이션 재생성(npm run import-q -- anim): 주먹·훅·구르기·춤·대시 등 UAL1 17개, UAL2 13개. 도구가 heroes.ts 의 이름도 읽게 함.
  - 새 무기군 권갑(KayKit fistweapon A·B, 진 전용).
  - 처음 가진 영웅은 4명, 나머지는 소환으로. 모험 탭 [편성](1~4명), 영웅 탭은 가진 영웅 전부(파티 밖이면 가운데 혼자), 초상화는 처음 볼 때 찍음(섞임이 끝나게 10장 그린 뒤).
  - 픽업 소환(주마다, 같은 등급 2배, 80회 확정·이월).
  - 공통 값 src/common.ts 로 분리(data.ts ↔ heroes.ts 순환 방지).
- 확인: 헤드리스 Chrome. poc.html 로 12명 등급 외형 확인. 영웅 소환 2만 회: 희귀 영웅 각 21% 안팎, 레온 0.26%(표 0.2%). 픽업 2만 회: 엘라 3.2%(표 2.88% + 천장), 픽업 사이 최대 79회. 소환 → 새 영웅 보기 → 편성에서 카일 빼고 진 넣기 → 1-1 승리. npm run build 통과.
- 결과: src/heroes.ts, src/common.ts 새로. data.ts, gacha.ts, lobby.ts, heroModel.ts, items.ts, unit.ts, battle.ts, save.ts, main.ts, style.css, tools/import-quaternius.mjs 수정. public/assets/q/anim 재생성.

## 2026-11-18 — 3-5 확장 2부: 적 교체(섞기), 2장

- 한 일:
  - 3-5 1부 push(bf6bd58, 106afcc → GitHub Pages 배포).
  - 적 교체: KayKit 해골 4종 + 보스를 모두 빼고 src/enemies.ts 에 적 13종. 일반 11종은 조합형(Quaternius 몸·옷·무기, UAL 좀비·투척·일어나기 동작), 보스 2종은 Ultimate Monsters(Ghost_Skull → 망령 군주 바르크, Demon → 불꽃 악마 아즈라).
  - Look 에 skin(몸 색 곱), UnitDef 에 fit(통짜 모델 크기 맞춤)·eyeGlow(눈 빛내기) 추가. keep·attach(KayKit 무기 붙이기)는 뺐다.
  - 전투: spawnEnemy(웨이브·보스 부하 부르기 공용), 보스 배너 이름을 웨이브의 보스에서. assets.spawn 이 'CharacterArmature|Idle' 같은 앞 이름을 뗀다. 시작 로딩의 KayKit 적 일괄 받기를 빼고 전투 시작 때 그 스테이지 적만 받는다.
  - 2장 불타는 고블린 굴 2-1 ~ 2-3 (적 Lv.9·12·16, 골드 1,200·1,600·2,400). 모험 탭 장 넘기기.
  - 애니메이션 재생성(npm run import-q -- anim): UAL1 17개, UAL2 18개(LayToIdle, OverhandThrow, Zombie_* 추가). 도구가 enemies.ts 이름도 읽게 함.
  - optimize-assets.mjs 는 던전만 처리(결과 그대로임을 확인). public/assets/characters·enemies 는 archive/assets 로.
  - poc.html: ?enemy= 적 줄 세우기, &mon= 몬스터 비교.
- 데이터: Ultimate Monsters 16종 GLB, data/ultimate_monsters (5.3MB, git 제외, 주소 sources.txt). 게임에는 public/assets/um 에 2개(Ghost_Skull 227KB, Demon 474KB).
- 확인: 헤드리스 Chrome. 1-3·2-3 각 웨이브·보스 스킬·필살기·부하 부르기·승리. 균형 1-1 Lv.1 승, 1-3 Lv.1 패·Lv.5 승, 2-1 Lv.8 승, 2-2 Lv.12 승, 2-3 Lv.16 패·Lv.22 승. npm run build 통과.
- 결과: src/enemies.ts, src/tools/fetch-polypizza.sh, public/assets/um 새로. data.ts, heroes.ts(공용 도우미 export), battle.ts, assets.ts, heroModel.ts, unit.ts, main.ts, lobby.ts, poc.ts, style.css, tools 2개, docs/credits.md, .gitignore 수정.

## 2026-11-18 — 3-5 2부 배포

- 한 일: ce8f8a0 를 main 에 push (사용자 승인). GitHub Actions deploy 성공(47초). 공개 주소에서 public/assets/um/Demon.glb 응답 200 확인.
- 결과: https://yongbard.github.io/party-rpg/

## 2026-11-18 — AI 변신형 시험: Tripo 용 + Blender 리깅

- 한 일:
  - Tripo 요금표 확인(무료 월 200 크레딧, 생성 15+옵션, 자동 리깅 20, 받기는 크레딧 없음·15회·H2.5 만, 공개·비상업). 사용자 Chrome 에 붙어 직접 생성.
  - Text to 3D(H2.5, 텍스처 2K, PBR 끔, 폴리곤 2만 → 25 크레딧): 금빛 용기사 용. data/tripo/dragon_knight_v1.glb (1.2MB, 삼각형 19,963, 뼈대 없음).
  - Tripo 자동 리깅(UE5 Mannequin, 20 크레딧)은 성공했지만 뼈대 포함 받기가 유료라 못 받음(결제 화면은 닫음). 남은 크레딧 155, 받기 14회.
  - Blender 5.3.0 휴대판(download.blender.org, 406MB, sha256 확인) → C:\Users\USER\tools. src/tools/blender_rig.py: Quaternius 65관절 뼈대를 모델의 골반·어깨·목·손·다리 위치로 옮기되 뼈 방향·roll 은 유지, 복셀 복사본에서 Bone Heat 가중치를 구해 원본으로 옮김(원본에 바로 하면 전부 실패). public/assets/q/body/TripoDragon.glb (키 2.4).
  - heroModel.ts POSE_ONLY: q/body/Tripo* 몸은 UAL 의 위치 키를 빼고 회전만 쓴다. poc.html &body= 로 몸만 바꿔 보기.
- 확인: poc.html?hero=leon&body=q/body/TripoDragon&anim=Idle_Shield_Loop / Sword_Regular_A / Jog_Fwd_Loop 에서 자세가 바뀌고 피부가 따라감. 날개는 팔을 따라감. 색은 거의 노랑 한 가지.
- 결과: src/tools/blender_rig.py, blender_probe.py, data/tripo/dragon_knight_v1.glb, public/assets/q/body/TripoDragon.glb.

## 2026-11-18 — 레온 초월 외형 = 용

- 한 일: data.ts 레온 looks[7] 을 q/body/TripoDragon(검·방패·발광·오라 유지)으로. items.ts 변신 몸에는 투구·망토를 안 붙임. heroModel.ts BODY_TALL(용 1.3) → ModelInstance.tall → Unit.tall: 머리 위 HP 바·필살기 컷인 높이에 곱함. camera.ts 초상화는 큰 몸이면 Head 뼈 위치를 겨눔(용 얼굴이 몸통보다 앞에 있어 잘렸음).
- 확인: 헤드리스 Chrome, 레온 초월 Lv.60 저장 → 로비, 영웅 탭(초월 · 용기사), 1-1 전투, 필살기 컷인, 초상화 카드. npm run build 통과.
- 결과: src/data.ts, items.ts, heroModel.ts, assets.ts, unit.ts, camera.ts.

## 2026-11-18 — 변신형 배포

- 한 일: 2e0ce5e, 99e91fc, c3ffabe 를 main 에 push (사용자 승인). GitHub Actions deploy 성공(31초). 공개 주소에서 assets/q/body/TripoDragon.glb 응답 200 확인.

## 2026-11-18 — 1단계 성장 마무리: 특성 트리, 별, 등급 패시브

- 한 일:
  - src/talents.ts: 가지 템플릿 11종(노드 4 × 3단계 + 끝 노드), 영웅 16명 가지 배정, 포인트(등급 + 별), 배우기·초기화, 별(조각 + 골드), 영웅별 패시브(희귀·전설·초월), 필살기 단계, 파티 오라.
  - items.ts Bonus 확장(hpPct, defPct, healPct, threatPct, drPct, lifesteal, cdr, gaugePct, rage, caps) + addBonus. loadout 이 장비 + 특성 + 패시브를 더한다. 전투력에 특성 포인트당 기본의 1.5%.
  - unit.ts: 체력·방어 비율, 받는 피해 감소, 위협 배율(threatMul), 끝 노드 has(), 불굴·기습·필살기 단계 상태.
  - battle.ts: 끝 노드 효과 11종, 흡혈·치유량·재사용 단축·필살기 충전, 필살기 단계 배율(필살기 뒤 5초), 파티 오라.
  - 영웅 탭: [특성] 보기(가지 3열, 노드 눌러 설명·배우기, 초기화), 승격 줄 아래 별 줄, 최대 레벨에 별, 능력치·스킬 목록에 패시브(못 연 것은 흐리게)·필살기 Lv·오라.
  - save.ts: heroes[id].stars, talents(15칸).
- 확인: 헤드리스 Chrome. 수호 가지 배우기·끝 노드 잠금(8P)·배움, 별 3개 → 최대 레벨 75, 초기화(골드 차감), 끝 노드 4종(불굴·가시·넘치는 생명·기습)으로 1-3 승리(불굴 발동, 기습 위협 0·첫 치명). 초월 레온: 필살기 ×1.6, 아군 전원 오라 +8%, 패시브 3개 표시. 균형 다시: 1-1 Lv.1 승, 1-3 Lv.1 패·Lv.5 승, 2-3 Lv.16 패·Lv.22 승(3명 생존). npm run build 통과.
- 결과: src/talents.ts 새로. items.ts, loadout.ts, unit.ts, battle.ts, lobby.ts, save.ts, data.ts(maxLevel 에 별), style.css 수정.

## 2026-11-18 — 2단계 메인 스토리 확장: 장마다 스테이지 10개, 별 조건, 임무·출석

- 한 일:
  - src/data.ts: 스테이지 20개(장마다 10개, 10번째 보스), 웨이브 15종(1장 W1_SMALL·GRAVE·HORDE·RITUAL·ARCH 추가, 2장 W2_SMALL·PACK·IMPS·WAR 추가). 별 조건 Cond(클리어·아무도 안 쓰러짐·시간·파티 체력·필살기 횟수·출전 인원), condText, condMet, starCount, starGems.
  - battle.ts: 영웅 필살기 수(ults), outcome()(시간·쓰러진 수·남은 체력 비율·필살기 수·인원).
  - main.ts: 승리 때 별 판정, 처음 채운 별마다 보석, 임무 집계(승리·보스·별). 장비 드랍 등급표를 적 레벨 8·12·16 까지 늘림(2장이 1장 표를 쓰던 것 고침).
  - src/missions.ts 새로: 일일 3개(날짜 씨앗) + 보너스, 주간 6개, 출석 7일, track·claim.
  - lobby.ts: 스테이지 별 표시, 장 별 합계, 고른 스테이지 조건, [임무] 버튼(받을 것 있으면 빨간 점)과 임무 화면, 하루 첫 접속 때 임무 화면부터. 소환·레벨업·특성·분해·승격·별 승급을 임무로 셈.
  - hud.ts 결과 화면: 별 조건 3개와 NEW.
  - save.ts: stars, daily, weekly, attend. 예전 저장 옮기기(장 보스 N-3 을 깼으면 N-1 ~ N-10 클리어, 별 1개).
- 확인: 헤드리스 Chrome. 예전 저장 옮기기(1-3·2-1 클리어 → 1-1 ~ 1-10, 2-1). 출석 받기(골드 3,000), 1-1 별 3개 → 보석 150. 임무 받기·보너스·날짜 바뀜 초기화·주 경계(월요일). 균형: 1-3 Lv.2, 1-5 Lv.4, 1-7 Lv.6, 1-9 Lv.8, 2-1 Lv.9, 2-3 Lv.10, 2-5 Lv.12, 2-7 Lv.14, 2-9 Lv.16 모두 승(체력 89~97%), 1-10 Lv.8 승(1명 쓰러짐), 2-10 Lv.18 패·Lv.22 승. npm run build 통과.
- 결과: src/missions.ts 새로. data.ts, battle.ts, main.ts, lobby.ts, hud.ts, save.ts, style.css 수정.

## 2026-11-18 — 3단계 장비 마무리: 고유 효과, 세트, +15 강화, 제작

- 한 일:
  - src/uniques.ts 새로: 고유 효과 16종(세기 p 에 따른 설명, 신화 이상 2차 효과, 파티 전체 여부), 세트 5종(2개 능력치, 4개 효과), uqPower(+10 ×1.25, +15 ×1.5).
  - items.ts: Item 에 lv·set·uq. makeItem 이 희귀 이상 60% 세트, 전설 이상 고유 효과를 붙인다. statsOf(강화 반영), setCounts, bonusOf 가 세트·고유 효과를 Bonus(uniq, uniq2, party, caps 'set_*')로. 기본형이 없는 높은 등급 부위(갑옷)는 낮은 기본형을 쓴다.
  - unit.ts: uq(id), uq2(id), 수호(위협 2배·받는 피해 감소·공격 −15%), 질풍(공속), 날카로운 눈 2차(치명 피해). buffAtk 설명 주석이 ultUntil 줄에 붙어 있던 것 고침.
  - battle.ts: 고유 효과 16종과 4세트 효과 처리(기본 공격·피해·치유·처치·쓰러짐·필살기·웨이브 시작·매 프레임), 불멸 이상 파티 전체 효과.
  - gacha.ts: 강화(enhanceCost, enhance), 제작(CRAFT, craft), 분해가 골드 + 강화석 + 정수(강화에 쓴 강화석 절반).
  - main.ts·hud.ts: 전투 승리마다 강화석, 결과 화면에 표시.
  - lobby.ts: 가방 상세(강화 단계, 강화 반영 수치, 고유 효과·2차·파티, 세트 2·4개, 강화·분해 버튼), 재료 줄과 [제작] 화면(16종), 칸에 +단계·★ 표시, 영웅 장비 탭에 고유 효과·세트 요약.
  - save.ts: mats(stone, essence). loadout.ts: 전투력에 고유 효과·4세트.
- 확인: 헤드리스 Chrome. 고유·세트 장비 15개를 파티에 끼우고 장비 탭 요약(철벽 4/4 등), 불멸 장신구 +10 강화(골드 27,500, 강화석 220 차감, 고유 효과 ×1.25), 파티 전체 효과(날카로운 눈 0.63·재생 0.50 이 다른 아군에게), 제작(피의 서약 전설 망치, 정수 30 차감), 1-10 전투 승리(광풍 4세트 추가 타격, 오류 없음). npm run build 통과.
- 결과: src/uniques.ts 새로. items.ts, unit.ts, battle.ts, gacha.ts, main.ts, hud.ts, lobby.ts, save.ts, loadout.ts, talents.ts(NumKey 를 items 에서), style.css 수정.

## 2026-11-18 — 4단계 반복 콘텐츠: 요일 던전, 무한탑, 레이드

- 한 일:
  - src/modes.ts 새로: 요일 던전 5종(요일·단계 6개·하루 3회·보상), 무한탑(층별 웨이브·보상, 주간 리셋), 레이드(60초, 피해 구간 6개, 하루 2회), refreshModes, stageOf, canRun, finishRun.
  - enemies.ts: 레이드 보스 심연의 비룡 카르나스(um/Dragon_Evolved, 체력 400,000, 꼬리 휩쓸기·서리 숨결·심연 낙하). public/assets/um/Dragon_Evolved.glb 복사(data/ultimate_monsters 원본, CC0).
  - data.ts: WAVE_POOL(망자·고블린·보스 웨이브), Stage.limit.
  - battle.ts: 제한 시간(fightAt, 시간 종료 배너), 남은 초를 웨이브 자리에, heroDamage.
  - main.ts: stageOf 로 스테이지를 찾고, 별 조건 없는 스테이지는 finishRun 보상. 다시 하기 때 횟수를 다 썼으면 로비로.
  - hud.ts 결과 화면: 제목 바꾸기(레이드 종료), 보상·정보 줄.
  - lobby.ts: [던전] 탭(요일 던전 목록·단계 고르기, 무한탑, 레이드 구간표), 승격 버튼에 승격석, 가방 재료 줄에 승격석. gacha.ts: PROMOTE_STONE.
  - save.ts: mats.promo, dungeon, tower, raid. missions.ts: dayKey·weekKey 내보내기.
- 확인: 헤드리스 Chrome(2026-11-18 수요일). 정수·승격석 던전만 열림, 시련의 제단 1단계 Lv.4·2단계 Lv.8 승(승격석 2·4), 무한탑 1·2층 Lv.3 승(다음 층으로), 레이드 Lv.10 피해 5만(3명 생존), Lv.20 8.7만, 하루 2회 뒤 버튼 막힘. npm run build 통과.
- 결과: src/modes.ts 새로. enemies.ts, data.ts, battle.ts, main.ts, hud.ts, lobby.ts, gacha.ts, save.ts, missions.ts, style.css, docs/credits.md 수정. public/assets/um/Dragon_Evolved.glb 추가.
