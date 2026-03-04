// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth }       from "firebase/auth";
import { getFirestore }  from "firebase/firestore";

const firebaseConfig = {
    apiKey:            "AIzaSyA8cZfXy4CsNEHjUqNUXL0XrRrrAAht530",
    authDomain:        "cyranoapp-a7d2c.firebaseapp.com",
    projectId:         "cyranoapp-a7d2c",
    storageBucket:     "cyranoapp-a7d2c.firebasestorage.app",
    messagingSenderId: "927032283173",
    appId:             "1:927032283173:web:f6f897cb34648f7f132fcc",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);
export default app;
