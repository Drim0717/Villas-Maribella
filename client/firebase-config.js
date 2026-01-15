// Import Firebase functions from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCBd-szJo67s4Z2kpGACoBXMtO5pYRNy7U",
    authDomain: "villas-maribella.firebaseapp.com",
    projectId: "villas-maribella",
    storageBucket: "villas-maribella.firebasestorage.app",
    messagingSenderId: "88532268625",
    appId: "1:88532268625:web:e726b78aea2a8431e8ea70",
    measurementId: "G-D6LBRQCD9M"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
