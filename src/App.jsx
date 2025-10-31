import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, query, orderBy, where, doc, getDoc } from 'firebase/firestore';

// Components
import Navigation from './components/Navigation';
import LoginPage from './components/LoginPage';
import HomePage from './components/HomePage';
import DiscoverPage from './components/DiscoverPage';
import UploadPage from './components/UploadPage';
import ProfilePage from './components/ProfilePage';
import AdminPage from './components/AdminPage';

// Modals
import AddCatModal from './components/modals/AddCatModal';
import BuyTreatsModal from './components/modals/BuyTreatsModal';
import GiftTreatsModal from './components/modals/GiftTreatsModal';
import RedemptionModal from './components/modals/RedemptionModal';
import BugReportModal from './components/modals/BugReportModal';

function App() {
    // State
    const [currentPage, setCurrentPage] = useState('home');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [posts, setPosts] = useState([]);
    const [users, setUsers] = useState([]);
    const [cats, setCats] = useState([]);
    const [selectedCat, setSelectedCat] = useState(null);
    const [loading, setLoading] = useState(true);

    // Modal states
    const [showBuyTreats, setShowBuyTreats] = useState(false);
    const [showAddCat, setShowAddCat] = useState(false);
    const [showRedemption, setShowRedemption] = useState(false);
    const [showBugReport, setShowBugReport] = useState(false);
    const [giftingPostId, setGiftingPostId] = useState(null);
    const [editingPost, setEditingPost] = useState(null);

    // Auth listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            try {
                if (user) {
                    setIsLoggedIn(true);
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    const userData = { uid: user.uid, email: user.email, ...(userDoc.data() || {}) };
                    setCurrentUser(userData);

                    if (userData.accountType === 'feline') {
                        await loadUserCats(user.uid);
                    }
                } else {
                    setIsLoggedIn(false);
                    setCurrentUser(null);
                    setCats([]);
                    setSelectedCat(null);
                    setPosts([]);
                    setUsers([]);
                }
            } catch (e) {
                console.error('Auth init error:', e);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    // Load data when logged in
    useEffect(() => {
        if (isLoggedIn) {
            loadPosts();
            loadUsers();
        }
    }, [isLoggedIn]);

    // If editing a post, route to upload page
    useEffect(() => {
        if (editingPost) {
            setCurrentPage('upload');
        }
    }, [editingPost]);

    const loadPosts = async () => {
        try {
            const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const postsData = [];

            for (const docSnap of querySnapshot.docs) {
                const postData = { id: docSnap.id, ...docSnap.data() };
                if (postData?.catId) {
                    const catDoc = await getDoc(doc(db, 'cats', postData.catId));
                    if (catDoc.exists()) {
                        postData.catData = catDoc.data();
                    }
                }
                postsData.push(postData);
            }

            setPosts(postsData);
        } catch (error) {
            console.error('Error loading posts:', error);
        }
    };

    const loadUsers = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'users'));
            const usersData = querySnapshot.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            }));
            setUsers(usersData);
        } catch (error) {
            console.error('Error loading users:', error);
        }
    };

    const loadUserCats = async (userId) => {
        try {
            const q = query(collection(db, 'cats'), where('ownerId', '==', userId));
            const querySnapshot = await getDocs(q);
            const catsData = querySnapshot.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            }));
            setCats(catsData);

            if (catsData.length > 0 && !selectedCat) {
                setSelectedCat(catsData[0]);
            }
        } catch (error) {
            console.error('Error loading cats:', error);
        }
    };

    const refreshCurrentUser = async () => {
        try {
            if (currentUser?.uid) {
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                setCurrentUser({
                    uid: currentUser.uid,
                    email: currentUser.email,
                    ...(userDoc.data() || {}),
                });
            }
        } catch (e) {
            console.error('Error refreshing user:', e);
        }
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-6xl mb-4">🐾</div>
                    <p className="text-gray-600">Loading OnlyBeans...</p>
                </div>
            </div>
        );
    }

    // Not logged in
    if (!isLoggedIn) {
        return <LoginPage />;
    }

    // Main app
    return (
        <div className="min-h-screen bg-gray-50">
            <Navigation
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                currentUser={currentUser}
                setShowBuyTreats={setShowBuyTreats}
                setShowBugReport={setShowBugReport}
            />

            <div className="py-8 px-4">
                {currentPage === 'home' && (
                    <HomePage
                        currentUser={currentUser}
                        posts={posts}
                        cats={cats}
                        selectedCat={selectedCat}
                        setCurrentPage={setCurrentPage}
                        setGiftingPostId={setGiftingPostId}
                        setEditingPost={setEditingPost}
                        loadPosts={loadPosts}
                    />
                )}

                {currentPage === 'discover' && (
                    <DiscoverPage currentUser={currentUser} refreshCurrentUser={refreshCurrentUser} />
                )}

                {currentPage === 'upload' && (
                    <UploadPage
                        currentUser={currentUser}
                        cats={cats}
                        selectedCat={selectedCat}
                        setSelectedCat={setSelectedCat}
                        editingPost={editingPost}
                        setEditingPost={setEditingPost}
                        setCurrentPage={setCurrentPage}
                        loadPosts={loadPosts}
                    />
                )}

                {currentPage === 'profile' && (
                    <ProfilePage
                        currentUser={currentUser}
                        cats={cats}
                        posts={posts}
                        selectedCat={selectedCat}
                        setSelectedCat={setSelectedCat}
                        setShowAddCat={setShowAddCat}
                        setShowRedemption={setShowRedemption}
                        setCurrentPage={setCurrentPage}
                    />
                )}

                {currentPage === 'admin' && <AdminPage currentUser={currentUser} />}
            </div>

            {/* Modals */}
            {showBuyTreats && (
                <BuyTreatsModal
                    currentUser={currentUser}
                    setShowBuyTreats={setShowBuyTreats}
                    refreshCurrentUser={refreshCurrentUser}
                />
            )}

            {showAddCat && (
                <AddCatModal
                    currentUser={currentUser}
                    setShowAddCat={setShowAddCat}
                    loadUserCats={loadUserCats}
                    refreshCurrentUser={refreshCurrentUser}  // <-- important
                />
            )}

            {showRedemption && (
                <RedemptionModal
                    currentUser={currentUser}
                    selectedCat={selectedCat}
                    users={users}
                    setShowRedemption={setShowRedemption}
                    loadUserCats={loadUserCats}
                    refreshCurrentUser={refreshCurrentUser}
                />
            )}

            {giftingPostId && (
                <GiftTreatsModal
                    post={posts.find((p) => p.id === giftingPostId) || null}
                    currentUser={currentUser}
                    setGiftingPostId={setGiftingPostId}
                    refreshCurrentUser={refreshCurrentUser}
                    loadPosts={loadPosts}
                />
            )}

            {showBugReport && (
                <BugReportModal currentUser={currentUser} setShowBugReport={setShowBugReport} />
            )}
        </div>
    );
}

export default App;
