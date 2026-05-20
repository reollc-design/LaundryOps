import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';

export interface LaundryOpsFirebaseClient {
  app: FirebaseApp | null;
  auth: Auth | null;
  db: Firestore | null;
  storage: FirebaseStorage | null;
  configured: boolean;
  usingEmulators: boolean;
  projectId: string | null;
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const requiredFields: Array<keyof typeof firebaseConfig> = ['apiKey', 'authDomain', 'projectId', 'appId'];
const isConfigured = requiredFields.every((field) => Boolean(firebaseConfig[field]));
const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';

let cachedClient: LaundryOpsFirebaseClient | null = null;
let emulatorsConnected = false;

function buildUnconfiguredClient(): LaundryOpsFirebaseClient {
  return {
    app: null,
    auth: null,
    db: null,
    storage: null,
    configured: false,
    usingEmulators: false,
    projectId: null,
  };
}

function buildConfiguredClient(): LaundryOpsFirebaseClient {
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);

  if (useEmulators && !emulatorsConnected) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
    emulatorsConnected = true;
  }

  return {
    app,
    auth,
    db,
    storage,
    configured: true,
    usingEmulators: useEmulators,
    projectId: firebaseConfig.projectId ?? null,
  };
}

export function getFirebaseClient(): LaundryOpsFirebaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = isConfigured ? buildConfiguredClient() : buildUnconfiguredClient();
  return cachedClient;
}
