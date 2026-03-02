'use client';

import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Messaging, getMessaging, getToken, isSupported } from 'firebase/messaging';

type BrowserPermission = NotificationPermission | 'unsupported';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

let firebaseApp: FirebaseApp | null = null;
let messagingInstance: Messaging | null = null;
let supportCheck: Promise<boolean> | null = null;

const hasCoreConfig = () =>
  Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.messagingSenderId &&
      firebaseConfig.appId &&
      vapidKey
  );

const getOrInitApp = () => {
  if (firebaseApp) return firebaseApp;
  firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return firebaseApp;
};

const getMessagingInstance = async (): Promise<Messaging | null> => {
  if (typeof window === 'undefined' || !hasCoreConfig()) {
    return null;
  }

  if (!supportCheck) {
    supportCheck = isSupported().catch(() => false);
  }

  const supported = await supportCheck;
  if (!supported) {
    return null;
  }

  if (!messagingInstance) {
    messagingInstance = getMessaging(getOrInitApp());
  }

  return messagingInstance;
};

export async function getBrowserPushPermissionState(): Promise<BrowserPermission> {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function isBrowserPushSupported(): Promise<boolean> {
  const permission = await getBrowserPushPermissionState();
  if (permission === 'unsupported') return false;
  const messaging = await getMessagingInstance();
  return Boolean(messaging);
}

export async function requestBrowserPushToken(): Promise<string | null> {
  const messaging = await getMessagingInstance();
  if (!messaging || typeof window === 'undefined') {
    return null;
  }

  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return null;
    }
  }

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration
  });

  return token || null;
}
