import React, { useState, useEffect, useRef } from 'react';
import { Camera, Maximize2, Tag } from 'lucide-react';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';

function UploadPage({ currentUser, cats, selectedCat, setSelectedCat, editingPost, setEditingPost, setCurrentPage, loadPosts }) {
    const [caption, setCaption] = useState(editingPost?.caption || '');
    const [selectedFile, setSelectedFile] = useState(null);
    const [preview, setPreview] = useState(editingPost?.imageUrl || null);
    const [editedImage, setEditedImage] = useState(null);
    const [showEditor, setShowEditor] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedCategories, setSelectedCategories] = useState(editingPost?.categories || []);

    // Crop box state
    const [cropBox, setCropBox] = useState({ x: 50, y: 50, width: 300, height: 300 });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

    const canvasRef = useRef(null);
    const imageRef = useRef(null);
    const containerRef = useRef(null);

    // Categories users can choose from
    const categories = [
        { id: 'throwback', name: 'Throwback', emoji: '🕰️', description: 'Old pics, new vibes', special: true },
        { id: 'everyday', name: 'Everyday Life', emoji: '🐱', description: 'Daily moments' },
        { id: 'rainbow-bridge', name: 'Rainbow Bridge', emoji: '🌈', description: 'In loving memory', special: true },
        { id: 'adoption', name: 'Up for Adoption', emoji: '🏠', description: 'Looking for a home', special: true },
        { id: 'funny', name: 'Funny', emoji: '😹', description: 'Hilarious moments' },
        { id: 'sleeping', name: 'Sleepy Time', emoji: '😴', description: 'Catching Z\'s' },
        { id: 'playing', name: 'Playtime', emoji: '🎾', description: 'Action shots' },
        { id: 'food', name: 'Food Time', emoji: '🍽️', description: 'Nom nom nom' },
        { id: 'adventure', name: 'Adventure', emoji: '🌟', description: 'Exploring the world' },
        { id: 'grooming', name: 'Grooming', emoji: '✨', description: 'Looking fabulous' },
        { id: 'tricks', name: 'Tricks & Skills', emoji: '🎪', description: 'Showing off talents' }
    ];

    if (!currentUser) {
        return (
            <div className="max-w-2xl mx-auto">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                    <p className="text-gray-700 mb-4">You need to be logged in to upload photos.</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    if (!selectedCat && cats.length === 0) {
        return (
            <div className="max-w-2xl mx-auto">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                    <h3 className="text-xl font-bold mb-2">No Cat Profile Yet</h3>
                    <p className="text-gray-700 mb-4">You need to add a cat to your profile before uploading photos.</p>
                    <button
                        onClick={() => setCurrentPage('profile')}
                        className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition"
                    >
                        Go to Profile
                    </button>
                </div>
            </div>
        );
    }

    const toggleCategory = (categoryId) => {
        if (selectedCategories.includes(categoryId)) {
            setSelectedCategories(selectedCategories.filter(id => id !== categoryId));
        } else {
            setSelectedCategories([...selectedCategories, categoryId]);
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result);
                setShowEditor(true);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleImageLoad = () => {
        if (imageRef.current && containerRef.current) {
            const img = imageRef.current;
            const container = containerRef.current;

            // Get scaled dimensions
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;
            const imgAspect = img.naturalWidth / img.naturalHeight;
            const containerAspect = containerWidth / containerHeight;

            let displayWidth, displayHeight;
            if (imgAspect > containerAspect) {
                displayWidth = containerWidth;
                displayHeight = containerWidth / imgAspect;
            } else {
                displayHeight = containerHeight;
                displayWidth = containerHeight * imgAspect;
            }

            setImageSize({ width: displayWidth, height: displayHeight });

            // Center crop box
            const size = Math.min(displayWidth, displayHeight, 300);
            setCropBox({
                x: (containerWidth - size) / 2,
                y: (containerHeight - size) / 2,
                width: size,
                height: size
            });
        }
    };

    // Helper function to get client coordinates from mouse or touch event
    const getClientCoordinates = (e) => {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    };

    // Mouse event handlers
    const handleMouseDown = (e, type) => {
        e.preventDefault();
        if (type === 'drag') setIsDragging(true);
        if (type === 'resize') setIsResizing(true);
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    // Touch event handlers
    const handleTouchStart = (e, type) => {
        e.preventDefault();
        if (type === 'drag') setIsDragging(true);
        if (type === 'resize') setIsResizing(true);
        const coords = getClientCoordinates(e);
        setDragStart(coords);
    };

    const handleMove = (e) => {
        if (!isDragging && !isResizing) return;

        const coords = getClientCoordinates(e);
        const deltaX = coords.x - dragStart.x;
        const deltaY = coords.y - dragStart.y;

        if (isDragging) {
            setCropBox(prev => {
                const container = containerRef.current;
                if (!container) return prev;

                const maxX = container.clientWidth - prev.width;
                const maxY = container.clientHeight - prev.height;

                return {
                    ...prev,
                    x: Math.max(0, Math.min(maxX, prev.x + deltaX)),
                    y: Math.max(0, Math.min(maxY, prev.y + deltaY))
                };
            });
        } else if (isResizing) {
            setCropBox(prev => {
                const container = containerRef.current;
                if (!container) return prev;

                const newWidth = Math.max(100, prev.width + deltaX);
                const newHeight = Math.max(100, prev.height + deltaY);
                const size = Math.min(newWidth, newHeight); // Keep square

                const maxSize = Math.min(
                    container.clientWidth - prev.x,
                    container.clientHeight - prev.y
                );

                return {
                    ...prev,
                    width: Math.min(size, maxSize),
                    height: Math.min(size, maxSize)
                };
            });
        }

        setDragStart(coords);
    };

    const handleEnd = () => {
        setIsDragging(false);
        setIsResizing(false);
    };

    // Add event listeners for both mouse and touch
    useEffect(() => {
        if (isDragging || isResizing) {
            // Mouse events
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleEnd);

            // Touch events
            window.addEventListener('touchmove', handleMove, { passive: false });
            window.addEventListener('touchend', handleEnd);

            return () => {
                window.removeEventListener('mousemove', handleMove);
                window.removeEventListener('mouseup', handleEnd);
                window.removeEventListener('touchmove', handleMove);
                window.removeEventListener('touchend', handleEnd);
            };
        }
    }, [isDragging, isResizing, dragStart]);

    const applyCrop = () => {
        if (!imageRef.current || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const img = imageRef.current;
        const container = containerRef.current;

        if (!container) return;

        // Calculate the image's position within the container (image is centered)
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        const imgOffsetX = (containerWidth - imageSize.width) / 2;
        const imgOffsetY = (containerHeight - imageSize.height) / 2;

        // Adjust crop box coordinates to be relative to the image, not the container
        const relativeCropX = cropBox.x - imgOffsetX;
        const relativeCropY = cropBox.y - imgOffsetY;

        // Calculate scale from displayed image to natural image
        const scaleX = img.naturalWidth / imageSize.width;
        const scaleY = img.naturalHeight / imageSize.height;

        // Scale to natural image coordinates
        const cropX = relativeCropX * scaleX;
        const cropY = relativeCropY * scaleY;
        const cropWidth = cropBox.width * scaleX;
        const cropHeight = cropBox.height * scaleY;

        // Set canvas to crop size
        canvas.width = cropWidth;
        canvas.height = cropHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(
            img,
            cropX, cropY, cropWidth, cropHeight,
            0, 0, cropWidth, cropHeight
        );

        canvas.toBlob((blob) => {
            setEditedImage(blob);
            setShowEditor(false);
        }, 'image/jpeg', 0.95);
    };

    const handleUpload = async () => {
        if (!currentUser || !selectedCat) return;

        // Require at least one category
        if (selectedCategories.length === 0) {
            alert('Please select at least one category for your post!');
            return;
        }

        // If editing and no new image, just update caption and categories
        if (editingPost && !editedImage && !selectedFile) {
            setUploading(true);
            try {
                await updateDoc(doc(db, 'posts', editingPost.id), {
                    caption: caption,
                    categories: selectedCategories
                });

                setEditingPost(null);
                setCaption('');
                setSelectedCategories([]);
                setCurrentPage('home');
                await loadPosts();
            } catch (error) {
                console.error('Error updating post:', error);
                alert('Error updating post. Please try again.');
            } finally {
                setUploading(false);
            }
            return;
        }

        if ((!selectedFile && !editedImage) || !currentUser) return;

        setUploading(true);
        try {
            const fileToUpload = editedImage || selectedFile;

            if (editingPost) {
                const storageRef = ref(storage, `posts/${currentUser.uid}/${Date.now()}.jpg`);
                await uploadBytes(storageRef, fileToUpload);
                const imageUrl = await getDownloadURL(storageRef);

                await updateDoc(doc(db, 'posts', editingPost.id), {
                    caption: caption,
                    imageUrl: imageUrl,
                    categories: selectedCategories
                });

                setEditingPost(null);
            } else {
                const storageRef = ref(storage, `posts/${currentUser.uid}/${Date.now()}.jpg`);
                await uploadBytes(storageRef, fileToUpload);
                const imageUrl = await getDownloadURL(storageRef);

                await addDoc(collection(db, 'posts'), {
                    userId: currentUser.uid,
                    catId: selectedCat.id,
                    caption: caption,
                    imageUrl: imageUrl,
                    categories: selectedCategories,
                    likes: 0,
                    likedBy: [],
                    comments: 0,
                    treats: 0,
                    createdAt: serverTimestamp()
                });
            }

            setCaption('');
            setSelectedFile(null);
            setPreview(null);
            setEditedImage(null);
            setSelectedCategories([]);
            setCurrentPage('home');

            await loadPosts();
        } catch (error) {
            console.error('Error uploading:', error);
            alert('Error uploading post. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold">{editingPost ? 'Edit Post' : 'Create New Post'}</h2>

                    {cats.length > 1 && !editingPost && (
                        <select
                            value={selectedCat?.id || ''}
                            onChange={(e) => {
                                const cat = cats.find(c => c.id === e.target.value);
                                setSelectedCat(cat);
                            }}
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        >
                            {cats.map(cat => (
                                <option key={cat.id} value={cat.id}>
                                    {cat.avatar} {cat.name}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                <canvas ref={canvasRef} style={{ display: 'none' }} />

                <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                />

                {!preview ? (
                    <label
                        htmlFor="file-upload"
                        className="block border-2 border-dashed border-gray-300 rounded-lg p-12 text-center mb-6 hover:border-purple-500 transition cursor-pointer"
                    >
                        <Camera size={48} className="mx-auto mb-4 text-gray-400" />
                        <p className="text-gray-600 mb-2">Click to upload cat photos</p>
                        <p className="text-sm text-gray-400">JPG, PNG, GIF up to 10MB</p>
                    </label>
                ) : showEditor ? (
                    <div className="mb-6">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">
                            <strong>How to crop:</strong> Drag the box to reposition, or drag the corner to resize. Your post will be cropped to the selected area.
                        </div>

                        <div className="border-2 border-gray-300 rounded-lg p-4 mb-4">
                            <div
                                ref={containerRef}
                                className="relative overflow-hidden bg-gray-900 rounded-lg mx-auto touch-none"
                                style={{
                                    width: '600px',
                                    height: '400px',
                                    maxWidth: '100%',
                                    cursor: isDragging ? 'grabbing' : 'default'
                                }}
                            >
                                <img
                                    ref={imageRef}
                                    src={preview}
                                    alt="Preview"
                                    onLoad={handleImageLoad}
                                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                                    style={{
                                        maxWidth: '100%',
                                        maxHeight: '100%',
                                        width: 'auto',
                                        height: 'auto',
                                        pointerEvents: 'none',
                                        userSelect: 'none'
                                    }}
                                    draggable="false"
                                />

                                {/* Dark overlay outside crop box */}
                                <div className="absolute inset-0 pointer-events-none">
                                    <svg width="100%" height="100%">
                                        <defs>
                                            <mask id="crop-mask">
                                                <rect width="100%" height="100%" fill="white"/>
                                                <rect
                                                    x={cropBox.x}
                                                    y={cropBox.y}
                                                    width={cropBox.width}
                                                    height={cropBox.height}
                                                    fill="black"
                                                />
                                            </mask>
                                        </defs>
                                        <rect
                                            width="100%"
                                            height="100%"
                                            fill="rgba(0, 0, 0, 0.5)"
                                            mask="url(#crop-mask)"
                                        />
                                    </svg>
                                </div>

                                {/* Crop box */}
                                <div
                                    className="absolute border-2 border-white shadow-lg"
                                    style={{
                                        left: cropBox.x,
                                        top: cropBox.y,
                                        width: cropBox.width,
                                        height: cropBox.height,
                                        cursor: isDragging ? 'grabbing' : 'grab',
                                        touchAction: 'none'
                                    }}
                                    onMouseDown={(e) => {
                                        if (e.target === e.currentTarget) {
                                            handleMouseDown(e, 'drag');
                                        }
                                    }}
                                    onTouchStart={(e) => {
                                        if (e.target === e.currentTarget) {
                                            handleTouchStart(e, 'drag');
                                        }
                                    }}
                                >
                                    {/* Grid lines */}
                                    <div className="absolute inset-0 pointer-events-none">
                                        <div className="absolute top-1/3 left-0 right-0 border-t border-white opacity-50"></div>
                                        <div className="absolute top-2/3 left-0 right-0 border-t border-white opacity-50"></div>
                                        <div className="absolute left-1/3 top-0 bottom-0 border-l border-white opacity-50"></div>
                                        <div className="absolute left-2/3 top-0 bottom-0 border-l border-white opacity-50"></div>
                                    </div>

                                    {/* Resize handle */}
                                    <div
                                        className="absolute bottom-0 right-0 w-8 h-8 bg-white border-2 border-purple-500 rounded-full cursor-nwse-resize transform translate-x-1/2 translate-y-1/2 flex items-center justify-center"
                                        style={{ touchAction: 'none' }}
                                        onMouseDown={(e) => handleMouseDown(e, 'resize')}
                                        onTouchStart={(e) => handleTouchStart(e, 'resize')}
                                    >
                                        <Maximize2 size={14} className="text-purple-600" />
                                    </div>

                                    {/* Corner handles */}
                                    <div className="absolute top-0 left-0 w-3 h-3 bg-white border border-white"></div>
                                    <div className="absolute top-0 right-0 w-3 h-3 bg-white border border-white"></div>
                                    <div className="absolute bottom-0 left-0 w-3 h-3 bg-white border border-white"></div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowEditor(false);
                                    setPreview(null);
                                    setSelectedFile(null);
                                }}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={applyCrop}
                                className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition font-semibold"
                            >
                                Apply & Continue
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="mb-6">
                        <div className="relative rounded-lg overflow-hidden mb-4">
                            <img
                                src={editedImage ? URL.createObjectURL(editedImage) : preview}
                                alt="Cropped preview"
                                className="w-full"
                            />
                        </div>
                        <button
                            onClick={() => setShowEditor(true)}
                            className="w-full mb-4 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm"
                        >
                            Re-crop Image
                        </button>
                    </div>
                )}

                {!showEditor && preview && (
                    <>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Caption
                            </label>
                            <textarea
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                                placeholder="Write a caption for your post..."
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                                rows={3}
                            />
                        </div>

                        {/* Category Selection */}
                        <div className="mb-6">
                            <div className="flex items-center gap-2 mb-3">
                                <Tag size={18} className="text-gray-700" />
                                <label className="block text-sm font-medium text-gray-700">
                                    Categories (select at least one) *
                                </label>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {categories.map(category => (
                                    <button
                                        key={category.id}
                                        type="button"
                                        onClick={() => toggleCategory(category.id)}
                                        className={`p-3 rounded-lg border-2 text-left transition ${
                                            selectedCategories.includes(category.id)
                                                ? category.special
                                                    ? 'border-pink-500 bg-pink-50'
                                                    : 'border-purple-500 bg-purple-50'
                                                : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                                        }`}
                                    >
                                        <div className="text-2xl mb-1">{category.emoji}</div>
                                        <div className={`font-bold text-sm mb-1 ${
                                            selectedCategories.includes(category.id) && category.special ? 'text-pink-700' : ''
                                        }`}>{category.name}</div>
                                        <div className="text-xs text-gray-500">{category.description}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setPreview(null);
                                    setSelectedFile(null);
                                    setEditedImage(null);
                                    setSelectedCategories([]);
                                    if (editingPost) {
                                        setEditingPost(null);
                                        setCurrentPage('home');
                                    }
                                }}
                                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                                disabled={uploading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpload}
                                disabled={uploading || selectedCategories.length === 0}
                                className={`flex-1 px-4 py-3 rounded-lg font-semibold transition ${
                                    uploading || selectedCategories.length === 0
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-purple-600 text-white hover:bg-purple-700'
                                }`}
                            >
                                {uploading ? 'Posting...' : (editingPost ? 'Update Post' : 'Post')}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default UploadPage;