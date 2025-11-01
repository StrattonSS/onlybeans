import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [error, setError] = useState('');

    // --- Beta welcome modal (first load) ---
    const STORAGE_KEY = 'ob_beta_seen_v1';
    const [showWelcome, setShowWelcome] = useState(false);

    useEffect(() => {
        try {
            const seen = localStorage.getItem(STORAGE_KEY);
            if (!seen) setShowWelcome(true);
        } catch {
            // If localStorage is blocked, just show it once.
            setShowWelcome(true);
        }
    }, []);

    const dismissWelcome = () => {
        try {
            localStorage.setItem(STORAGE_KEY, '1');
        } catch {}
        setShowWelcome(false);
    };

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
            {/* Beta Welcome Modal */}
            {showWelcome && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/50"
                        onClick={dismissWelcome}
                        aria-hidden="true"
                    />
                    <div
                        className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="beta-title"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold tracking-wide px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
                                    v1 • Beta Testing
                                </span>
                            </div>
                            <button
                                onClick={dismissWelcome}
                                className="text-gray-500 hover:text-gray-700"
                                aria-label="Close"
                                title="Close"
                            >
                                ✖
                            </button>
                        </div>

                        <h2 id="beta-title" className="text-2xl font-bold text-purple-700 mb-2">
                            Hi, I’m Ben — thanks for trying OnlyBeans! 🐾
                        </h2>

                        <p className="text-gray-700 mb-4">
                            This is an early beta. I’m actively building and fixing things, so your feedback is gold.
                        </p>

                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                            <h3 className="font-semibold text-purple-800 mb-2">Quick start</h3>
                            <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                                <li>Sign up — everyone starts as a <strong>Viewer</strong>.</li>
                                <li>After you log in, visit <strong>Discover</strong> to follow cats and like posts.</li>
                                <li>Want to post? Go to your <strong>Profile</strong> and <strong>Add Cat</strong>, then upload photos.</li>
                                <li>Gift <strong>treats</strong> to posts you love. Creators can redeem 500 treats for real goodies.(Redemptions closed during beta)</li>
                                <li>See something weird? Use the <strong>🐞 Report a Bug</strong> button in the top navigation after logging in.</li>
                            </ul>
                        </div>

                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                            <h3 className="font-semibold text-green-800 mb-2">Help us grow</h3>
                            <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                                <li>Please invite your friends to join the beta.</li>
                                <li>Tell your <strong>local animal shelter</strong> about OnlyBeans — we support treat donations!</li>
                            </ul>
                        </div>

                        <p className="text-xs text-gray-500 mb-4">
                            P.S. If the site acts up, a quick bug report helps me fix it ASAP. Thank you! — Ben
                        </p>

                        <div className="flex gap-2">
                            <button
                                onClick={dismissWelcome}
                                className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700 transition"
                            >
                                Got it — let’s go!
                            </button>
                            <button
                                onClick={() => {
                                    // Don’t persist the dismissal if they want to re-read next time
                                    setShowWelcome(false);
                                }}
                                className="flex-1 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition"
                            >
                                Remind me next time
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
