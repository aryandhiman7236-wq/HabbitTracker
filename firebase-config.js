// firebase-config.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDJUARxSDeGa4M6fItenGwvK842ZnW-JHY",
  authDomain: "habbittracker-95092.firebaseapp.com",
  projectId: "habbittracker-95092",
  storageBucket: "habbittracker-95092.firebasestorage.app",
  messagingSenderId: "903104022899",
  appId: "1:903104022899:web:838017924d1863f4a19d06"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.error("Persistence error:", error);
  });

const db = getFirestore(app);

export { app, auth, db };