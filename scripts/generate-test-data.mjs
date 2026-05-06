import { mkdirSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import * as XLSX from 'xlsx';

// 결정론적 PRNG (Mulberry32) — 같은 시드면 항상 같은 결과
function rng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r = rng(20260401);
const pick = (arr) => arr[Math.floor(r() * arr.length)];
const between = (lo, hi) => Math.max(100, Math.round((lo + r() * (hi - lo)) / 100) * 100);

const HEADERS = ['거래일', '가맹점', '결제수단', '카테고리', '메모', '이용금액'];

// === 큰 거래 6건 ===
const big = [
  ['2026-04-05', '신세계백화점 강남점',   '신용카드', '쇼핑',   '봄옷 구매',          280000],
  ['2026-04-12', '한식당 봄날',             '신용카드', '외식',   '가족 회식',          220000],
  ['2026-04-15', '한국전력공사',           '자동이체', '공과금', '4월 전기요금',       150000],
  ['2026-04-22', '세브란스병원',           '신용카드', '의료',   '정기검진',           110000],
  ['2026-04-25', 'GS칼텍스 강남주유소',    '신용카드', '교통',   '휘발유 가득',         75000],
  ['2026-04-28', '쿠팡',                    '체크카드', '생활',   '생활용품 정기배송',    65000],
];

// === 중간 거래 12건 ===
const mid = [
  ['2026-04-02', '올리브영 신사점',       '신용카드', '뷰티',     '봄철 화장품',  45000],
  ['2026-04-04', '교보문고 광화문점',     '신용카드', '도서',     '책 3권',       38000],
  ['2026-04-07', 'CGV 강남',                '체크카드', '문화',     '영화 + 팝콘',  42000],
  ['2026-04-09', '무신사',                  '신용카드', '쇼핑',     '셔츠',         89000],
  ['2026-04-11', '롯데마트 잠실점',       '신용카드', '마트',     '주말 장보기',  67000],
  ['2026-04-14', '이케아 광명점',         '신용카드', '가구',     '책상 의자',    95000],
  ['2026-04-17', '도미노피자',              '신용카드', '외식',     '친구 모임',    52000],
  ['2026-04-19', '한강공원 자전거',       '현금',     '여가',     '자전거 대여',  28000],
  ['2026-04-21', '다이소 강남점',         '체크카드', '생활',     '생활용품 한꺼번에', 33000],
  ['2026-04-24', 'GS25 강남대로점',       '신용카드', '편의점',   '간식 + 음료 한꺼번에', 24000],
  ['2026-04-26', '브런치카페 모카',       '신용카드', '카페',     '일요일 브런치', 58000],
  ['2026-04-29', '강남약국',                '체크카드', '의료',     '영양제 정기',  49000],
];

// === 작은 거래 — 결정론적 생성 ===
const POOL = {
  카페: [
    ['스타벅스 강남R점',     5800, 6500, ['아침', '오후 커피', '회의', '브레이크']],
    ['이디야 강남R점',       4500, 4500, ['오전', '오후']],
    ['투썸플레이스 압구정점', 6200, 7500, ['디저트', '미팅']],
    ['메가커피 강남',         2500, 2500, ['모닝', '오후']],
    ['컴포즈커피 강남',       2000, 2000, ['아침']],
    ['빽다방 신사',           2500, 2500, ['오후']],
    ['폴바셋 강남',           7500, 8500, ['아침 미팅']],
    ['할리스 강남R점',       5200, 5800, ['저녁']],
    ['커피빈 청담',           6500, 7200, ['오후']],
  ],
  편의점: [
    ['GS25 신사점',           1500, 5500, ['음료', '간식', '야식']],
    ['CU 신사역점',           1500, 6800, ['저녁', '음료']],
    ['이마트24 강남',         2000, 5800, ['간식', '음료']],
    ['세븐일레븐 신사점',     1800, 5500, ['도시락', '음료']],
  ],
  식당: [
    ['김밥천국 신사',         6500, 8500, ['점심', '저녁']],
    ['맘스터치 신사점',       7500, 10500, ['저녁', '야식']],
    ['롯데리아 신사',         7000, 9500, ['점심']],
    ['맥도날드 강남',         7500, 10500, ['점심', '저녁']],
    ['서브웨이 강남',         8500, 11500, ['점심']],
    ['백반집 어머니의 손길',  8000, 9500, ['점심']],
    ['죽이야기 신사',         7800, 9800, ['아침']],
    ['이삭토스트 R점',        4500, 5500, ['아침']],
  ],
  베이커리: [
    ['파리바게뜨 신사',       3500, 8500, ['빵', '샌드위치']],
    ['뚜레쥬르 신사',         4500, 9500, ['케이크 한 조각', '샌드위치']],
    ['던킨도너츠 강남',       3800, 6500, ['도넛 + 커피']],
  ],
  교통: [
    ['지하철 환승',           1450, 1850, ['출근', '퇴근', '외출']],
    ['버스 광역',             1500, 2800, ['외출']],
    ['카카오T 단거리',        4500, 9800, ['귀가', '미팅']],
  ],
};

const small = [];
for (let day = 1; day <= 30; day++) {
  const dateStr = `2026-04-${String(day).padStart(2, '0')}`;
  const dow = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  const txPerDay = dow === 0 || dow === 6 ? 4 : 5; // 주말 4 / 평일 5
  for (let i = 0; i < txPerDay; i++) {
    const cats = Object.keys(POOL);
    const cat = cats[Math.floor(r() * cats.length)];
    const [name, lo, hi, memos] = pick(POOL[cat]);
    const amt = between(lo, hi);
    const memo = pick(memos);
    const method = r() < 0.6 ? '신용카드' : '체크카드';
    small.push([dateStr, name, method, cat, memo, amt]);
  }
}

// === 합계 정확히 240만원 (예산 300만의 80%) 으로 보정 ===
const TOTAL_TARGET = 2400000;
const bigSum = big.reduce((a, x) => a + x[5], 0);
const midSum = mid.reduce((a, x) => a + x[5], 0);
const smallTarget = TOTAL_TARGET - bigSum - midSum;
const smallNow = small.reduce((a, x) => a + x[5], 0);

// 비율 스케일링 + 마지막 1건으로 잔차 흡수
const ratio = smallTarget / smallNow;
for (let i = 0; i < small.length; i++) {
  small[i][5] = Math.max(500, Math.round((small[i][5] * ratio) / 100) * 100);
}
const adjustedSumWithoutLast = small.slice(0, -1).reduce((a, x) => a + x[5], 0);
small[small.length - 1][5] = Math.max(500, smallTarget - adjustedSumWithoutLast);

const smallSum = small.reduce((a, x) => a + x[5], 0);
const total = bigSum + midSum + smallSum;

console.log(`큰 거래   ${big.length.toString().padStart(3)}건  합 ${bigSum.toLocaleString()}원`);
console.log(`중간 거래 ${mid.length.toString().padStart(3)}건  합 ${midSum.toLocaleString()}원`);
console.log(`작은 거래 ${small.length.toString().padStart(3)}건  합 ${smallSum.toLocaleString()}원`);
console.log(`총       ${(big.length + mid.length + small.length).toString().padStart(3)}건  합 ${total.toLocaleString()}원`);
console.log(`목표     ${TOTAL_TARGET.toLocaleString()}원 → ${total === TOTAL_TARGET ? '정확히 일치 ✅' : '오차 ' + (total - TOTAL_TARGET) + '원'}`);

// 날짜 정렬
const allRows = [...big, ...mid, ...small].sort((a, b) =>
  a[0] === b[0] ? a[5] - b[5] : a[0].localeCompare(b[0]),
);

const aoa = [HEADERS, ...allRows];
const ws = XLSX.utils.aoa_to_sheet(aoa);
ws['!cols'] = [
  { wch: 12 },
  { wch: 26 },
  { wch: 10 },
  { wch: 10 },
  { wch: 22 },
  { wch: 12 },
];
// 금액 셀 형식 (원화 콤마)
const range = XLSX.utils.decode_range(ws['!ref']);
for (let R = 1; R <= range.e.r; R++) {
  const cell = ws[XLSX.utils.encode_cell({ r: R, c: 5 })];
  if (cell) cell.z = '#,##0';
}
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, '4월 카드 명세');

const out = 'samples/2026-04-budget80.xlsx';
mkdirSync(dirname(out), { recursive: true });
XLSX.writeFile(wb, out);

const size = statSync(out).size;
console.log(`\n생성됨: ${out} (${(size / 1024).toFixed(1)} KB)`);
