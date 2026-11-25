import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyATW_tqjN__16FqPxkIWWLV0xvQHQKqjuI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "online-fuze-s01dl.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "online-fuze-s01dl",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "online-fuze-s01dl.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "263744415467",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:263744415467:web:5b626c9f59cfcce9d180ae",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app, "ai-studio-structuredesk-e2b099cf-30df-4140-a717-6b169c89e8cf");
export const googleProvider = new GoogleAuthProvider();
export const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || "loymedia7@gmail.com").trim().toLowerCase();
