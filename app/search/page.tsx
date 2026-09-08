'use client'

import React, { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
    Search,
    Users,
    Zap,
    Calendar,
    MapPin,
    DollarSign,
    Star,
    MessageCircle,
    ArrowRight,
} from 'lucide-react'
import Button from '@/components/Button'
import { formatPersonName } from '@/utils/formatPersonName'

type Event = {
    _id: string
    title: string
    venue: string
    images: string[]
    tags: string[]
    description: string
    startDate: string
    ticketTypes: Array<{ price: number }>
    organizer: { _id: string; name: string }
}

type Person = {
    _id: string
    name: string
    username: string
    profileImage: string
    role: 'organizer' | 'vendor' | 'attendee' | 'ticket_checker'
    bio: string
    followers: string[]
    location: string
}

type SearchResults = {
    events: Event[]
    people: Person[]
    count: number
    query: string
}

const SearchResultsPage = () => {
    const searchParams = useSearchParams()
    const router = useRouter()
    const { data: session } = useSession()
    const query = searchParams.get('q') || ''
    const [results, setResults] = useState<SearchResults | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [newQuery, setNewQuery] = useState(query)
    const [activeTab, setActiveTab] = useState<'all' | 'events' | 'people'>('all')

    useEffect(() => {
        if (!query) {
            setLoading(false)
            return
        }

        const fetchResults = async () => {
            try {
                setLoading(true)
                setError('')
                const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
                const data = await response.json()
                if (data.success) {
                    setResults(data.data)
                } else {
                    setError('Failed to load search results')
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred')
            } finally {
                setLoading(false)
            }
        }

        fetchResults()
    }, [query])

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        if (newQuery.trim()) {
            router.push(`/search?q=${encodeURIComponent(newQuery)}`)
        }
    }

    const getRoleDisplay = (role: string) => {
        const roleMap: Record<string, string> = {
            organizer: 'Event Organizer',
            vendor: 'Vendor',
            attendee: 'Community Member',
            ticket_checker: 'Ticket Checker',
        }
        return roleMap[role] || role
    }

    const getRoleBgColor = (role: string) => {
        const colors: Record<string, string> = {
            organizer: 'bg-blue-100 text-blue-700',
            vendor: 'bg-green-100 text-green-700',
            attendee: 'bg-purple-100 text-purple-700',
            ticket_checker: 'bg-orange-100 text-orange-700',
        }
        return colors[role] || 'bg-gray-100 text-gray-700'
    }

    if (loading) {
        return (
            <section className='my-4 mx-2 px-4 font-cause text-text-dark md:my-3 md:mx-3 md:px-3 lg:my-4 lg:mx-4 lg:px-4 xl:my-6 xl:mx-6 xl:px-6 2xl:my-8 2xl:mx-8 2xl:px-8'>
                <div className='max-w-4xl mx-auto'>
                    <div className='mb-8'>
                        <h1 className='font-dynapuff text-3xl md:text-4xl font-bold mb-4'>Search Results</h1>
                        <form onSubmit={handleSearch} className='flex gap-2'>
                            <input
                                type='text'
                                value={newQuery}
                                onChange={(e) => setNewQuery(e.target.value)}
                                placeholder='Search events and people...'
                                className='flex-1 px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brown-normal'
                            />
                            <Button text='Search' variant='cta' size='md' onClick={() => handleSearch({ preventDefault: () => {} } as React.FormEvent)} />
                        </form>
                    </div>
                    <p className='text-gray-500 text-center py-8'>Loading results...</p>
                </div>
            </section>
        )
    }

    if (error) {
        return (
            <section className='my-4 mx-2 px-4 font-cause text-text-dark md:my-3 md:mx-3 md:px-3 lg:my-4 lg:mx-4 lg:px-4 xl:my-6 xl:mx-6 xl:px-6 2xl:my-8 2xl:mx-8 2xl:px-8'>
                <div className='max-w-4xl mx-auto'>
                    <h1 className='font-dynapuff text-3xl md:text-4xl font-bold mb-4'>Search Results</h1>
                    <div className='text-red-600 bg-red-50 border border-red-200 rounded-lg p-4'>{error}</div>
                </div>
            </section>
        )
    }

    if (!results || (!results.events.length && !results.people.length)) {
        return (
            <section className='my-4 mx-2 px-4 font-cause text-text-dark md:my-3 md:mx-3 md:px-3 lg:my-4 lg:mx-4 lg:px-4 xl:my-6 xl:mx-6 xl:px-6 2xl:my-8 2xl:mx-8 2xl:px-8'>
                <div className='max-w-4xl mx-auto'>
                    <div className='mb-8'>
                        <h1 className='font-dynapuff text-3xl md:text-4xl font-bold mb-4'>Search Results</h1>
                        <form onSubmit={handleSearch} className='flex gap-2'>
                            <input
                                type='text'
                                value={newQuery}
                                onChange={(e) => setNewQuery(e.target.value)}
                                placeholder='Search events and people...'
                                className='flex-1 px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brown-normal'
                            />
                            <Button text='Search' variant='cta' size='md' onClick={() => handleSearch({ preventDefault: () => {} } as React.FormEvent)} />
                        </form>
                    </div>
                    <div className='text-center py-12'>
                        <Search size={48} className='mx-auto text-gray-300 mb-4' />
                        <h2 className='text-2xl font-bold text-gray-600 mb-2'>No results found</h2>
                        <p className='text-gray-500 mb-6'>
                            We couldn&apos;t find any events or people matching &quot;{query}&quot;
                        </p>
                        <Link href='/explore-events' className='text-blue-600 hover:text-blue-700 font-medium'>
                            Browse all events →
                        </Link>
                    </div>
                </div>
            </section>
        )
    }

    const eventCount = results.events.length
    const peopleCount = results.people.length

    return (
        <section className='my-4 mx-2 px-4 font-cause text-text-dark md:my-3 md:mx-3 md:px-3 lg:my-4 lg:mx-4 lg:px-4 xl:my-6 xl:mx-6 xl:px-6 2xl:my-8 2xl:mx-8 2xl:px-8'>
            <div className='max-w-6xl mx-auto'>
                {/* Search Bar */}
                <div className='mb-8'>
                    <h1 className='font-dynapuff text-3xl md:text-4xl font-bold mb-4'>Search Results for &quot;{query}&quot;</h1>
                    <form onSubmit={handleSearch} className='flex gap-2'>
                        <input
                            type='text'
                            value={newQuery}
                            onChange={(e) => setNewQuery(e.target.value)}
                            placeholder='Search events and people...'
                            className='flex-1 px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brown-normal'
                        />
                        <Button text='Search' variant='cta' size='md' onClick={() => handleSearch({ preventDefault: () => {} } as React.FormEvent)} />
                    </form>
                </div>

                {/* Results Summary */}
                <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-8'>
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`p-4 rounded-lg border-2 transition-all ${
                            activeTab === 'all'
                                ? 'border-brown-normal bg-brown-light'
                                : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                        <p className='text-2xl font-bold'>{results.count}</p>
                        <p className='text-sm text-gray-600'>Total Results</p>
                    </button>
                    <button
                        onClick={() => setActiveTab('events')}
                        className={`p-4 rounded-lg border-2 transition-all ${
                            activeTab === 'events'
                                ? 'border-brown-normal bg-brown-light'
                                : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                        <p className='text-2xl font-bold'>{eventCount}</p>
                        <p className='text-sm text-gray-600'>Events</p>
                    </button>
                    <button
                        onClick={() => setActiveTab('people')}
                        className={`p-4 rounded-lg border-2 transition-all ${
                            activeTab === 'people'
                                ? 'border-brown-normal bg-brown-light'
                                : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                        <p className='text-2xl font-bold'>{peopleCount}</p>
                        <p className='text-sm text-gray-600'>People</p>
                    </button>
                </div>

                {/* Events Section */}
                {(activeTab === 'all' || activeTab === 'events') && (
                    <div className='mb-12'>
                        <h2 className='font-dynapuff text-2xl font-bold mb-6 flex items-center gap-2'>
                            <Zap size={24} /> Events ({eventCount})
                        </h2>
                        {eventCount > 0 ? (
                            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                                {results.events.map((event) => (
                                    <article
                                        key={event._id}
                                        onClick={() => router.push(`/event-details/${event._id}`)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault()
                                                router.push(`/event-details/${event._id}`)
                                            }
                                        }}
                                        role='link'
                                        tabIndex={0}
                                        className='group cursor-pointer rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300'
                                    >
                                        <div className='relative overflow-hidden bg-gray-200 h-48'>
                                            <img
                                                src={event.images?.[0] || '/images/party.png'}
                                                alt={event.title}
                                                className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-300'
                                            />
                                            {event.tags.length > 0 && (
                                                <div className='absolute top-3 left-3 flex flex-wrap gap-2'>
                                                    {event.tags.slice(0, 2).map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className='px-2 py-1 bg-brown-normal text-white text-xs font-semibold rounded-full'
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className='p-4'>
                                            <h3 className='font-dynapuff font-bold text-lg mb-2 line-clamp-2 group-hover:text-brown-normal transition-colors'>
                                                {event.title}
                                            </h3>
                                            <p className='text-sm text-gray-600 mb-3 line-clamp-2'>{event.description}</p>

                                            <div className='space-y-2 text-sm text-gray-600'>
                                                {event.startDate && (
                                                    <div className='flex items-center gap-2'>
                                                        <Calendar size={16} />
                                                        <span>
                                                            {new Date(event.startDate).toLocaleDateString('en-US', {
                                                                month: 'short',
                                                                day: 'numeric',
                                                            })}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className='flex items-center gap-2'>
                                                    <MapPin size={45} />
                                                    <span className='line-clamp-1'>{event.venue}</span>
                                                </div>
                                                {event.ticketTypes && event.ticketTypes.length > 0 && (
                                                    <div className='flex items-center gap-2'>
                                                        <DollarSign size={16} />
                                                        <span>
                                                            {event.ticketTypes.some((t) => t.price === 0)
                                                                ? 'Free'
                                                                : `From Rs. ${Math.min(...event.ticketTypes.map((t) => t.price))}`}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {event.organizer && (
                                                <div className='mt-4 pt-4 border-t border-gray-200'>
                                                    <Link
                                                        href={`/userprofile?userId=${event.organizer._id}`}
                                                        className='text-sm text-blue-600 hover:text-blue-700 font-medium'
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        By {formatPersonName(event.organizer.name)}
                                                    </Link>
                                                </div>
                                            )}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <p className='text-gray-500 text-center py-8'>No events found matching your search.</p>
                        )}
                    </div>
                )}

                {/* People Section */}
                {(activeTab === 'all' || activeTab === 'people') && (
                    <div className='mb-12'>
                        <h2 className='font-dynapuff text-2xl font-bold mb-6 flex items-center gap-2'>
                            <Users size={24} /> People ({peopleCount})
                        </h2>
                        {peopleCount > 0 ? (
                            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                                {results.people.map((person) => (
                                    <Link
                                        key={person._id}
                                        href={
                                            person.username
                                                ? `/userprofile?username=${encodeURIComponent(person.username)}`
                                                : `/userprofile?userId=${person._id}`
                                        }
                                        className='border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 p-6'
                                    >
                                        <div className='flex flex-col items-center text-center'>
                                            <img
                                                src={person.profileImage || '/images/user-avatar.png'}
                                                alt={person.name}
                                                className='w-20 h-20 rounded-full object-cover mb-4 border-2 border-gray-200'
                                            />
                                            <h3 className='font-dynapuff font-bold text-lg mb-1'>{person.name}</h3>
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold mb-3 ${getRoleBgColor(person.role)}`}>
                                                {getRoleDisplay(person.role)}
                                            </span>

                                            {person.bio && (
                                                <p className='text-sm text-gray-600 mb-4 line-clamp-2'>{person.bio}</p>
                                            )}

                                            <div className='w-full space-y-2 mb-4 text-sm text-gray-600'>
                                                {person.location && (
                                                    <div className='flex items-center justify-center gap-2'>
                                                        <MapPin size={16} />
                                                        <span>{person.location}</span>
                                                    </div>
                                                )}
                                                <div className='flex items-center justify-center gap-2'>
                                                    <Users size={16} />
                                                    <span>{person.followers?.length || 0} followers</span>
                                                </div>
                                            </div>

                                            <div className='w-full flex gap-2'>
                                                <Button
                                                    text='View Profile'
                                                    variant='cta'
                                                    size='md'
                                                    className='flex-1'
                                                />
                                                <Button
                                                    text='Message'
                                                    variant='secondary'
                                                    size='md'
                                                    iconLeft={<MessageCircle size={16} />}
                                                    className='flex-1'
                                                />
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <p className='text-gray-500 text-center py-8'>No people found matching your search.</p>
                        )}
                    </div>
                )}
            </div>
        </section>
    )
}

export default function Page() {
    return (
        <Suspense
            fallback={
                <section className='px-4 py-8 text-text-dark'>Loading search results…</section>
            }
        >
            <SearchResultsPage />
        </Suspense>
    )
}
