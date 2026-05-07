import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC_y__iiEjVPm2YrkNAy5kCL07A_Gnum38",
  authDomain: "rent-70140.firebaseapp.com",
  projectId: "rent-70140",
  storageBucket: "rent-70140.firebasestorage.app",
  messagingSenderId: "838579011708",
  appId: "1:838579011708:web:c2419df5b3ca6eafc709f9"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);