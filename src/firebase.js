import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Replace with YOUR Firebase config from Firebase Console
const firebaseConfig = {
    apiKey: "AIzaSyCpkcJ449rDsnWlLR3j5ZHAqBpmEa52oq0",
    authDomain: "only-beans.firebaseapp.com",
    projectId: "only-beans",
    storageBucket: "only-beans.firebasestorage.app",
    messagingSenderId: "833431008683",
    appId: "1:833431008683:web:b164e6d182f1ed860cceee"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;