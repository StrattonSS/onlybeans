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

    // Categories users can choose from (added Throwback)
    const categories = [
        { id: 'throwback', name: 'Throwback', emoji: '🕰️', description: 'Old pics, new vibes', special: true },
        { id: 'everyday', name: 'Everyday Life', emoji: '🐱', description: 'Daily moments' },
        { id: 'rainbow-bridge', name: 'Rainbow Bridge', emoji: '🌈', description: 'In loving memory', special: true },
        { id: 'adoption', name: 'Up for Adoption', emoji: '🏠', description: 'Looking for a home', special: true },
        { id: 'funny', name: 'Funny', emoji: '😹', description: 'Hilarious moments' },
        { id: 'sleeping', name: 'Sleepy Time', emoji: '😴', description: 'Catching Z\'s' },
        { id: 'playing', name: 'Playtime', emoji: '🎾', description: 'Action shots' },
        { id: 'food', name: 'Food Time', emoji: '🍽️', description: 'Nom nom nom' },
        { id: 'adventure', name: 'Adventures', emoji: '🌟', description: 'Exploring the world' },
        { id: 'grooming', name: 'Grooming', emoji: '✨', description: 'Looking fabulous' },
        { id: 'tricks', name: 'Tricks & Skills', emoji: '🎪', description: 'Showing off' }
    ];

    useEffect(() => {
        if (editingPost) {
            setCaption(editingPost.caption);
            setPreview(editingPost.imageUrl);
            setSelectedCategories(editingPost.categories || []);
        }
    }, [editingPost]);

    // Check if user can upload
    if (currentUser?.accountType === 'viewer') {
        return (
            <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-lg shadow p-12 text-center">
                    <div className="text-6xl mb-4">😿</div>
                    <h2 className="text-2xl font-bold mb-4">Viewer accounts cannot post</h2>
                    <p className="text-gray-600 mb-4">
                        To share cat photos, you'll need to upgrade to a Cat Owner account.
                    </p>
                    <button
                        onClick={() => setCurrentPage('home')}
                        className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    if (cats.length === 0 && currentUser?.accountType === 'feline') {
        return (
            <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-lg shadow p-12 text-center">
                    <div className="text-6xl mb-4">😺</div>
                    <h2 className="text-2xl font-bold mb-4">Add your first cat profile</h2>
                    <p className="text-gray-600 mb-4">
                        Before uploading photos, you need to create a cat profile!
                    </p>
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

    const handleMouseDown = (e, type) => {
        e.preventDefault();
        if (type === 'drag') setIsDragging(true);
        if (type === 'resize') setIsResizing(true);
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e) => {
        if (!isDragging && !isResizing) return;

        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;

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

        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setIsResizing(false);
    };

    useEffect(() => {
        if (isDragging || isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, isResizing, dragStart]);

    const applyCrop = () => {
        if (!imageRef.current || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const img = imageRef.current;
        theContainer:
        {
            const container = containerRef.current;
            if (!container) break theContainer;

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
        }
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
                                className="relative overflow-hidden bg-gray-900 rounded-lg mx-auto"
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
                                        cursor: isDragging ? 'grabbing' : 'grab'
                                    }}
                                    onMouseDown={(e) => {
                                        if (e.target === e.currentTarget) {
                                            handleMouseDown(e, 'drag');
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
                                        className="absolute bottom-0 right-0 w-6 h-6 bg-white border-2 border-purple-500 rounded-full cursor-nwse-resize transform translate-x-1/2 translate-y-1/2"
                                        onMouseDown={(e) => handleMouseDown(e, 'resize')}
                                    >
                                        <Maximize2 size={12} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-purple-600" />
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
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xl">{category.emoji}</span>
                                            <span className={`font-semibold text-sm ${
                                                selectedCategories.includes(category.id)
                                                    ? category.special ? 'text-pink-700' : 'text-purple-700'
                                                    : 'text-gray-700'
                                            }`}>
                                                {category.name}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500">{category.description}</p>
                                    </button>
                                ))}
                            </div>

                            {selectedCategories.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <span className="text-xs text-gray-600">Selected:</span>
                                    {selectedCategories.map(catId => {
                                        const cat = categories.find(c => c.id === catId);
                                        return (
                                            <span key={catId} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                                                {cat?.emoji} {cat?.name}
                                            </span>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    if (editingPost) {
                                        setEditingPost(null);
                                    }
                                    setCaption('');
                                    setPreview(null);
                                    setSelectedFile(null);
                                    setEditedImage(null);
                                    setSelectedCategories([]);
                                    setCurrentPage('home');
                                }}
                                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                                disabled={uploading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpload}
                                disabled={uploading || !selectedCat || selectedCategories.length === 0}
                                className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
