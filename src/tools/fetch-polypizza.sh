#!/bin/bash
# Poly Pizza 에서 Quaternius 몬스터를 이름으로 찾아 GLB 를 받는다. 인자: 출력 폴더, 이름들 (공백은 %20)
out=$1; shift
mkdir -p "$out"
for q in "$@"; do
  name=$(echo "$q" | sed 's/%20/_/g')
  [ -s "$out/$name.glb" ] && continue
  page=$(curl -sL "https://poly.pizza/search/$q")
  # 검색 결과에서 alt 이름이 정확히 같은 첫 모델
  id=$(echo "$page" | grep -o '/m/[A-Za-z0-9_-]*\|alt="[^"]*"' | awk -v want="$(echo "$q" | sed 's/%20/ /g')" '/^\/m\//{m=$0; next} $0=="alt=\""want"\"" && m {print m; exit}')
  [ -z "$id" ] && { echo "NOTFOUND $q"; continue; }
  m=$(curl -sL "https://poly.pizza$id")
  echo "$m" | grep -q Quaternius || { echo "NOTQ $q $id"; continue; }
  lic=$(echo "$m" | grep -o 'CC0\|CC-BY' | head -1)
  glb=$(echo "$m" | grep -o 'static\.poly\.pizza/[0-9a-f-]*\.glb' | head -1)
  curl -sL -o "$out/$name.glb" "https://$glb"
  echo "$name $id $lic $(stat -c %s "$out/$name.glb") https://$glb"
done
