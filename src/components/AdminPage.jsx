import React, { useState, useEffect } from 'react';
import {
    Users, Bug, Shield, Activity, CheckCircle, XCircle, Ban, UserX, Package, Truck
} from 'lucide-react';
import {
    collection, getDocs, getDoc, doc, updateDoc, deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';

function AdminPage({ currentUser }) {
    const [activeTab, setActiveTab] = useState('bugs');
    const [bugReports, setBugReports] = useState([]);
    const [shelterRequests, setShelterRequests] = useState([]);
    const [users, setUsers] = useState([]);
    const [redemptions, setRedemptions] = useState([]);

    const [stats, setStats] = useState({
        totalUsers: 0,
        catOwners: 0,
        viewers: 0,
        shelters: 0,
        pendingBugs: 0,
        pendingShelterRequests: 0,
        pendingRedemptions: 0,
    });

    const [loading, setLoading] = useState(true);

    // Gate
    if (!currentUser?.isAdmin) {
        return (
            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-lg shadow p-12 text-center">
                    <div className="text-6xl mb-4">🚫</div>
                    <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
                    <p className="text-gray-600">You don't have permission to view this page.</p>
                </div>
            </div>
        );
    }

    useEffect(() => {
        loadAllData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadAllData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                loadBugReports(),
                loadShelterRequests(),
                loadUsers(),
                loadRedemptions(),
            ]);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    // ----- Loaders -----
    const loadBugReports = async () => {
        try {
            const snap = await getDocs(collection(db, 'bugReports'));
            const reports = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setBugReports(reports);
            setStats(prev => ({ ...prev, pendingBugs: reports.filter(r => r.status === 'pending').length }));
        } catch (e) {
            console.error('Error loading bug reports:', e);
        }
    };

    const loadShelterRequests = async () => {
        try {
            const snap = await getDocs(collection(db, 'shelterRequests'));
            const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setShelterRequests(requests);
            setStats(prev => ({
                ...prev,
                pendingShelterRequests: requests.filter(r => r.status === 'pending').length
            }));
        } catch (e) {
            console.error('Error loading shelter requests:', e);
        }
    };

    const loadUsers = async () => {
        try {
            const snap = await getDocs(collection(db, 'users'));
            const usersData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setUsers(usersData);

            const catOwners = usersData.filter(u => u.accountType === 'feline').length;
            const viewers = usersData.filter(u => u.accountType !== 'feline').length;
            const shelters = usersData.filter(u => u.verifiedShelter === true).length;

            setStats(prev => ({
                ...prev,
                totalUsers: usersData.length,
                catOwners,
                viewers,
                shelters
            }));
        } catch (e) {
            console.error('Error loading users:', e);
        }
    };

    const loadRedemptions = async () => {
        try {
            const snap = await getDocs(collection(db, 'redemptions'));
            let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Enrich each redemption with user/shelter display info.
            // If it's a donation and shippingAddress is missing, derive it from the shelter's user record.
            items = await Promise.all(items.map(async (r) => {
                let enriched = { ...r };

                // Attach user display fields (if available)
                if (r.userId) {
                    try {
                        const u = await getDoc(doc(db, 'users', r.userId));
                        if (u.exists()) {
                            const ud = u.data();
                            enriched.username = enriched.username || ud.username || ud.displayName || '';
                            enriched.userEmail = enriched.userEmail || ud.email || '';
                        }
                    } catch (e) {
                        console.warn('Could not enrich redemption user:', r.userId, e);
                    }
                }

                // If donation to shelter, attach shelter display + derive address if none on the redemption
                if (r.type === 'donate' && r.shelterId) {
                    try {
                        const s = await getDoc(doc(db, 'users', r.shelterId));
                        if (s.exists()) {
                            const sd = s.data();
                            enriched.shelterName = sd.shelterName || sd.displayName || sd.username || r.shelterId;
                            // Derive a displayable address if redemption didn't store one
                            if (!r.shippingAddress && sd.shippingAddress) {
                                enriched.derivedShippingAddress = sd.shippingAddress;
                            }
                        }
                    } catch (e) {
                        console.warn('Could not enrich donation shelter:', r.shelterId, e);
                    }
                }

                // friendly reward/treat fields
                enriched._treats = r.treats ?? r.treatsRedeemed ?? 0;
                enriched._rewardName =
                    r.rewardName ||
                    (r.type === 'donate' ? 'Shelter Donation' : 'Treat Redemption');

                return enriched;
            }));

            // newest first
            items.sort((a, b) => {
                const ta = a.createdAt?.toDate?.()?.getTime?.() ?? 0;
                const tb = b.createdAt?.toDate?.()?.getTime?.() ?? 0;
                return tb - ta;
            });

            setRedemptions(items);
            setStats(prev => ({
                ...prev,
                pendingRedemptions: items.filter(r => r.status === 'pending').length
            }));
        } catch (e) {
            console.error('Error loading redemptions:', e);
        }
    };

    // ----- Bug actions -----
    const handleResolveBug = async (bugId, resolution) => {
        try {
            await updateDoc(doc(db, 'bugReports', bugId), {
                status: 'resolved',
                resolution: resolution,
                resolvedBy: currentUser.uid,
                resolvedAt: new Date()
            });
            await loadBugReports();
            alert('Bug report marked as resolved!');
        } catch (error) {
            console.error('Error resolving bug:', error);
            alert('Error resolving bug report.');
        }
    };

    const handleDeleteBug = async (bugId) => {
        if (!window.confirm('Are you sure you want to delete this bug report?')) return;
        try {
            await deleteDoc(doc(db, 'bugReports', bugId));
            await loadBugReports();
            alert('Bug report deleted!');
        } catch (error) {
            console.error('Error deleting bug:', error);
            alert('Error deleting bug report.');
        }
    };

    // ----- Shelter actions -----
    const handleApproveShelter = async (request) => {
        try {
            // Persist all verified-shelter profile fields, INCLUDING shippingAddress (new)
            await updateDoc(doc(db, 'users', request.userId), {
                verifiedShelter: true,
                shelterName: request.shelterName,
                shelterLocation: request.location,
                shelterWebsite: request.website,
                shelterDescription: request.description,
                ...(request.shippingAddress ? { shippingAddress: request.shippingAddress } : {})
            });

            await updateDoc(doc(db, 'shelterRequests', request.id), {
                status: 'approved',
                approvedBy: currentUser.uid,
                approvedAt: new Date()
            });

            await loadShelterRequests();
            await loadUsers();
            alert('Shelter verified successfully!');
        } catch (error) {
            console.error('Error approving shelter:', error);
            alert('Error approving shelter request.');
        }
    };

    const handleRejectShelter = async (requestId, reason) => {
        try {
            await updateDoc(doc(db, 'shelterRequests', requestId), {
                status: 'rejected',
                rejectedBy: currentUser.uid,
                rejectedAt: new Date(),
                rejectionReason: reason
            });
            await loadShelterRequests();
            alert('Shelter request rejected.');
        } catch (error) {
            console.error('Error rejecting shelter:', error);
            alert('Error rejecting shelter request.');
        }
    };

    // ----- User actions -----
    const handleBanUser = async (userId, username) => {
        const reason = window.prompt(`Enter reason for banning ${username}:`);
        if (!reason) return;
        if (!window.confirm(`Ban ${username}?`)) return;

        try {
            await updateDoc(doc(db, 'users', userId), {
                banned: true,
                bannedReason: reason,
                bannedBy: currentUser.uid,
                bannedAt: new Date()
            });
            await loadUsers();
            alert(`${username} has been banned.`);
        } catch (error) {
            console.error('Error banning user:', error);
            alert('Error banning user.');
        }
    };

    const handleUnbanUser = async (userId, username) => {
        if (!window.confirm(`Unban ${username}?`)) return;
        try {
            await updateDoc(doc(db, 'users', userId), {
                banned: false,
                unbannedBy: currentUser.uid,
                unbannedAt: new Date()
            });
            await loadUsers();
            alert(`${username} has been unbanned.`);
        } catch (error) {
            console.error('Error unbanning user:', error);
            alert('Error unbanning user.');
        }
    };

    // ----- Redemption actions -----
    const approveRedemption = async (r) => {
        try {
            await updateDoc(doc(db, 'redemptions', r.id), {
                status: 'processing',
                approvedBy: currentUser.uid,
                approvedAt: new Date(),
                updatedAt: new Date(),
            });
            await loadRedemptions();
            alert('Redemption approved and moved to Processing.');
        } catch (e) {
            console.error('Error approving redemption:', e);
            alert('Error approving redemption.');
        }
    };

    const markRedemptionShipped = async (r) => {
        const trackingNumber = window.prompt('Enter tracking number (optional):') || '';
        try {
            await updateDoc(doc(db, 'redemptions', r.id), {
                status: 'shipped',
                shippedBy: currentUser.uid,
                shippedAt: new Date(),
                trackingNumber,
                updatedAt: new Date(),
            });
            await loadRedemptions();
            alert('Marked as Shipped.');
        } catch (e) {
            console.error('Error marking shipped:', e);
            alert('Error marking shipped.');
        }
    };

    const rejectRedemption = async (r) => {
        const reason = window.prompt('Enter rejection reason:');
        if (!reason) return;
        try {
            await updateDoc(doc(db, 'redemptions', r.id), {
                status: 'rejected',
                rejectedBy: currentUser.uid,
                rejectedAt: new Date(),
                rejectionReason: reason,
                updatedAt: new Date(),
            });
            await loadRedemptions();
            alert('Redemption rejected.');
        } catch (e) {
            console.error('Error rejecting redemption:', e);
            alert('Error rejecting redemption.');
        }
    };

    const saveRedemptionNotes = async (id, notes) => {
        try {
            await updateDoc(doc(db, 'redemptions', id), {
                notes: notes || '',
                updatedAt: new Date(),
            });
        } catch (e) {
            console.error('Error saving notes:', e);
            alert('Could not save notes.');
        }
    };

    // ----- UI helpers -----
    const pendingBugs = bugReports.filter(r => r.status === 'pending');
    const resolvedBugs = bugReports.filter(r => r.status === 'resolved');
    const pendingShelterRequests = shelterRequests.filter(r => r.status === 'pending');

    const byStatus = (status) => redemptions.filter(r => r.status === status);

    // Address renderer that supports BOTH schemas:
    // - User self-redeem (name/address/city/state/zip[/phone])
    // - Shelter/user shippingAddress (name/street/city/state/zip[/phone])
    // - Legacy schema (fullName/address1/address2/city/state/zip)
    const AddressBlock = ({ addr }) => {
        if (!addr) return <p className="text-sm text-gray-500 italic">No address provided</p>;

        // Normalize keys
        const fullName = addr.fullName || addr.name || addr.recipient || '';
        const line1 = addr.address1 || addr.street || addr.address || '';
        const line2 = addr.address2 || '';
        const city = addr.city || '';
        const state = addr.state || '';
        const zip = addr.zip || addr.postalCode || '';
        const phone = addr.phone || '';

        if (!fullName && !line1 && !city && !state && !zip) {
            return <p className="text-sm text-gray-500 italic">No address provided</p>;
        }

        return (
            <div className="text-sm text-gray-700 leading-5">
                {fullName ? <div className="font-semibold">{fullName}</div> : null}
                {line1 ? <div>{line1}</div> : null}
                {line2 ? <div>{line2}</div> : null}
                {(city || state || zip) ? <div>{city}{city && (state || zip) ? ',' : ''} {state} {zip}</div> : null}
                {phone ? <div className="text-gray-500">📞 {phone}</div> : null}
            </div>
        );
    };

    const RedemptionCard = ({ r }) => {
        const [localNotes, setLocalNotes] = useState(r.notes || '');
        const displayAddress = r.shippingAddress || r.derivedShippingAddress || null;

        return (
            <div
                key={r.id}
                className={`border-2 rounded-lg p-4 ${
                    r.status === 'pending'
                        ? 'border-yellow-200 bg-yellow-50'
                        : r.status === 'processing'
                            ? 'border-blue-200 bg-blue-50'
                            : r.status === 'shipped'
                                ? 'border-green-200 bg-green-50'
                                : 'border-red-200 bg-red-50'
                }`}
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <Package size={18} className="text-purple-600" />
                            <h4 className="font-bold">
                                {r._rewardName} • {r._treats} treats
                            </h4>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">
                            Requested: {r.createdAt?.toDate?.()?.toLocaleString() || 'Recently'}
                        </p>

                        <div className="grid md:grid-cols-3 gap-4">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">User</p>
                                <div className="text-sm">
                                    <div className="font-semibold">{r.username || r.userEmail || r.userId}</div>
                                    {r.userEmail && <div className="text-gray-600">{r.userEmail}</div>}
                                </div>
                            </div>

                            <div>
                                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Cat</p>
                                <div className="text-sm">
                                    <div className="font-semibold">{r.catName || r.catId || '—'}</div>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Status</p>
                                <div>
                  <span
                      className={`text-xs px-2 py-1 rounded-full font-semibold ${
                          r.status === 'pending' ? 'bg-yellow-500 text-white'
                              : r.status === 'processing' ? 'bg-blue-500 text-white'
                                  : r.status === 'shipped' ? 'bg-green-600 text-white'
                                      : 'bg-red-600 text-white'
                      }`}
                  >
                    {r.status}
                  </span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 grid md:grid-cols-2 gap-4">
                            <div>
                                <div className="flex items-center justify-between">
                                    <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Shipping Address</p>
                                    {r.type === 'donate' && r.shelterName && (
                                        <span className="text-xs text-gray-600 italic">Destination: {r.shelterName}</span>
                                    )}
                                </div>
                                <div className="rounded-lg border bg-white p-3">
                                    <AddressBlock addr={displayAddress} />
                                </div>
                            </div>

                            <div>
                                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Notes</p>
                                <div className="rounded-lg border bg-white p-2">
                  <textarea
                      className="w-full text-sm p-2 outline-none"
                      rows={3}
                      value={localNotes}
                      onChange={(e) => setLocalNotes(e.target.value)}
                      onBlur={() => saveRedemptionNotes(r.id, localNotes)}
                      placeholder="Internal processing notes..."
                  />
                                </div>
                            </div>
                        </div>

                        {r.trackingNumber && (
                            <div className="mt-3 text-sm text-gray-700">
                                <span className="font-semibold">Tracking:</span> {r.trackingNumber}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 min-w-[180px]">
                        {r.status === 'pending' && (
                            <>
                                <button
                                    onClick={() => approveRedemption(r)}
                                    className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition text-sm flex items-center gap-2"
                                >
                                    <CheckCircle size={16} /> Approve → Processing
                                </button>
                                <button
                                    onClick={() => rejectRedemption(r)}
                                    className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition text-sm flex items-center gap-2"
                                >
                                    <XCircle size={16} /> Reject
                                </button>
                            </>
                        )}

                        {r.status === 'processing' && (
                            <button
                                onClick={() => markRedemptionShipped(r)}
                                className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition text-sm flex items-center gap-2"
                            >
                                <Truck size={16} /> Mark Shipped
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto text-center py-12">
                <div className="text-4xl mb-4">⏳</div>
                <p className="text-gray-600">Loading admin data...</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto">
            <div className="mb-8">
                <h2 className="text-3xl font-bold mb-2">Admin Dashboard</h2>
                <p className="text-gray-600">Manage OnlyBeans platform</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-700">Total Users</h3>
                        <Users size={24} className="text-purple-500" />
                    </div>
                    <div className="text-3xl font-bold text-purple-600 mb-1">{stats.totalUsers}</div>
                    <p className="text-sm text-gray-500">{stats.catOwners} cat owners</p>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-700">Pending Bugs</h3>
                        <Bug size={24} className="text-red-500" />
                    </div>
                    <div className="text-3xl font-bold text-red-600 mb-1">{stats.pendingBugs}</div>
                    <p className="text-sm text-gray-500">{bugReports.length} total reports</p>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-700">Shelter Requests</h3>
                        <Shield size={24} className="text-green-500" />
                    </div>
                    <div className="text-3xl font-bold text-green-600 mb-1">{stats.pendingShelterRequests}</div>
                    <p className="text-sm text-gray-500">{shelterRequests.length} total requests</p>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-700">Platform Health</h3>
                        <Activity size={24} className="text-blue-500" />
                    </div>
                    <div className="text-4xl mb-1">✅</div>
                    <p className="text-sm text-gray-500">All clear!</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-lg shadow">
                <div className="border-b border-gray-200">
                    <div className="flex flex-wrap">
                        <button
                            onClick={() => setActiveTab('bugs')}
                            className={`flex items-center gap-2 px-6 py-4 font-semibold transition ${
                                activeTab === 'bugs' ? 'border-b-2 border-purple-500 text-purple-600' : 'text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            <Bug size={20} /> Bug Reports ({bugReports.filter(b => b.status === 'pending').length})
                        </button>

                        <button
                            onClick={() => setActiveTab('shelters')}
                            className={`flex items-center gap-2 px-6 py-4 font-semibold transition ${
                                activeTab === 'shelters' ? 'border-b-2 border-purple-500 text-purple-600' : 'text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            <Shield size={20} /> Shelter Requests ({shelterRequests.filter(r => r.status === 'pending').length})
                        </button>

                        <button
                            onClick={() => setActiveTab('redemptions')}
                            className={`flex items-center gap-2 px-6 py-4 font-semibold transition ${
                                activeTab === 'redemptions' ? 'border-b-2 border-purple-500 text-purple-600' : 'text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            <Package size={20} /> Redemptions ({stats.pendingRedemptions})
                        </button>

                        <button
                            onClick={() => setActiveTab('users')}
                            className={`flex items-center gap-2 px-6 py-4 font-semibold transition ${
                                activeTab === 'users' ? 'border-b-2 border-purple-500 text-purple-600' : 'text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            <Users size={20} /> User Management
                        </button>
                    </div>
                </div>

                <div className="p-6">
                    {/* BUGS */}
                    {activeTab === 'bugs' && (
                        <div>
                            {bugReports.length === 0 ? (
                                <div className="text-center py-12">
                                    <Bug size={48} className="mx-auto mb-4 text-gray-400" />
                                    <p className="text-gray-500">No bug reports yet!</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Pending */}
                                    {pendingBugs.length > 0 && (
                                        <>
                                            <h3 className="font-bold text-lg mb-3">Pending Reports</h3>
                                            {pendingBugs.map(report => (
                                                <div key={report.id} className="border-2 border-red-200 rounded-lg p-4 bg-red-50">
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div className="flex items-start gap-3">
                                                            <Bug size={20} className="text-red-600 mt-1" />
                                                            <div>
                                                                <h4 className="font-bold text-lg">{report.title}</h4>
                                                                <p className="text-sm text-gray-600">By: {report.username} ({report.email})</p>
                                                                <p className="text-xs text-gray-500">
                                                                    {report.submittedAt?.toDate?.()?.toLocaleString() || 'Recently'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <span className="bg-red-600 text-white text-xs px-3 py-1 rounded-full">pending</span>
                                                    </div>
                                                    <p className="text-gray-700 mb-4 ml-8">{report.description}</p>
                                                    <div className="flex gap-2 ml-8">
                                                        <button
                                                            onClick={() => {
                                                                const resolution = window.prompt('Enter resolution notes (optional):');
                                                                handleResolveBug(report.id, resolution || 'Resolved');
                                                            }}
                                                            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                                                        >
                                                            <CheckCircle size={16} />
                                                            Mark as Resolved
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteBug(report.id)}
                                                            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition flex items-center gap-2"
                                                        >
                                                            <XCircle size={16} />
                                                            Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </>
                                    )}

                                    {/* Resolved */}
                                    {resolvedBugs.length > 0 && (
                                        <>
                                            <h3 className="font-bold text-lg mb-3 mt-6">Resolved Reports</h3>
                                            {resolvedBugs.map(report => (
                                                <div key={report.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div className="flex items-start gap-3">
                                                            <CheckCircle size={20} className="text-green-600 mt-1" />
                                                            <div>
                                                                <h4 className="font-bold">{report.title}</h4>
                                                                <p className="text-sm text-gray-600">By: {report.username}</p>
                                                            </div>
                                                        </div>
                                                        <span className="bg-green-600 text-white text-xs px-3 py-1 rounded-full">resolved</span>
                                                    </div>
                                                    {report.resolution && (
                                                        <p className="text-sm text-gray-600 ml-8 mt-2">
                                                            <strong>Resolution:</strong> {report.resolution}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* SHELTERS */}
                    {activeTab === 'shelters' && (
                        <div>
                            {pendingShelterRequests.length === 0 ? (
                                <div className="text-center py-12">
                                    <Shield size={48} className="mx-auto mb-4 text-gray-400" />
                                    <p className="text-gray-500">No pending shelter requests</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {pendingShelterRequests.map(request => (
                                        <div key={request.id} className="border-2 border-green-200 rounded-lg p-6 bg-green-50">
                                            <div className="flex items-start justify-between mb-4">
                                                <div>
                                                    <h3 className="text-xl font-bold mb-1">{request.shelterName}</h3>
                                                    <p className="text-gray-600">{request.location}</p>
                                                    {request.website && (
                                                        <a href={request.website} target="_blank" rel="noopener noreferrer" className="text-purple-600 text-sm hover:underline">
                                                            {request.website}
                                                        </a>
                                                    )}
                                                </div>
                                                <span className="bg-yellow-600 text-white text-xs px-3 py-1 rounded-full">pending</span>
                                            </div>

                                            <div className="mb-4">
                                                <p className="text-sm font-semibold mb-1">About:</p>
                                                <p className="text-gray-700">{request.description}</p>
                                            </div>

                                            {/* Show shipping address submitted with request (new) */}
                                            <div className="mb-4">
                                                <p className="text-sm font-semibold mb-1">Shipping Address (for donations)</p>
                                                <div className="rounded-lg border bg-white p-3">
                                                    <AddressBlock addr={request.shippingAddress} />
                                                </div>
                                            </div>

                                            <div className="mb-4 text-sm">
                                                <p className="text-gray-600">
                                                    <strong>Submitted by:</strong> {request.username} ({request.email})
                                                </p>
                                                <p className="text-gray-500">{request.submittedAt?.toDate?.()?.toLocaleString() || 'Recently'}</p>
                                            </div>

                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => handleApproveShelter(request)}
                                                    className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                                                >
                                                    <CheckCircle size={18} />
                                                    Approve & Verify
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const reason = window.prompt('Enter rejection reason:');
                                                        if (reason) handleRejectShelter(request.id, reason);
                                                    }}
                                                    className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition flex items-center gap-2"
                                                >
                                                    <XCircle size={18} />
                                                    Reject
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* REDEMPTIONS */}
                    {activeTab === 'redemptions' && (
                        <div className="space-y-8">
                            {/* Pending */}
                            <section>
                                <h3 className="font-bold text-lg mb-3">Pending</h3>
                                <div className="space-y-3">
                                    {byStatus('pending').length === 0 ? (
                                        <p className="text-sm text-gray-500">No pending redemptions.</p>
                                    ) : byStatus('pending').map(r => <RedemptionCard key={r.id} r={r} />)}
                                </div>
                            </section>

                            {/* Processing */}
                            <section>
                                <h3 className="font-bold text-lg mb-3">Processing</h3>
                                <div className="space-y-3">
                                    {byStatus('processing').length === 0 ? (
                                        <p className="text-sm text-gray-500">Nothing in processing.</p>
                                    ) : byStatus('processing').map(r => <RedemptionCard key={r.id} r={r} />)}
                                </div>
                            </section>

                            {/* Shipped */}
                            <section>
                                <h3 className="font-bold text-lg mb-3">Shipped</h3>
                                <div className="space-y-3">
                                    {byStatus('shipped').length === 0 ? (
                                        <p className="text-sm text-gray-500">No shipped redemptions yet.</p>
                                    ) : byStatus('shipped').map(r => <RedemptionCard key={r.id} r={r} />)}
                                </div>
                            </section>

                            {/* Rejected */}
                            <section>
                                <h3 className="font-bold text-lg mb-3">Rejected</h3>
                                <div className="space-y-3">
                                    {byStatus('rejected').length === 0 ? (
                                        <p className="text-sm text-gray-500">No rejected redemptions.</p>
                                    ) : byStatus('rejected').map(r => <RedemptionCard key={r.id} r={r} />)}
                                </div>
                            </section>
                        </div>
                    )}

                    {/* USERS */}
                    {activeTab === 'users' && (
                        <div>
                            <div className="mb-4">
                                <h3 className="font-bold text-lg mb-2">User Management</h3>
                                <p className="text-sm text-gray-600">Ban or unban users from the platform</p>
                            </div>
                            <div className="space-y-2">
                                {users.map(user => (
                                    <div
                                        key={user.id}
                                        className={`border rounded-lg p-4 ${user.banned ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="text-2xl">{user.avatar || '😺'}</div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-semibold">{user.username || user.displayName}</h4>
                                                        {user.verifiedShelter && (
                                                            <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Shield size={10} /> Shelter
                              </span>
                                                        )}
                                                        {user.isAdmin && (
                                                            <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded-full">Admin</span>
                                                        )}
                                                        {user.banned && (
                                                            <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Ban size={10} /> Banned
                              </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-600">{user.email}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {user.accountType === 'feline' ? 'Cat Owner' : 'Viewer'}
                                                    </p>
                                                    {user.banned && user.bannedReason && (
                                                        <p className="text-xs text-red-600 mt-1">Reason: {user.bannedReason}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {!user.isAdmin && (
                                                <div>
                                                    {user.banned ? (
                                                        <button
                                                            onClick={() => handleUnbanUser(user.id, user.username)}
                                                            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm flex items-center gap-2"
                                                        >
                                                            <CheckCircle size={16} /> Unban
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleBanUser(user.id, user.username)}
                                                            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition text-sm flex items-center gap-2"
                                                        >
                                                            <UserX size={16} /> Ban User
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}

export default AdminPage;
