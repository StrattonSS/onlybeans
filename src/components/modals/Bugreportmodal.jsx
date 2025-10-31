import React, { useState } from 'react';
import { X, Bug } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

function BugReportModal({ currentUser, setShowBugReport }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!title.trim() || !description.trim()) {
            alert('Please fill out all fields!');
            return;
        }

        setSubmitting(true);
        try {
            await addDoc(collection(db, 'bugReports'), {
                userId: currentUser.uid,
                username: currentUser.username || currentUser.displayName,
                email: currentUser.email,
                title: title,
                description: description,
                status: 'pending',
                submittedAt: serverTimestamp()
            });

            alert('🐛 Bug report submitted! Thank you for helping us improve OnlyBeans.');
            setShowBugReport(false);
        } catch (error) {
            console.error('Error submitting bug report:', error);
            alert('Error submitting bug report. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                        <Bug className="text-red-600" size={24} />
                        <h2 className="text-2xl font-bold text-gray-800">Report a Bug</h2>
                    </div>
                    <button
                        onClick={() => setShowBugReport(false)}
                        className="text-gray-500 hover:text-gray-700"
                    >
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
                        <p>Help us fix issues! Describe what went wrong so we can improve OnlyBeans.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Bug Title *
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            placeholder="Brief description of the issue"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Description *
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                            rows={5}
                            placeholder="What happened? What were you trying to do? What did you expect to happen?"
                            required
                        />
                    </div>

                    <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-600">
                        <p><strong>Note:</strong> Your report will be sent to the admin team. We'll review and fix issues as quickly as possible!</p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => setShowBugReport(false)}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                            disabled={submitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition disabled:opacity-50"
                            disabled={submitting}
                        >
                            {submitting ? 'Submitting...' : 'Submit Report'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default BugReportModal;