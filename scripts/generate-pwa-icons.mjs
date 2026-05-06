import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

// 일반 아이콘 (홈 화면 / Apple touch / Android default)
// — rounded rect + 가운데 ₩ — Apple은 자동으로 라운드 마스크 씌우므로 padding 약간만.
const SVG_NORMAL = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#F472B6"/>
  <text x="256" y="372"
    font-size="340" font-weight="900" fill="#FFFFFF" text-anchor="middle"
    font-family="Malgun Gothic, Apple SD Gothic Neo, Noto Sans CJK KR, sans-serif">₩</text>
</svg>
`;

// Maskable: 안드로이드는 어떤 모양으로든 마스킹할 수 있어야 하므로
// 가장자리까지 단색 + 안전영역(80%)에 핵심 콘텐츠.
const SVG_MASKABLE = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#F472B6"/>
  <text x="256" y="332"
    font-size="240" font-weight="900" fill="#FFFFFF" text-anchor="middle"
    font-family="Malgun Gothic, Apple SD Gothic Neo, Noto Sans CJK KR, sans-serif">₩</text>
</svg>
`;

mkdirSync('public', { recursive: true });

await Promise.all([
  sharp(Buffer.from(SVG_NORMAL)).resize(192, 192).png().toFile('public/icon-192.png'),
  sharp(Buffer.from(SVG_NORMAL)).resize(512, 512).png().toFile('public/icon-512.png'),
  sharp(Buffer.from(SVG_NORMAL)).resize(180, 180).png().toFile('public/apple-touch-icon.png'),
  sharp(Buffer.from(SVG_NORMAL)).resize(32, 32).png().toFile('public/favicon-32.png'),
  sharp(Buffer.from(SVG_MASKABLE))
    .resize(512, 512)
    .png()
    .toFile('public/icon-512-maskable.png'),
]);

console.log('생성됨:');
console.log('  public/icon-192.png            (192x192)');
console.log('  public/icon-512.png            (512x512)');
console.log('  public/icon-512-maskable.png   (512x512, maskable)');
console.log('  public/apple-touch-icon.png    (180x180, iOS 홈 화면)');
console.log('  public/favicon-32.png          (32x32)');
