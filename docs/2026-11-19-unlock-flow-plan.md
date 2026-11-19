# 진행에 따라 열리는 화면 구현 계획

> For agentic workers: REQUIRED SUB-SKILL: superpowers:executing-plans 로 과제를 하나씩 한다. 단계는 체크박스(- [ ])로 표시한다.

목표: 스테이지를 깰 때마다 기능이 하나씩 열리고, 새로 열린 것과 할 수 있는 일을 빛·점으로 보여 준다. 말풍선 안내는 뺀다.

구조: 열림 표와 판정은 다른 파일을 가져오지 않는 순수 모듈 src/unlocks.ts 에 둔다(node 로 바로 시험할 수 있게). 로비(lobby.ts)·전투 HUD(hud.ts, main.ts)·결과 화면이 이 모듈로 보일지 말지, 빛낼지를 정한다. "본 것"은 저장의 seen 목록에 적는다.

기술: TypeScript + Vite, Babylon.js. 시험은 node 24 내장 node:test(타입 제거 실행)와 puppeteer-core 헤드리스 Chrome(390×844).

설계: docs/2026-11-19-unlock-flow-design.md

## 전체 조건

- 열림은 save.cleared 로만 계산한다. 열림 상태를 따로 저장하지 않는다.
- 저장을 불러올 때 seen 이 없으면 그때 열려 있는 기능을 모두 seen 에 넣는다(하던 저장에 빛이 쏟아지지 않게).
- 화면을 가리는 설명 창을 새로 만들지 않는다.
- 열림 표(설계 그대로):

```
id        이름          깨야 할 스테이지
hero      영웅          1-1
speed     배속          1-1
gear      장비          1-2
bag       가방          1-2
missions  임무          1-3
auto      AUTO          1-3
swap      앞뒤 교대     1-4
summon    소환          1-5
form      편성          1-5
policy    행동 방침     1-6
talent    특성          1-7
promo     승격·별       1-8
dungeon   던전          1-10
enhance   장비 강화     1-10
tower     무한탑        2-2
craft     장비 제작     2-4
raid      레이드        2-5
mock      모의전        2-7
```

## 놓치기 쉬운 곳 (Review Focus)

1. 하던 저장(전부 깬 것): 탭 5개·버튼이 모두 보이고 .new 빛이 하나도 없다 → 과제 1 시험, 과제 6 확인.
2. 저장 가져오기(설정)로 진행이 앞선 저장을 넣었을 때: seen 이 있으면 그대로 쓰고, 없으면 과제 1 규칙으로 채운다 → 과제 1 시험(seen 없는 저장).
3. 잠긴 탭에 머물러 있는 상태(예: 처음부터 다시 하기 뒤 tab 이 hero): 로비가 모험 탭으로 돌아간다 → 과제 2.
4. 배속·AUTO 가 잠겼는데 저장의 opt.speed 가 2·3 이거나 auto 가 켜져 있을 때: 전투는 1×, AUTO 꺼짐으로 돈다 → 과제 3.
5. 2장으로 넘어가며 여러 기능이 한 번에 열릴 때(1-10 은 dungeon·enhance 둘): 결과 화면에 둘 다 적힌다 → 과제 1 시험(newlyOpened 가 2개).

---

### 과제 1: 열림 모듈과 저장

Files:
- Create: src/unlocks.ts
- Create: src/tools/test-unlocks.mjs
- Modify: src/save.ts (SaveData 에 seen, upgrade 에 채우기)

Interfaces (뒤 과제가 쓰는 것):

```
export type Feature = 'hero' | 'speed' | 'gear' | 'bag' | 'missions' | 'auto' | 'swap' | 'summon' | 'form' | 'policy' | 'talent' | 'promo' | 'dungeon' | 'enhance' | 'tower' | 'craft' | 'raid' | 'mock'
export const UNLOCKS: Record<Feature, { name: string; at: string }>   // 위 표
export function isOpen(cleared: string[], f: Feature): boolean
export function opened(cleared: string[]): Feature[]                  // 열린 것 전부, 표 순서
export function newlyOpened(before: string[], after: string[]): Feature[]
export function isNew(save: { cleared: string[]; seen?: string[] }, f: Feature): boolean   // 열렸고 seen 에 없음
export function markSeen(save: { seen?: string[] }, f: Feature): boolean  // 새로 적었으면 true (저장은 부른 쪽이)
```

SaveData 에 seen?: string[] (본 기능 id). upgrade() 끝에 s.seen ??= opened(s.cleared). 새 저장(newSave)은 seen: [].

- [ ] 1. src/tools/test-unlocks.mjs 에 node:test 시험을 쓴다. import 는 '../unlocks.ts'.
  - isOpen([], 'hero') === false, isOpen(['1-1'], 'hero') === true, isOpen(['1-1'], 'gear') === false
  - opened(1-1 ~ 2-10 전부) 길이 18
  - newlyOpened(['1-1',…,'1-9'], [...그것, '1-10']) 는 ['dungeon', 'enhance']
  - newlyOpened(x, x) 는 []
  - isNew({ cleared: ['1-1'], seen: [] }, 'hero') === true, seen: ['hero'] 이면 false, cleared: [] 이면 false
  - markSeen 은 처음 true, 두 번째 false, seen 이 없던 객체에 배열을 만든다
- [ ] 2. 실행: node --test src/tools/test-unlocks.mjs → 모듈이 없어 FAIL
- [ ] 3. src/unlocks.ts 를 만든다. 아무 파일도 import 하지 않는다. 스테이지 비교는 cleared.includes(at).
- [ ] 4. 실행: node --test src/tools/test-unlocks.mjs → 모두 pass
- [ ] 5. save.ts 에 seen 필드와 upgrade 채우기. 실행: npx tsc --noEmit → 오류 없음
- [ ] 6. 커밋: "열림 표(unlocks.ts)와 저장 seen"

### 과제 2: 로비 — 잠긴 것 숨기기, 새것 빛내기, 말풍선 빼기

Files:
- Modify: src/lobby.ts, src/style.css

Interfaces:
- 소비: isOpen, isNew, markSeen (과제 1)
- 생산: Lobby.show(save, go?: { tab: Tab; heroView?: 'info' | 'gear' | 'talent'; heroId?: string }) — 과제 4 가 패배 바로가기에 쓴다. go 가 없으면 지금처럼 모험 탭.

숨길 곳과 기능 id:

```
아래 탭       dungeon→dungeon, hero→hero, summon→summon, bag→bag (adventure 는 늘)
모험 패널     편성 버튼→form, 임무 버튼→missions (출석 자동 열기도 missions 가 열렸을 때만)
영웅 탭       장비 seg→gear, 특성 seg→talent, 행동 방침 줄→policy, promoHtml 전체→promo
가방          강화 버튼→enhance, 제작 버튼→craft
던전 seg      무한탑→tower, 레이드→raid, 모의전→mock
```

- [ ] 1. 위 표대로 render·각 Html 에서 잠긴 것을 그리지 않는다. this.tab·this.dview 가 잠긴 곳이면 adventure·day 로 되돌린다.
- [ ] 2. 열렸지만 isNew 인 버튼·탭에 class new 를 붙인다. 누르면 markSeen → writeSave. 모험 탭의 출전 버튼은 빛내지 않는다.
- [ ] 3. CSS .new: 금빛 고동(기존 tippulse 와 같은 결의 box-shadow 애니메이션, 1.2초 반복). 아래 탭은 아이콘 위로 살짝 떠오르며 나타나는 등장(한 번).
- [ ] 4. tips()·showTip·tipOpen import 와 부르는 곳을 지운다.
- [ ] 5. show(save, go) 를 받게 한다.
- [ ] 6. 실행: npx tsc --noEmit → 오류 없음. 커밋: "로비: 진행에 따라 탭·버튼 열기, 새것 빛"

### 과제 3: 로비 점과 전투 화면 신호

Files:
- Modify: src/lobby.ts, src/hud.ts, src/main.ts, src/style.css

점 (기존 i.dot 모양, 해당 기능이 열렸을 때만):
- 영웅 탭과 그 영웅 칩: 파티 영웅 중 레벨 < 다음에 깰 스테이지(frontier) 적 레벨이고 골드 ≥ levelCost(레벨) 인 영웅
- 영웅 탭 장비 seg 와 영웅 칩: 그 영웅의 빈 장비 칸에 낄 수 있는 장비가 가방에 있다(장착 후보를 고르는 기존 함수를 쓴다)
- 영웅 탭: 승격 가능(canPromote 가 빈 값)
- 소환 탭: 보석 ≥ 10회 소환 비용(gacha.ts 의 영웅 배너 10회 값)

전투:
- [ ] 1. hud.setLocks(open: { speed: boolean; auto: boolean; swap: boolean }, fresh: { speed: boolean; auto: boolean; swap: boolean }) — 잠긴 버튼은 숨기고, fresh 는 class new. 버튼을 처음 누르면 main 에서 markSeen.
- [ ] 2. main.startBattle: speed 가 잠겼으면 b.setSpeed(1), auto 가 잠겼으면 b.auto = false(저장값은 그대로 둔다).
- [ ] 3. 필살 가능 카드(.card.full)에 금빛 고동 애니메이션을 더한다(CSS 만).
- [ ] 4. ⇅: 열렸고 이번 전투에서 앞줄(slot < 2) 영웅 체력이 처음 50% 아래가 되면 hud.pulseSwap() 으로 class new 를 3초 붙인다. 이것이 지금 battleTips 의 자리를 대신한다. battleTips 와 tutorial import 는 지운다.
- [ ] 5. 실행: npx tsc --noEmit → 오류 없음. 커밋: "할 수 있는 일 점, 전투 버튼 열림·빛"

### 과제 4: 결과 화면 — 새로 열림 줄과 패배 바로가기

Files:
- Modify: src/main.ts, src/hud.ts, src/style.css

Interfaces:
- hud.result(win, heroes, time, reward, onRetry, onLobby, extra?: { opened?: string[]; links?: { label: string; go: () => void }[] })
- 소비: newlyOpened (과제 1), Lobby.show(save, go) (과제 2)

- [ ] 1. 이기면 첫 클리어 전후 cleared 로 newlyOpened 를 구해 "새로 열림 · 영웅 · 배속" 한 줄로 결과에 넣는다(UNLOCKS[f].name, 가운데점으로 잇기).
- [ ] 2. 메인 스토리에서 지면 원인 순서대로 최대 2개 바로가기:
  - 파티 평균 레벨 < 스테이지 적 레벨이고 hero 열림 → [레벨 올리기] → { tab: 'hero', heroView: 'info', heroId: 파티에서 레벨 가장 낮은 영웅 }
  - 파티 영웅 중 빈 칸에 낄 장비가 있고 gear 열림 → [장비 끼기] → { tab: 'hero', heroView: 'gear', heroId: 그 영웅 }
  - 남은 특성 포인트가 있는 파티 영웅이 있고 talent 열림 → [특성 찍기] → { tab: 'hero', heroView: 'talent', heroId: 그 영웅 }
  - 위가 하나도 없고 summon 열림 → [영웅 소환] → { tab: 'summon' }
- [ ] 3. 바로가기 버튼은 금색 버튼 줄로 결과 상자 안, 로비로·다시 하기 위에 둔다.
- [ ] 4. 실행: npx tsc --noEmit → 오류 없음. 커밋: "결과: 새로 열림, 패배 바로가기"

### 과제 5: 튜토리얼 빼기

Files:
- Move: src/tutorial.ts → archive/src/tutorial.ts
- Modify: src/settings.ts (튜토리얼 다시 보기 버튼·onTutorial 훅 빼기, 머리 주석 고치기), src/lobby.ts (openSettings 부르는 곳의 훅), src/style.css (.tip-ov, .tip-hole, .tip-box, tippulse 를 다른 데서 안 쓰면 빼기)

- [ ] 1. 옮기고 지운다. save.tut 필드는 하던 저장 호환을 위해 둔다.
- [ ] 2. 실행: grep -rn "tutorial\|showTip" src → 결과 없음. npm run build → 성공.
- [ ] 3. 커밋: "말풍선 튜토리얼 빼기 (archive 로)"

### 과제 6: 실제 화면 확인

Files:
- Create: src/tools/check-unlocks.mjs (portraits.mjs 와 같은 puppeteer-core 설정, 개발 서버를 띄운 채 실행)

- [ ] 1. 스크립트가 확인하는 것:
  - 새 저장(localStorage.clear 뒤): 아래 탭 버튼이 모험 하나, 편성·임무 버튼 없음
  - window.game.save.cleared 를 1-1 로 두고 lobby.show: 영웅 탭이 있고 .new
  - 그 탭을 누른 뒤: .new 없음, save.seen 에 hero
  - 1-1 ~ 1-5: 탭 4개(모험·영웅·소환·가방), 1-10 까지: 5개
  - 1-1 ~ 2-10 에 seen 없는 저장을 loadSave 규칙으로 올림(upgrade 를 거치게 localStorage 에 쓰고 다시 불러오기): .new 0개
  - 전투 화면: 새 저장으로 1-1 시작 시 배속·AUTO·⇅ 버튼 숨김
  - 단계마다 스크린샷을 logs/unlock-check/ 에 저장
- [ ] 2. 실행: npm run dev 를 띄운 채 node src/tools/check-unlocks.mjs → 모든 줄 OK. 스크린샷을 눈으로 본다(빛 모양, 결과 화면 줄).
- [ ] 3. README(현재 상태·폴더 구조: unlocks.ts, tools 두 개, archive/src), HISTORY, conversations/2026-11-19.md 를 고친다.
- [ ] 4. 커밋: "열림 확인 스크립트, 기록". push 는 사용자에게 묻는다.
