# 🍫 빼빼로데이 챌린지 — Copilot Managed Runtime 버전

사내 서버 없이 **managedapps.cloud.microsoft** 에 올려서 쓰는 버전입니다.
게임 3종과 랭킹 화면은 사내 서버 버전과 같습니다.

| | 사내 서버 버전 (`../`) | 이 버전 |
|---|---|---|
| 로그인 | 4자리 개인 코드 | **회사 계정으로 자동 로그인** (코드 불필요) |
| 기록 저장 | 서버의 JSON 파일 | Managed Runtime **내장 앱 상태(state)** — SharePoint 목록 불필요 |
| 랭킹 갱신 | 즉시 | **5초마다** 새로고침 |
| 점수 계산 | 서버에서 다시 계산 | 브라우저에서 계산 (카드 게임은 뒤집기 기록을 다시 재생해서 검증) |
| 관리 기능 | `/admin` 페이지 | 상단 **[관리]** 버튼 (`src/config.js` 의 `ADMINS` 에 있는 사람만 보임) |

> ⚠️ 서버가 없으므로 마음먹고 브라우저 개발자 도구로 기록을 조작하는 것까지 막지는 못합니다.
> 팀 내부 이벤트 수준에서는 충분하다고 판단했습니다. 이상한 기록은 관리 화면에서 삭제하세요.

---

## 준비물 (한 번만)

1. **Node.js 22 이상** — <https://nodejs.org/> (`node --version` 으로 확인)
2. **Git** — <https://git-scm.com/> (Windows는 Git for Windows 설치 시 Git Credential Manager가 함께 설치됨)
3. **Managed Apps CLI** 설치

   ```bash
   npm install -g @microsoft/managed-apps-cli@latest
   ms --version
   ```

   > `npx ms` 로 실행하지 마세요. 같은 이름의 다른 패키지가 실행될 수 있습니다.

4. 회사 계정으로 로그인

   ```bash
   ms auth login
   ms auth status      # 본인 계정이 맞는지 확인
   ```

5. **내장 앱 상태(state) 기능이 켜져 있는지 확인**

   ```bash
   ms feature status --name state --json
   ```

   결과에 `"enabled": true` 가 있어야 합니다. `false` 이면 여기서 멈추고 알려주세요 (그 경우 SharePoint 목록 저장 방식으로 바꿔야 합니다).

---

## 1. 앱 만들기

작업할 폴더(예: 문서 폴더)에서:

```bash
ms app create pepero-challenge --display-name "빼빼로데이 챌린지" --non-interactive
cd pepero-challenge
```

- 처음 실행하면 브라우저 로그인 창이 한 번 더 뜰 수 있습니다.
- `Could not commit and push the initial scaffold` 오류가 나오면 앱은 이미 만들어진 것입니다.
  `git fetch origin` 을 실행해서 브라우저에서 승인한 뒤 다음 단계로 넘어가세요. (`ms app create` 를 다시 실행하지 마세요.)

## 2. 이 폴더의 파일로 바꾸기

`ms app create` 가 만든 React 예제 파일을 지우고, 이 `managed-app` 폴더의 내용을 덮어씁니다.
**`ms.config.json` 과 `.git` 폴더는 지우지 마세요.** (앱과 연결된 정보입니다)

PowerShell (Windows):

```powershell
Remove-Item -Recurse -Force src, public, eslint.config.js, tsconfig.json, tsconfig.app.json, tsconfig.node.json -ErrorAction SilentlyContinue
Copy-Item -Recurse -Force <BBR_game 저장소 경로>\managed-app\* .
```

bash (Mac/Linux):

```bash
rm -rf src public eslint.config.js tsconfig*.json
cp -R <BBR_game 저장소 경로>/managed-app/. .
```

복사 후 폴더 구성:

```
pepero-challenge/
  ms.config.json     ← ms app create 가 만든 것 (그대로 둠)
  index.html, package.json, vite.config.ts, setup-state.ps1, setup-state.sh
  src/
    config.js        ← 관리자·마감 시각 설정
    main.js, store.js, managed.css, styles.css, shared/, games/
```

## 3. 기록 저장소(state) 만들기

```powershell
./setup-state.ps1        # Windows PowerShell
```

```bash
./setup-state.sh         # Mac/Linux
```

`attempt`(도전 기록)와 `setting`(마감 여부) 두 컬렉션을 만듭니다. **한 번만** 실행하세요.

## 4. 설정 바꾸기 — `src/config.js`

```js
export const EVENT_END = '2026-11-11T18:00:00+09:00'; // 자동 마감 시각
export const ADMINS = ['홍길동'];                       // 관리 화면을 볼 사람 (회사 계정 표시 이름 그대로)
export const PARTICIPANTS = [];                         // (선택) 미리 랭킹표에 보일 팀원 이름
```

`ADMINS` 이름은 앱 상단에 "🍫 OOO님"으로 표시되는 이름과 **정확히 같아야** 합니다.
(처음엔 비워두고 실행해서 본인 이름이 어떻게 나오는지 본 뒤 적어도 됩니다.)

## 5. 내 PC에서 실행해보기

```bash
npm install
npm run build
ms app dev
```

터미널에 `https://play...managedapps.../apps/dev?...` 주소가 나오면 브라우저로 열어서 게임을 해보세요.
코드를 고치면 바로 반영됩니다. 끝낼 때는 `Ctrl + C`.

> 참고: 주소 뒤에 `?mock&user=테스트` 를 붙이면 기록을 그 브라우저에만 저장하는 **모의 모드**로 동작합니다.
> 실제 저장소를 건드리지 않고 화면만 확인할 때 쓰세요. (이벤트용 링크에는 붙이지 마세요)

## 6. 올리기 (배포)

```bash
npm run build
git add -A
git commit -m "빼빼로데이 챌린지"
git push
ms app play --mode preview     # (권장) 배포 전 미리보기 — 미리보기는 기록 저장소가 따로라 테스트 기록이 섞이지 않음
ms app deploy                  # 실제 배포
ms app play                    # 배포된 앱 열기
```

## 7. 팀원에게 공유

이메일로 지정해서 공유:

```bash
ms app share "a@회사.com,b@회사.com,c@회사.com"
```

또는 링크로 공유:

```bash
ms app share link create
```

팀원은 받은 링크나 <https://managedapps.cloud.microsoft> 에서 앱을 열면 됩니다. 회사 계정으로 자동 로그인됩니다.

## 이벤트 운영

- **테스트 기록 지우기**: 이벤트 전에 상단 [관리] → **전체 기록 초기화**
- **기회 복구**: [관리] → 해당 기록 **삭제** (그 사람의 기회 1회가 돌아옴)
- **마감**: `EVENT_END` 시각에 자동 마감 / 바로 마감하려면 [관리] → **지금 마감**
- **결과 정리**: [관리] → **CSV 보기** → 복사해서 엑셀에 붙여넣기
- 게임을 **시작하는 순간 기회 1회가 차감**됩니다. 중간에 창을 닫으면 그 판은 기록 없이 소진됩니다.

## 코드 수정 후 다시 올리기

```bash
npm run build
git add -A && git commit -m "수정" && git push
ms app deploy
```

## 자주 나오는 문제

| 증상 | 해결 |
|---|---|
| "로그인 정보를 불러오지 못했어요" | 앱 플레이어(`ms app dev`가 알려준 주소 또는 managedapps 포털)에서 열었는지 확인 |
| `저장소 오류 (HTTP 404)` | 3단계 `setup-state` 를 실행했는지, 그 뒤 `npm run build` → 배포했는지 확인 |
| `저장소 오류 (HTTP 400)` | `setup-state` 일부 명령이 실패했을 수 있음. `ms project state list-schema` 결과를 확인 |
| `ms app deploy` 401 | `ms auth login` 후 다시 시도 |
| `ms app deploy` "commit not in remote" | `git push` 를 먼저 |

## 개발 메모 (저장소 관리자용)

`src/shared/`, `src/games/`, `src/styles.css` 는 저장소 루트의 원본(`public/`)을 복사한 것입니다.
원본을 고친 뒤 루트에서 `npm run sync:managed` 를 실행하세요. 두 파일이 다르면 `npm test` 가 실패합니다.
