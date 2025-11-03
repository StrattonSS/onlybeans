// src/utils/notifications.js
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Creates a notification in Firestore
 * @param {Object} params - Notification parameters
 * @param {string} params.userId - ID of user receiving the notification
 * @param {string} params.type - Type of notification (like, comment, gift, admin_shelter_approved, admin_shelter_rejected, admin_redemption_approved, admin_redemption_rejected, admin_ban, admin_unban)
 * @param {string} params.actorId - ID of user performing the action
 * @param {string} params.actorName - Display name of actor
 * @param {string} params.actorAvatar - Avatar emoji of actor (optional)
 * @param {string} params.message - Notification message
 * @param {string} params.postId - ID of related post (optional)
 * @param {Object} params.metadata - Additional metadata (optional)
 */
export async function createNotification({
                                             userId,
                                             type,
                                             actorId,
                                             actorName,
                                             actorAvatar = '😺',
                                             message,
                                             postId = null,
                                             metadata = {}
                                         }) {
    try {
        // Don't create notifications for users notifying themselves
        if (userId === actorId) {
            return null;
        }

        await addDoc(collection(db, 'notifications'), {
            userId,
            type,
            actorId,
            actorName,
            actorAvatar,
            message,
            postId,
            metadata,
            read: false,
            createdAt: serverTimestamp()
        });

        return true;
    } catch (error) {
        console.error('Error creating notification:', error);
        return false;
    }
}

/**
 * Create a notification for a post like
 */
export async function createLikeNotification(postOwnerId, liker, post) {
    return createNotification({
        userId: postOwnerId,
        type: 'like',
        actorId: liker.uid,
        actorName: liker.displayName || liker.username || 'Someone',
        actorAvatar: liker.avatar || '😺',
        message: `${liker.displayName || liker.username || 'Someone'} liked your post`,
        postId: post.id,
        metadata: {
            catName: post.catData?.name || 'your cat',
            imageUrl: post.imageUrl
        }
    });
}

/**
 * Create a notification for a comment
 */
export async function createCommentNotification(postOwnerId, commenter, post, commentText) {
    return createNotification({
        userId: postOwnerId,
        type: 'comment',
        actorId: commenter.uid,
        actorName: commenter.displayName || commenter.username || 'Someone',
        actorAvatar: commenter.avatar || '😺',
        message: `${commenter.displayName || commenter.username || 'Someone'} commented: "${commentText.substring(0, 50)}${commentText.length > 50 ? '...' : ''}"`,
        postId: post.id,
        metadata: {
            catName: post.catData?.name || 'your cat',
            imageUrl: post.imageUrl,
            commentText: commentText
        }
    });
}

/**
 * Create a notification for treat gift
 */
export async function createGiftNotification(catOwnerId, gifter, post, treatAmount) {
    return createNotification({
        userId: catOwnerId,
        type: 'gift',
        actorId: gifter.uid,
        actorName: gifter.displayName || gifter.username || 'Someone',
        actorAvatar: gifter.avatar || '😺',
        message: `${gifter.displayName || gifter.username || 'Someone'} gifted ${treatAmount} treats to ${post.catData?.name || 'your cat'}! 🎁`,
        postId: post.id,
        metadata: {
            catName: post.catData?.name || 'your cat',
            treatAmount: treatAmount,
            imageUrl: post.imageUrl
        }
    });
}

/**
 * Create a notification for shelter approval
 */
export async function createShelterApprovedNotification(userId, adminName) {
    return createNotification({
        userId: userId,
        type: 'admin_shelter_approved',
        actorId: 'admin',
        actorName: adminName || 'Admin',
        actorAvatar: '🛡️',
        message: '🎉 Your shelter verification request has been approved!',
        metadata: {
            action: 'shelter_approved'
        }
    });
}

/**
 * Create a notification for shelter rejection
 */
export async function createShelterRejectedNotification(userId, adminName, reason) {
    return createNotification({
        userId: userId,
        type: 'admin_shelter_rejected',
        actorId: 'admin',
        actorName: adminName || 'Admin',
        actorAvatar: '🛡️',
        message: `Your shelter verification request was not approved. Reason: ${reason}`,
        metadata: {
            action: 'shelter_rejected',
            reason: reason
        }
    });
}

/**
 * Create a notification for redemption approval
 */
export async function createRedemptionApprovedNotification(userId, adminName) {
    return createNotification({
        userId: userId,
        type: 'admin_redemption_approved',
        actorId: 'admin',
        actorName: adminName || 'Admin',
        actorAvatar: '🛡️',
        message: '✅ Your treat redemption has been approved and is being processed!',
        metadata: {
            action: 'redemption_approved'
        }
    });
}

/**
 * Create a notification for redemption rejection
 */
export async function createRedemptionRejectedNotification(userId, adminName, reason) {
    return createNotification({
        userId: userId,
        type: 'admin_redemption_rejected',
        actorId: 'admin',
        actorName: adminName || 'Admin',
        actorAvatar: '🛡️',
        message: `Your treat redemption was rejected. Reason: ${reason || 'No reason provided'}`,
        metadata: {
            action: 'redemption_rejected',
            reason: reason
        }
    });
}

/**
 * Create a notification for user ban
 */
export async function createBanNotification(userId, adminName, reason) {
    return createNotification({
        userId: userId,
        type: 'admin_ban',
        actorId: 'admin',
        actorName: adminName || 'Admin',
        actorAvatar: '🛡️',
        message: `Your account has been banned. Reason: ${reason}`,
        metadata: {
            action: 'ban',
            reason: reason
        }
    });
}

/**
 * Create a notification for user unban
 */
export async function createUnbanNotification(userId, adminName) {
    return createNotification({
        userId: userId,
        type: 'admin_unban',
        actorId: 'admin',
        actorName: adminName || 'Admin',
        actorAvatar: '🛡️',
        message: '✅ Your account has been unbanned. Welcome back!',
        metadata: {
            action: 'unban'
        }
    });
}