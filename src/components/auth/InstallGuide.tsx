'use client';

import { useEffect, useRef, useState } from 'react';
import { Smartphone, X, Download } from 'lucide-react';
import { Card, CardSubtle, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';

type Browser = 'ios-safari' | 'samsung' | 'android-chrome' | 'desktop' | 'other';

// Chromium 계열 브라우저가 발생시키는 PWA 설치 prompt 이벤트
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function detectBrowser(): Browser {
  if (typeof window === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios-safari';
  if (/Android/i.test(ua) && /Chrome/i.test(ua)) return 'android-chrome';
  return 'desktop';
}

const STORAGE_KEY = 'install-guide-dismissed-until';
type Tab = 'ios-safari' | 'samsung' | 'android-chrome';

export function InstallGuide() {
  const [hidden, setHidden] = useState(true);
  const [tab, setTab] = useState<Tab>('ios-safari');
  const [browser, setBrowser] = useState<Browser>('other');
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [hasNativePrompt, setHasNativePrompt] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    if (isStandalone) {
      setHidden(true);
      return;
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && Date.now() < Number(stored)) {
      setHidden(true);
      return;
    }
    const b = detectBrowser();
    setBrowser(b);
    if (b === 'samsung') setTab('samsung');
    else if (b === 'android-chrome') setTab('android-chrome');
    else setTab('ios-safari');
    setHidden(false);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      promptRef.current = e as BeforeInstallPromptEvent;
      setHasNativePrompt(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    const onInstalled = () => {
      promptRef.current = null;
      setHasNativePrompt(false);
      setHidden(true);
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  function dismiss(days: number) {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        STORAGE_KEY,
        String(Date.now() + days * 24 * 60 * 60 * 1000),
      );
    }
    setHidden(true);
  }

  async function handleInstall() {
    setHint(null);
    if (promptRef.current) {
      try {
        await promptRef.current.prompt();
        const { outcome } = await promptRef.current.userChoice;
        if (outcome === 'accepted') {
          setHidden(true);
        } else {
          setHint('설치를 취소했어요. 언제든 다시 시도할 수 있어요.');
        }
        promptRef.current = null;
        setHasNativePrompt(false);
      } catch {
        setHint('설치 다이얼로그를 띄우지 못했어요. 아래 가이드를 따라주세요.');
      }
      return;
    }
    // 이벤트 없는 환경(iOS Safari, 일부 삼성 인터넷): 가이드 탭을 본인 브라우저로 자동 전환 + 힌트
    if (browser === 'ios-safari') {
      setTab('ios-safari');
      setHint('iOS Safari는 자동 설치를 지원하지 않아요. 아래 단계를 따라주세요.');
    } else if (browser === 'samsung') {
      setTab('samsung');
      setHint('자동 안내가 안 보이면 메뉴에서 “현재 페이지에 추가 → 앱” 으로 진행하세요.');
    } else {
      setHint('브라우저 메뉴에서 “앱 설치” 또는 “홈 화면에 추가” 항목을 사용해주세요.');
    }
  }

  if (hidden) return null;

  return (
    <Card className="mt-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-textPinkStrong" strokeWidth={1.75} />
          <CardTitle>📱 홈 화면에 앱처럼 설치</CardTitle>
        </div>
        <button
          type="button"
          onClick={() => dismiss(7)}
          aria-label="닫기"
          className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-softPinkBackground"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
      <CardSubtle className="mt-1">
        한 번 설치하면 카톡 옆에 아이콘으로 등장합니다. 풀스크린 + 빠른 접속 + 알림 가능.
      </CardSubtle>

      {/* 권장 브라우저 안내 — 화면 확대·축소 차이 때문 */}
      <div className="mt-3 rounded-md bg-primaryPinkSoft border border-primaryPinkBorder px-3 py-2 text-xs leading-relaxed">
        <div className="font-semibold text-textPinkStrong">📌 권장 브라우저</div>
        <ul className="mt-1 space-y-0.5 text-textPrimary">
          <li>
            <b>Android</b> — <b>Chrome</b> (또는 Edge)
          </li>
          <li>
            <b>iOS</b> — <b>Safari</b>
          </li>
        </ul>
        <p className="mt-1.5 text-textMuted">
          삼성 인터넷·기타 브라우저는 화면 확대 잠금이 일부 무시될 수 있어요. 위 권장 브라우저로
          설치하면 의도된 모바일 디자인이 정확히 적용됩니다.
        </p>
      </div>

      {browser === 'samsung' && (
        <div className="mt-2 rounded-md bg-warningSoft border border-warning/30 px-3 py-2 text-xs text-warning leading-relaxed">
          <b>지금 삼성 인터넷으로 보고 있어요.</b> 화면 핀치 확대를 쓰지 않으시려면 <b>Chrome</b>
          으로 다시 열어 설치하시는 걸 권장합니다.
        </div>
      )}

      {/* 자체 설치 버튼 */}
      <div className="mt-3">
        <Button onClick={handleInstall} fullWidth size="lg">
          <Download className="h-4 w-4" strokeWidth={1.75} /> 홈 화면에 추가하기
        </Button>
        {!hasNativePrompt && browser === 'ios-safari' && (
          <p className="mt-1 text-[11px] text-textMuted text-center">
            iOS Safari 는 자동 설치를 지원하지 않아 아래 단계를 따라야 해요.
          </p>
        )}
        {hint && (
          <p className="mt-2 text-xs rounded-md bg-warningSoft text-warning px-3 py-2">{hint}</p>
        )}
      </div>

      {/* 브라우저별 단계 가이드 */}
      <div className="mt-4">
        <div className="text-xs text-textSecondary mb-2">브라우저별 단계</div>
        <div className="flex items-center gap-1 flex-wrap">
          {[
            { id: 'ios-safari' as const, label: 'iOS Safari' },
            { id: 'samsung' as const, label: '삼성 인터넷' },
            { id: 'android-chrome' as const, label: 'Android Chrome' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                'h-8 px-3 rounded-md text-xs border ' +
                (tab === t.id
                  ? 'bg-primaryPinkSoft text-textPinkStrong border-primaryPinkBorder'
                  : 'bg-white text-textSecondary border-borderDefault hover:bg-softPinkBackground')
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-3 text-sm text-textSecondary leading-relaxed">
          {tab === 'ios-safari' && (
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                <b>Safari</b>로 이 페이지를 엽니다 (Chrome iOS 는 ❌).
              </li>
              <li>
                화면 <b>아래쪽 가운데 ⬆️ (공유) 버튼</b> 탭.
              </li>
              <li>
                스크롤 내려서 <b>“홈 화면에 추가”</b> 선택.
              </li>
              <li>
                이름 확인 → <b>“추가”</b> 탭. 끝.
              </li>
            </ol>
          )}
          {tab === 'samsung' && (
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                삼성 인터넷으로 접속 (<b>시크릿 모드 ❌</b>).
              </li>
              <li>
                위의 <b>[홈 화면에 추가하기]</b> 버튼이 바로 동작하면 그걸로 끝.
              </li>
              <li>
                안 되면 우하단 <b>☰ 메뉴 → “현재 페이지에 추가”</b> 선택.
              </li>
              <li>
                옵션에서 <b>“앱”</b> 선택 (“바로가기” ❌) → 추가.
              </li>
            </ol>
          )}
          {tab === 'android-chrome' && (
            <ol className="list-decimal pl-5 space-y-1">
              <li>Chrome 으로 접속.</li>
              <li>
                위의 <b>[홈 화면에 추가하기]</b> 버튼 탭 → 네이티브 설치 다이얼로그 → 설치.
              </li>
              <li>
                안 뜨면 우상단 <b>⋮ → “앱 설치”</b> 또는 <b>“홈 화면에 추가”</b>.
              </li>
            </ol>
          )}
        </div>
      </div>

      <div className="mt-3 rounded-md bg-warningSoft px-3 py-2.5 text-xs text-warning leading-relaxed">
        <div className="font-medium text-sm">⚠️ 설치 중 보안 안내가 떠도 정상이에요</div>
        <p className="mt-1">
          이 사이트는 <b>HTTPS + Vercel 인증 도메인</b>(SSL 인증서 자동 갱신)이고, 데이터는
          Supabase에 본인 계정으로만 접근 가능하게 저장되어 안전합니다. 폰이 띄우는 보안 안내는
          “외부 사이트에서 앱처럼 추가”되는 동작에 대한 일반적인 확인이에요.
        </p>
        <div className="mt-2 font-medium text-textPrimary">자주 나오는 메시지와 대응</div>
        <ol className="mt-1 list-decimal pl-4 space-y-1.5 text-textSecondary">
          <li>
            <b className="text-textPrimary">“이 페이지를 홈 화면에 추가하시겠습니까?”</b>
            <br />
            → 가장 흔한 정상 안내. <b>“추가” / “확인”</b> 탭하면 끝.
          </li>
          <li>
            <b className="text-textPrimary">“출처를 알 수 없는 앱” / “알 수 없는 사이트”</b>
            <br />
            → 일반 APK 설치 때 뜨는 안내가 PWA에도 가끔 표시. <b>“허용” · “계속” · “이 앱 신뢰”</b>
            중 하나 선택. 한 번만 선택하면 다음부턴 안 뜸.
          </li>
          <li>
            <b className="text-textPrimary">“Google Play Protect가 검사 중입니다”</b>
            <br />
            → Android 기본 안전 검사. 1~2초 기다리면 통과되며, 이상 없으면 자동으로 사라짐.
            아무것도 누르지 않아도 됨.
          </li>
          <li>
            <b className="text-textPrimary">“알림을 보낼 수 있게 허용하시겠습니까?”</b>
            <br />
            → 예산 초과·고정 거래 같은 푸시 알림 권한 요청. <b>“허용”</b>하면 알림 받음,
            <b>“차단”</b>해도 앱 사용엔 영향 없음 (나중에 설정에서 변경 가능).
          </li>
          <li>
            <b className="text-textPrimary">“삼성 패스 / V3 모바일 / Lookout” 등 보안 앱 경고</b>
            <br />
            → 일부 보안 앱이 PWA 설치를 모르는 행동으로 표시. 해당 앱 화면에서{' '}
            <b>“이 앱 신뢰”</b> 또는 <b>“예외 추가”</b> 선택.
          </li>
          <li>
            <b className="text-textPrimary">“이 앱은 회사 정책에 의해 차단됩니다”</b>
            <br />
            → 회사·학교에서 지급한 폰의 <b>MDM(모바일 관리)</b> 정책. 사용자가 풀 수 없으니
            <b> 개인 폰</b>에서 설치하세요.
          </li>
          <li>
            <b className="text-textPrimary">설치 후 “앱이 손상되었거나 변경되었습니다”</b>
            <br />
            → 거의 발생 X. 발생 시 한 번 삭제 후 재설치 — 새 버전 배포 직후 일시 현상일 수 있음.
          </li>
        </ol>
        <p className="mt-2 text-textMuted">
          확실치 않은 메시지가 뜨면 화면 캡처해서 운영자에게 보내주세요.
        </p>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => dismiss(30)}
          className="text-xs text-textMuted hover:underline"
        >
          30일 동안 보지 않기
        </button>
      </div>
    </Card>
  );
}
