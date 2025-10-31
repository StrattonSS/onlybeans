import React, { useState, useEffect } from 'react';
import { Gift, Users, Search, Heart, MessageCircle } from 'lucide-react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';

function DiscoverPage({ currentUser, refreshCurrentUser }) {
    const [allCats, setAllCats] = useState([]);
    const [allPosts, setAllPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [followingCat, setFollowingCat] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('cats'); // 'cats' or 'posts'

    const categories = [
        { id: 'all', name: 'All', emoji: '🐱', description: 'Everything' },
        { id: 'throwback', name: 'Throwback', emoji: '🕰️', description: 'Old pics, new vibes', special: true },
        { id: 'everyday', name: 'Everyday Life', emoji: '🐾', description: 'Daily moments' },
        { id: 'rainbow-bridge', name: 'Rainbow Bridge', emoji: '🌈', description: 'In loving memory', special: true },
        { id: 'adoption', name: 'Up for Adoption', emoji: '🏠', description: 'Looking for a home', special: true },
        { id: 'funny', name: 'Funny', emoji: '😹', description: 'Hilarious moments' },
        { id: 'sleeping', name: 'Sleepy Time', emoji: '😴', description: 'Catching Z\'s' },
        { id: 'playing', name: 'Playtime', emoji: '🎾', description: 'Action shots' },
        { id: 'food', name: 'Food Time', emoji: '🍽️', description: 'Nom nom nom' },
        { id: 'adventure', name: 'Adventures', emoji: '🌟', description: 'Exploring' },
        { id: 'grooming', name: 'Grooming', emoji: '✨', description: 'Looking fab' },
        { id: 'tricks', name: 'Tricks & Skills', emoji: '🎪', description: 'Showing off' }
    ];

    useEffect(() => {
        loadAllData();
    }, []);

    const loadAllData = async () => {
        try {
            await Promise.all([loadAllCats(), loadAllPosts()]);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadAllCats = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'cats'));
            const catsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setAllCats(catsData);
        } catch (error) {
            console.error('Error loading cats:', error);
        }
    };

    const loadAllPosts = async () => {
        try {
            const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const postsData = [];

            for (const docSnap of querySnapshot.docs) {
                const postData = { id: docSnap.id, ...docSnap.data() };

                // Load cat data for each post
                const catDoc = await getDocs(collection(db, 'cats'));
                const cat = catDoc.docs.find(c => c.id === postData.catId);
                if (cat) {
                    postData.catData = cat.data();
                }

                postsData.push(postData);
            }

            setAllPosts(postsData);
        } catch (error) {
            console.error('Error loading posts:', error);
        }
    };

    const handleFollowToggle = async (cat) => {
        if (!currentUser || !currentUser.uid) {
            alert('Please log in to follow cats');
            return;
        }

        if (followingCat === cat.id) return;
        setFollowingCat(cat.id);

        try {
            const followedCats = currentUser.followedCats || [];
            const isFollowing = followedCats.includes(cat.id);

            if (isFollowing) {
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    followedCats: arrayRemove(cat.id)
                });
                await updateDoc(doc(db, 'cats', cat.id), {
                    followers: increment(-1)
                });
            } else {
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    followedCats: arrayUnion(cat.id)
                });
                await updateDoc(doc(db, 'cats', cat.id), {
                    followers: increment(1)
                });
            }

            await refreshCurrentUser();
            await loadAllCats();
        } catch (error) {
            console.error('Error toggling follow:', error);
            alert('Error updating follow status. Please try again.');
        } finally {
            setFollowingCat(null);
        }
    };

    const isFollowing = (catId) => currentUser?.followedCats?.includes(catId) || false;

    const filteredCats = allCats.filter(cat => {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
            cat.name?.toLowerCase().includes(q) ||
            cat.bio?.toLowerCase().includes(q);
        return matchesSearch;
    });

    const filteredPosts = allPosts.filter(post => {
        if (selectedCategory !== 'all') {
            if (!post.categories || !post.categories.includes(selectedCategory)) return false;
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const matchesCaption = post.caption?.toLowerCase().includes(q);
            const matchesCatName = post.catData?.name?.toLowerCase().includes(q);
            return matchesCaption || matchesCatName;
        }
        return true;
    });

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto text-center py-12">
                <div className="text-4xl mb-4">🐾</div>
                <p className="text-gray-600">Loading cats and posts...</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto">
            <div className="mb-8">
                <h2 className="text-3xl font-bold mb-2">Discover</h2>
                <p className="text-gray-600">Explore cats and posts from our community</p>
            </div>

            {/* View Mode Toggle */}
            <div className="mb-6 flex gap-3">
                <button
                    onClick={() => {
                        setViewMode('cats');
                        setSelectedCategory('all'); // reset category filter when switching to Cats
                    }}
                    className={`flex-1 py-3 rounded-lg font-semibold transition ${
                        viewMode === 'cats'
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                    🐱 Browse Cats
                </button>
                <button
                    onClick={() => setViewMode('posts')}
                    className={`flex-1 py-3 rounded-lg font-semibold transition ${
                        viewMode === 'posts'
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                    📸 Browse Posts
                </button>
            </div>

            {/* Search Bar */}
            <div className="mb-8">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder={viewMode === 'cats' ? "Search for cats..." : "Search posts..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                </div>
            </div>

            {/* Categories: ONLY show when browsing posts */}
            {viewMode === 'posts' && (
                <div className="mb-8">
                    <h3 className="text-xl font-bold mb-4">Browse by Category</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {categories.map(category => (
                            <button
                                key={category.id}
                                onClick={() => setSelectedCategory(category.id)}
                                className={`p-3 rounded-xl border-2 text-left transition ${
                                    selectedCategory === category.id
                                        ? category.special
                                            ? 'border-pink-500 bg-pink-50'
                                            : 'border-purple-500 bg-purple-50'
                                        : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                                }`}
                            >
                                <div className="text-2xl mb-1">{category.emoji}</div>
                                <div className={`font-bold text-xs mb-1 ${
                                    selectedCategory === category.id && category.special ? 'text-pink-700' : ''
                                }`}>{category.name}</div>
                                <div className="text-xs text-gray-500">{category.description}</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Content Grid */}
            <div>
                {viewMode === 'cats' ? (
                    <>
                        <h3 className="text-xl font-bold mb-4">
                            {filteredCats.length} {filteredCats.length === 1 ? 'Cat' : 'Cats'}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredCats.length === 0 ? (
                                <div className="col-span-3 text-center py-12">
                                    <p className="text-gray-500">
                                        {searchQuery ? 'No cats found matching your search.' : 'No cats yet! Be the first to join 🐾'}
                                    </p>
                                </div>
                            ) : (
                                filteredCats.map(cat => {
                                    const following = isFollowing(cat.id);
                                    const isProcessing = followingCat === cat.id;
                                    const isOwnCat = currentUser?.uid === cat.ownerId;

                                    return (
                                        <div key={cat.id} className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition">
                                            <div className="h-32 bg-gradient-to-br from-purple-400 to-pink-400"></div>
                                            <div className="p-6 text-center">
                                                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-4xl mx-auto -mt-16 mb-4 shadow-lg border-4 border-white">
                                                    {cat.avatar || '😺'}
                                                </div>
                                                <h3 className="font-bold text-lg mb-1">{cat.name || 'Cat'}</h3>
                                                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{cat.bio || 'A cute cat on OnlyBeans!'}</p>
                                                <div className="flex items-center justify-center gap-4 mb-4 text-sm text-gray-600">
                                                    <div className="flex items-center gap-1">
                                                        <Gift size={16} />
                                                        <span>{cat.treatsEarned || 0}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Users size={16} />
                                                        <span>{cat.followers || 0}</span>
                                                    </div>
                                                </div>
                                                {isOwnCat ? (
                                                    <div className="w-full py-2 rounded-lg font-semibold bg-gray-100 text-gray-500 text-center">
                                                        Your Cat
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => handleFollowToggle(cat)}
                                                        disabled={isProcessing}
                                                        className={`w-full py-2 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
                                                            following
                                                                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                                : 'bg-purple-600 text-white hover:bg-purple-700'
                                                        } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    >
                                                        {following ? (
                                                            <>
                                                                <Heart size={18} fill="currentColor" />
                                                                Following
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Heart size={18} />
                                                                Follow
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold">
                                {selectedCategory === 'all' ? 'All Posts' : categories.find(c => c.id === selectedCategory)?.name}
                            </h3>
                            <span className="text-sm text-gray-500">
                                {filteredPosts.length} {filteredPosts.length === 1 ? 'post' : 'posts'}
                            </span>
                        </div>

                        {filteredPosts.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-lg shadow">
                                <p className="text-gray-500">
                                    {searchQuery || selectedCategory !== 'all'
                                        ? 'No posts found. Try a different category or search term.'
                                        : 'No posts yet! Be the first to share 🐾'}
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredPosts.map(post => (
                                    <div key={post.id} className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition">
                                        {post.imageUrl && (
                                            <div className="relative">
                                                <img
                                                    src={post.imageUrl}
                                                    alt={post.caption}
                                                    className="w-full h-64 object-cover"
                                                />
                                                {/* Category badges */}
                                                {post.categories && post.categories.length > 0 && (
                                                    <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                                                        {post.categories.map(catId => {
                                                            const cat = categories.find(c => c.id === catId);
                                                            return cat ? (
                                                                <span
                                                                    key={catId}
                                                                    className={`text-xs px-2 py-1 rounded-full font-semibold ${
                                                                        cat.special
                                                                            ? 'bg-pink-500 text-white'
                                                                            : 'bg-purple-500 text-white'
                                                                    }`}
                                                                >
                                                                    {cat.emoji}
                                                                </span>
                                                            ) : null;
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-8 h-8 bg-purple-200 rounded-full flex items-center justify-center text-lg">
                                                    {post.catData?.avatar || '😺'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-sm truncate">
                                                        {post.catData?.name || 'Anonymous Cat'}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {post.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
                                                    </p>
                                                </div>
                                            </div>

                                            {post.caption && (
                                                <p className="text-gray-800 text-sm mb-3 line-clamp-2">
                                                    {post.caption}
                                                </p>
                                            )}

                                            <div className="flex items-center gap-4 text-sm text-gray-600">
                                                <div className="flex items-center gap-1">
                                                    <Heart size={16} />
                                                    <span>{post.likes || 0}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <MessageCircle size={16} />
                                                    <span>{post.comments || 0}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Gift size={16} />
                                                    <span>{post.treats || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default DiscoverPage;
