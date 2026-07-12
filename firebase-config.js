/* ---------- Firebase Configuration (Shared) ---------- */
/* This file is loaded once per page, before any other script.
   It sets up the global `auth` and `db` objects used everywhere. */

const firebaseConfig = {
  apiKey: "AIzaSyDbX9Mslo1O2a_-4IeW4cK78MEnPdPpNNQ",
  authDomain: "faculty-office-hours.firebaseapp.com",
  projectId: "faculty-office-hours",
  storageBucket: "faculty-office-hours.firebasestorage.app",
  messagingSenderId: "907286070765",
  appId: "1:907286070765:web:adb315f1debd814973d3e4"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
