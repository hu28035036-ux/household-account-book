# LOCAL_AI_SERVER_PLAN

## 목표
Vercel은 정적/서버리스 호스팅이라 Ollama를 직접 돌릴 수 없다. 따라서 **별도 머신(개인 PC 또는 미니 서버)에 Ollama**를 띄우고, Vercel의 Next.js API에서 HTTP로 호출한다.

## 머신 요구사항(권장)
- gemma4:e4b 모델 추론을 무리 없이 돌릴 수 있는 GPU 또는 충분한 메모리(상세 사양은 모델 카드 확인).
- 24/7 켜져 있어야 외부 사용자가 분석 가능. 1인 사용은 사용 시점에만 켜도 OK.

## 설치
1. Ollama 설치(공식 문서).
2. 모델 pull: `ollama pull gemma4:e4b` (모델 식별자가 다르면 사용자 환경에 맞게 조정).
3. 기본 포트: `11434`.

## 외부 접근
인터넷 직접 노출은 위험. 권장 옵션:

### A. Cloudflare Tunnel (권장)
- `cloudflared`로 터널 생성 → `https://ai-yourname.trycloudflare.com` 같은 URL 발급.
- 도메인 앞에 Access(Cloudflare Zero Trust)로 보안 토큰 검증.

### B. Tailscale
- 사설망으로 묶고, Vercel은 외부망이라 직접 호출 불가. → Tailscale 노드를 둔 중계 서버를 한 단계 두거나, Vercel이 호출하는 부분을 사용자 PC가 polling 방식으로 가져가는 방식 검토.

### C. 자체 리버스 프록시 + 토큰
- nginx/caddy가 인증 헤더(`x-ai-token`) 검증 후 Ollama로 프록시.
- 토큰은 Vercel 환경변수 `OLLAMA_API_TOKEN`로 관리.

## Next.js 측 호출
- 환경변수 `OLLAMA_API_BASE_URL`, `OLLAMA_MODEL`, (옵션) `OLLAMA_API_TOKEN`.
- 서버 라우트에서 `fetch` 호출, timeout 60s, 재시도 1회.
- AI 서버 다운 시: 사용자에게 명확히 안내, 수동 입력 옵션 제공.

## 보안
- 인터넷 직접 노출 금지. 토큰 또는 Zero Trust 필수.
- Ollama는 기본적으로 인증이 없으므로 반드시 앞단에 인증 게이트웨이.
- IP 화이트리스트(Vercel egress IP 범위는 가변이라 한계가 있음 → 토큰 인증 우선).

## 가용성
- 사용자 본인만 쓸 때: 사용 시점에 Ollama 띄우고, 끝나면 끔.
- 다중 사용자: Ollama 서버 24/7 운영, 동시 요청 큐잉/제한 검토.

## 모니터링
- Ollama 프로세스 헬스 체크 엔드포인트(`/api/tags` 또는 자체 `/healthz`).
- Next.js 측에서 5분 간격 헬스체크 후 대시보드에 "AI 서버 상태" 배지 표시(설정 화면).

## 설정 화면 노출
- AI 서버 URL/연결 상태 표시.
- 연결 실패 가이드(파워 온 / 터널 활성화 / 토큰 확인).

## Fallback 전략
- AI 서버 미가동 시 OCR 텍스트 + 학습 규칙만으로 후보 일부 자동 생성.
- 그래도 부족하면 사용자가 수동 입력으로 진행.

## 다중 사용자 확장 시 고려
- 외부 AI 서버 비용/관리 책임 증가.
- 본인 외 사용자 데이터가 집 PC를 거치게 됨 → 개인정보보호 검토 필수.
- 이때부터는 별도 서버 인프라(예: GPU 인스턴스)로 분리하거나, 오픈소스 LLM 운영형 서비스로 전환 검토.
