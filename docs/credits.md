# 에셋 출처

게임에 쓴 외부 에셋과 라이선스. 새 에셋을 넣으면 여기에 한 줄 더한다. CC-BY 계열은 게임 설정 화면 크레딧에도 넣는다(src/settings.ts CREDITS, 2026-11-18 추가).

| 에셋 | 위치 | 출처 | 라이선스 |
|---|---|---|---|
| 영웅 모델·애니메이션 (Knight, Barbarian, Mage, Rogue, Rogue_Hooded) | data/kaykit/characters/ (3-5 부터 안 씀, 줄인 판은 archive/assets/characters) | KayKit Adventurers Character Pack 1.0, Kay Lousberg (github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0) | CC0 |
| 해골 모델·애니메이션 (Minion, Warrior, Rogue, Mage) | data/kaykit/enemies/ (3-5 부터 안 씀, 줄인 판은 archive/assets/enemies) | KayKit Skeletons Character Pack 1.0, Kay Lousberg (github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0) | CC0 |
| 해골 무기 (Axe, Blade, Staff, Crossbow, Shield) | data/kaykit/enemies/weapons/ | 위와 같은 팩 | CC0 |
| 던전 바닥·벽·소품 20종 | data/kaykit/dungeon/ | KayKit Dungeon Remastered 1.0, Kay Lousberg (github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0) | CC0 |
| 조합형 캐릭터 몸·머리·헤어 | public/assets/q/head, body/Human_*, hair (원본 data/quaternius/base) | Quaternius Universal Base Characters [Standard] | CC0 |
| 의상 파츠 (농부·레인저) | public/assets/q/part (원본 data/quaternius/outfits) | Quaternius Modular Character Outfits - Fantasy [Standard] | CC0 |
| 엘프·오크 몸 | public/assets/q/body/Elf_*, Orc_* (원본 data/quaternius/races) | Quaternius Characters - Fantasy Races [Standard] | QAL (게임 안 사용 가능, 에셋 단독 재배포 금지) |
| 임프·퍼글린 몸 | public/assets/q/body/Imp, Puglin (원본 data/quaternius/bestiary) | Quaternius Bestiary - Dungeon Monsters [Standard] | QAL |
| 공용 애니메이션 | public/assets/q/anim/UAL1, UAL2 (원본 data/quaternius/ual, ual2) | Quaternius Universal Animation Library 1·2 [Standard] | CC0 |
| 무기 70종 (도끼·단검·망치·장검·철퇴·곡괭이·세이버·단검·삽·창) | public/assets/q/weapon/*_0N (원본 data/weapons/rpg-weapons) | Binbun RPG Weapons (Free) | CC0 |
| 무기 31종 (활·지팡이·완드·방패·검 등) | public/assets/q/weapon/kk_* (원본 data/weapons/fantasy-weapons-bits) | KayKit Fantasy Weapons Bits 1.0 (Free), Kay Lousberg | CC0 |
| 투구·모자·망토 11종 | public/assets/q/gear (원본 data/kaykit 캐릭터에서 떼어 냄) | KayKit Adventurers·Skeletons, Kay Lousberg | CC0 |
| 보스 몬스터 (Ghost_Skull 망령 군주, Demon 불꽃 악마, Dragon_Evolved 레이드 비룡) | public/assets/um (받은 원본 16종은 data/ultimate_monsters, 출처 목록 data/ultimate_monsters/sources.txt) | Quaternius Ultimate Monsters (quaternius.com, Google Drive 가 한도 초과라 같은 모델을 Poly Pizza poly.pizza 에서 GLB 로 받음, 2026-11-18, 16개 5.3MB) | CC0 |
| 변신형 용 (용기사) | public/assets/q/body/TripoDragon.glb (원본 data/tripo/dragon_knight_v1.glb) | Tripo AI 무료 계정으로 생성 (tripo3d.ai, H2.5, 2026-11-18). 뼈대는 Quaternius Universal Base Characters 뼈대를 Blender 5.3 으로 옮겨 심음 | Tripo 무료 계정 결과물: 공개 모델·비상업 이용 (게임은 무료 공개) |
| 변신형 4종: 별빛 사수(카일), 대지 거인(가르쉬), 리치(모르간), 현자(세라) | public/assets/q/body/TripoStarArcher.glb, TripoEarthTitan.glb, TripoLich.glb, TripoSage.glb, 각 1.5~1.7MB (원본 data/tripo/kyle_star_v1.glb, garsh_titan_v1.glb, morgan_lich_v1.glb, sera_sage_v1.glb) | Tripo AI 무료 계정으로 생성 (tripo3d.ai, H2.5, 텍스처 2K, 폴리곤 2만, 모델당 25 크레딧, 2026-11-19). 뼈대는 위와 같이 Blender 로 심음 | Tripo 무료 계정 결과물: 공개 모델·비상업 이용 |
| 장비 아이콘 17종 | public/icons/*.svg | game-icons.net (Lorc, Delapouite, Willdabeast) | CC BY 3.0 (표기 의무) |
| 메뉴 아이콘 6종(모험·던전·영웅·소환·가방 탭, 설정) | public/icons/ui/*.svg, 약 12KB | game-icons.net (Lorc, Delapouite), github.com/game-icons/icons | CC BY 3.0 (표기 의무) |
| 글꼴 Black Han Sans, Noto Sans KR | Google Fonts 에서 불러옴 | Google Fonts | SIL OFL 1.1 |
| meshopt 디코더 | public/meshopt_decoder.js | meshoptimizer, Arseny Kapoulkine | MIT |
| 이펙트 텍스처 (불꽃, 링, 베기, 빛기둥) | 코드로 그림 (src/fx.ts) | 직접 제작 | — |
| 장식 소품 10종 (Crown, Armor_Metal, Armor_Golden, Armor_Leather, Necklace1, Necklace3, Backpack, Bag, Skull: Quaternius / Quiver: CreativeTrio) | public/assets/q/acc (원본 data/polypizza, 출처·주소 data/polypizza/sources.txt) | Poly Pizza (poly.pizza) 에서 받음, 2026-11-19 | CC0 |
| 빛 장식 (후광, 빛 날개, 구슬, 뿔) | 코드로 만듦 (src/heroModel.ts makeFxAcc) | 직접 제작 | — |
| 효과음 15종, 배경음 3곡 | 코드로 합성 (src/sound.ts, Web Audio) | 직접 제작 | — |

CC0 는 표기 의무가 없지만 KayKit 제작자가 표기를 권하므로 크레딧 화면에 Kay Lousberg (www.kaylousberg.com) 를 넣는다.

게임에는 원본(data/kaykit)을 줄인 판(public/assets, npm run assets)을 쓴다.

QAL 원본(data/quaternius/races, bestiary)은 git 에 올리지 않는다. 게임용으로 줄이고 바꾼 파일만 public/ 에 둔다.
