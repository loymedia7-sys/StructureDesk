import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp, increment } from "firebase/firestore";
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
    const cred = await signInWithPopup(auth, googleProvider);
    if (cred.user) {
      await saveProfile(cred.user);
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    if (cred.user) {
      await saveProfile(cred.user);
    }
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
    const userRef = doc(db, "users", u.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: u.uid,
        name: u.displayName || u.email?.split("@")[0] || "Trader",
        email: u.email || "",
        photo: u.photoURL || "",
        status: "active",
        subscriptionPlan: "free",
        tokenBalance: 500,
        loginCount: 1,
        lastLogin: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        userRef,
        {
          name: u.displayName || snap.data()?.name || "Trader",
          email: u.email || "",
          photo: u.photoURL || snap.data()?.photo || "",
          lastLogin: serverTimestamp(),
          loginCount: increment(1),
        },
        { merge: true }
      );
    }

    // Record login event in events collection for real-time dashboard telemetry
    await addDoc(collection(db, "events"), {
      type: "login",
      uid: u.uid,
      email: u.email || "",
      name: u.displayName || "Trader",
      path: window.location.pathname,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("Error saving user profile to Firestore:", err);
  }
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
