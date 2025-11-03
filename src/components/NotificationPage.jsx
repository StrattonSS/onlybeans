import React, { useState, useEffect } from 'react';
import { Bell, Heart, MessageCircle, Gift, Shield, Trash2, Check } from 'lucide-react';
import { collection, query, where, orderBy, getDocs, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

function NotificationPage({ currentUser, setCurrentPage }) {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // 'all', 'unread'

    useEffect(() => {
        if (currentUser?.uid) {
            loadNotifications();
        }
    }, [currentUser]);

    const loadNotifications = async () => {
        if (!currentUser?.uid) return;

        setLoading(true);
        try {
            const q = query(
                collection(db, 'notifications'),
                where('userId', '==', currentUser.uid),
                orderBy('createdAt', 'desc')
            );

            const snapshot = await getDocs(q);
            const notifs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setNotifications(notifs);
        } catch (error) {
            console.error('Error loading notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (notificationId) => {
        try {
            await updateDoc(doc(db, 'notifications', notificationId), {
                read: true
            });
            await loadNotifications();
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            const batch = writeBatch(db);
            const unreadNotifs = notifications.filter(n => !n.read);

            unreadNotifs.forEach(notif => {
                const notifRef = doc(db, 'notifications', notif.id);
                batch.update(notifRef, { read: true });
            });

            await batch.commit();
            await loadNotifications();
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const deleteNotification = async (notificationId) => {
        try {
            await deleteDoc(doc(db, 'notifications', notificationId));
            await loadNotifications();
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    const clearAll = async () => {
        if (!window.confirm('Are you sure you want to clear all notifications?')) return;

        try {
            const batch = writeBatch(db);
            notifications.forEach(notif => {
                const notifRef = doc(db, 'notifications', notif.id);
                batch.delete(notifRef);
            });

            await batch.commit();
            await loadNotifications();
        } catch (error) {
            console.error('Error clearing notifications:', error);
            alert('Error clearing notifications. Please try again.');
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'like':
                return <Heart size={20} className="text-red-500" />;
            case 'comment':
                return <MessageCircle size={20} className="text-blue-500" />;
            case 'gift':
                return <Gift size={20} className="text-yellow-500" />;
            case 'admin_shelter_approved':
            case 'admin_shelter_rejected':
            case 'admin_redemption_approved':
            case 'admin_redemption_rejected':
            case 'admin_ban':
            case 'admin_unban':
                return <Shield size={20} className="text-purple-500" />;
            default:
                return <Bell size={20} className="text-gray-500" />;
        }
    };

    const handleNotificationClick = (notif) => {
        // Mark as read
        if (!notif.read) {
            markAsRead(notif.id);
        }

        // Navigate to relevant page if there's a post
        if (notif.postId && setCurrentPage) {
            setCurrentPage('home');
        }
    };

    const formatDate = (createdAt) => {
        if (!createdAt) return 'Recently';

        try {
            const date = createdAt?.toDate?.() || new Date(createdAt);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;
            return date.toLocaleDateString();
        } catch {
            return 'Recently';
        }
    };

    const filteredNotifications = filter === 'unread'
        ? notifications.filter(n => !n.read)
        : notifications;

    const unreadCount = notifications.filter(n => !n.read).length;

    if (loading) {
        return (
            <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-lg shadow p-8 text-center">
                    <Bell size={48} className="mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-600">Loading notifications...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Bell size={32} className="text-purple-600" />
                        <div>
                            <h2 className="text-2xl font-bold">Notifications</h2>
                            {unreadCount > 0 && (
                                <p className="text-sm text-gray-600">{unreadCount} unread</p>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="px-4 py-2 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition flex items-center gap-2"
                            >
                                <Check size={16} />
                                Mark all read
                            </button>
                        )}
                        {notifications.length > 0 && (
                            <button
                                onClick={clearAll}
                                className="px-4 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition flex items-center gap-2"
                            >
                                <Trash2 size={16} />
                                Clear all
                            </button>
                        )}
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 rounded-lg font-medium transition ${
                            filter === 'all'
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        All ({notifications.length})
                    </button>
                    <button
                        onClick={() => setFilter('unread')}
                        className={`px-4 py-2 rounded-lg font-medium transition ${
                            filter === 'unread'
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        Unread ({unreadCount})
                    </button>
                </div>

                {/* Notifications List */}
                <div className="space-y-3">
                    {filteredNotifications.length === 0 ? (
                        <div className="text-center py-12">
                            <Bell size={64} className="mx-auto mb-4 text-gray-300" />
                            <p className="text-gray-500 text-lg">
                                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                            </p>
                            <p className="text-gray-400 text-sm mt-2">
                                You'll be notified when someone likes, comments, or gifts treats to your posts
                            </p>
                        </div>
                    ) : (
                        filteredNotifications.map(notif => (
                            <div
                                key={notif.id}
                                onClick={() => handleNotificationClick(notif)}
                                className={`p-4 rounded-lg border-2 transition cursor-pointer ${
                                    notif.read
                                        ? 'bg-white border-gray-200 hover:border-gray-300'
                                        : 'bg-purple-50 border-purple-200 hover:border-purple-300'
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                                        {getIcon(notif.type)}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="text-2xl flex-shrink-0">{notif.actorAvatar}</span>
                                                <span className="font-semibold text-gray-900 truncate">
                                                    {notif.actorName}
                                                </span>
                                            </div>
                                            <span className="text-xs text-gray-500 flex-shrink-0">
                                                {formatDate(notif.createdAt)}
                                            </span>
                                        </div>

                                        <p className="text-gray-700 mt-1">{notif.message}</p>

                                        {/* Show preview image if available */}
                                        {notif.metadata?.imageUrl && (
                                            <img
                                                src={notif.metadata.imageUrl}
                                                alt="Post preview"
                                                className="mt-2 w-20 h-20 object-cover rounded-lg"
                                            />
                                        )}
                                    </div>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteNotification(notif.id);
                                        }}
                                        className="flex-shrink-0 text-gray-400 hover:text-red-500 transition p-1"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export default NotificationPage;