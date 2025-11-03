import React, { useState, useEffect } from 'react';
import {
    Users, Bug, Shield, Activity, CheckCircle, XCircle, Ban, UserX, Package, Truck
} from 'lucide-react';
import {
    collection, getDocs, getDoc, doc, updateDoc, deleteDoc, increment,addDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import {
    createShelterApprovedNotification,
    createShelterRejectedNotification,
    createRedemptionApprovedNotification,
    createRedemptionRejectedNotification,
    createBanNotification,
    createUnbanNotification
} from '../utils/notifications';

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

            items = await Promise.all(items.map(async (r) => {
                let enriched = { ...r };

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

                if (r.type === 'donate' && r.shelterId) {
                    try {
                        const s = await getDoc(doc(db, 'users', r.shelterId));
                        if (s.exists()) {
                            const sd = s.data();
                            enriched.shelterName = sd.shelterName || sd.displayName || sd.username || r.shelterId;
                            if (!r.shippingAddress && sd.shippingAddress) {
                                enriched.derivedShippingAddress = sd.shippingAddress;
                            }
                        }
                    } catch (e) {
                        console.warn('Could not enrich donation shelter:', r.shelterId, e);
                    }
                }

                enriched._treats = r.treats ?? r.treatsRedeemed ?? 0;
                enriched._rewardName =
                    r.rewardName ||
                    (r.type === 'donate' ? 'Shelter Donation' : 'Treat Redemption');

                return enriched;
            }));

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

    const handleApproveShelter = async (request) => {
        try {
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

            await createShelterApprovedNotification(
                request.userId,
                currentUser.displayName || currentUser.username || 'Admin'
            );

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
            const requestDoc = await getDoc(doc(db, 'shelterRequests', requestId));
            const userId = requestDoc.exists() ? requestDoc.data().userId : null;

            await updateDoc(doc(db, 'shelterRequests', requestId), {
                status: 'rejected',
                rejectedBy: currentUser.uid,
                rejectedAt: new Date(),
                rejectionReason: reason
            });

            if (userId) {
                await createShelterRejectedNotification(
                    userId,
                    currentUser.displayName || currentUser.username || 'Admin',
                    reason
                );
            }

            await loadShelterRequests();
            alert('Shelter request rejected.');
        } catch (error) {
            console.error('Error rejecting shelter:', error);
            alert('Error rejecting shelter request.');
        }
    };

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

            await createBanNotification(
                userId,
                currentUser.displayName || currentUser.username || 'Admin',
                reason
            );

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

            await createUnbanNotification(
                userId,
                currentUser.displayName || currentUser.username || 'Admin'
            );

            await loadUsers();
            alert(`${username} has been unbanned.`);
        } catch (error) {
            console.error('Error unbanning user:', error);
            alert('Error unbanning user.');
        }
    };

    const approveRedemption = async (r) => {
        try {
            await updateDoc(doc(db, 'redemptions', r.id), {
                status: 'processing',
                approvedBy: currentUser.uid,
                approvedAt: new Date(),
                updatedAt: new Date(),
            });

            if (r.userId) {
                await createRedemptionApprovedNotification(
                    r.userId,
                    currentUser.displayName || currentUser.username || 'Admin'
                );
            }

            await loadRedemptions();
            alert('Redemption approved and moved to Processing.');
        } catch (e) {
            console.error('Error approving redemption:', e);
            alert('Error approving redemption.');
        }
    };

    // This is the FIXED rejectRedemption function for AdminPage.jsx
// Replace the existing rejectRedemption function with this one

    const rejectRedemption = async (r) => {
        const reason = window.prompt('Enter rejection reason:');
        if (!reason) return;
        try {
            // 1. Update redemption status
            await updateDoc(doc(db, 'redemptions', r.id), {
                status: 'rejected',
                rejectedBy: currentUser.uid,
                rejectedAt: new Date(),
                rejectionReason: reason,
                updatedAt: new Date(),
            });

            // 2. Refund the treats
            const refundAmount = r.treatsRedeemed || r.treats || 500;

            if (r.catId) {
                // Refund to cat's treats
                await updateDoc(doc(db, 'cats', r.catId), {
                    treatsEarned: increment(refundAmount)
                });
            } else if (r.userId) {
                // Refund to user's treats
                await updateDoc(doc(db, 'users', r.userId), {
                    treatsEarned: increment(refundAmount)
                });
            }

            // 3. Create a notification for the user
            await addDoc(collection(db, 'notifications'), {
                userId: r.userId,
                type: 'redemption_rejected',
                title: 'Redemption Rejected',
                message: `Your redemption request was rejected. Reason: ${reason}. ${refundAmount} treats have been refunded to your account.`,
                redemptionId: r.id,
                refundedAmount: refundAmount,
                read: false,
                createdAt: serverTimestamp()
            });

            await loadRedemptions();
            alert(`Redemption rejected and ${refundAmount} treats refunded to user.`);
        } catch (e) {
            console.error('Error rejecting redemption:', e);
            alert('Error rejecting redemption.');
        }
    };

    const markAsShipped = async (r) => {
        try {
            await updateDoc(doc(db, 'redemptions', r.id), {
                status: 'shipped',
                shippedBy: currentUser.uid,
                shippedAt: new Date(),
                updatedAt: new Date(),
            });
            await loadRedemptions();
            alert('Redemption marked as shipped!');
        } catch (e) {
            console.error('Error marking as shipped:', e);
            alert('Error updating redemption.');
        }
    };

    const byStatus = (status) => redemptions.filter(r => r.status === status);
    const pendingBugs = bugReports.filter(r => r.status === 'pending');
    const resolvedBugs = bugReports.filter(r => r.status === 'resolved');
    const pendingRequests = shelterRequests.filter(r => r.status === 'pending');
    const approvedRequests = shelterRequests.filter(r => r.status === 'approved');
    const rejectedRequests = shelterRequests.filter(r => r.status === 'rejected');

    const RedemptionCard = ({ r }) => (
        <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-3">
                <div>
                    <div className="flex items-center gap-2">
                        <h4 className="font-bold text-lg">{r._rewardName}</h4>
                        {r.type === 'donate' && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                Donation
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                        <strong>User:</strong> {r.username || 'N/A'} ({r.userEmail || 'N/A'})
                    </p>
                    {r.type === 'donate' && r.shelterName && (
                        <p className="text-sm text-gray-600">
                            <strong>Shelter:</strong> {r.shelterName}
                        </p>
                    )}
                    <p className="text-sm text-gray-600">
                        <strong>Treats:</strong> {r._treats}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                        Requested: {r.createdAt?.toDate?.()?.toLocaleString() || 'Recently'}
                    </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    r.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        r.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                            r.status === 'shipped' ? 'bg-green-100 text-green-800' :
                                r.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                }`}>
                    {r.status}
                </span>
            </div>

            {r.shippingAddress && (
                <div className="bg-gray-50 p-3 rounded mt-3 text-sm">
                    <p className="font-semibold mb-1">Shipping Address:</p>
                    <p>{r.shippingAddress.fullName}</p>
                    <p>{r.shippingAddress.address1}</p>
                    {r.shippingAddress.address2 && <p>{r.shippingAddress.address2}</p>}
                    <p>{r.shippingAddress.city}, {r.shippingAddress.state} {r.shippingAddress.zip}</p>
                    {r.shippingAddress.phone && <p>Phone: {r.shippingAddress.phone}</p>}
                </div>
            )}

            {r.notes && (
                <div className="bg-blue-50 p-3 rounded mt-3 text-sm">
                    <p className="font-semibold mb-1">Notes:</p>
                    <p>{r.notes}</p>
                </div>
            )}

            {r.status === 'pending' && (
                <div className="flex gap-2 mt-4">
                    <button
                        onClick={() => approveRedemption(r)}
                        className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                    >
                        <CheckCircle size={16} className="inline mr-2" />
                        Approve
                    </button>
                    <button
                        onClick={() => rejectRedemption(r)}
                        className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
                    >
                        <XCircle size={16} className="inline mr-2" />
                        Reject
                    </button>
                </div>
            )}
            {r.status === 'processing' && (
                <button
                    onClick={() => markAsShipped(r)}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition mt-4"
                >
                    <Truck size={16} className="inline mr-2" />
                    Mark as Shipped
                </button>
            )}
        </div>
    );

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto text-center py-12">
                <Activity size={48} className="mx-auto mb-4 text-gray-400 animate-spin" />
                <p className="text-gray-600">Loading admin panel...</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg shadow-lg p-6 mb-6 text-white">
                <div className="flex items-center gap-3 mb-4">
                    <Shield size={32} />
                    <h1 className="text-3xl font-bold">Admin Panel</h1>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white bg-opacity-20 rounded-lg p-4">
                        <p className="text-sm opacity-90">Total Users</p>
                        <p className="text-2xl font-bold">{stats.totalUsers}</p>
                    </div>
                    <div className="bg-white bg-opacity-20 rounded-lg p-4">
                        <p className="text-sm opacity-90">Pending Bugs</p>
                        <p className="text-2xl font-bold">{stats.pendingBugs}</p>
                    </div>
                    <div className="bg-white bg-opacity-20 rounded-lg p-4">
                        <p className="text-sm opacity-90">Pending Shelters</p>
                        <p className="text-2xl font-bold">{stats.pendingShelterRequests}</p>
                    </div>
                    <div className="bg-white bg-opacity-20 rounded-lg p-4">
                        <p className="text-sm opacity-90">Pending Redemptions</p>
                        <p className="text-2xl font-bold">{stats.pendingRedemptions}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow">
                <div className="border-b">
                    <div className="flex gap-4 p-4 overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('bugs')}
                            className={`px-4 py-2 font-medium transition flex items-center gap-2 whitespace-nowrap ${
                                activeTab === 'bugs'
                                    ? 'border-b-2 border-purple-500 text-purple-600'
                                    : 'text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            <Bug size={20} /> Bug Reports
                        </button>
                        <button
                            onClick={() => setActiveTab('shelters')}
                            className={`px-4 py-2 font-medium transition flex items-center gap-2 whitespace-nowrap ${
                                activeTab === 'shelters'
                                    ? 'border-b-2 border-purple-500 text-purple-600'
                                    : 'text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            <Shield size={20} /> Shelter Requests
                        </button>
                        <button
                            onClick={() => setActiveTab('redemptions')}
                            className={`px-4 py-2 font-medium transition flex items-center gap-2 whitespace-nowrap ${
                                activeTab === 'redemptions'
                                    ? 'border-b-2 border-purple-500 text-purple-600'
                                    : 'text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            <Package size={20} /> Redemptions
                        </button>
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`px-4 py-2 font-medium transition flex items-center gap-2 whitespace-nowrap ${
                                activeTab === 'users'
                                    ? 'border-b-2 border-purple-500 text-purple-600'
                                    : 'text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            <Users size={20} /> User Management
                        </button>
                    </div>
                </div>

                <div className="p-6">
                    {activeTab === 'bugs' && (
                        <div>
                            {bugReports.length === 0 ? (
                                <div className="text-center py-12">
                                    <Bug size={48} className="mx-auto mb-4 text-gray-400" />
                                    <p className="text-gray-500">No bug reports yet!</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {pendingBugs.length > 0 && (
                                        <>
                                            <h3 className="font-bold text-lg mb-3">Pending Reports</h3>
                                            <div className="space-y-3">
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
                                                        </div>
                                                        <p className="text-gray-700 mb-4">{report.description}</p>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    const resolution = window.prompt('Enter resolution notes:');
                                                                    if (resolution) handleResolveBug(report.id, resolution);
                                                                }}
                                                                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                                                            >
                                                                <CheckCircle size={16} />
                                                                Resolve
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
                                            </div>
                                        </>
                                    )}

                                    {resolvedBugs.length > 0 && (
                                        <>
                                            <h3 className="font-bold text-lg mb-3 mt-6">Resolved Reports</h3>
                                            <div className="space-y-3">
                                                {resolvedBugs.map(report => (
                                                    <div key={report.id} className="border rounded-lg p-4 bg-gray-50">
                                                        <div className="flex items-start justify-between">
                                                            <div>
                                                                <h4 className="font-bold">{report.title}</h4>
                                                                <p className="text-sm text-gray-600">By: {report.username}</p>
                                                                <p className="text-sm text-green-600 mt-2">✓ {report.resolution}</p>
                                                            </div>
                                                            <button
                                                                onClick={() => handleDeleteBug(report.id)}
                                                                className="text-red-600 hover:text-red-800"
                                                            >
                                                                <XCircle size={20} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'shelters' && (
                        <div className="space-y-8">
                            {pendingRequests.length > 0 && (
                                <div>
                                    <h3 className="font-bold text-lg mb-3">Pending Requests</h3>
                                    {pendingRequests.map(request => (
                                        <div key={request.id} className="border-2 border-yellow-200 rounded-lg p-4 bg-yellow-50 mb-3">
                                            <h4 className="font-bold text-lg mb-2">{request.shelterName}</h4>
                                            <div className="space-y-1 text-sm mb-4">
                                                <p><strong>Location:</strong> {request.location}</p>
                                                <p><strong>Website:</strong> {request.website || 'N/A'}</p>
                                                <p><strong>Description:</strong> {request.description}</p>
                                                <p className="text-xs text-gray-500 mt-2">
                                                    Submitted: {request.submittedAt?.toDate?.()?.toLocaleString() || 'Recently'}
                                                </p>
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

                            {approvedRequests.length > 0 && (
                                <div>
                                    <h3 className="font-bold text-lg mb-3">Approved Shelters</h3>
                                    {approvedRequests.map(request => (
                                        <div key={request.id} className="border rounded-lg p-4 bg-green-50 mb-2">
                                            <p className="font-bold">{request.shelterName}</p>
                                            <p className="text-sm text-gray-600">{request.location}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {rejectedRequests.length > 0 && (
                                <div>
                                    <h3 className="font-bold text-lg mb-3">Rejected Requests</h3>
                                    {rejectedRequests.map(request => (
                                        <div key={request.id} className="border rounded-lg p-4 bg-red-50 mb-2">
                                            <p className="font-bold">{request.shelterName}</p>
                                            <p className="text-sm text-red-600">Reason: {request.rejectionReason}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'redemptions' && (
                        <div className="space-y-8">
                            <section>
                                <h3 className="font-bold text-lg mb-3">Pending</h3>
                                <div className="space-y-3">
                                    {byStatus('pending').length === 0 ? (
                                        <p className="text-sm text-gray-500">No pending redemptions.</p>
                                    ) : byStatus('pending').map(r => <RedemptionCard key={r.id} r={r} />)}
                                </div>
                            </section>

                            <section>
                                <h3 className="font-bold text-lg mb-3">Processing</h3>
                                <div className="space-y-3">
                                    {byStatus('processing').length === 0 ? (
                                        <p className="text-sm text-gray-500">None processing.</p>
                                    ) : byStatus('processing').map(r => <RedemptionCard key={r.id} r={r} />)}
                                </div>
                            </section>

                            <section>
                                <h3 className="font-bold text-lg mb-3">Shipped</h3>
                                <div className="space-y-3">
                                    {byStatus('shipped').length === 0 ? (
                                        <p className="text-sm text-gray-500">None shipped yet.</p>
                                    ) : byStatus('shipped').map(r => <RedemptionCard key={r.id} r={r} />)}
                                </div>
                            </section>

                            <section>
                                <h3 className="font-bold text-lg mb-3">Rejected</h3>
                                <div className="space-y-3">
                                    {byStatus('rejected').length === 0 ? (
                                        <p className="text-sm text-gray-500">None rejected.</p>
                                    ) : byStatus('rejected').map(r => <RedemptionCard key={r.id} r={r} />)}
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div>
                            <div className="mb-4 grid grid-cols-3 gap-4">
                                <div className="bg-purple-50 p-4 rounded-lg">
                                    <p className="text-sm text-gray-600">Cat Owners</p>
                                    <p className="text-2xl font-bold text-purple-600">{stats.catOwners}</p>
                                </div>
                                <div className="bg-blue-50 p-4 rounded-lg">
                                    <p className="text-sm text-gray-600">Viewers</p>
                                    <p className="text-2xl font-bold text-blue-600">{stats.viewers}</p>
                                </div>
                                <div className="bg-green-50 p-4 rounded-lg">
                                    <p className="text-sm text-gray-600">Verified Shelters</p>
                                    <p className="text-2xl font-bold text-green-600">{stats.shelters}</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {users.map(user => (
                                    <div key={user.id} className="border rounded-lg p-4 flex items-center justify-between">
                                        <div>
                                            <p className="font-semibold">{user.displayName || user.username}</p>
                                            <p className="text-sm text-gray-600">{user.email}</p>
                                            <div className="flex gap-2 mt-1">
                                                {user.accountType === 'feline' && (
                                                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                                                        Cat Owner
                                                    </span>
                                                )}
                                                {user.verifiedShelter && (
                                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                                        Verified Shelter
                                                    </span>
                                                )}
                                                {user.banned && (
                                                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                                                        Banned
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {user.banned ? (
                                                <button
                                                    onClick={() => handleUnbanUser(user.id, user.username || user.displayName)}
                                                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm flex items-center gap-2"
                                                >
                                                    <CheckCircle size={16} />
                                                    Unban
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleBanUser(user.id, user.username || user.displayName)}
                                                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition text-sm flex items-center gap-2"
                                                >
                                                    <Ban size={16} />
                                                    Ban User
                                                </button>
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