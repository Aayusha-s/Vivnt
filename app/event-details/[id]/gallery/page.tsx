"use client";

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';

type EventGallery = {
    _id: string;
    title: string;
    images: string[];
};

type GalleryPhoto = { imageUrl: string };

const fallbackImage = '/images/party.png';

export default function GalleryPage() {
    const { id } = useParams<{ id: string }>();
    const [event, setEvent] = useState<EventGallery | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [uploadedPhotos, setUploadedPhotos] = useState<GalleryPhoto[]>([]);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [mounted, setMounted] = useState(false);
    const { status: sessionStatus } = useSession();

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    useEffect(() => {
        if (!id) return;
        let active = true;

        fetch(`/api/events/${id}`)
            .then(async (response) => {
                if (response.status === 404) throw new Error('not-found');
                const result = await response.json();
                if (!response.ok || !result.success) throw new Error('Unable to load gallery.');
                if (active) setEvent(result.data);
                const photosResponse = await fetch(`/api/photos?eventId=${id}`);
                const photosResult = await photosResponse.json();
                if (active && photosResponse.ok && photosResult.success) setUploadedPhotos(photosResult.data);
            })
            .catch(() => {
                if (active) setNotFound(true);
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => { active = false; };
    }, [id]);

    useEffect(() => {
        if (!selectedImage) return;
        const previousBodyOverflow = document.body.style.overflow;
        const previousHtmlOverflow = document.documentElement.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.documentElement.style.overflow = previousHtmlOverflow;
        };
    }, [selectedImage]);

    const handleUpload = async (file: File) => {
        if (!id) return;
        setUploading(true);
        setUploadError('');
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('eventId', id);
            const response = await fetch('/api/photos', { method: 'PUT', body: formData });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error?.message || 'Unable to upload photo.');
            setUploadedPhotos((current) => [result.data, ...current]);
        } catch (error) {
            setUploadError(error instanceof Error ? error.message : 'Unable to upload photo.');
        } finally {
            setUploading(false);
        }
    };

    if (loading) return <section className='py-16 px-4 text-center font-cause text-text-dark'>Loading gallery…</section>;
    if (notFound || !event) return <section className='py-16 px-4 text-center font-cause text-text-dark'><h1 className='font-dynapuff text-3xl font-bold'>Gallery unavailable</h1><p className='mt-3 text-text-dark/70'>This event may have been removed or the link is invalid.</p></section>;

    const images = [...(event.images.length ? event.images : [fallbackImage]), ...uploadedPhotos.map((photo) => photo.imageUrl)];

    return (
        <main className='min-h-screen bg-[#fbfaf8] px-4 py-8 font-cause text-text-dark md:px-8 md:py-12'>
            <div className='mx-auto max-w-7xl'>
                <Link href={`/event-details/${event._id}`} className='inline-flex items-center gap-2 text-sm font-semibold text-brown-normal transition-colors hover:text-brown-dark'>
                    <i className='fa-solid fa-arrow-left' aria-hidden='true'></i>
                    Back to event
                </Link>
                <header className='mb-8 mt-6 border-b border-brown-light/60 pb-6 md:mb-10'>
                    <p className='mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-brown-normal'>Event gallery</p>
                    <h1 className='font-dynapuff text-3xl font-bold md:text-5xl'>{event.title}</h1>
                    <p className='mt-3 text-text-dark/65'>{images.length} {images.length === 1 ? 'photo' : 'photos'}</p>
                </header>
                <div className='mb-8 flex flex-col gap-3 rounded-xl border border-brown-light/70 bg-white p-5 sm:flex-row sm:items-center sm:justify-between'>
                    <div>
                        <h2 className='font-dynapuff text-lg font-bold'>Add to this gallery</h2>
                        <p className='mt-1 text-sm text-text-dark/65'>Share a JPG, PNG, or WebP image up to 10MB.</p>
                        {uploadError && <p className='mt-2 text-sm font-semibold text-red-600'>{uploadError}</p>}
                    </div>
                    {sessionStatus === 'authenticated' ? (
                        <label className='inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-brown-normal px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-brown-dark'>
                            <i className='fa-solid fa-arrow-up-from-bracket' aria-hidden='true'></i>
                            {uploading ? 'Uploading...' : 'Upload image'}
                            <input type='file' accept='image/jpeg,image/png,image/webp' className='sr-only' disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleUpload(file); event.target.value = ''; }} />
                        </label>
                    ) : (
                        <Link href='/login' className='inline-flex items-center justify-center rounded-lg border border-brown-normal px-4 py-3 text-sm font-bold text-brown-normal transition-colors hover:bg-brown-light/30'>Sign in to upload</Link>
                    )}
                </div>
                <div className='columns-1 gap-5 sm:columns-2 lg:columns-3 xl:columns-4'>
                    {images.map((image, index) => (
                        <button type='button' key={`${image}-${index}`} onClick={() => setSelectedImage(image)} className='mb-5 block w-full break-inside-avoid overflow-hidden rounded-xl bg-gray-200 text-left shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg'>
                            <img src={image} alt={`${event.title} gallery photo ${index + 1}`} className='block h-auto w-full' loading={index < 4 ? 'eager' : 'lazy'} />
                        </button>
                    ))}
                </div>
            </div>
            {mounted && selectedImage && createPortal(
                <div role='presentation' className='fixed inset-0 z-[1000] flex h-[100dvh] w-screen touch-none items-center justify-center overflow-hidden overscroll-none bg-black/85 p-4' onClick={() => setSelectedImage(null)}>
                    <button type='button' aria-label='Close image preview' onClick={() => setSelectedImage(null)} className='absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-2xl text-white transition-colors hover:bg-white/30'>
                        <i className='fa-solid fa-xmark' aria-hidden='true'></i>
                    </button>
                    <img src={selectedImage} alt={`${event.title} preview`} className='!m-0 !h-auto !w-auto max-h-[90dvh] max-w-[90vw] object-contain' onClick={(event) => event.stopPropagation()} />
                </div>,
                document.body,
            )}
        </main>
    );
}