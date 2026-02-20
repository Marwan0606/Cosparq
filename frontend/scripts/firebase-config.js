// Firebase configuration for Phone Auth
// ‑‑‑ Replace the values below with YOUR Firebase project config ‑‑‑
// Go to: Firebase Console → Project Settings → General → Your apps → Web app
const firebaseConfig = {
  apiKey:            "AIzaSyCjSm45Ed-BZp2RO3vqw8_fNL_hWP4s5tU",
  authDomain:        "cosparq.firebaseapp.com",
  projectId:         "cosparq",
  storageBucket:     "cosparq.firebasestorage.app",
  messagingSenderId: "71217120819",
  appId:             "1:71217120819:web:f82df528277162084546",
  measurementId:     "G-0GRTVG41V7"
};

firebase.initializeApp(firebaseConfig);
const firebaseAuth = firebase.auth();
