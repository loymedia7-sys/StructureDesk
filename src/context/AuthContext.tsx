import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { doc, setDoc, serverTimestamp, increment } from "firebase/firestore";
import { auth, db, googleProvider, ADMIN_EMAIL } from "../lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (e: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        await saveProfile(u);
      }
    });
  }, []);

  const loginWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const isAdmin = Boolean(user?.email && user.email.trim().toLowerCase() === ADMIN_EMAIL);

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, loginWithGoogle, loginWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

async function saveProfile(u: User) {
  try {
    await setDoc(
      doc(db, "users", u.uid),
      {
        uid: u.uid,
        name: u.displayName || u.email?.split("@")[0] || "Trader",
        email: u.email || "",
        photo: u.photoURL || "",
        lastLogin: serverTimestamp(),
        loginCount: increment(1),
      },
      { merge: true }
    );
  } catch {
    // offline or permissions fallback
  }
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
