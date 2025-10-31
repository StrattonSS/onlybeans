'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
    LogOut,
    PlusCircle,
    Gift,
    Camera,
    Heart,
    Shield,
    CheckCircle,
    X as CloseIcon,
    MapPin
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import {
    doc,
    setDoc,
    addDoc,
    collection,
    serverTimestamp,
    updateDoc,
    getDoc,
} from 'firebase/firestore';

/** -------------------------------------------------------------
 * Small reusable address form used for:
 * - user shipping address
 * - shelter shipping address
 *
 * Writes into local state via onChange(field, value)
 * ------------------------------------------------------------ */
function AddressForm({ title, address, onChange, onSave, saving, helpText }) {
    return (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-center gap-2 mb-2">
                <MapPin size={18} className="text-purple-600" />
                <h3 className="text-lg font-bold">{title}</h3>
            </div>
            {helpText && <p className="text-sm text-gray-600 mb-4">{helpText}</p>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm text-gray-700 mb-1">Full name *</label>
                    <input
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        value={address.fullName || ''}
                        onChange={(e) => onChange('fullName', e.target.value)}
                        placeholder="e.g., Benjamin Stratton"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm text-gray-700 mb-1">Phone</label>
                    <input
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        value={address.phone || ''}
                        onChange={(e) => onChange('phone', e.target.value)}
                        placeholder="e.g., 555-123-4567"
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm text-gray-700 mb-1">Address line 1 *</label>
                    <input
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        value={address.address1 || ''}
                        onChange={(e) => onChange('address1', e.target.value)}
                        placeholder="e.g., 123 Catnip Ave"
                        required
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm text-gray-700 mb-1">Address line 2</label>
                    <input
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        value={address.address2 || ''}
                        onChange={(e) => onChange('address2', e.target.value)}
                        placeholder="Apt, suite, unit (optional)"
                    />
                </div>
                <div>
                    <label className="block text-sm text-gray-700 mb-1">City *</label>
                    <input
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        value={address.city || ''}
                        onChange={(e) => onChange('city', e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm text-gray-700 mb-1">State/Province *</label>
                    <input
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        value={address.state || ''}
                        onChange={(e) => onChange('state', e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm text-gray-700 mb-1">ZIP/Postal Code *</label>
                    <input
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        value={address.zip || ''}
                        onChange={(e) => onChange('zip', e.target.value)}
                        required
                    />
                </div>
            </div>

            <div className="mt-4 flex gap-2">
                <button
                    onClick={onSave}
                    className="bg-purple-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-60"
                    disabled={saving}
                >
                    {saving ? 'Saving…' : 'Save Address'}
                </button>
            </div>
        </div>
    );
}

function ProfilePage({
                         currentUser,
                         cats = [],
                         posts = [],
                         selectedCat,
                         setSelectedCat,
                         setShowAddCat,
                         setShowRedemption,
                         setCurrentPage,
                         refreshCurrentUser,
                     }) {
    const [showShelterRequest, setShowShelterRequest] = useState(false);
    const [shelterName, setShelterName] = useState('');
    const [shelterLocation, setShelterLocation] = useState('');
    const [shelterWebsite, setShelterWebsite] = useState('');
    const [shelterDescription, setShelterDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);

    // Address state (pulled from currentUser on mount/update)
    const [userAddr, setUserAddr] = useState({
        fullName: '',
        address1: '',
        address2: '',
        city: '',
        state: '',
        zip: '',
        phone: '',
    });
    const [shelterAddr, setShelterAddr] = useState({
        fullName: '',
        address1: '',
        address2: '',
        city: '',
        state: '',
        zip: '',
        phone: '',
    });
    const [savingUserAddr, setSavingUserAddr] = useState(false);
    const [savingShelterAddr, setSavingShelterAddr] = useState(false);

    useEffect(() => {
        // Hydrate local address state from the latest currentUser
        if (currentUser?.shippingAddress) {
            setUserAddr({
                fullName: currentUser.shippingAddress.fullName || '',
                address1: currentUser.shippingAddress.address1 || '',
                address2: currentUser.shippingAddress.address2 || '',
                city: currentUser.shippingAddress.city || '',
                state: currentUser.shippingAddress.state || '',
                zip: currentUser.shippingAddress.zip || '',
                phone: currentUser.shippingAddress.phone || '',
            });
        }
        if (currentUser?.shelterShippingAddress) {
            setShelterAddr({
                fullName: currentUser.shelterShippingAddress.fullName || '',
                address1: currentUser.shelterShippingAddress.address1 || '',
                address2: currentUser.shelterShippingAddress.address2 || '',
                city: currentUser.shelterShippingAddress.city || '',
                state: currentUser.shelterShippingAddress.state || '',
                zip: currentUser.shelterShippingAddress.zip || '',
                phone: currentUser.shelterShippingAddress.phone || '',
            });
        } else if (currentUser?.verifiedShelter && currentUser?.displayName) {
            // prefill shelter full name from display name if empty
            setShelterAddr((prev) => ({ ...prev, fullName: prev.fullName || currentUser.displayName }));
        }
        if (currentUser?.displayName && !userAddr.fullName) {
            // prefill user name if empty
            setUserAddr((prev) => ({ ...prev, fullName: prev.fullName || currentUser.displayName }));
        }
    }, [currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

    const userIsViewer = currentUser?.accountType === 'viewer';
    const isCatOwner = currentUser?.accountType === 'feline';
    const isVerifiedShelter = currentUser?.verifiedShelter === true;

    // Posts that belong to any of the user's cats
    const userPosts = useMemo(
        () => posts.filter((post) => cats.some((cat) => cat.id === post.catId)),
        [posts, cats]
    );
    const totalLikes = useMemo(
        () => userPosts.reduce((sum, post) => sum + (post.likes || 0), 0),
        [userPosts]
    );
    const totalTreatsEarned = useMemo(
        () => cats.reduce((sum, cat) => sum + (cat.treatsEarned || 0), 0),
        [cats]
    );

    const handleAddCatClick = async () => {
        // Auto-upgrade to cat owner when adding first cat
        if (userIsViewer && currentUser?.uid) {
            try {
                await setDoc(
                    doc(db, 'users', currentUser.uid),
                    {
                        accountType: 'feline',
                        bio: currentUser?.bio || 'Cat owner on OnlyBeans! 🐾',
                    },
                    { merge: true }
                );
                if (typeof refreshCurrentUser === 'function') {
                    await refreshCurrentUser();
                }
            } catch (error) {
                console.error('Error upgrading account:', error);
                // still open the modal
            }
        }
        setShowAddCat(true);
    };

    const handleShelterRequest = async (e) => {
        e.preventDefault();
        if (!currentUser?.uid) return;
        setSubmitting(true);

        try {
            await addDoc(collection(db, 'shelterRequests'), {
                userId: currentUser.uid,
                username: currentUser.username,
                email: currentUser.email,
                shelterName,
                location: shelterLocation,
                website: shelterWebsite,
                description: shelterDescription,
                // NOTE: shipping address not collected here; admins expect it on the user doc.
                status: 'pending',
                submittedAt: serverTimestamp(),
            });

            setSubmitSuccess(true);
            setTimeout(() => {
                setShowShelterRequest(false);
                setSubmitSuccess(false);
                setShelterName('');
                setShelterLocation('');
                setShelterWebsite('');
                setShelterDescription('');
            }, 2000);
        } catch (error) {
            console.error('Error submitting shelter request:', error);
            alert('Error submitting request. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // Save addresses
    const saveUserAddress = async () => {
        if (!currentUser?.uid) return;
        setSavingUserAddr(true);
        try {
            await setDoc(
                doc(db, 'users', currentUser.uid),
                { shippingAddress: { ...userAddr } },
                { merge: true }
            );
            if (refreshCurrentUser) await refreshCurrentUser();
            alert('Shipping address saved to your profile.');
        } catch (e) {
            console.error('Error saving shipping address', e);
            alert('Could not save address. Try again.');
        } finally {
            setSavingUserAddr(false);
        }
    };

    const saveShelterAddress = async () => {
        if (!currentUser?.uid) return;
        setSavingShelterAddr(true);
        try {
            await setDoc(
                doc(db, 'users', currentUser.uid),
                { shelterShippingAddress: { ...shelterAddr } },
                { merge: true }
            );
            if (refreshCurrentUser) await refreshCurrentUser();
            alert('Shelter shipping address saved.');
        } catch (e) {
            console.error('Error saving shelter shipping address', e);
            alert('Could not save shelter address. Try again.');
        } finally {
            setSavingShelterAddr(false);
        }
    };

    // Click “Redeem Treats”:
    // We pass extra info so the redemption modal/admin card has everything:
    // - ownerId (userId)
    // - userShippingAddress & shelterShippingAddress snapshots
    const onRedeem = (cat) => {
        const payload = {
            ...cat,
            ownerId: currentUser?.uid || null,
            userShippingAddress: currentUser?.shippingAddress || null,
            shelterShippingAddress: currentUser?.shelterShippingAddress || null,
            ownerUsername: currentUser?.username || null,
            ownerEmail: currentUser?.email || null,
        };
        setSelectedCat(payload);
        setShowRedemption(true);
    };

    return (
        <div className="max-w-4xl mx-auto">
            {/* Upgrade Banner for Viewers */}
            {userIsViewer && (
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg shadow-lg p-6 mb-6 text-white">
                    <div className="text-center">
                        <div className="text-6xl mb-4">😺</div>
                        <h2 className="text-3xl font-bold mb-2">Start Sharing Your Cats!</h2>
                        <p className="text-lg mb-6 opacity-90">
                            Add your first cat to become a Cat Owner and start earning treats
                        </p>
                        <button
                            onClick={handleAddCatClick}
                            className="bg-white text-purple-600 px-8 py-3 rounded-lg font-bold text-lg hover:bg-gray-100 transition inline-flex items-center gap-2"
                        >
                            <PlusCircle size={24} />
                            Add Your First Cat
                        </button>
                        <p className="text-sm mt-4 opacity-75">
                            Upload photos, earn treats, and optionally apply for shelter verification!
                        </p>
                    </div>
                </div>
            )}

            {/* Shelter Verification Option for Cat Owners */}
            {isCatOwner && !isVerifiedShelter && (
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-6">
                    <div className="flex items-start gap-4">
                        <div className="text-4xl">🛡️</div>
                        <div className="flex-1">
                            <h3 className="font-bold text-lg mb-1">Are you an Animal Shelter?</h3>
                            <p className="text-sm text-gray-700 mb-3">
                                Get verified as an animal shelter to receive treat donations from the community!
                            </p>
                            <button
                                onClick={() => setShowShelterRequest(true)}
                                className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition flex items-center gap-2"
                            >
                                <Shield size={18} />
                                Apply for Shelter Verification
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Shelter Request Modal */}
            {showShelterRequest && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-2xl font-bold">Apply for Shelter Verification</h3>
                                <button
                                    onClick={() => setShowShelterRequest(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                    aria-label="Close"
                                    title="Close"
                                >
                                    <CloseIcon size={20} />
                                </button>
                            </div>

                            {submitSuccess ? (
                                <div className="text-center py-8">
                                    <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
                                    <h4 className="text-xl font-bold mb-2">Application Submitted!</h4>
                                    <p className="text-gray-600">
                                        We'll review your application and get back to you within 48 hours.
                                    </p>
                                </div>
                            ) : (
                                <form onSubmit={handleShelterRequest} className="space-y-4">
                                    <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800 mb-4">
                                        <strong>Note:</strong> You'll keep all your cat owner abilities (posting, earning
                                        treats) and gain the ability to receive donations from supporters!
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Shelter Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={shelterName}
                                            onChange={(e) => setShelterName(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            placeholder="Happy Paws Animal Shelter"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Location *</label>
                                        <input
                                            type="text"
                                            value={shelterLocation}
                                            onChange={(e) => setShelterLocation(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            placeholder="City, State"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Website (optional)
                                        </label>
                                        <input
                                            type="url"
                                            value={shelterWebsite}
                                            onChange={(e) => setShelterWebsite(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            placeholder="https://yourshelter.org"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Tell us about your shelter *
                                        </label>
                                        <textarea
                                            value={shelterDescription}
                                            onChange={(e) => setShelterDescription(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            rows={4}
                                            placeholder="Brief description of your shelter, mission, and how many cats you help..."
                                            required
                                        />
                                    </div>

                                    <div className="bg-yellow-50 p-3 rounded-lg text-sm text-yellow-800">
                                        <Shield size={16} className="inline mr-2" />
                                        Your application will be reviewed by our team. We may contact you for additional
                                        verification.
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setShowShelterRequest(false)}
                                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                                            disabled={submitting}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50"
                                            disabled={submitting}
                                        >
                                            {submitting ? 'Submitting...' : 'Submit Application'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* User Header */}
            <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
                <div className="h-48 bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400"></div>
                <div className="p-6">
                    <div className="flex flex-col md:flex-row items-start gap-6">
                        <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center text-6xl -mt-20 shadow-xl border-4 border-white">
                            {currentUser?.avatar || '😺'}
                        </div>
                        <div className="flex-1 w-full">
                            <div className="flex items-center gap-2 mb-1">
                                <h2 className="text-2xl font-bold">{currentUser?.displayName || 'User'}</h2>
                                {isVerifiedShelter && (
                                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <Shield size={12} />
                    Verified Shelter
                  </span>
                                )}
                                {isCatOwner && !isVerifiedShelter && (
                                    <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                    Cat Owner
                  </span>
                                )}
                                {userIsViewer && (
                                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                    Viewer
                  </span>
                                )}
                            </div>
                            <p className="text-gray-500 mb-4">@{currentUser?.username || 'username'}</p>
                            <p className="text-gray-600 mb-4">{currentUser?.bio || 'No bio yet'}</p>

                            {isCatOwner && (
                                <div className="flex gap-6 mb-4 flex-wrap">
                                    <div>
                                        <div className="text-2xl font-bold">{cats.length}</div>
                                        <div className="text-sm text-gray-500">Cats</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold">{userPosts.length}</div>
                                        <div className="text-sm text-gray-500">Posts</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold">
                                            {currentUser?.followedCats?.length || 0}
                                        </div>
                                        <div className="text-sm text-gray-500">Following</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold">{totalTreatsEarned}</div>
                                        <div className="text-sm text-gray-500">Treats Earned</div>
                                    </div>
                                    {isVerifiedShelter && (
                                        <div>
                                            <div className="text-2xl font-bold text-green-600">
                                                {currentUser?.donationsReceived || 0}
                                            </div>
                                            <div className="text-sm text-gray-500">Donations Received</div>
                                        </div>
                                    )}
                                    <div>
                                        <div className="text-2xl font-bold">{currentUser?.treatBalance || 0}</div>
                                        <div className="text-sm text-gray-500">Treats to Gift</div>
                                    </div>
                                </div>
                            )}

                            {userIsViewer && (
                                <div className="flex gap-6 mb-4">
                                    <div>
                                        <div className="text-2xl font-bold">{currentUser?.treatBalance || 0}</div>
                                        <div className="text-sm text-gray-500">Treats to Gift</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold">
                                            {currentUser?.followedCats?.length || 0}
                                        </div>
                                        <div className="text-sm text-gray-500">Following</div>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 flex-wrap">
                                {isCatOwner && (
                                    <>
                                        <button
                                            onClick={handleAddCatClick}
                                            className="bg-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700 transition flex items-center gap-2"
                                        >
                                            <PlusCircle size={18} />
                                            Add Cat
                                        </button>
                                        {cats.length > 0 && (
                                            <button
                                                onClick={() => setCurrentPage('upload')}
                                                className="bg-pink-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-pink-700 transition flex items-center gap-2"
                                            >
                                                <Camera size={18} />
                                                Upload Photo
                                            </button>
                                        )}
                                    </>
                                )}

                                {userIsViewer && (
                                    <button
                                        onClick={handleAddCatClick}
                                        className="bg-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700 transition flex items-center gap-2"
                                    >
                                        <PlusCircle size={18} />
                                        Add Your First Cat
                                    </button>
                                )}

                                <button
                                    onClick={() => signOut(auth)}
                                    className="bg-red-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-600 transition flex items-center gap-2"
                                >
                                    <LogOut size={18} />
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* User Shipping Address */}
            <AddressForm
                title="Your Shipping Address"
                helpText="Required if you want to redeem treats and have items shipped to you."
                address={userAddr}
                onChange={(field, value) => setUserAddr((prev) => ({ ...prev, [field]: value }))}
                onSave={saveUserAddress}
                saving={savingUserAddr}
            />

            {/* Shelter Shipping Address (only if verified shelter) */}
            {isVerifiedShelter && (
                <AddressForm
                    title="Shelter Shipping Address"
                    helpText="Required so supporters can redeem treats and ship them to your shelter."
                    address={shelterAddr}
                    onChange={(field, value) => setShelterAddr((prev) => ({ ...prev, [field]: value }))}
                    onSave={saveShelterAddress}
                    saving={savingShelterAddr}
                />
            )}

            {/* Cat Profiles Section */}
            {isCatOwner && cats.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <h3 className="text-xl font-bold mb-4">My Cats</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {cats.map((cat) => {
                            const catPosts = posts.filter((p) => p.catId === cat.id);
                            const progress = ((cat.treatsEarned || 0) / 500) * 100;

                            return (
                                <div key={cat.id} className="border border-gray-200 rounded-lg p-4">
                                    <div className="flex items-start gap-4 mb-4">
                                        <div className="w-16 h-16 bg-purple-200 rounded-full flex items-center justify-center text-3xl">
                                            {cat.avatar}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-lg">{cat.name}</h4>
                                            <p className="text-sm text-gray-600">{cat.bio}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                                        <div>
                                            <div className="text-xl font-bold">{catPosts.length}</div>
                                            <div className="text-xs text-gray-500">Posts</div>
                                        </div>
                                        <div>
                                            <div className="text-xl font-bold">{cat.treatsEarned || 0}</div>
                                            <div className="text-xs text-gray-500">Treats</div>
                                        </div>
                                        <div>
                                            <div className="text-xl font-bold">{cat.followers || 0}</div>
                                            <div className="text-xs text-gray-500">Followers</div>
                                        </div>
                                    </div>

                                    <div className="mb-2">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span>Progress to redemption</span>
                                            <span className="font-bold">{cat.treatsEarned || 0} / 500</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div
                                                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all"
                                                style={{ width: `${Math.min(progress, 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    {(cat.treatsEarned || 0) >= 500 && (
                                        <button
                                            onClick={() => onRedeem(cat)}
                                            className="w-full bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 transition text-sm"
                                        >
                                            Redeem Treats
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Stats Grid */}
            {isCatOwner && cats.length > 0 && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold">Total Treats</h3>
                                <Gift size={20} className="text-yellow-500" />
                            </div>
                            <div className="text-3xl font-bold text-yellow-600">{totalTreatsEarned}</div>
                            <p className="text-sm text-gray-500">From all cats</p>
                        </div>

                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold">Total Posts</h3>
                                <Camera size={20} className="text-purple-500" />
                            </div>
                            <div className="text-3xl font-bold text-purple-600">{userPosts.length}</div>
                            <p className="text-sm text-gray-500">All cats combined</p>
                        </div>

                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold">Engagement</h3>
                                <Heart size={20} className="text-red-500" />
                            </div>
                            <div className="text-3xl font-bold text-red-600">{totalLikes}</div>
                            <p className="text-sm text-gray-500">Total likes</p>
                        </div>
                    </div>

                    {/* Photo Grid */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h3 className="text-xl font-bold mb-4">My Photos</h3>
                        {userPosts.length === 0 ? (
                            <div className="text-center py-12">
                                <Camera size={48} className="mx-auto mb-4 text-gray-400" />
                                <p className="text-gray-500 mb-4">No photos yet</p>
                                <p className="text-sm text-gray-400">Start posting to see your photos here!</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                {userPosts.map((post) => (
                                    <div key={post.id} className="relative aspect-square group cursor-pointer">
                                        <img
                                            src={post.imageUrl}
                                            alt={post.caption}
                                            className="w-full h-full object-cover rounded-lg"
                                        />
                                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                                            <div className="text-white text-center">
                                                <div className="flex items-center justify-center gap-4">
                                                    <div className="flex items-center gap-1">
                                                        <Heart size={20} fill="white" />
                                                        <span>{post.likes || 0}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Gift size={20} />
                                                        <span>{post.treats || 0}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default ProfilePage;
