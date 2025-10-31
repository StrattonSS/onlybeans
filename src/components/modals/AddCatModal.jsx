import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
    collection,
    addDoc,
    serverTimestamp,
    setDoc,
    doc,
    arrayUnion,
} from 'firebase/firestore';
import { db } from '../../firebase';

function AddCatModal({ currentUser, setShowAddCat, loadUserCats, refreshCurrentUser }) {
    const [catName, setCatName] = useState('');
    const [catBio, setCatBio] = useState('');
    const [catAvatar, setCatAvatar] = useState('😺');
    const [creating, setCreating] = useState(false);

    const avatarOptions = ['😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '🐱', '🐈', '🐈‍⬛'];

    const handleAddCat = async () => {
        if (!currentUser?.uid) {
            alert('Please log in before creating a cat profile.');
            return;
        }
        if (!catName.trim()) {
            alert('Please enter a cat name!');
            return;
        }

        setCreating(true);
        try {
            // 1) Create the cat
            const payload = {
                ownerId: currentUser.uid,
                name: catName.trim(),
                bio: catBio.trim() || 'A cute cat on OnlyBeans! 🐾',
                avatar: catAvatar,
                treatsEarned: 0,
                followers: 0,
                createdAt: serverTimestamp(),
            };

            const catRef = await addDoc(collection(db, 'cats'), payload);
            console.log('✅ Cat created with ID:', catRef.id);

            // 2) (Optional) track cat id on the user doc; merge so it never overwrites
            await setDoc(
                doc(db, 'users', currentUser.uid),
                { cats: arrayUnion(catRef.id) },
                { merge: true }
            );

            // 3) Safely call callbacks if provided as functions
            if (typeof loadUserCats === 'function') {
                await loadUserCats(currentUser.uid);
            }
            if (typeof refreshCurrentUser === 'function') {
                await refreshCurrentUser();
            }

            // 4) Reset & close
            setCatName('');
            setCatBio('');
            setCatAvatar('😺');
            setShowAddCat(false);
            alert('🎉 Cat profile created successfully!');
        } catch (error) {
            console.error('❌ Error adding cat:', error);
            // Surface the real Firestore message if available
            alert(error?.message || 'Error creating cat profile. Please try again.');
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-purple-600">Add Cat Profile 🐱</h2>
                    <button onClick={() => setShowAddCat(false)} className="text-gray-500 hover:text-gray-700">
                        <X size={24} />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Cat&apos;s Name</label>
                        <input
                            type="text"
                            value={catName}
                            onChange={(e) => setCatName(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            placeholder="Whiskers"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                        <textarea
                            value={catBio}
                            onChange={(e) => setCatBio(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            rows="3"
                            placeholder="Tell us about your cat..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Choose Avatar</label>
                        <div className="grid grid-cols-6 gap-2">
                            {avatarOptions.map((emoji) => (
                                <button
                                    key={emoji}
                                    onClick={() => setCatAvatar(emoji)}
                                    className={`text-3xl p-3 rounded-lg border-2 transition ${
                                        catAvatar === emoji ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'
                                    }`}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handleAddCat}
                        disabled={creating}
                        className={`w-full text-white py-3 rounded-lg font-semibold transition ${
                            creating ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
                        }`}
                    >
                        {creating ? 'Creating…' : 'Create Cat Profile'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default AddCatModal;
