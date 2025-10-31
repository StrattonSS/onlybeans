import React, { useMemo, useState } from 'react';
import { X, MapPin, Building2 } from 'lucide-react';
import {
    collection,
    addDoc,
    doc,
    updateDoc,
    increment,
    serverTimestamp,
    getDoc
} from 'firebase/firestore';
import { db } from '../../firebase';

const REDEEM_COST = 500;

function RedemptionModal({
                             currentUser,
                             selectedCat,
                             users,
                             setShowRedemption,
                             loadUserCats,
                             refreshCurrentUser
                         }) {
    const [redemptionType, setRedemptionType] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [notes, setNotes] = useState('');

    // SHIPPING — self
    const [shippingInfo, setShippingInfo] = useState({
        fullName: currentUser?.displayName || currentUser?.username || '',
        address1: '',
        address2: '',
        city: '',
        state: '',
        zip: '',
        phone: ''
    });

    // DONATE — shelter selection + (fallback) address capture
    const [selectedShelter, setSelectedShelter] = useState('');
    const [shelterAddressOverride, setShelterAddressOverride] = useState({
        fullName: '',
        address1: '',
        address2: '',
        city: '',
        state: '',
        zip: '',
        phone: ''
    });
    const [requireShelterAddress, setRequireShelterAddress] = useState(false);

    const verifiedShelters = useMemo(
        () => users.filter(u => u.verifiedShelter === true),
        [users]
    );
    const fallbackShelters = useMemo(
        () => users.filter(u => u.accountType === 'shelter'),
        [users]
    );
    const shelters = verifiedShelters.length ? verifiedShelters : fallbackShelters;

    const hasEnoughTreats = useMemo(() => {
        if (currentUser?.accountType === 'feline' && selectedCat) {
            return (selectedCat?.treatsEarned || 0) >= REDEEM_COST;
        }
        return (currentUser?.treatsEarned || 0) >= REDEEM_COST;
    }, [currentUser, selectedCat]);

    const onChangeShip = (patch) =>
        setShippingInfo(prev => ({ ...prev, ...patch }));

    const onChangeShelterShip = (patch) =>
        setShelterAddressOverride(prev => ({ ...prev, ...patch }));

    const validateUSAddress = ({ fullName, address1, city, state, zip }) => {
        if (!fullName || !address1 || !city || !state || !zip) return false;
        if (String(state).trim().length !== 2) return false;
        if (!/^\d{5}$/.test(String(zip).trim())) return false;
        return true;
    };

    const fetchCatName = async (catId) => {
        try {
            if (!catId) return '';
            const snap = await getDoc(doc(db, 'cats', catId));
            return snap.exists() ? snap.data()?.name || '' : '';
        } catch {
            return '';
        }
    };

    const commonRedemptionPayload = async ({ type, extra = {} }) => {
        const catName = await fetchCatName(selectedCat?.id);
        return {
            status: 'pending',
            type, // 'ship' | 'donate'
            userId: currentUser.uid,
            username: currentUser.username || currentUser.displayName || '',
            userEmail: currentUser.email || '',
            catId: selectedCat?.id || null,
            catName: catName || selectedCat?.name || '',
            treatsRedeemed: REDEEM_COST,
            rewardName: type === 'ship' ? 'OnlyBeans Prize' : 'Treat Redemption',
            notes: notes || '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            ...extra
        };
    };

    const afterSuccess = async () => {
        // Deduct treats from source
        if (currentUser.accountType === 'feline' && selectedCat?.id) {
            await updateDoc(doc(db, 'cats', selectedCat.id), {
                treatsEarned: increment(-REDEEM_COST)
            });
            await loadUserCats(currentUser.uid);
        } else {
            await updateDoc(doc(db, 'users', currentUser.uid), {
                treatsEarned: increment(-REDEEM_COST)
            });
            await refreshCurrentUser();
        }
        setShowRedemption(false);
    };

    const handleShipToMe = async () => {
        if (!hasEnoughTreats) {
            alert(`Not enough treats. You need ${REDEEM_COST}.`);
            return;
        }
        if (!validateUSAddress(shippingInfo)) {
            alert('Please complete a valid US shipping address (2-letter state, 5-digit ZIP).');
            return;
        }

        setSubmitting(true);
        try {
            const payload = await commonRedemptionPayload({
                type: 'ship',
                extra: {
                    shippingAddress: {
                        fullName: shippingInfo.fullName.trim(),
                        address1: shippingInfo.address1.trim(),
                        address2: shippingInfo.address2.trim(),
                        city: shippingInfo.city.trim(),
                        state: shippingInfo.state.toUpperCase().trim(),
                        zip: shippingInfo.zip.trim(),
                        phone: (shippingInfo.phone || '').trim()
                    }
                }
            });

            await addDoc(collection(db, 'redemptions'), payload);
            await afterSuccess();
            alert("🎉 Redemption submitted! We'll ship your treats within 5–7 business days.");
        } catch (error) {
            console.error('Error redeeming:', error);
            alert('Error processing redemption. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDonate = async () => {
        if (!hasEnoughTreats) {
            alert(`Not enough treats. You need ${REDEEM_COST}.`);
            return;
        }
        if (!selectedShelter) {
            alert('Please select a shelter.');
            return;
        }

        setSubmitting(true);
        try {
            // Pull shelter user doc to get shipping
            const shelterSnap = await getDoc(doc(db, 'users', selectedShelter));
            const shelterDoc = shelterSnap.exists() ? shelterSnap.data() : null;
            const shelterBase = users.find(u => u.id === selectedShelter) || {};
            const shelterAddress = shelterDoc?.shippingAddress;

            let effectiveAddress = shelterAddress || null;

            // If no stored address, require a one-time address for this redemption
            if (!effectiveAddress) {
                setRequireShelterAddress(true);
                setSubmitting(false);
                return;
            }

            const payload = await commonRedemptionPayload({
                type: 'donate',
                extra: {
                    shelterId: selectedShelter,
                    shelterName: shelterBase.displayName || shelterBase.username || shelterDoc?.shelterName || 'Shelter',
                    shelterEmail: shelterBase.email || shelterDoc?.email || '',
                    shippingAddress: {
                        // snapshot shelter address at time of redemption
                        fullName: effectiveAddress.fullName || shelterBase.displayName || 'Receiving Shelter',
                        address1: effectiveAddress.address1,
                        address2: effectiveAddress.address2 || '',
                        city: effectiveAddress.city,
                        state: effectiveAddress.state,
                        zip: effectiveAddress.zip,
                        phone: effectiveAddress.phone || ''
                    }
                }
            });

            await addDoc(collection(db, 'redemptions'), payload);

            // If donations are virtual balance to shelter, keep; otherwise remove:
            await updateDoc(doc(db, 'users', selectedShelter), {
                treatsReceived: increment(REDEEM_COST)
            });

            await afterSuccess();
            alert('🎉 Thank you! Your 500 treats have been donated to the selected shelter.');
        } catch (error) {
            console.error('Error donating:', error);
            alert('Error processing donation. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDonateWithOneTimeAddress = async () => {
        if (!validateUSAddress(shelterAddressOverride)) {
            alert('Please complete a valid US shipping address for the shelter (2-letter state, 5-digit ZIP).');
            return;
        }
        setSubmitting(true);
        try {
            const shelterBase = users.find(u => u.id === selectedShelter) || {};
            const payload = await commonRedemptionPayload({
                type: 'donate',
                extra: {
                    shelterId: selectedShelter,
                    shelterName: shelterBase.displayName || shelterBase.username || 'Shelter',
                    shelterEmail: shelterBase.email || '',
                    shippingAddress: {
                        fullName: shelterAddressOverride.fullName.trim(),
                        address1: shelterAddressOverride.address1.trim(),
                        address2: (shelterAddressOverride.address2 || '').trim(),
                        city: shelterAddressOverride.city.trim(),
                        state: shelterAddressOverride.state.toUpperCase().trim(),
                        zip: shelterAddressOverride.zip.trim(),
                        phone: (shelterAddressOverride.phone || '').trim()
                    }
                }
            });

            await addDoc(collection(db, 'redemptions'), payload);
            await updateDoc(doc(db, 'users', selectedShelter), { treatsReceived: increment(REDEEM_COST) });
            await afterSuccess();
            alert('🎉 Donation submitted! We captured the shelter’s shipping address for this redemption.');
        } catch (e) {
            console.error(e);
            alert('Could not submit donation. Try again.');
        } finally {
            setSubmitting(false);
            setRequireShelterAddress(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-purple-600">Redeem Your Treats 🎁</h2>
                        <button
                            onClick={() => !submitting && setShowRedemption(false)}
                            className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
                            disabled={submitting}
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {!redemptionType ? (
                        <div className="space-y-4">
                            <p className="text-gray-600 mb-6">
                                You&apos;ve earned {REDEEM_COST} treats! Choose how you&apos;d like to redeem them:
                            </p>

                            <button
                                onClick={() => setRedemptionType('ship')}
                                className="w-full border-2 border-purple-200 rounded-xl p-6 hover:border-purple-500 hover:bg-purple-50 transition text-left"
                            >
                                <div className="flex items-start gap-4">
                                    <MapPin size={32} className="text-purple-600 flex-shrink-0" />
                                    <div>
                                        <h3 className="font-bold text-lg mb-2">Ship to Me 📦</h3>
                                        <p className="text-gray-600 text-sm">Shipped directly to your door (US only).</p>
                                    </div>
                                </div>
                            </button>

                            <button
                                onClick={() => setRedemptionType('donate')}
                                className="w-full border-2 border-green-200 rounded-xl p-6 hover:border-green-500 hover:bg-green-50 transition text-left"
                            >
                                <div className="flex items-start gap-4">
                                    <Building2 size={32} className="text-green-600 flex-shrink-0" />
                                    <div>
                                        <h3 className="font-bold text-lg mb-2">Donate to Shelter 💚</h3>
                                        <p className="text-gray-600 text-sm">We’ll send treats to a verified shelter.</p>
                                    </div>
                                </div>
                            </button>
                        </div>
                    ) : redemptionType === 'ship' ? (
                        <div>
                            <button
                                onClick={() => setRedemptionType(null)}
                                className="text-purple-600 hover:text-purple-700 mb-4 flex items-center gap-2"
                                disabled={submitting}
                            >
                                ← Back
                            </button>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                                    <input
                                        type="text"
                                        value={shippingInfo.fullName}
                                        onChange={(e) => onChangeShip({ fullName: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                        placeholder="Jane Doe"
                                        disabled={submitting}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Address Line 1 *</label>
                                    <input
                                        type="text"
                                        value={shippingInfo.address1}
                                        onChange={(e) => onChangeShip({ address1: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                        placeholder="123 Main St"
                                        disabled={submitting}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Address Line 2</label>
                                    <input
                                        type="text"
                                        value={shippingInfo.address2}
                                        onChange={(e) => onChangeShip({ address2: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                        placeholder="Apt 4B"
                                        disabled={submitting}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">City *</label>
                                        <input
                                            type="text"
                                            value={shippingInfo.city}
                                            onChange={(e) => onChangeShip({ city: e.target.value })}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                            placeholder="Flint"
                                            disabled={submitting}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">State *</label>
                                        <input
                                            type="text"
                                            value={shippingInfo.state}
                                            onChange={(e) => onChangeShip({ state: e.target.value.toUpperCase() })}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                            placeholder="MI"
                                            maxLength={2}
                                            disabled={submitting}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">ZIP Code *</label>
                                        <input
                                            type="text"
                                            value={shippingInfo.zip}
                                            onChange={(e) => {
                                                const v = e.target.value.replace(/\D/g, '').slice(0, 5);
                                                onChangeShip({ zip: v });
                                            }}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                            placeholder="48502"
                                            inputMode="numeric"
                                            disabled={submitting}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone (optional)</label>
                                    <input
                                        type="tel"
                                        value={shippingInfo.phone}
                                        onChange={(e) => onChangeShip({ phone: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                        placeholder="(810) 555-0123"
                                        disabled={submitting}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
                                    <textarea
                                        rows={2}
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                        placeholder="Gate code, delivery instructions, etc."
                                        disabled={submitting}
                                    />
                                </div>

                                <button
                                    onClick={handleShipToMe}
                                    disabled={submitting}
                                    className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-60"
                                >
                                    {submitting ? 'Submitting…' : `Confirm & Redeem (${REDEEM_COST} treats)`}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <button
                                onClick={() => setRedemptionType(null)}
                                className="text-green-600 hover:text-green-700 mb-4 flex items-center gap-2"
                                disabled={submitting}
                            >
                                ← Back
                            </button>

                            {requireShelterAddress ? (
                                <>
                                    <p className="text-gray-600 mb-4">
                                        This shelter doesn&apos;t have a shipping address on file. Enter a one-time address for this donation:
                                    </p>

                                    <div className="space-y-4 mb-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Recipient Name *</label>
                                            <input
                                                type="text"
                                                value={shelterAddressOverride.fullName}
                                                onChange={(e) => onChangeShelterShip({ fullName: e.target.value })}
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                                                placeholder="Happy Paws Shelter"
                                                disabled={submitting}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Address Line 1 *</label>
                                            <input
                                                type="text"
                                                value={shelterAddressOverride.address1}
                                                onChange={(e) => onChangeShelterShip({ address1: e.target.value })}
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                                                placeholder="456 Rescue Rd"
                                                disabled={submitting}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Address Line 2</label>
                                            <input
                                                type="text"
                                                value={shelterAddressOverride.address2}
                                                onChange={(e) => onChangeShelterShip({ address2: e.target.value })}
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                                                placeholder="Suite 12"
                                                disabled={submitting}
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">City *</label>
                                                <input
                                                    type="text"
                                                    value={shelterAddressOverride.city}
                                                    onChange={(e) => onChangeShelterShip({ city: e.target.value })}
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                                                    placeholder="Flint"
                                                    disabled={submitting}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">State *</label>
                                                <input
                                                    type="text"
                                                    value={shelterAddressOverride.state}
                                                    onChange={(e) => onChangeShelterShip({ state: e.target.value.toUpperCase() })}
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                                                    placeholder="MI"
                                                    maxLength={2}
                                                    disabled={submitting}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">ZIP Code *</label>
                                                <input
                                                    type="text"
                                                    value={shelterAddressOverride.zip}
                                                    onChange={(e) => {
                                                        const v = e.target.value.replace(/\D/g, '').slice(0, 5);
                                                        onChangeShelterShip({ zip: v });
                                                    }}
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                                                    placeholder="48502"
                                                    inputMode="numeric"
                                                    disabled={submitting}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Phone (optional)</label>
                                            <input
                                                type="tel"
                                                value={shelterAddressOverride.phone}
                                                onChange={(e) => onChangeShelterShip({ phone: e.target.value })}
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                                                placeholder="(810) 555-0199"
                                                disabled={submitting}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
                                            <textarea
                                                rows={2}
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                                                placeholder="Any message for the shelter"
                                                disabled={submitting}
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleDonateWithOneTimeAddress}
                                        disabled={submitting}
                                        className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-60"
                                    >
                                        {submitting ? 'Submitting…' : `Donate ${REDEEM_COST} Treats`}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <p className="text-gray-600 mb-6">
                                        Select an animal shelter to receive your donated cat treats:
                                    </p>

                                    {shelters.length === 0 ? (
                                        <p className="text-center text-gray-500 py-8">No shelters registered yet.</p>
                                    ) : (
                                        <div className="space-y-3 mb-6">
                                            {shelters.map(shelter => (
                                                <button
                                                    key={shelter.id}
                                                    onClick={() => setSelectedShelter(shelter.id)}
                                                    disabled={submitting}
                                                    className={`w-full border-2 rounded-lg p-4 text-left transition ${
                                                        selectedShelter === shelter.id
                                                            ? 'border-green-500 bg-green-50'
                                                            : 'border-gray-200 hover:border-green-300'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <h4 className="font-semibold">
                                                                {shelter.displayName || shelter.username || 'Shelter'}
                                                            </h4>
                                                            <p className="text-sm text-gray-500">
                                                                {shelter.shelterName || shelter.bio || 'Animal Shelter'}
                                                            </p>
                                                        </div>
                                                        {selectedShelter === shelter.id && (
                                                            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white">
                                                                ✓
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
                                            <textarea
                                                rows={2}
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                                                placeholder="Any message for the shelter"
                                                disabled={submitting}
                                            />
                                        </div>

                                        <button
                                            onClick={handleDonate}
                                            disabled={!selectedShelter || submitting}
                                            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                                        >
                                            {submitting ? 'Submitting…' : `Donate ${REDEEM_COST} Treats`}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default RedemptionModal;
