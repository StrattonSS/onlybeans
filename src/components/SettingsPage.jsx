import React, { useState, useEffect } from 'react';
import {
    LogOut,
    MapPin,
    Shield,
    CheckCircle,
    X as CloseIcon,
    User,
    Mail,
    Lock,
    Bell
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import {
    doc,
    setDoc,
    addDoc,
    collection,
    serverTimestamp,
} from 'firebase/firestore';

function AddressForm({ title, address, onChange, onSave, saving, helpText }) {
    return (
        <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center gap-2 mb-2">
                <MapPin size={18} className="text-purple-600" />
                <h3 className="text-lg font-bold">{title}</h3>
            </div>
            {helpText && <p className="text-sm text-gray-600 mb-4">{helpText}</p>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full name *</label>
                    <input
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        value={address.fullName || ''}
                        onChange={(e) => onChange('fullName', e.target.value)}
                        placeholder="e.g., Benjamin Stratton"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        value={address.phone || ''}
                        onChange={(e) => onChange('phone', e.target.value)}
                        placeholder="(555) 123-4567"
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1 *</label>
                    <input
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        value={address.address1 || ''}
                        onChange={(e) => onChange('address1', e.target.value)}
                        placeholder="123 Main St"
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                    <input
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        value={address.address2 || ''}
                        onChange={(e) => onChange('address2', e.target.value)}
                        placeholder="Apt 4B"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                    <input
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        value={address.city || ''}
                        onChange={(e) => onChange('city', e.target.value)}
                        placeholder="Flint"
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                        <input
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase"
                            value={address.state || ''}
                            onChange={(e) => onChange('state', e.target.value.toUpperCase())}
                            placeholder="MI"
                            maxLength={2}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ZIP *</label>
                        <input
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            value={address.zip || ''}
                            onChange={(e) => onChange('zip', e.target.value)}
                            placeholder="48502"
                            maxLength={5}
                        />
                    </div>
                </div>
            </div>

            <button
                onClick={onSave}
                disabled={saving}
                className={`w-full py-3 rounded-lg font-semibold transition ${
                    saving
                        ? 'bg-gray-400 cursor-not-allowed text-white'
                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
            >
                {saving ? 'Saving...' : 'Save Address'}
            </button>
        </div>
    );
}

function SettingsPage({ currentUser, refreshCurrentUser }) {
    const [userAddr, setUserAddr] = useState({
        fullName: '',
        address1: '',
        address2: '',
        city: '',
        state: '',
        zip: '',
        phone: ''
    });

    const [shelterAddr, setShelterAddr] = useState({
        fullName: '',
        address1: '',
        address2: '',
        city: '',
        state: '',
        zip: '',
        phone: ''
    });

    const [savingUserAddr, setSavingUserAddr] = useState(false);
    const [savingShelterAddr, setSavingShelterAddr] = useState(false);

    // Shelter verification state
    const [showShelterRequest, setShowShelterRequest] = useState(false);
    const [shelterName, setShelterName] = useState('');
    const [shelterLocation, setShelterLocation] = useState('');
    const [shelterWebsite, setShelterWebsite] = useState('');
    const [shelterDescription, setShelterDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);

    const isVerifiedShelter = currentUser?.verifiedShelter === true;
    const isCatOwner = currentUser?.accountType === 'feline';

    // Load addresses on mount
    useEffect(() => {
        if (currentUser?.shippingAddress) {
            setUserAddr(currentUser.shippingAddress);
        }
        if (currentUser?.shelterShippingAddress) {
            setShelterAddr(currentUser.shelterShippingAddress);
        }
    }, [currentUser]);

    // Save user shipping address
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
            alert('✅ Shipping address saved!');
        } catch (e) {
            console.error('Error saving shipping address', e);
            alert('❌ Could not save address. Try again.');
        } finally {
            setSavingUserAddr(false);
        }
    };

    // Save shelter shipping address
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
            alert('✅ Shelter shipping address saved!');
        } catch (e) {
            console.error('Error saving shelter shipping address', e);
            alert('❌ Could not save shelter address. Try again.');
        } finally {
            setSavingShelterAddr(false);
        }
    };

    // Handle shelter verification request
    const handleShelterRequest = async (e) => {
        e.preventDefault();
        if (!shelterName || !shelterLocation) {
            alert('Please fill in all required fields.');
            return;
        }

        setSubmitting(true);
        try {
            await addDoc(collection(db, 'shelterRequests'), {
                userId: currentUser.uid,
                userEmail: currentUser.email,
                shelterName,
                shelterLocation,
                shelterWebsite,
                shelterDescription,
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

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Settings</h1>
                <p className="text-gray-600">Manage your account settings and preferences</p>
            </div>

            {/* Account Information */}
            <div className="bg-white rounded-xl shadow p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <User size={20} className="text-purple-600" />
                    <h2 className="text-xl font-bold">Account Information</h2>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                        <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-800">
                            {currentUser?.displayName || 'Not set'}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                        <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-800">
                            @{currentUser?.username || 'Not set'}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-800 flex items-center gap-2">
                            <Mail size={16} className="text-gray-500" />
                            {currentUser?.email || 'Not set'}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                        <div className="px-4 py-3 bg-gray-50 rounded-lg">
                            {isVerifiedShelter && (
                                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium inline-flex items-center gap-1">
                                    <Shield size={14} />
                                    Verified Shelter
                                </span>
                            )}
                            {isCatOwner && !isVerifiedShelter && (
                                <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
                                    Cat Owner
                                </span>
                            )}
                            {!isCatOwner && !isVerifiedShelter && (
                                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                                    Viewer
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Shelter Verification Option */}
            {isCatOwner && !isVerifiedShelter && (
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 mb-6">
                    <div className="flex items-start gap-4">
                        <div className="text-4xl">🛡️</div>
                        <div className="flex-1">
                            <h3 className="font-bold text-lg mb-2">Are you an Animal Shelter?</h3>
                            <p className="text-sm text-gray-700 mb-4">
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
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-2xl font-bold">Apply for Shelter Verification</h3>
                                <button
                                    onClick={() => setShowShelterRequest(false)}
                                    className="text-gray-400 hover:text-gray-600"
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
                                        <strong>Note:</strong> You'll keep all your cat owner abilities and gain the ability to receive donations!
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1">Shelter Name *</label>
                                        <input
                                            type="text"
                                            value={shelterName}
                                            onChange={(e) => setShelterName(e.target.value)}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                            placeholder="Flint Animal Shelter"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1">Location *</label>
                                        <input
                                            type="text"
                                            value={shelterLocation}
                                            onChange={(e) => setShelterLocation(e.target.value)}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                            placeholder="Flint, Michigan"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1">Website (optional)</label>
                                        <input
                                            type="url"
                                            value={shelterWebsite}
                                            onChange={(e) => setShelterWebsite(e.target.value)}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                            placeholder="https://yourshelter.org"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1">Tell us about your shelter</label>
                                        <textarea
                                            value={shelterDescription}
                                            onChange={(e) => setShelterDescription(e.target.value)}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                            rows={4}
                                            placeholder="Brief description of your shelter and its mission..."
                                        />
                                    </div>

                                    <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
                                        We may contact you for additional verification.
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

            {/* Shipping Addresses */}
            <div className="space-y-6 mb-6">
                <AddressForm
                    title="Your Shipping Address"
                    helpText="Required if you want to redeem treats and have items shipped to you."
                    address={userAddr}
                    onChange={(field, value) => setUserAddr((prev) => ({ ...prev, [field]: value }))}
                    onSave={saveUserAddress}
                    saving={savingUserAddr}
                />

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
            </div>

            {/* Danger Zone */}
            <div className="bg-white rounded-xl shadow p-6 border-2 border-red-200">
                <h2 className="text-xl font-bold text-red-600 mb-4">Danger Zone</h2>
                <p className="text-gray-600 mb-4">
                    Once you sign out, you'll need to log back in with your credentials.
                </p>
                <button
                    onClick={() => signOut(auth)}
                    className="bg-red-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-600 transition flex items-center gap-2"
                >
                    <LogOut size={18} />
                    Sign Out
                </button>
            </div>
        </div>
    );
}

export default SettingsPage;