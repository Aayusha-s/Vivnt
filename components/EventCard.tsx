"use client";

import Button from "./Button";
import { useRouter } from "next/navigation";
import { Calendar, ChevronRight, Heart, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTilt } from "@/hooks/use-tilt";
import { useEffect, useState } from "react";
import { isEventEnded } from "@/lib/event-status";
import { formatPersonName } from "@/utils/formatPersonName";

type EventCardProps = {
    eventId: string | number;
    tags: string[];
    imageUrl: string;
    imageAlt: string;
    title: string;
    organizer: string;
    descriptions: string[];
    location: string;
    price: string;
    endDate?: string;
};

const EventCard = ({
    eventId,
    tags,
    imageUrl,
    imageAlt,
    title,
    organizer,
    descriptions,
    location,
    price,
    endDate,
}: EventCardProps) => {
    const router = useRouter();
    const { cardRef, tilt, prefersReducedMotion } = useTilt(3);
    const [saved, setSaved] = useState(false);
    const ended = endDate ? isEventEnded(endDate) : false;
    useEffect(() => { fetch('/api/saved-events').then(response => response.json()).then(result => { if (result.success) setSaved(result.data.items.some((item: { event: { _id: string } }) => item.event._id === String(eventId))); }).catch(() => undefined); }, [eventId]);
    const toggleSaved = async (event: React.MouseEvent) => { event.stopPropagation(); const response = await fetch('/api/saved-events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: String(eventId) }) }); const result = await response.json(); if (result.success) setSaved(result.data.saved); };

    const handleCardClick = () => {
        router.push(`/event-details/${eventId}`);
    };

    const handleTagClick = (e: React.MouseEvent, tag: string) => {
        e.stopPropagation();
        router.push(`/event-tags?tag=${tag}`);
    };

    return (
        <article
            ref={cardRef}
            onClick={handleCardClick}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleCardClick();
                }
            }}
            role="link"
            tabIndex={0}
            aria-label={`View event: ${title}`}
            style={prefersReducedMotion ? undefined : tilt}
            className={cn(
                "group surface-card motion-card-lift flex h-full cursor-pointer flex-col overflow-hidden p-0",
                "shadow-sm hover:shadow-lg",
                prefersReducedMotion && "interactive-card"
            )}
        >
            <div className="relative aspect-[16/10] w-full overflow-hidden">
                <img
                    src={imageUrl}
                    alt={imageAlt}
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                    {ended && <span className="rounded-full bg-gray-900/90 px-2.5 py-1 text-xs font-semibold text-white">Event Ended</span>}
                    {tags.slice(0, 2).map((tag) => (
                        <div
                            key={tag}
                            onClick={(e) => handleTagClick(e, tag)}
                            className="transition-transform duration-200 group-hover:scale-[1.02]"
                        >
                            <Button
                                text={tag}
                                variant="tag"
                                size="sm"
                                className="backdrop-blur-sm transition-all duration-200 group-hover:border-brown-dark group-hover:shadow-sm"
                            />
                        </div>
                    ))}
                </div>
                <button type="button" onClick={toggleSaved} className="absolute right-3 top-3" aria-label={saved ? 'Remove saved event' : 'Save event'}><Heart className={saved ? 'fill-red-500 text-red-500' : 'text-white'} /></button>
            </div>

            <div className="flex flex-1 flex-col p-4 md:p-5">
                <div className="mb-3 flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brown-light text-brown-dark transition-colors duration-200 group-hover:bg-brown-light-hover">
                        <Calendar className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="line-clamp-2 min-h-[2.75rem] text-base font-semibold leading-snug text-text-dark transition-colors duration-200 group-hover:text-brown-darker">
                            {title}
                        </h3>
                        <p className="mt-0.5 truncate text-sm text-text-muted">{formatPersonName(organizer)}</p>
                    </div>
                </div>

                <ul className="mb-4 min-h-[3.75rem] space-y-1.5 overflow-hidden text-sm text-text-light">
                    {descriptions.slice(0, 3).map((desc) => (
                        <li key={desc} className="flex items-start gap-2">
                            <ChevronRight
                                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brown-normal transition-transform duration-200 group-hover:translate-x-0.5"
                                aria-hidden="true"
                            />
                            <span className="line-clamp-2">{desc}</span>
                        </li>
                    ))}
                </ul>

                <div className="mt-auto flex items-center justify-between gap-3 border-t border-brown-normal/30 pt-3 text-sm">
                    <div className="flex min-w-0 items-center gap-1.5 text-text-light">
                        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{location}</span>
                    </div>
                    <span className="shrink-0 font-semibold text-brown-darker">{price}</span>
                </div>
            </div>
        </article>
    );
};

export default EventCard;
