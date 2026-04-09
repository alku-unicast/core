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
let initialized = false;

export async function initFirebase(): Promise<void> {
  if (initialized) return;

  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getDatabase(app);

  await signInAnonymously(auth);
  initialized = true;
}

export function getFirebaseDB(): Database {
  if (!db) throw new Error("Firebase not initialized. Call initFirebase() first.");
  return db;
}

export function getFirebaseAuth(): Auth {
  if (!auth) throw new Error("Firebase not initialized. Call initFirebase() first.");
  return auth;
}
