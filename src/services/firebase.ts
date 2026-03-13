import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getRemoteConfig, fetchAndActivate, getValue } from 'firebase/remote-config';

const firebaseConfig = {
  apiKey: "AIzaSyC7nyUWzhnOXIiIGzDGFwLSiJ9OvlNnzWU",
  authDomain: "party-favors-1d33d.firebaseapp.com",
  databaseURL: "https://party-favors-1d33d-default-rtdb.firebaseio.com",
  projectId: "party-favors-1d33d",
  storageBucket: "party-favors-1d33d.firebasestorage.app",
  messagingSenderId: "169135189672",
  appId: "1:169135189672:web:2a54c309e01988a501dc9d",
  measurementId: "G-JSGMGT7CMT"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);

// Remote Config for access PIN
const remoteConfig = getRemoteConfig(app);
remoteConfig.settings.minimumFetchIntervalMillis = 300000; // 5 min cache

// Default fallback (empty string = no hardcoded PIN in source)
remoteConfig.defaultConfig = {
  access_pin: '',
};

export async function getAccessPin(): Promise<string> {
  try {
    await fetchAndActivate(remoteConfig);
    return getValue(remoteConfig, 'access_pin').asString();
  } catch (error) {
    console.error('Failed to fetch remote config:', error);
    return '';
  }
}
