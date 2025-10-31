import React, { useState } from 'react';
import { X } from 'lucide-react';
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../../firebase';

function GiftTreatsModal({ post, currentUser, setGiftingPostId, refreshCurrentUser, loadPosts }) {
    const [treatAmount, setTreatAmount] = useState(5);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleGift = async () => {
        if (!currentUser?.treatBalance || currentUser.treatBalance < treatAmount) {
            alert('Not enough treats! Buy more treats first.');
            return;
        }

        if (isProcessing) return;
        setIsProcessing(true);

        try {
            // Use Firestore transaction to ensure all-or-nothing behavior
            await runTransaction(db, async (transaction) => {
                const userRef = doc(db, 'users', currentUser.uid);
                const catRef = doc(db, 'cats', post.catId);
                const postRef = doc(db, 'posts', post.id);

                // Get current values
                const userDoc = await transaction.get(userRef);
                const catDoc = await transaction.get(catRef);
                const postDoc = await transaction.get(postRef);

                if (!userDoc.exists()) {
                    throw new Error('User not found');
                }
                if (!catDoc.exists()) {
                    throw new Error('Cat not found');
                }
                if (!postDoc.exists()) {
                    throw new Error('Post not found');
                }

                const currentBalance = userDoc.data().treatBalance || 0;
                if (currentBalance < treatAmount) {
                    throw new Error('Insufficient treats');
                }

                // Perform all updates atomically
                transaction.update(userRef, {
                    treatBalance: (currentBalance - treatAmount)
                });

                const currentTreatsEarned = catDoc.data().treatsEarned || 0;
                transaction.update(catRef, {
                    treatsEarned: (currentTreatsEarned + treatAmount)
                });

                const currentPostTreats = postDoc.data().treats || 0;
                transaction.update(postRef, {
                    treats: (currentPostTreats + treatAmount)
                });
            });

            // Transaction successful - refresh data
            await Promise.all([
                refreshCurrentUser(),
                loadPosts()
            ]);

            setGiftingPostId(null);
            alert('Success! You gifted ' + treatAmount + ' treats to ' + (post.catData?.name || 'the cat') + '!');
        } catch (error) {
            console.error('Error gifting treats:', error);

            // Refresh user data to ensure balance is accurate
            await refreshCurrentUser();

            if (error.message === 'Insufficient treats') {
                alert('Not enough treats! Buy more treats first.');
            } else if (error.message === 'Cat not found' || error.message === 'Post not found') {
                alert('This post or cat no longer exists.');
                setGiftingPostId(null);
            } else {
                alert('Error gifting treats. Please try again.');
            }
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-purple-600">Gift Treats</h2>
                    <button
                        onClick={() => setGiftingPostId(null)}
                        className="text-gray-500 hover:text-gray-700"
                        disabled={isProcessing}
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="text-center mb-6">
                    <div className="text-6xl mb-4">{post.catData?.avatar || '😺'}</div>
                    <p className="text-gray-600">
                        Send treats to <span className="font-bold">{post.catData?.name}</span>
                    </p>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Number of treats (You have: {currentUser?.treatBalance || 0})
                    </label>
                    <input
                        type="number"
                        min="1"
                        max={currentUser?.treatBalance || 0}
                        value={treatAmount}
                        onChange={(e) => setTreatAmount(parseInt(e.target.value) || 1)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        disabled={isProcessing}
                    />
                </div>

                <div className="flex gap-2 mb-4">
                    {[5, 10, 25, 50].map(amount => (
                        <button
                            key={amount}
                            onClick={() => setTreatAmount(amount)}
                            className="flex-1 py-2 border-2 border-purple-200 rounded-lg hover:bg-purple-50 transition disabled:opacity-50"
                            disabled={isProcessing || amount > (currentUser?.treatBalance || 0)}
                        >
                            {amount}
                        </button>
                    ))}
                </div>

                <button
                    onClick={handleGift}
                    disabled={!currentUser?.treatBalance || currentUser.treatBalance < treatAmount || isProcessing}
                    className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    {isProcessing ? 'Processing...' : `Gift ${treatAmount} Treats`}
                </button>
            </div>
        </div>
    );
}

export default GiftTreatsModal;