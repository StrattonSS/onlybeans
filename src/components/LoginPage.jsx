import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [error, setError] = useState('');

    const handleAuth = async (e) => {
        e.preventDefault();
        setError('');

        try {
            if (isSignUp) {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);

                // Everyone starts as a viewer - can upgrade in profile page
                await setDoc(doc(db, 'users', userCredential.user.uid), {
                    username: username || email.split('@')[0],
                    email: email,
                    displayName: username || 'Cat Lover',
                    bio: 'New to OnlyBeans! 🐾',
                    avatar: '😺',
                    accountType: 'viewer',
                    treatBalance: 0,
                    createdAt: serverTimestamp()
                });
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (error) {
            setError(error.message);
            console.error('Auth error:', error);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-purple-600 mb-2">OnlyBeans 🐾</h1>
                    <p className="text-gray-600">The purrfect platform for cat content</p>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                    {isSignUp && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="your_username"
                                required={isSignUp}
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="cat@example.com"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition"
                    >
                        {isSignUp ? 'Create Account' : 'Sign In'}
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="w-full text-purple-600 hover:text-purple-700 text-sm"
                    >
                        {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                    </button>
                </form>

                {isSignUp && (
                    <div className="mt-6 p-4 bg-purple-50 rounded-lg">
                        <p className="text-sm text-gray-600 text-center">
                            <strong>Everyone starts as a Viewer!</strong><br />
                            After signing up, you can upgrade to Cat Owner or apply as an Animal Shelter in your profile.
                        </p>
                    </div>
                )}

                <div className="mt-8 text-center text-sm text-gray-500">
                    <p>Join thousands of cats sharing their daily lives</p>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;