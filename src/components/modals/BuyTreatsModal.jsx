import React from 'react';
import { X } from 'lucide-react';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../../firebase';

function BuyTreatsModal({ currentUser, setShowBuyTreats, refreshCurrentUser }) {
    const treatPackages = [
        { name: 'Small Bag', price: 4.99, treats: 50, emoji: '🐾' },
        { name: 'Medium Bag', price: 9.99, treats: 120, emoji: '🎁', popular: true },
        { name: 'Large Bag', price: 19.99, treats: 300, emoji: '🎉' }
    ];

    const handlePurchase = async (pkg) => {
        try {
            await updateDoc(doc(db, 'users', currentUser.uid), {
                treatBalance: increment(pkg.treats)
            });

            await refreshCurrentUser();
            setShowBuyTreats(false);

            alert(`🎉 Success! You got ${pkg.treats} treats!`);
        } catch (error) {
            console.error('Error purchasing treats:', error);
            alert('Error purchasing treats. Please try again.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-purple-600">Buy Treats 🍪</h2>
                        <button onClick={() => setShowBuyTreats(false)} className="text-gray-500 hover:text-gray-700">
                            <X size={24} />
                        </button>
                    </div>

                    <p className="text-gray-600 mb-6">
                        Gift treats to your favorite cats! Creators can redeem 500 treats for a FREE bag of real cat treats!
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        {treatPackages.map((pkg, index) => (
                            <div
                                key={index}
                                className={`border-2 rounded-xl p-6 text-center relative ${
                                    pkg.popular ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
                                }`}
                            >
                                {pkg.popular && (
                                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                                        BEST VALUE
                                    </div>
                                )}
                                <div className="text-4xl mb-3">{pkg.emoji}</div>
                                <h3 className="font-bold text-lg mb-2">{pkg.name}</h3>
                                <div className="text-3xl font-bold text-purple-600 mb-2">${pkg.price}</div>
                                <div className="text-gray-600 mb-4">{pkg.treats} treats</div>
                                <div className="text-sm text-gray-500 mb-4">
                                    ${(pkg.price / pkg.treats).toFixed(3)} per treat
                                </div>
                                <button
                                    onClick={() => handlePurchase(pkg)}
                                    className="w-full bg-purple-600 text-white py-2 rounded-lg font-semibold hover:bg-purple-700 transition"
                                >
                                    Buy Now (Demo)
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-semibold mb-2">How it works:</h4>
                        <ul className="text-sm text-gray-600 space-y-1">
                            <li>✅ Buy treats in bundles</li>
                            <li>✅ Gift treats to posts you love</li>
                            <li>✅ Creators accumulate treats</li>
                            <li>✅ At 500 treats, redeem for FREE cat treats!</li>
                        </ul>
                    </div>

                    <p className="text-xs text-gray-400 text-center mt-4">
                        * Currently in demo mode - no real payments processed
                    </p>
                </div>
            </div>
        </div>
    );
}

export default BuyTreatsModal;