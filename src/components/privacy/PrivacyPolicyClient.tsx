'use client';

import {
  ShieldCheck,
  Database,
  Brain,
  Eye,
  Trash2,
  Lock,
  AlertTriangle,
  Mail,
} from 'lucide-react';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';

// 개인정보보호법 기준 필수 항목 + 30지인 비공개 운영 현실에 맞춘 솔직한 톤.
// 시행일은 컴파일 시점 기준 — 큰 변경 시 수동 갱신.
const EFFECTIVE_DATE = '2026-05-07';
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'hu28035036@gmail.com';

export function PrivacyPolicyClient() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-textPinkStrong" strokeWidth={1.75} />
        <h2 className="text-2xl font-semibold text-textPrimary">개인정보처리방침</h2>
      </div>

      <Card className="bg-softPinkBackground/50 border-softPinkBackground">
        <CardSubtle className="leading-relaxed">
          이 앱은 <b className="text-textPrimary">개인 운영자가 30명 미만 지인을 위해 비공개로
          운영</b>하는 가계부입니다. 광고·결제·외부 영업 없이 운영되며, 아래 정책에 따라
          개인정보를 안전하게 처리합니다. 회원가입과 동시에 본 처리방침에 동의한 것으로 봅니다.
        </CardSubtle>
      </Card>

      {/* 1. 수집·처리 항목 */}
      <Section
        icon={<Database className="h-5 w-5" strokeWidth={1.75} />}
        title="1. 처리하는 개인정보 항목"
      >
        <ul className="list-disc pl-5 space-y-1 text-sm text-textSecondary leading-relaxed">
          <li>
            <b className="text-textPrimary">계정 정보</b> — 이메일, 아이디, 비밀번호(해시),
            닉네임, 가입일, 마지막 로그인 시각·IP
          </li>
          <li>
            <b className="text-textPrimary">금융 거래 기록</b> — 거래일, 금액, 가맹점 이름,
            카테고리, 결제수단명, 메모
          </li>
          <li>
            <b className="text-textPrimary">파일</b> — 업로드한 영수증 사진, 은행/카드 거래내역
            파일(CSV·XLSX·PDF)
          </li>
          <li>
            <b className="text-textPrimary">설정</b> — 예산 한도, 카테고리·결제수단 정의, 고정
            거래 규칙, 알림 설정
          </li>
          <li>
            <b className="text-textPrimary">학습 데이터</b> — 가맹점 → 카테고리 자동 매칭 규칙
            (사용자별)
          </li>
          <li>
            <b className="text-textPrimary">로그</b> — 알림 발송 기록, 분석 후보 처리 이력, AI
            분석 응답 기록
          </li>
        </ul>
        <p className="mt-3 text-xs text-textMuted leading-relaxed">
          민감정보(주민번호, 카드번호, 계좌번호 전체) 는 OCR/파일 처리 단계에서{' '}
          <b className="text-textPrimary">자동 마스킹</b> 되어 끝 4자리만 저장됩니다.
        </p>
      </Section>

      {/* 2. 처리 목적 */}
      <Section
        icon={<Brain className="h-5 w-5" strokeWidth={1.75} />}
        title="2. 처리 목적"
      >
        <ul className="list-disc pl-5 space-y-1 text-sm text-textSecondary leading-relaxed">
          <li>가계부 본연의 기능: 거래 기록, 예산·분석·통계, 모임 공유</li>
          <li>영수증·파일에서 거래를 자동 추출 (OCR + AI)</li>
          <li>가맹점 → 카테고리 자동 분류 (학습 규칙 + AI)</li>
          <li>예산 초과 알림, 정기 거래 사전 알림</li>
          <li>오류 디버깅 및 서비스 안정 운영</li>
        </ul>
      </Section>

      {/* 3. 보유 기간 */}
      <Section
        icon={<Trash2 className="h-5 w-5" strokeWidth={1.75} />}
        title="3. 보유·이용 기간"
      >
        <ul className="list-disc pl-5 space-y-1 text-sm text-textSecondary leading-relaxed">
          <li>
            계정이 유지되는 동안 보관됩니다.
          </li>
          <li>
            <b className="text-textPrimary">계정 삭제 요청 시</b>: 즉시 cascade delete —
            거래·파일·후보·학습 규칙·알림 모두 영구 삭제. 되돌릴 수 없습니다.
          </li>
          <li>
            <b className="text-textPrimary">OCR 원본 텍스트</b>: 분석 후 7일 자동 폐기 (자동 cron
            job).
          </li>
          <li>
            데이터베이스 백업이 운영자 정책상 존재할 수 있으며, 일반적으로 7일 이내 자동
            폐기됩니다.
          </li>
        </ul>
      </Section>

      {/* 4. 제3자 제공 / 위탁 */}
      <Section
        icon={<Eye className="h-5 w-5" strokeWidth={1.75} />}
        title="4. 제3자 제공 및 위탁"
      >
        <p className="text-sm text-textSecondary mb-2">
          광고·마케팅 목적의 제3자 제공은 일절 없습니다. 단, 서비스 운영을 위해 다음 위탁업체를
          이용합니다:
        </p>
        <div className="space-y-2">
          <SubItem
            name="Supabase (미국)"
            purpose="데이터베이스, 인증, 파일 스토리지"
            data="모든 가계부 데이터 (행 단위 RLS 격리)"
            retention="계정 유지 기간"
          />
          <SubItem
            name="Vercel (미국)"
            purpose="웹앱 호스팅"
            data="HTTP 요청 로그 (URL, 상태코드, IP, 시각). 거래 내용은 로그에 남기지 않음."
            retention="자동 30일"
          />
          <SubItem
            name="OpenAI (미국)"
            purpose="영수증 분석, AI 입력 어시스턴트, 통계 요약"
            data="영수증에서 추출된 텍스트, 가맹점·금액 등 관련 정보, 사용자 자연어 명령"
            retention="OpenAI 정책상 30일 후 자동 폐기. 모델 학습에 사용되지 않음 (gpt-4o-mini API)."
          />
        </div>
      </Section>

      {/* 5. 안전조치 */}
      <Section
        icon={<Lock className="h-5 w-5" strokeWidth={1.75} />}
        title="5. 안전조치"
      >
        <ul className="list-disc pl-5 space-y-1 text-sm text-textSecondary leading-relaxed">
          <li>
            <b className="text-textPrimary">RLS (Row Level Security)</b> — 다른 사용자의
            데이터에 절대 접근할 수 없도록 데이터베이스 레벨에서 강제.
          </li>
          <li>
            <b className="text-textPrimary">비밀번호</b> — 해시 저장 (Supabase 표준), 운영자도
            평문 비밀번호를 알 수 없음.
          </li>
          <li>
            <b className="text-textPrimary">전송 구간 암호화</b> — 모든 통신 HTTPS (TLS 1.2+).
          </li>
          <li>
            <b className="text-textPrimary">민감정보 자동 마스킹</b> — 카드번호·계좌번호·주민번호
            자동 탐지 후 끝 4자리만 저장.
          </li>
          <li>
            <b className="text-textPrimary">2단계 인증</b> — 운영자 계정 의무 적용. 일반 사용자
            선택 가능.
          </li>
          <li>
            <b className="text-textPrimary">접근 통제</b> — 관리자 메뉴는 등록된 운영자
            이메일만 접근 가능.
          </li>
        </ul>
      </Section>

      {/* 6. 정보주체 권리 */}
      <Section
        icon={<ShieldCheck className="h-5 w-5" strokeWidth={1.75} />}
        title="6. 사용자(정보주체) 권리"
      >
        <ul className="list-disc pl-5 space-y-1 text-sm text-textSecondary leading-relaxed">
          <li>
            <b className="text-textPrimary">열람</b> — 본인 데이터를 거래내역·통계 페이지에서
            언제든 조회 가능. 전체 백업이 필요하면{' '}
            <b className="text-textPrimary">설정 → 데이터 내보내기</b> (CSV/XLSX/JSON).
          </li>
          <li>
            <b className="text-textPrimary">정정·수정</b> — 거래내역 페이지에서 직접 편집.
          </li>
          <li>
            <b className="text-textPrimary">삭제</b> — 설정 → 계정 삭제 → "DELETE" 입력 →
            영구 삭제. 즉시 처리됨.
          </li>
          <li>
            <b className="text-textPrimary">처리 정지·동의 철회</b> — 계정 삭제로 갈음됩니다.
          </li>
        </ul>
      </Section>

      {/* 7. 운영자 알림 — 솔직한 고지 */}
      <Card className="bg-warningSoft border-warning/30">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" strokeWidth={1.75} />
          <div>
            <CardTitle className="text-warning">운영자 접근 가능성 — 솔직한 고지</CardTitle>
            <CardSubtle className="mt-2 leading-relaxed">
              본 서비스는 <b className="text-textPrimary">개인 운영자가 직접 운영</b>합니다.
              기술적으로 운영자는 데이터베이스 관리자 권한을 갖고 있어, 디버깅·운영·보안 점검
              과정에서 사용자 데이터를 열람할 수 있습니다.
              <br />
              <br />
              운영자는 본 처리방침에 따라:
              <ul className="mt-1 list-disc pl-5">
                <li>업무 외 목적으로 사용자 데이터를 열람·복제·외부 전달하지 않습니다</li>
                <li>제3자에게 데이터를 제공·판매하지 않습니다</li>
                <li>오·남용에 대해 사용자에게 즉시 고지하고 책임집니다</li>
              </ul>
              <br />이 부분이 부담된다면 가입을 권하지 않습니다. 신뢰 기반의 비공개 서비스로
              이해해 주세요.
            </CardSubtle>
          </div>
        </div>
      </Card>

      {/* 8. 문의 + 시행일 */}
      <Section
        icon={<Mail className="h-5 w-5" strokeWidth={1.75} />}
        title="7. 문의 및 시행일"
      >
        <ul className="space-y-1.5 text-sm text-textSecondary leading-relaxed">
          <li>
            <b className="text-textPrimary">개인정보 보호책임자</b> · 운영자
          </li>
          <li>
            <b className="text-textPrimary">연락처</b>:{' '}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-textPinkStrong hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
          </li>
          <li>
            데이터 열람·정정·삭제·신고: 위 이메일로 요청 또는 설정 페이지에서 직접 처리
          </li>
          <li>
            <b className="text-textPrimary">시행일</b>: {EFFECTIVE_DATE}
          </li>
        </ul>
        <p className="mt-3 text-xs text-textMuted leading-relaxed">
          이 처리방침은 법령·서비스 변경에 따라 갱신될 수 있습니다. 중요한 변경은 알림으로
          안내합니다.
        </p>
      </Section>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <span className="h-5 w-5 text-textPinkStrong shrink-0 inline-flex items-center justify-center">
          {icon}
        </span>
        <CardTitle>{title}</CardTitle>
      </div>
      <div className="mt-3">{children}</div>
    </Card>
  );
}

function SubItem({
  name,
  purpose,
  data,
  retention,
}: {
  name: string;
  purpose: string;
  data: string;
  retention: string;
}) {
  return (
    <div className="rounded-md border border-borderSoft px-3 py-2 text-xs leading-relaxed">
      <div className="font-semibold text-textPrimary">{name}</div>
      <div className="text-textSecondary">
        <span className="text-textMuted">목적</span> · {purpose}
      </div>
      <div className="text-textSecondary">
        <span className="text-textMuted">전달 데이터</span> · {data}
      </div>
      <div className="text-textSecondary">
        <span className="text-textMuted">보유 기간</span> · {retention}
      </div>
    </div>
  );
}
