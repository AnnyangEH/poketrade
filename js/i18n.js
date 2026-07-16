/* ════════════════════════════════════════
   한국어 / English 다국어 지원
════════════════════════════════════════ */
const TRANSLATIONS = {
  ko: {
    tabReservation: '예약 일정',
    formTitle: '예약 추가',
    labelDate: '날짜',
    labelBuyer: '예약자',
    placeholderBuyer: '예약자 이름',
    labelReceive: '받을 포켓몬',
    labelGive: '줄 포켓몬',
    placeholderSearch: '이름/번호 검색',
    labelReceiveMemo: '받을 포켓몬 메모',
    labelGiveMemo: '줄 포켓몬 메모',
    placeholderMemo: '예: 고페 배경 이로치',
    checkGuaranteedLucky: '확반',
    checkLuckyTrinket: '반참',
    btnAddReservation: '예약 추가',
    calendarTitle: '달력',
    weekDays: ['일', '월', '화', '수', '목', '금', '토'],
    calWd0: '월', calWd1: '화', calWd2: '수', calWd3: '목', calWd4: '금', calWd5: '토', calWd6: '일',
    legend0: '0건', legend1: '1건', legend2: '2건+',
    upcomingTitle: '예정된 교환',
    upcomingEmpty: '활성 예약이 없습니다.',
    completedTitle: '완료된 교환',
    completedEmpty: '완료된 교환이 없습니다.',
    receiveLabel: '받음',
    giveLabel: '줄',
    buyerLabel: '예약자',
    btnComplete: '완료',
    btnCancel: '취소',
    alertDate: '날짜를 YYYY-MM-DD 형식으로 입력해주세요.',
    alertBuyer: '예약자를 입력해주세요.',
    alertReceive: '받을 포켓몬을 선택해주세요.',
    alertGive: '줄 포켓몬을 선택해주세요.',
    confirmComplete: buyer => `${buyer}님 예약 완료 처리?\n→ 보관함에서 줄 포켓몬 수량이 1개 차감됩니다.`,
    confirmCancel: buyer => `${buyer}님 예약을 취소하시겠습니까?`,
    confirmQuota: names => `이미 ${names}님과 예약 일정이 있습니다. 일정을 추가하시겠습니까?`,
    settingsTitle: '설정',
    languageLabel: '언어',
    btnResetAll: '모든 일정 내역 초기화',
    confirmResetAll: '정말 모든 일정 내역을 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.'
  },
  en: {
    tabReservation: 'Reservation Schedule',
    formTitle: 'Add Reservation',
    labelDate: 'Date',
    labelBuyer: 'Partner',
    placeholderBuyer: 'Partner name',
    labelReceive: 'Receiving',
    labelGive: 'Giving',
    placeholderSearch: 'Search name / number',
    labelReceiveMemo: 'Receiving memo',
    labelGiveMemo: 'Giving memo',
    placeholderMemo: 'e.g. GO Fest bg shiny',
    checkGuaranteedLucky: 'Guaranteed',
    checkLuckyTrinket: 'Lucky Trinket',
    btnAddReservation: 'Add Reservation',
    calendarTitle: 'Calendar',
    weekDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    calWd0: 'Mon', calWd1: 'Tue', calWd2: 'Wed', calWd3: 'Thu', calWd4: 'Fri', calWd5: 'Sat', calWd6: 'Sun',
    legend0: '0', legend1: '1', legend2: '2+',
    upcomingTitle: 'Upcoming Exchanges',
    upcomingEmpty: 'No active reservations.',
    completedTitle: 'Completed Exchanges',
    completedEmpty: 'No completed exchanges.',
    receiveLabel: 'Receive',
    giveLabel: 'Give',
    buyerLabel: 'Partner',
    btnComplete: 'Confirm',
    btnCancel: 'Cancel',
    alertDate: 'Please enter a date in YYYY-MM-DD format.',
    alertBuyer: 'Please enter a partner name.',
    alertReceive: 'Please select the Pokémon to receive.',
    alertGive: 'Please select the Pokémon to give.',
    confirmComplete: buyer => `Confirm reservation for ${buyer}?\n→ 1 will be deducted from the given Pokémon's inventory.`,
    confirmCancel: buyer => `Cancel ${buyer}'s reservation?`,
    confirmQuota: names => `You already have a reservation with ${names}. Add this one anyway?`,
    settingsTitle: 'Settings',
    languageLabel: 'Language',
    btnResetAll: 'Reset All Schedule History',
    confirmResetAll: 'Are you sure you want to reset all schedule history?\nThis cannot be undone.'
  }
};

const STORAGE_KEY = 'poketrade_lang';
let currentLang = localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ko';

export function getLanguage() {
  return currentLang;
}

export function t(key) {
  const dict = TRANSLATIONS[currentLang];
  return (dict && dict[key] !== undefined) ? dict[key] : key;
}

export function applyStaticTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
}

window.setLanguage = lang => {
  currentLang = (lang === 'en') ? 'en' : 'ko';
  localStorage.setItem(STORAGE_KEY, currentLang);
  applyStaticTranslations();
  updateLangButtons();
  window.dispatchEvent(new Event('languagechange'));
};

function updateLangButtons() {
  const koBtn = document.getElementById('lang-ko-btn');
  const enBtn = document.getElementById('lang-en-btn');
  if (!koBtn || !enBtn) return;
  koBtn.className = koBtn.className.replace(/ (bg-blue-600 text-white|bg-gray-100 text-gray-600)/, '') +
    (currentLang === 'ko' ? ' bg-blue-600 text-white' : ' bg-gray-100 text-gray-600');
  enBtn.className = enBtn.className.replace(/ (bg-blue-600 text-white|bg-gray-100 text-gray-600)/, '') +
    (currentLang === 'en' ? ' bg-blue-600 text-white' : ' bg-gray-100 text-gray-600');
}

window.openSettings = () => {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  updateLangButtons();
};

window.closeSettings = () => {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
};

applyStaticTranslations();
