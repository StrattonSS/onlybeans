import React, { useState } from 'react';
import { Gift, ShoppingCart, Menu, X, Shield, Bug } from 'lucide-react';

function Navigation({ currentPage, setCurrentPage, currentUser, setShowBuyTreats, setShowBugReport }) {
    const [showMobileMenu, setShowMobileMenu] = useState(false);

    return (
        <nav className="bg-white shadow-md sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-purple-600">OnlyBeans 🐾</h1>
                    </div>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-6">
                        <button
                            onClick={() => setCurrentPage('home')}
                            className={`font-medium transition ${
                                currentPage === 'home' ? 'text-purple-600' : 'text-gray-600 hover:text-purple-600'
                            }`}
                        >
                            Home
                        </button>
                        <button
                            onClick={() => setCurrentPage('discover')}
                            className={`font-medium transition ${
                                currentPage === 'discover' ? 'text-purple-600' : 'text-gray-600 hover:text-purple-600'
                            }`}
                        >
                            Discover
                        </button>
                        <button
                            onClick={() => setCurrentPage('profile')}
                            className={`font-medium transition ${
                                currentPage === 'profile' ? 'text-purple-600' : 'text-gray-600 hover:text-purple-600'
                            }`}
                        >
                            Profile
                        </button>

                        {/* Admin link - only for admins */}
                        {currentUser?.isAdmin && (
                            <button
                                onClick={() => setCurrentPage('admin')}
                                className={`font-medium transition flex items-center gap-1 ${
                                    currentPage === 'admin' ? 'text-purple-600' : 'text-gray-600 hover:text-purple-600'
                                }`}
                            >
                                <Shield size={18} />
                                Admin
                            </button>
                        )}

                        {/* Bug Report Button */}
                        {setShowBugReport && (
                            <button
                                onClick={() => setShowBugReport(true)}
                                className="text-gray-600 hover:text-red-600 transition"
                                title="Report a Bug"
                            >
                                <Bug size={20} />
                            </button>
                        )}

                        {/* Treat Balance */}
                        <button
                            onClick={() => setShowBuyTreats(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 transition"
                        >
                            <Gift size={18} />
                            <span className="font-semibold">{currentUser?.treatBalance || 0}</span>
                        </button>

                        <button
                            onClick={() => setShowBuyTreats(true)}
                            className="bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700 transition flex items-center gap-2"
                        >
                            <ShoppingCart size={18} />
                            Buy Treats
                        </button>
                    </div>

                    {/* Mobile menu button */}
                    <button
                        onClick={() => setShowMobileMenu(!showMobileMenu)}
                        className="md:hidden text-gray-600"
                    >
                        {showMobileMenu ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>

                {/* Mobile Navigation */}
                {showMobileMenu && (
                    <div className="md:hidden pb-4 space-y-2">
                        <button
                            onClick={() => {
                                setCurrentPage('home');
                                setShowMobileMenu(false);
                            }}
                            className="block w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                        >
                            Home
                        </button>
                        <button
                            onClick={() => {
                                setCurrentPage('discover');
                                setShowMobileMenu(false);
                            }}
                            className="block w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                        >
                            Discover
                        </button>
                        <button
                            onClick={() => {
                                setCurrentPage('profile');
                                setShowMobileMenu(false);
                            }}
                            className="block w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                        >
                            Profile
                        </button>
                        {currentUser?.isAdmin && (
                            <button
                                onClick={() => {
                                    setCurrentPage('admin');
                                    setShowMobileMenu(false);
                                }}
                                className="block w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded flex items-center gap-2"
                            >
                                <Shield size={18} />
                                Admin
                            </button>
                        )}
                        {setShowBugReport && (
                            <button
                                onClick={() => {
                                    setShowBugReport(true);
                                    setShowMobileMenu(false);
                                }}
                                className="block w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded flex items-center gap-2"
                            >
                                <Bug size={18} />
                                Report a Bug
                            </button>
                        )}
                        <button
                            onClick={() => {
                                setShowBuyTreats(true);
                                setShowMobileMenu(false);
                            }}
                            className="block w-full text-left px-4 py-2 bg-purple-600 text-white rounded font-semibold"
                        >
                            Buy Treats ({currentUser?.treatBalance || 0})
                        </button>
                    </div>
                )}
            </div>
        </nav>
    );
}

export default Navigation;