// 1) Firebase 프로젝트를 만든 뒤 Realtime Database를 활성화하세요.
// 2) 아래 값을 본인 프로젝트 값으로 교체한 후 파일명을 firebase-config.js 로 저장하세요.
// 3) GitHub에 올릴 때도 firebase-config.js 가 필요합니다.

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
