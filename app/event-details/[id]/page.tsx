"use client";

import Button from '@/components/Button';
import EventCard from '@/components/EventCard';
import Map from '@/components/Map';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import EventSocial from '@/components/EventSocial';
import EventStalls from '@/components/EventStalls';
import { getEventTimeStatus, isEventEnded } from '@/lib/event-status';
import { formatPersonName } from '@/utils/formatPersonName';

type TicketType = { name: string; price: number; quantity: number; description?: string };
type EventData = {
    _id: string; title: string; description: string; venue?: string; latitude?: number; longitude?: number;
    category: string; images: string[]; startDate: string; endDate: string; ticketTypes: TicketType[];
    capacity: number; status: string; tags: string[]; ticketsSold?: number;
    organizer?: { _id: string; name?: string; profileImage?: string };
};
type UploadedPhoto = { imageUrl: string };

const formatDate = (value: string) => new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date(value));
const formatTime = (value: string) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
const fallbackImage = '/images/party.png';

const Page = () => {
    const { id } = useParams<{ id: string }>();
    const { data: session } = useSession();
    const [event, setEvent] = useState<EventData | null>(null);
    const [similarEvents, setSimilarEvents] = useState<EventData[]>([]);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [saved, setSaved] = useState(false);
    const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);

    useEffect(() => {
        if (!id) return;
        let active = true;

        const loadEvent = async () => {
            try {
                const response = await fetch(`/api/events/${id}`);
                if (response.status === 404) {
                    if (active) setNotFound(true);
                    return;
                }
                const result = await response.json();
                if (!response.ok || !result.success) throw new Error('Unable to load event.');
                if (!active) return;
                setEvent(result.data);

                const photosResponse = await fetch(`/api/photos?eventId=${id}`);
                const photosResult = await photosResponse.json();
                if (active && photosResponse.ok && photosResult.success) {
                    setUploadedPhotos(photosResult.data);
                }

                const similarResponse = await fetch(`/api/events?category=${encodeURIComponent(result.data.category)}&status=published&pageSize=12`);
                const similarResult = await similarResponse.json();
                if (similarResponse.ok && similarResult.success && active) {
                    setSimilarEvents((similarResult.data.items as EventData[]).filter((item) => item._id !== result.data._id).slice(0, 4));
                }
            } catch {
                if (active) setNotFound(true);
            } finally {
                if (active) setLoading(false);
            }
        };

        loadEvent();
        return () => { active = false; };
    }, [id]);

    useEffect(() => { 
        if (!id) return; 
        fetch('/api/saved-events').then(response => response.json()).then(result => { 
            if (result.success) setSaved(result.data.items.some((item: { event: { _id: string } }) => item.event._id === id)); 
        }).catch(() => undefined); 
    }, [id]);

    const toggleSaved = async () => { 
        if (!event) return; 
        const response = await fetch('/api/saved-events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: event._id }) }); 
        const result = await response.json(); 
        if (result.success) setSaved(result.data.saved); 
    };

    const details = useMemo(() => {
        if (!event) return [];
        const organizerName = event.organizer?.name ?? 'Event organizer';
        return [
            { icon: 'fa-solid fa-calendar', title: 'Date', text: formatDate(event.startDate) },
            { icon: 'fa-solid fa-clock', title: 'Time', text: `${formatTime(event.startDate)} - ${formatTime(event.endDate)}` },
            { icon: 'fa-solid fa-location-dot', title: 'Location', text: event.venue },
            { icon: 'fa-solid fa-user', title: 'Organizer', text: organizerName },
            { icon: 'fa-solid fa-ticket', title: 'Price', text: event.ticketTypes.some((ticket) => ticket.price === 0) ? 'Free tickets available' : `From Rs. ${Math.min(...event.ticketTypes.map((ticket) => ticket.price)).toLocaleString()}` },
            { icon: 'fa-solid fa-users', title: 'Seats', text: `${Math.max(0, event.capacity - (event.ticketsSold ?? 0)).toLocaleString()} remaining of ${event.capacity.toLocaleString()}` },
        ];
    }, [event]);

    if (loading) return <section className='py-16 px-4 text-center font-cause text-text-dark'>Loading event…</section>;
    if (notFound || !event) return <section className='py-16 px-4 text-center font-cause text-text-dark'><h1 className='font-dynapuff text-3xl font-bold'>Event not found</h1><p className='mt-3 text-text-dark/70'>This event may have been removed or the link is invalid.</p></section>;

    const organizerName = formatPersonName(event.organizer?.name ?? 'Event organizer');
    const organizerHref = `/userprofile?userId=${event.organizer?._id ?? ''}`;
    const coverImage = event.images[0] ?? fallbackImage;
    const galleryImages = Array.from(new Set([
        ...(event.images.length ? event.images : [fallbackImage]),
        ...uploadedPhotos.map((photo) => photo.imageUrl),
    ])).slice(0, 4);
    const hasCoordinates = typeof event.latitude === 'number' && typeof event.longitude === 'number' && (event.latitude !== 0 || event.longitude !== 0);
    const readableLocation = event.venue?.trim();
    const mapQuery = readableLocation || (hasCoordinates ? `${event.latitude},${event.longitude}` : '');
    const mapUrl = mapQuery ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed` : undefined;
    const role = session?.user?.role;
    const ownsEvent = role === 'organizer' && event.organizer?._id === session?.user?.id;
    const remainingSeats = Math.max(0, event.capacity - (event.ticketsSold ?? 0));
    const eventEnded = isEventEnded(event.endDate);
    const eventTimeStatus = getEventTimeStatus(event.startDate, event.endDate);

    return (
        <main className='bg-white text-text-dark font-cause'>
            {/* Hero Section */}
            <div className='relative h-64 md:h-96 lg:h-[500px] overflow-hidden bg-gray-200 flex items-center justify-center'>
                <img src={coverImage} alt={event.title} className='w-full h-full object-cover' />
                <div className='absolute inset-0 bg-gradient-to-t from-black/30 to-transparent'></div>
                <div className='absolute top-4 right-4 flex gap-2'>
                    <button onClick={toggleSaved} className='bg-white/90 hover:bg-white p-3 rounded-full shadow-lg transition-all'>
                        <i className={`fa-solid fa-bookmark text-lg ${saved ? 'text-brown-normal' : 'text-text-dark'}`}></i>
                    </button>
                </div>
            </div>

            <div className='max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-12'>
                {/* Main Content Grid */}
                <div className='grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10'>
                    {/* Left Column - Main Content */}
                    <div className='lg:col-span-2 space-y-8'>
                        {/* Title & Category */}
                        <div className='space-y-3'>
                            <div className='flex items-center gap-2 flex-wrap'>
                                <span className='inline-block px-3 py-1 bg-brown-light text-brown-normal rounded-full text-sm font-semibold capitalize'>{event.category.replaceAll('_', ' ')}</span>
                                <span className={`inline-block rounded-full px-3 py-1 text-sm ${eventEnded ? 'bg-gray-900 text-white' : 'bg-gray-100 text-text-dark'}`}>{eventEnded ? 'Event Ended' : eventTimeStatus === 'active' ? 'Event Active' : event.status}</span>
                            </div>
                            <h1 className='text-3xl md:text-4xl lg:text-5xl font-bold font-dynapuff leading-tight'>{event.title}</h1>
                            <div className='flex items-center gap-4 pt-2'>
                                <div className='flex items-center gap-2'>
                                    <i className="fa-solid fa-users text-brown-normal"></i>
                                    <span className='text-text-dark/70'>{event.ticketsSold ?? 0} attendees</span>
                                </div>
                                {remainingSeats > 0 && (
                                    <div className='flex items-center gap-2'>
                                        <i className="fa-solid fa-check-circle text-green-600"></i>
                                        <span className='text-green-700 font-semibold'>{remainingSeats} seats left</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Organizer Card */}
                        <div className='bg-gradient-to-r from-brown-light to-brown-light/50 rounded-xl p-6 flex items-center gap-4'>
                            <div className='w-16 h-16 rounded-full border-3 border-brown-normal flex items-center justify-center shrink-0 bg-white overflow-hidden'>
                                {event.organizer?.profileImage ? 
                                    <img src={event.organizer.profileImage} alt={organizerName} className='w-full h-full object-cover' /> 
                                    : <i className="fa-solid fa-user text-2xl text-brown-normal"></i>
                                }
                            </div>
                            <div className='flex-1 min-w-0'>
                                <p className='text-sm text-text-dark/70 mb-1'>Hosted by</p>
                                <Link href={organizerHref} className='hover:text-brown-dark transition-colors'>
                                    <h3 className='text-xl font-bold font-dynapuff truncate'>{organizerName}</h3>
                                </Link>
                            </div>
                        </div>

                        {/* Event Details Grid */}
                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                            {details.map((item) => (
                                <div key={item.title} className='flex gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-brown-normal hover:bg-brown-light/20 transition-all'>
                                    <div className='text-brown-normal text-xl mt-1 shrink-0 w-6 text-center'>
                                        <i className={item.icon}></i>
                                    </div>
                                    <div className='min-w-0'>
                                        <p className='text-sm font-semibold text-text-dark/70'>{item.title}</p>
                                        <p className='text-base font-semibold text-text-dark truncate'>{item.text}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Location Map */}
                        <div className='border-t pt-8'>
                            <Map mapId={1} mapUrl={mapUrl} />
                        </div>

                        {/* Event Description */}
                        <div className='border-t pt-8 space-y-6'>
                            <div>
                                <h2 className='text-2xl font-bold font-dynapuff mb-4'>About This Event</h2>
                                <p className='text-base md:text-lg leading-relaxed text-text-dark/80 whitespace-pre-wrap'>{event.description}</p>
                            </div>
                        </div>

                        {/* Ticket Types */}
                        <div className='border-t pt-8 space-y-4'>
                            <h2 className='text-2xl font-bold font-dynapuff'>Tickets</h2>
                            <div className='space-y-3'>
                                {event.ticketTypes.map((ticket) => (
                                    <div key={ticket.name} className='flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-brown-normal transition-all'>
                                        <div className='min-w-0'>
                                            <h3 className='font-semibold text-text-dark'>{ticket.name}</h3>
                                            {ticket.description && <p className='text-sm text-text-dark/70 mt-1'>{ticket.description}</p>}
                                            <p className='text-xs text-text-dark/60 mt-2'>{ticket.quantity} available</p>
                                        </div>
                                        <div className='shrink-0 text-right ml-4'>
                                            <p className='text-xl font-bold text-brown-normal'>{ticket.price === 0 ? 'Free' : `Rs. ${ticket.price.toLocaleString()}`}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Photos Gallery */}
                        <div className='border-t pt-8 space-y-4'>
                            <div className='flex items-center justify-between'>
                                <Link href={`/event-details/${event._id}/gallery`} className='text-2xl font-bold font-dynapuff hover:text-brown-normal transition-colors'>Gallery</Link>
                                <Link href={`/event-details/${event._id}/gallery`} className='text-brown-normal font-semibold hover:text-brown-dark transition-colors'>
                                    View All
                                </Link>
                            </div>
                            <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
                                {galleryImages.slice(0, 6).map((image, index) => (
                                    <Link href={`/event-details/${event._id}/gallery`} key={`${image}-${index}`} className='block aspect-square overflow-hidden rounded-lg bg-gray-200 hover:shadow-lg transition-shadow'>
                                        <img src={image} alt={`${event.title} ${index + 1}`} className='!block !h-full !w-full object-cover hover:scale-110 transition-transform duration-300' />
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Tags */}
                        <div className='border-t pt-8 space-y-4'>
                            <h3 className='text-lg font-semibold'>Tags</h3>
                            <div className='flex flex-wrap gap-2'>
                                {event.tags.map((tag) => (
                                    <Link key={tag} href={`/event-tags?tag=${encodeURIComponent(tag)}`} className='px-4 py-2 bg-gray-100 text-text-dark rounded-full hover:bg-brown-light hover:text-brown-dark transition-colors text-sm font-medium'>
                                        {tag}
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Similar Events */}
                        {similarEvents.length > 0 && (
                            <div className='border-t pt-8 space-y-6'>
                                <div className='flex items-center justify-between'>
                                    <h2 className='text-2xl font-bold font-dynapuff'>Similar Events</h2>
                                    <Link href={`/explore-events?category=${encodeURIComponent(event.category)}`} className='text-brown-normal font-semibold hover:text-brown-dark transition-colors'>
                                        View More →
                                    </Link>
                                </div>
                                <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                                    {similarEvents.map((similar) => (
                                        <EventCard key={similar._id} eventId={similar._id} tags={similar.tags} imageUrl={similar.images[0] ?? fallbackImage} imageAlt={similar.title} title={similar.title} organizer={`By ${similar.organizer?.name ?? 'Event organizer'}`} descriptions={[similar.description]} location={similar.venue ?? 'Location unavailable'} price={similar.ticketTypes.some((ticket) => ticket.price === 0) ? 'Free' : `From Rs. ${Math.min(...similar.ticketTypes.map((ticket) => ticket.price)).toLocaleString()}`} endDate={similar.endDate} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Event Stalls */}
                        <div className='border-t pt-8'>
                            <EventStalls eventId={event._id} />
                        </div>

                        {/* Event Social */}
                        <div className='border-t pt-8'>
                            <EventSocial eventId={event._id} />
                        </div>
                    </div>

                    {/* Right Column - Sticky Booking Card */}
                    <div className='lg:col-span-1'>
                        <div className='sticky top-4 bg-white rounded-xl border-2 border-brown-normal p-6 shadow-lg space-y-4'>
                            {/* Price Summary */}
                            <div className='space-y-2 pb-4 border-b'>
                                <p className='text-sm text-text-dark/70'>Starting from</p>
                                <p className='text-3xl font-bold text-brown-normal font-dynapuff'>
                                    {event.ticketTypes.some((t) => t.price === 0) 
                                        ? 'Free' 
                                        : `Rs. ${Math.min(...event.ticketTypes.map((t) => t.price)).toLocaleString()}`
                                    }
                                </p>
                            </div>

                            {/* Availability Status */}
                            <div className={`p-3 rounded-lg text-sm font-semibold text-center ${eventEnded || remainingSeats <= 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                                {eventEnded ? 'Event Ended' : remainingSeats > 0
                                    ? `${remainingSeats} tickets available` 
                                    : 'Event is sold out'
                                }
                            </div>

                            {/* Action Buttons */}
                            <div className='space-y-3'>
                                {role === 'attendee' && !eventEnded && (
                                    <Link href={`/booknow?eventId=${event._id}`} className='block'>
                                        <Button text="Book Now" variant="cta" size="lg" className='w-full' />
                                    </Link>
                                )}
                                {role === 'vendor' && (
                                    <Link href={`/vendor/stalls/create/step-1?eventId=${event._id}`} className='block'>
                                        <Button text="Create Stall" variant="cta" size="lg" className='w-full' />
                                    </Link>
                                )}
                                {ownsEvent && (
                                    <Link href={`/create-event/step-1?eventId=${event._id}`} className='block'>
                                        <Button text="Manage Event" variant="cta" size="lg" className='w-full' />
                                    </Link>
                                )}
                                {!role && !eventEnded && (
                                    <Link href='/login' className='block'>
                                        <Button text="Sign in to Book" variant="cta" size="lg" className='w-full' />
                                    </Link>
                                )}
                            </div>

                            {/* Share & Save */}
                            <div className='flex gap-2 pt-4 border-t'>
                                <button className='flex-1 py-2 px-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center justify-center gap-2 text-text-dark font-semibold'>
                                    <i className="fa-solid fa-share-alt"></i>
                                    <span className='hidden sm:inline'>Share</span>
                                </button>
                                <button onClick={toggleSaved} className={`flex-1 py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2 font-semibold ${saved ? 'bg-brown-light text-brown-normal' : 'bg-gray-100 hover:bg-gray-200 text-text-dark'}`}>
                                    <i className="fa-solid fa-bookmark"></i>
                                    <span className='hidden sm:inline'>{saved ? 'Saved' : 'Save'}</span>
                                </button>
                            </div>

                            {/* Important Info */}
                            <div className='bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 space-y-1'>
                                <p><strong>✓</strong> Secure payment</p>
                                <p><strong>✓</strong> Mobile e-tickets</p>
                                <p><strong>✓</strong> Money-back guarantee</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Page;
