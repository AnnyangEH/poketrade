/* ════════════════════════════════════════
   Firebase 초기화 / auth / firestore 래퍼
════════════════════════════════════════ */
import { initializeApp }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, onSnapshot, enableIndexedDbPersistence }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            "AIzaSyBkpsqEzgtDP_90n9KwwtO-22DvqKIalBs",
  authDomain:        "poketrade-36af0.firebaseapp.com",
  projectId:         "poketrade-36af0",
  storageBucket:     "poketrade-36af0.firebasestorage.app",
  messagingSenderId: "479217485125",
  appId:             "1:479217485125:web:d1485920fe0aa3a0bf6a2c"
};

/*
── Firestore 보안 규칙 (Firebase Console > Firestore > 규칙) ──
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /prices/{hash} {
      allow read, write: if request.auth != null;
    }
  }
}
*/

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

enableIndexedDbPersistence(db).catch(e => {
  if (e.code === 'failed-precondition') console.warn('오프라인: 다중 탭 환경에서는 미지원');
  else if (e.code === 'unimplemented')  console.warn('오프라인: 브라우저 미지원');
});

export const provider = new GoogleAuthProvider();

export {
  doc, getDoc, setDoc, onSnapshot,
  signInWithPopup, signOut, onAuthStateChanged
};

/* ════════════════════════════════════════
   저장 (즉시 저장 — 새로고침 시 데이터 유실 방지)
   연타 방지는 150ms 디바운스만 적용
════════════════════════════════════════ */
const _timers = {};
export function debounced(key, fn, ms = 150) {
  clearTimeout(_timers[key]);
  _timers[key] = setTimeout(fn, ms);
}

export function fsErr(label) {
  return e => {
    console.error(`[Firebase 저장 오류] ${label}:`, e.code, e.message);
    if (e.code === 'permission-denied')
      alert(`저장 실패: Firestore 보안 규칙을 확인해주세요.\n(${label})`);
  };
}
