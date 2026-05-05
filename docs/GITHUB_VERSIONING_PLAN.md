# GITHUB_VERSIONING_PLAN

## 저장소 구조
- 단일 저장소(Single repo). 추후 모노레포 분리 가능성 열어둠.
- 기본 브랜치: `main` (production 배포 트리거).

## 브랜치 전략
| 브랜치 | 용도 | 보호 |
|---|---|---|
| main | production 배포 | 보호: PR 필수, status check 통과, 1인 review |
| dev | 개발 통합 | 보호 가벼움 |
| feature/<name> | 신규 기능 | PR 후 dev로 머지 |
| fix/<name> | 버그 수정 | dev 또는 main(핫픽스) |
| docs/<name> | 문서 작업 | dev로 머지 |

> 1인 개발 초기에는 PR 자체를 생략하고 dev → main 직접 머지도 허용. 다만 main으로 가는 머지 직전에는 build/test pass 확인.

## 커밋 메시지 컨벤션 (Conventional Commits)
- `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`, `chore: ...`, `test: ...`, `style: ...`, `perf: ...`, `ci: ...`.
- 한국어 본문 허용. 제목은 50자 이내, 본문 줄바꿈 72자 권장.

## PR 규칙
- 제목: 한 줄 요약(컨벤션 prefix 사용).
- 본문: 변경 사항 / 테스트 방법 / 관련 이슈.
- 체크리스트:
  - [ ] 비밀키/secret이 커밋되지 않음
  - [ ] build 통과
  - [ ] 단위 테스트 통과
  - [ ] 반응형 확인(필요한 경우)
  - [ ] DB 마이그레이션/롤백 SQL 동봉(스키마 변경 시)

## .gitignore 핵심 항목
```
node_modules/
.next/
out/
.vercel/
.env
.env.local
.env.*.local
*.pem
coverage/
.DS_Store
*.log
.idea/
.vscode/
```

## secret 보호
- pre-commit에 `gitleaks` 또는 `git-secrets` 통합.
- GitHub Action(`secret scanning`) 활성화.
- 만약 비밀키가 커밋되면: 즉시 회전 → BFG로 히스토리 정리 → force-push는 팀 합의 후.

## CI (GitHub Actions, 권장)
- workflow 파일 위치: `.github/workflows/ci.yml`.
- 트리거: PR open/synchronize, push to main/dev.
- 단계:
  1. setup node
  2. install
  3. typecheck
  4. lint
  5. test (unit)
  6. build (`next build`)
- 시크릿 스캔(gitleaks) 단계 추가.

## 태그 / 릴리즈
- 의미 있는 마일스톤마다 태그(예: `v0.1.0-mvp`).
- GitHub Releases에 변경점 정리(자동 생성기 활용 가능).

## 이슈 라벨
- `type:feature`, `type:bug`, `type:docs`, `type:chore`.
- `area:ai`, `area:ocr`, `area:ui`, `area:db`, `area:security`.
- `priority:high/medium/low`.

## push 전 체크리스트
- [ ] `git status`로 의도치 않은 파일 없음 확인
- [ ] `.env*` 파일 staged 아님
- [ ] `npm run typecheck && npm run lint && npm run test` 통과
- [ ] `next build` 통과(가능하면 로컬에서 1회)
- [ ] 마이그레이션 SQL 포함(스키마 변경 시)

## 충돌 시
- rebase 우선(작업 단위 작게 유지).
- main으로 force-push 금지. 필요 시 별도 브랜치에서 정리 후 PR.
