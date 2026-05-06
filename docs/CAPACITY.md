# CAPACITY — 무료 플랜 기준 동시 사용자 가이드

본 서비스는 모두 **무료 티어**(Vercel Hobby + Supabase Free + 운영자 PC Ollama + Cloudflare Quick Tunnel)에서 운영됩니다. 각 컴포넌트의 한도와 권장 사용자 규모를 정리합니다.

## 권장 규모 (지인 배포 가정)

| 항목 | 권장값 | 비고 |
|---|---|---|
| **활성 사용자(MAU)** | **30명 이내** | 데이터 양·동시 접속 모두 여유 |
| **동시 접속(같은 시간)** | 10명 이내 | Vercel/Supabase는 충분, Ollama 미점유 시 OK |
| **동시 AI 분석 요청** | **5건 이내** | gemma4:e4b 1건당 5~30초. 큐잉 안 함 |
| **사용자별 일평균 분석** | 5~10건 | 그 이상이면 운영자 PC 부담 ↑ |

> 30명까지는 거의 모든 작업이 무료 한도 안에서 동작합니다. 50명을 넘기면 한도 점검(특히 Ollama 처리 속도와 Cloudflare tunnel 안정성)이 필요합니다.

## 컴포넌트별 한도

### Vercel Hobby
| 항목 | 한도 | 30명 운영 시 예상 |
|---|---|---|
| 함수 실행시간 | 10s / req (Hobby), 60s 우리 코드 max | OCR/AI 분석은 클라이언트로 분담했으므로 안전 |
| 함수 실행 횟수 | 100k/월 | 30명 × 일 30회 ≈ 27k/월. 여유 있음 |
| 대역폭 | 100GB/월 | 본 앱은 매우 가벼움(텍스트 위주) |
| Cron jobs | **일 1회** | keep-warm은 GitHub Actions로 대체 |

### Supabase Free
| 항목 | 한도 | 30명 운영 시 |
|---|---|---|
| DB 용량 | 500 MB | 거래 1만 건 ≈ 5MB. 충분 |
| Auth MAU | 50,000 | 무관 |
| Storage | 1 GB | 영수증 평균 200KB × 5,000장 ≈ 1GB. **자동 정리(7일 raw_text 폐기)로 관리** |
| 동시 connection | 60 | 30명 동시 접속에도 여유 |
| Egress | 5 GB/월 | 무관 |

### 운영자 PC Ollama (병목 지점)
| 항목 | 한도 | 권장 |
|---|---|---|
| gemma4:e4b 동시 처리 | 보통 1~2건 | 5건 이상 동시면 큐 적체 |
| 영수증 1건 분석 시간 | 5~30초 (CPU/GPU에 따라) | GPU 권장. CPU는 30초 가까이 |
| 전체 가용 처리량 | 시간당 100~700건 | 활성 사용자 30명 × 일 5건 = 150건/일 → 충분 |
| **PC 가동 시간** | 사용자 분석 시점에 켜져 있어야 함 | 24/7 전원 권장. 또는 활성 시간대만 |

### Cloudflare Quick Tunnel
| 항목 | 특성 |
|---|---|
| 비용 | 무료 |
| URL | 기동 때마다 새로 발급(임시) |
| uptime | **무보장** (Cloudflare 정책) |
| 권장 | 지인 배포는 OK, 50명+ 안정 운영은 named tunnel + Cloudflare Access로 업그레이드 |

## 30명을 넘어갈 때 점검할 것

1. **Ollama PC 사양** — 동시 분석 5건+이면 큐 또는 GPU 업그레이드.
2. **Cloudflare tunnel** — quick → named tunnel + 자체 도메인 + Access 토큰.
3. **Supabase Storage** — 사용자에게 영수증 자동 정리(7일 후 미보관) 권장.
4. **Vercel Pro 검토** — 함수 실행시간 60s, cron 무제한, 동시 사용자 안정성.
5. **모니터링** — Vercel Logs + Supabase Usage + Ollama 헬스 체크.

## 알림 임계 (운영자가 챙길 것)

| 지표 | 경고 | 위험 |
|---|---|---|
| Supabase DB 사용량 | > 60% | > 85% (다른 정리 또는 Pro로 이전) |
| Supabase Storage | > 60% | > 85% (영수증 자동 삭제 정책 강화) |
| Vercel 대역폭 | > 60% | > 85% |
| Ollama PC 응답 시간 | 분석 60s+ | 분석 timeout 60s 도달 (모델 다운그레이드 검토) |

## Keep-warm 정책

Vercel Hobby의 cold start를 줄이기 위해 **GitHub Actions cron** 사용:
- `.github/workflows/keep-warm.yml` 매 5분마다 `/api/ai-status` GET
- 추가 비용 없음, GitHub Actions 무료 한도 안에서 동작 (월 2,000분, 본 작업은 분당 5초 미만)

## 결론

- **30명 이내 지인 배포**: 모든 컴포넌트가 무료 한도 안에서 안정 동작
- **30~50명**: Ollama PC 사양과 Cloudflare tunnel 안정성을 한 번 점검
- **50명+**: Cloudflare named tunnel + Vercel Pro + 별도 Ollama 서버 분리 검토
