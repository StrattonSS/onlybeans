import React, { useMemo, useState } from 'react';
import { Camera, Heart, MessageCircle, Gift, Edit, Trash2, MoreVertical, Send } from 'lucide-react';
import { doc, updateDoc, increment, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

function HomePage({
                      currentUser,
                      posts = [],
                      setPosts, // accepted but not used here
                      cats = [],
                      selectedCat,
                      setCurrentPage,
                      setGiftingPostId,
                      setEditingPost,
                      loadPosts,
                  }) {
    const [showPostMenu, setShowPostMenu] = useState(null);
    const [likingPost, setLikingPost] = useState(null);
    const [showComments, setShowComments] = useState(null);
    const [commentText, setCommentText] = useState('');
    const [addingComment, setAddingComment] = useState(false);

    // Category map (memoized so we don't rebuild it for every tile)
    const categoryMap = useMemo(
        () => ({
            everyday: { emoji: '🐱', name: 'Everyday', special: false },
            'rainbow-bridge': { emoji: '🌈', name: 'Rainbow Bridge', special: true },
            adoption: { emoji: '🏠', name: 'Adoption', special: true },
            funny: { emoji: '😹', name: 'Funny', special: false },
            sleeping: { emoji: '😴', name: 'Sleepy', special: false },
            playing: { emoji: '🎾', name: 'Playing', special: false },
            food: { emoji: '🍽️', name: 'Food', special: false },
            adventure: { emoji: '🌟', name: 'Adventure', special: false },
            grooming: { emoji: '✨', name: 'Grooming', special: false },
            tricks: { emoji: '🎪', name: 'Tricks', special: false },
        }),
        []
    );

    // Filter posts to only show cats the user follows (and always include your own cats)
    const followedCatIds = currentUser?.followedCats || [];
    const filteredPosts = posts.filter((post) => {
        if (cats.some((cat) => cat.id === post.catId)) return true; // own cats' posts
        return followedCatIds.includes(post.catId); // followed cats' posts
    });

    const isMyPost = (post) => cats.some((cat) => cat.id === post.catId);

    const safeDateLabel = (createdAt) => {
        try {
            if (!createdAt) return 'Recently';
            // Firestore Timestamp
            if (typeof createdAt?.toDate === 'function') return createdAt.toDate().toLocaleDateString();
            // ISO string or Date
            const d = createdAt instanceof Date ? createdAt : new Date(createdAt);
            if (!isNaN(d.getTime())) return d.toLocaleDateString();
        } catch {}
        return 'Recently';
    };

    const handleLikePost = async (post) => {
        if (!currentUser?.uid) {
            alert('Please log in to like posts');
            return;
        }
        if (likingPost === post.id) return;

        const likedBy = post.likedBy || [];
        const hasLiked = likedBy.includes(currentUser.uid);
        setLikingPost(post.id);

        try {
            if (hasLiked) {
                // Guard: avoid going negative on likes
                const likeUpdate = Math.max((post.likes || 0) - 1, 0);
                await updateDoc(doc(db, 'posts', post.id), {
                    likes: likeUpdate === (post.likes || 0) ? increment(-1) : likeUpdate,
                    likedBy: arrayRemove(currentUser.uid),
                });
            } else {
                await updateDoc(doc(db, 'posts', post.id), {
                    likes: increment(1),
                    likedBy: arrayUnion(currentUser.uid),
                });
            }
            await loadPosts();
        } catch (error) {
            console.error('Error liking post:', error);
            alert('Failed to update like. Please try again.');
            await loadPosts();
        } finally {
            setLikingPost(null);
        }
    };

    const handleAddComment = async (post) => {
        if (!currentUser?.uid) {
            alert('Please log in to comment');
            return;
        }
        if (!commentText.trim() || addingComment) return;

        setAddingComment(true);
        try {
            const newComment = {
                userId: currentUser.uid,
                username: currentUser.displayName || currentUser.username || 'User',
                avatar: currentUser.avatar || '😺',
                text: commentText.trim(),
                createdAt: new Date().toISOString(),
            };

            await updateDoc(doc(db, 'posts', post.id), {
                comments: increment(1),
                commentsList: arrayUnion(newComment),
            });

            setCommentText('');
            await loadPosts();
        } catch (error) {
            console.error('Error adding comment:', error);
            alert('Failed to add comment. Please try again.');
        } finally {
            setAddingComment(false);
        }
    };

    const handleDeletePost = async (postId) => {
        if (!window.confirm('Are you sure you want to delete this post?')) return;

        try {
            await deleteDoc(doc(db, 'posts', postId));
            setShowPostMenu(null);
            await loadPosts();
            alert('Post deleted successfully!');
        } catch (error) {
            console.error('Error deleting post:', error);
            alert('Error deleting post. Please try again.');
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            {/* Create-post composer (only if user has cats) */}
            {currentUser?.accountType === 'feline' && cats.length > 0 && (
                <div className="mb-6 bg-white rounded-lg shadow p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-purple-200 rounded-full flex items-center justify-center text-2xl">
                            {selectedCat?.avatar || '😺'}
                        </div>
                        <input
                            type="text"
                            placeholder="Share your cat's adventures..."
                            className="flex-1 px-4 py-3 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                            onClick={() => setCurrentPage('upload')}
                            readOnly
                        />
                        <button
                            onClick={() => setCurrentPage('upload')}
                            className="bg-purple-600 text-white p-3 rounded-full hover:bg-purple-700 transition"
                        >
                            <Camera size={20} />
                        </button>
                    </div>
                </div>
            )}

            {/* Setup message for cat owners with no cats */}
            {currentUser?.accountType === 'feline' && cats.length === 0 && (
                <div className="mb-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg shadow-lg p-6 text-white text-center">
                    <div className="text-4xl mb-3">🐱</div>
                    <h3 className="text-xl font-bold mb-2">Welcome to OnlyBeans!</h3>
                    <p className="mb-4 opacity-90">Create your first cat profile to start posting</p>
                    <button
                        onClick={() => setCurrentPage('profile')}
                        className="bg-white text-purple-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition"
                    >
                        Go to Profile to Add Cat
                    </button>
                </div>
            )}

            {/* Empty feed nudge */}
            {followedCatIds.length === 0 && cats.length === 0 && (
                <div className="mb-6 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg shadow p-6 text-center">
                    <div className="text-4xl mb-3">🐾</div>
                    <h3 className="text-xl font-bold mb-2">Your feed is empty!</h3>
                    <p className="text-gray-700 mb-4">
                        Follow some cats to see their posts here, or add your own cat to start posting!
                    </p>
                    <button
                        onClick={() => setCurrentPage('discover')}
                        className="bg-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700 transition"
                    >
                        Discover Cats
                    </button>
                </div>
            )}

            <div className="space-y-6">
                {filteredPosts.length === 0 && (followedCatIds.length > 0 || cats.length > 0) ? (
                    <div className="bg-white rounded-lg shadow p-12 text-center">
                        <p className="text-gray-500 mb-4">No posts yet from the cats you follow! 🐾</p>
                        {currentUser?.accountType === 'feline' && cats.length > 0 && (
                            <button
                                onClick={() => setCurrentPage('upload')}
                                className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition"
                            >
                                Create First Post
                            </button>
                        )}
                    </div>
                ) : (
                    filteredPosts.map((post) => {
                        const hasLiked = !!currentUser && post.likedBy?.includes(currentUser.uid);
                        const myPost = isMyPost(post);
                        const isCommentsOpen = showComments === post.id;

                        return (
                            <div key={post.id} className="bg-white rounded-lg shadow overflow-hidden">
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-purple-200 rounded-full flex items-center justify-center text-xl">
                                            {post.catData?.avatar || '😺'}
                                        </div>
                                        <div>
                                            <p className="font-semibold">{post.catData?.name || 'Anonymous Cat'}</p>
                                            <p className="text-xs text-gray-500">{safeDateLabel(post.createdAt)}</p>
                                        </div>
                                    </div>

                                    {myPost && (
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowPostMenu(showPostMenu === post.id ? null : post.id)}
                                                className="text-gray-500 hover:text-gray-700 p-2"
                                            >
                                                <MoreVertical size={20} />
                                            </button>

                                            {showPostMenu === post.id && (
                                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                                                    <button
                                                        onClick={() => {
                                                            setEditingPost(post);
                                                            setShowPostMenu(null);
                                                        }}
                                                        className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2 text-sm"
                                                    >
                                                        <Edit size={16} />
                                                        Edit Post
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeletePost(post.id)}
                                                        className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2 text-sm text-red-600"
                                                    >
                                                        <Trash2 size={16} />
                                                        Delete Post
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {post.imageUrl && (
                                    <div className="relative">
                                        <img
                                            src={post.imageUrl}
                                            alt="Cat content"
                                            className="w-full object-cover"
                                            style={{ maxHeight: '600px' }}
                                        />
                                        {post.categories && post.categories.length > 0 && (
                                            <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                                                {post.categories.map((catId) => {
                                                    const cat = categoryMap[catId];
                                                    return cat ? (
                                                        <span
                                                            key={catId}
                                                            className={`text-xs px-3 py-1 rounded-full font-semibold shadow-lg ${
                                                                cat.special ? 'bg-pink-500 text-white' : 'bg-purple-500 text-white'
                                                            }`}
                                                        >
                              {cat.emoji} {cat.name}
                            </span>
                                                    ) : null;
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="p-4">
                                    <div className="flex items-center gap-4 mb-3">
                                        <button
                                            onClick={() => handleLikePost(post)}
                                            disabled={likingPost === post.id}
                                            className={`flex items-center gap-2 transition ${
                                                hasLiked ? 'text-red-500' : 'hover:text-red-500'
                                            } ${likingPost === post.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <Heart size={24} fill={hasLiked ? 'currentColor' : 'none'} />
                                            <span>{post.likes || 0}</span>
                                        </button>

                                        <button
                                            onClick={() => setShowComments(isCommentsOpen ? null : post.id)}
                                            className="flex items-center gap-2 hover:text-purple-600 transition"
                                        >
                                            <MessageCircle size={24} />
                                            <span>{post.comments || 0}</span>
                                        </button>

                                        <button
                                            onClick={() => setGiftingPostId(post.id)}
                                            className="flex items-center gap-2 hover:text-yellow-600 transition ml-auto"
                                        >
                                            <Gift size={24} />
                                            <span>{post.treats || 0} treats</span>
                                        </button>
                                    </div>

                                    {post.caption && (
                                        <p className="text-gray-800 mb-3">
                                            <span className="font-semibold">{post.catData?.name || 'Anonymous'}</span> {post.caption}
                                        </p>
                                    )}

                                    {/* Comments Section */}
                                    {isCommentsOpen && (
                                        <div className="border-t pt-3 mt-3">
                                            {/* Existing Comments */}
                                            <div className="space-y-3 mb-3 max-h-60 overflow-y-auto">
                                                {(post.commentsList || []).length === 0 ? (
                                                    <p className="text-gray-500 text-sm text-center py-2">
                                                        No comments yet. Be the first to comment!
                                                    </p>
                                                ) : (
                                                    (post.commentsList || []).map((comment, index) => (
                                                        <div key={index} className="flex gap-2">
                                                            <div className="w-8 h-8 bg-purple-200 rounded-full flex items-center justify-center text-lg flex-shrink-0">
                                                                {comment.avatar || '😺'}
                                                            </div>
                                                            <div className="flex-1 bg-gray-100 rounded-lg px-3 py-2">
                                                                <p className="font-semibold text-sm">{comment.username}</p>
                                                                <p className="text-sm">{comment.text}</p>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>

                                            {/* Add Comment */}
                                            <div className="flex gap-2">
                                                <div className="w-8 h-8 bg-purple-200 rounded-full flex items-center justify-center text-lg flex-shrink-0">
                                                    {currentUser?.avatar || '😺'}
                                                </div>
                                                <input
                                                    type="text"
                                                    value={commentText}
                                                    onChange={(e) => setCommentText(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            handleAddComment(post);
                                                        }
                                                    }}
                                                    placeholder="Write a comment..."
                                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                                    disabled={addingComment}
                                                />
                                                <button
                                                    onClick={() => handleAddComment(post)}
                                                    disabled={!commentText.trim() || addingComment}
                                                    className="bg-purple-600 text-white p-2 rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                                                >
                                                    <Send size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

export default HomePage;
