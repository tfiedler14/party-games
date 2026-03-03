import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

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
