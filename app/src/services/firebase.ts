import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, signInAnonymously, Auth } from "firebase/auth";
import { getDatabase, Database } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAOpBLf5BWV8YMERPMDiL50FMl8ogsUlyY",
  authDomain: "unicast-8a705.firebaseapp.com",
  databaseURL: "https://unicast-8a705-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "unicast-8a705",
  storageBucket: "unicast-8a705.firebasestorage.app",
  messagingSenderId: "398236908752",
  appId: "1:398236908752:web:d07d4bf474d7a78795b2d5",
};

// Singleton pattern — initialized once on first import
let app: FirebaseApp;
let auth: Auth;
let db: Database;
let initPromise: Promise<void> | null = null;
let initComplete = false;

export async function initFirebase(): Promise<void> {
  // If already started, wait for it
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.log("[Firebase] Initializing app...");
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getDatabase(app);

      console.log("[Firebase] Attempting anonymous sign-in (5s timeout)...");

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Firebase auth timeout (5s)")), 5000)
      );

      try {
        await Promise.race([signInAnonymously(auth), timeout]);
        console.log("[Firebase] Anonymous sign-in successful.");
      } catch (e) {
        console.warn("[Firebase] Auth failed or timed out, but proceeding anyway:", e);
      }

      initComplete = true;
    } catch (e) {
      console.error("[Firebase] Critical init error:", e);
      initComplete = true;
    }
  })();

  return initPromise;
}

export function isFirebaseReady(): boolean {
  return initComplete;
}

export function getFirebaseDB(): Database | null {
  if (!initComplete || !db) return null;
  return db;
}

export function getFirebaseAuth(): Auth | null {
  if (!initComplete || !auth) return null;
  return auth;
}
