// auth.js

import { auth, db } from "./firebase-config.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ===============================
// SIGN UP
// ===============================

export async function signup({
  name,
  gender,
  mobile,
  email,
  password
}) {
  try {

    const result = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    const user = result.user;

    await setDoc(
      doc(db, "users", user.uid),
      {
        name: name || "",
        gender: gender || "",
        mobile: mobile || "",
        email: user.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    return user;

  } catch (error) {
    throw error;
  }
}


// ===============================
// LOGIN
// ===============================

export async function login(email, password) {

  try {

    const result = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    return result.user;

  } catch (error) {
    throw error;
  }
}


// ===============================
// LOGOUT
// ===============================

export async function logout() {

  try {
    await signOut(auth);
  } catch (error) {
    console.error(error);
    throw error;
  }
}


// ===============================
// FORGOT PASSWORD
// ===============================

export async function forgotPassword(email) {

  if (!email) {
    throw new Error("Please enter your email address.");
  }

  await sendPasswordResetEmail(auth, email);
}


// ===============================
// GET PROFILE
// ===============================

export async function getProfile(user) {

  if (!user) return null;

  const snap = await getDoc(
    doc(db, "users", user.uid)
  );

  if (!snap.exists()) {

    return {
      name: "",
      gender: "",
      mobile: "",
      email: user.email || ""
    };

  }

  return snap.data();
}


// ===============================
// SAVE PROFILE
// ===============================

export async function saveProfile(user, data) {

  if (!user) {
    throw new Error("Please login first.");
  }

  await setDoc(
    doc(db, "users", user.uid),
    {
      name: data.name || "",
      gender: data.gender || "",
      mobile: data.mobile || "",
      email: user.email || "",
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}


// ===============================
// AUTH STATE
// ===============================

onAuthStateChanged(auth, (user) => {

  window.dispatchEvent(
    new CustomEvent(
      user ? "userLoggedIn" : "userLoggedOut",
      {
        detail: user
      }
    )
  );

});