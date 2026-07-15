/* ════════════════════════════════════════
   재고 탭 — 이미지 합성 프로토타입
   실제 스프라이트/배경 에셋이 없어 임시 도형으로 대체:
     일반 = 노란 삼각형, 이로치 = 흰 삼각형, 배경 on = 검정 배경
════════════════════════════════════════ */

let variant = 'normal';   // 'normal' | 'shiny'
let showBackground = true;

const VARIANT_COLOR = { normal: '#facc15', shiny: '#ffffff' };

export function renderInventory() {
  const normalBtn = document.getElementById('variant-normal');
  const shinyBtn  = document.getElementById('variant-shiny');
  const bgBtn     = document.getElementById('bg-toggle');
  const bgEl      = document.getElementById('composite-bg');
  const spriteEl  = document.getElementById('composite-sprite');
  if (!normalBtn || !shinyBtn || !bgBtn || !bgEl || !spriteEl) return;

  if (!renderInventory._wired) {
    normalBtn.onclick = () => { variant = 'normal'; renderInventory(); };
    shinyBtn.onclick  = () => { variant = 'shiny';  renderInventory(); };
    bgBtn.onclick     = () => { showBackground = !showBackground; renderInventory(); };
    renderInventory._wired = true;
  }

  normalBtn.classList.toggle('active', variant === 'normal');
  shinyBtn.classList.toggle('active', variant === 'shiny');
  bgBtn.classList.toggle('active', showBackground);

  bgEl.style.background = showBackground ? '#000000' : '#e5e7eb';

  spriteEl.style.width = '0';
  spriteEl.style.height = '0';
  spriteEl.style.borderLeft = '45px solid transparent';
  spriteEl.style.borderRight = '45px solid transparent';
  spriteEl.style.borderBottom = `78px solid ${VARIANT_COLOR[variant]}`;
}
