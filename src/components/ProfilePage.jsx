import React, { useState, useMemo } from 'react';
import {
    PlusCircle,
    Camera,
    Heart,
    MessageCircle,
    Gift,
    Edit3,
    Settings,
    Shield,
    Upload,
    X
} from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { storage, db } from '../firebase';

function ProfilePage({
                         currentUser,
                         cats,
                         posts,
                         setShowAddCat,
                         setCurrentPage,
                         setSelectedCat,
                         loadUserCats
                     }) {
    const [editingCat, setEditingCat] = useState(null);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', bio: '', avatar: '' });

    // Determine user type
    const userIsViewer = currentUser?.accountType === 'viewer';
    const isCatOwner = currentUser?.accountType === 'feline';
    const isVerifiedShelter = currentUser?.verifiedShelter === true;

    // Get user's posts organized by cat
    const postsByCat = useMemo(() => {
        if (!cats || !posts) return {};
        const organized = {};
        cats.forEach(cat => {
            organized[cat.id] = posts.filter(p => p.catId === cat.id);
        });
        return organized;
    }, [cats, posts]);

    // Handle cat profile picture upload
    const handleCatPhotoUpload = async (catId, file) => {
        if (!file || !currentUser?.uid) return;

        setUploadingPhoto(true);
        try {
            // Upload to storage
            const storageRef = ref(storage, `cats/${currentUser.uid}/${catId}/profile.jpg`);
            await uploadBytes(storageRef, file);
            const photoURL = await getDownloadURL(storageRef);

            // Update cat document
            await updateDoc(doc(db, 'cats', catId), {
                photoURL: photoURL
            });

            // Reload cats
            if (loadUserCats) {
                await loadUserCats(currentUser.uid);
            }

            alert('Profile picture updated!');
        } catch (error) {
            console.error('Error uploading cat photo:', error);
            alert('Error uploading photo. Please try again.');
        } finally {
            setUploadingPhoto(false);
        }
    };

    // Handle cat profile edit
    const handleEditCat = (cat) => {
        setEditingCat(cat.id);
        setEditForm({
            name: cat.name,
            bio: cat.bio || '',
            avatar: cat.avatar || '😺'
        });
    };

    const handleSaveCatEdit = async (catId) => {
        try {
            await updateDoc(doc(db, 'cats', catId), {
                name: editForm.name,
                bio: editForm.bio,
                avatar: editForm.avatar
            });

            if (loadUserCats) {
                await loadUserCats(currentUser.uid);
            }

            setEditingCat(null);
            alert('Cat profile updated!');
        } catch (error) {
            console.error('Error updating cat:', error);
            alert('Error updating cat profile.');
        }
    };

    const avatarOptions = ['😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '🐱', '🐈', '🐈‍⬛'];

    return (
        <div className="max-w-7xl mx-auto">
            {/* User Header Card */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-8">
                {/* Cover Image */}
                <div className="h-48 bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 relative">
                    <button
                        onClick={() => setCurrentPage('settings')}
                        className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg font-semibold text-gray-700 hover:bg-white transition flex items-center gap-2"
                    >
                        <Settings size={18} />
                        Settings
                    </button>
                </div>

                {/* User Info */}
                <div className="px-6 pb-6">
                    <div className="flex flex-col md:flex-row items-start gap-6">
                        {/* Profile Avatar */}
                        <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center text-6xl -mt-16 shadow-xl border-4 border-white">
                            {currentUser?.avatar || '😺'}
                        </div>

                        {/* User Details */}
                        <div className="flex-1 mt-2">
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-3xl font-bold">{currentUser?.displayName || 'User'}</h1>
                                {isVerifiedShelter && (
                                    <span className="bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full flex items-center gap-1 font-medium">
                                        <Shield size={14} />
                                        Verified Shelter
                                    </span>
                                )}
                                {isCatOwner && !isVerifiedShelter && (
                                    <span className="bg-purple-100 text-purple-800 text-sm px-3 py-1 rounded-full font-medium">
                                        Cat Owner
                                    </span>
                                )}
                                {userIsViewer && (
                                    <span className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full font-medium">
                                        Viewer
                                    </span>
                                )}
                            </div>

                            <p className="text-gray-600 mb-4">@{currentUser?.username || 'user'}</p>

                            {currentUser?.bio && (
                                <p className="text-gray-700 mb-4">{currentUser.bio}</p>
                            )}

                            {/* Stats */}
                            <div className="flex gap-6 text-sm">
                                <div>
                                    <span className="font-bold text-lg">{cats?.length || 0}</span>
                                    <span className="text-gray-600 ml-1">Cats</span>
                                </div>
                                <div>
                                    <span className="font-bold text-lg">{posts?.length || 0}</span>
                                    <span className="text-gray-600 ml-1">Posts</span>
                                </div>
                                <div>
                                    <span className="font-bold text-lg">{currentUser?.treatBalance || 0}</span>
                                    <span className="text-gray-600 ml-1">💰 Treats</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Call to Action for Viewers */}
            {userIsViewer && (
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl shadow-lg p-8 mb-8 text-white text-center">
                    <div className="text-6xl mb-4">🐱</div>
                    <h2 className="text-3xl font-bold mb-3">Start Sharing Your Cats!</h2>
                    <p className="text-lg mb-6 opacity-90">
                        Add your first cat to become a Cat Owner and start earning treats
                    </p>
                    <button
                        onClick={() => setShowAddCat(true)}
                        className="bg-white text-purple-600 px-8 py-3 rounded-xl font-bold text-lg hover:bg-gray-100 transition inline-flex items-center gap-2 shadow-lg"
                    >
                        <PlusCircle size={24} />
                        Add Your First Cat
                    </button>
                </div>
            )}

            {/* Cats Section */}
            {isCatOwner && (
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold">My Cats</h2>
                        <button
                            onClick={() => setShowAddCat(true)}
                            className="bg-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-purple-700 transition flex items-center gap-2"
                        >
                            <PlusCircle size={20} />
                            Add Cat
                        </button>
                    </div>

                    {cats.length === 0 ? (
                        <div className="bg-white rounded-2xl shadow p-12 text-center">
                            <div className="text-6xl mb-4">🐾</div>
                            <h3 className="text-xl font-bold mb-2">No cats yet!</h3>
                            <p className="text-gray-600 mb-6">Add your first cat profile to start posting</p>
                            <button
                                onClick={() => setShowAddCat(true)}
                                className="bg-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-purple-700 transition"
                            >
                                Add Your First Cat
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {cats.map((cat) => {
                                const catPosts = postsByCat[cat.id] || [];
                                const isEditing = editingCat === cat.id;

                                return (
                                    <div key={cat.id} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                                        {/* Cat Header */}
                                        <div className="bg-gradient-to-r from-purple-100 to-pink-100 p-6">
                                            <div className="flex items-start gap-6">
                                                {/* Cat Profile Picture */}
                                                <div className="relative">
                                                    {cat.photoURL ? (
                                                        <img
                                                            src={cat.photoURL}
                                                            alt={cat.name}
                                                            className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
                                                        />
                                                    ) : (
                                                        <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center text-5xl border-4 border-white shadow-lg">
                                                            {cat.avatar || '😺'}
                                                        </div>
                                                    )}

                                                    {/* Upload Photo Button */}
                                                    <label className="absolute bottom-0 right-0 bg-purple-600 text-white p-2 rounded-full cursor-pointer hover:bg-purple-700 transition shadow-lg">
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={(e) => {
                                                                const file = e.target.files[0];
                                                                if (file) handleCatPhotoUpload(cat.id, file);
                                                            }}
                                                            disabled={uploadingPhoto}
                                                        />
                                                        <Camera size={16} />
                                                    </label>
                                                </div>

                                                {/* Cat Details */}
                                                <div className="flex-1">
                                                    {isEditing ? (
                                                        <div className="space-y-3">
                                                            <input
                                                                type="text"
                                                                value={editForm.name}
                                                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                                                className="w-full px-4 py-2 border rounded-lg text-xl font-bold"
                                                                placeholder="Cat name"
                                                            />
                                                            <textarea
                                                                value={editForm.bio}
                                                                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                                                                className="w-full px-4 py-2 border rounded-lg"
                                                                placeholder="Cat bio"
                                                                rows={2}
                                                            />
                                                            <div className="flex gap-2 flex-wrap">
                                                                {avatarOptions.map(emoji => (
                                                                    <button
                                                                        key={emoji}
                                                                        onClick={() => setEditForm({ ...editForm, avatar: emoji })}
                                                                        className={`text-2xl p-2 rounded-lg border-2 transition ${
                                                                            editForm.avatar === emoji
                                                                                ? 'border-purple-500 bg-purple-50'
                                                                                : 'border-gray-200 hover:border-purple-300'
                                                                        }`}
                                                                    >
                                                                        {emoji}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => handleSaveCatEdit(cat.id)}
                                                                    className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                                                                >
                                                                    Save Changes
                                                                </button>
                                                                <button
                                                                    onClick={() => setEditingCat(null)}
                                                                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <h3 className="text-2xl font-bold">{cat.name}</h3>
                                                                <button
                                                                    onClick={() => handleEditCat(cat)}
                                                                    className="text-gray-500 hover:text-purple-600 transition"
                                                                    title="Edit cat profile"
                                                                >
                                                                    <Edit3 size={18} />
                                                                </button>
                                                            </div>
                                                            <p className="text-gray-700 mb-4">{cat.bio}</p>

                                                            {/* Cat Stats */}
                                                            <div className="flex gap-6 text-sm">
                                                                <div>
                                                                    <span className="font-bold text-lg">{catPosts.length}</span>
                                                                    <span className="text-gray-600 ml-1">Posts</span>
                                                                </div>
                                                                <div>
                                                                    <span className="font-bold text-lg">{cat.followers || 0}</span>
                                                                    <span className="text-gray-600 ml-1">Followers</span>
                                                                </div>
                                                                <div>
                                                                    <span className="font-bold text-lg text-purple-600">{cat.treatsEarned || 0}</span>
                                                                    <span className="text-gray-600 ml-1">💰 Treats Earned</span>
                                                                </div>
                                                            </div>

                                                            {/* Treats Progress Bar */}
                                                            <div className="mt-4">
                                                                <div className="flex items-center justify-between text-sm mb-2">
                                                                    <span className="text-gray-600">Treats to Redemption</span>
                                                                    <span className="font-bold">{cat.treatsEarned || 0} / 500</span>
                                                                </div>
                                                                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                                                    <div
                                                                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-500"
                                                                        style={{ width: `${Math.min(((cat.treatsEarned || 0) / 500) * 100, 100)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Cat Posts Gallery */}
                                        <div className="p-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <h4 className="text-lg font-bold">Posts ({catPosts.length})</h4>
                                                <button
                                                    onClick={() => {
                                                        setSelectedCat(cat);
                                                        setCurrentPage('upload');
                                                    }}
                                                    className="bg-pink-600 text-white px-4 py-2 rounded-lg hover:bg-pink-700 transition flex items-center gap-2 text-sm"
                                                >
                                                    <Upload size={16} />
                                                    Upload Photo
                                                </button>
                                            </div>

                                            {catPosts.length === 0 ? (
                                                <div className="text-center py-12 bg-gray-50 rounded-xl">
                                                    <Camera size={48} className="mx-auto text-gray-400 mb-3" />
                                                    <p className="text-gray-500 mb-4">No posts yet</p>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedCat(cat);
                                                            setCurrentPage('upload');
                                                        }}
                                                        className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition"
                                                    >
                                                        Upload First Photo
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                                    {catPosts.map((post) => (
                                                        <div
                                                            key={post.id}
                                                            className="relative aspect-square rounded-lg overflow-hidden group cursor-pointer bg-gray-100"
                                                            onClick={() => {
                                                                // You can add a modal to view the full post here
                                                                console.log('View post:', post.id);
                                                            }}
                                                        >
                                                            <img
                                                                src={post.imageUrl}
                                                                alt={post.caption}
                                                                className="w-full h-full object-cover transition group-hover:scale-105"
                                                            />
                                                            {/* Overlay with stats */}
                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100">
                                                                <div className="text-white flex items-center gap-1">
                                                                    <Heart size={20} fill="white" />
                                                                    <span className="font-bold">{post.likes || 0}</span>
                                                                </div>
                                                                <div className="text-white flex items-center gap-1">
                                                                    <MessageCircle size={20} fill="white" />
                                                                    <span className="font-bold">{post.comments || 0}</span>
                                                                </div>
                                                                <div className="text-white flex items-center gap-1">
                                                                    <Gift size={20} fill="white" />
                                                                    <span className="font-bold">{post.treats || 0}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default ProfilePage;