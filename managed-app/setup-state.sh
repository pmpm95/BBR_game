#!/usr/bin/env bash
# 내장 앱 상태(state) 컬렉션 생성 + 타입 코드 생성 (앱 폴더에서 한 번만 실행)
set -euo pipefail

ms project state add --collection attempt
ms project state add --collection attempt --property playerId   --type string   --required true --max-length 100 --index true
ms project state add --collection attempt --property playerName --type string   --required true --max-length 200
ms project state add --collection attempt --property game       --type string   --required true --max-length 20  --index true
ms project state add --collection attempt --property status     --type string   --required true --max-length 20
ms project state add --collection attempt --property startedAt  --type datetime --required true
ms project state add --collection attempt --property finishedAt --type datetime
ms project state add --collection attempt --property deck       --type string   --max-length 400
ms project state add --collection attempt --property raw        --type number
ms project state add --collection attempt --property metric     --type number
ms project state add --collection attempt --property score      --type integer
ms project state add --collection attempt --property display    --type string   --max-length 200
ms project state add --collection attempt --property detail     --type string   --max-length 2000
ms project state add --collection attempt --property rejectReason --type string --max-length 300

ms project state add --collection setting
ms project state add --collection setting --property key    --type string --required true --max-length 50
ms project state add --collection setting --property frozen --type boolean

ms project state set-setting --locale ko-KR
ms project state generate-code
ms project state list-schema
echo "✅ state 스키마 준비 완료"
