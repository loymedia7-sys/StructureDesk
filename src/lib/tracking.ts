import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

export function logEvent(type: "visit" | "analysis", uid: string | null = null, extra: Record<string, unknown> = {}) {
  try {
    return addDoc(collection(db, "events"), {
      type,
      uid,
      path: window.location.pathname,
      createdAt: serverTimestamp(),
      ...extra,
    }).catch(() => {});
  } catch {
    // ignore offline or initialization failures
  }
}
