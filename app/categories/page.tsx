"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Music,
  Utensils,
  Briefcase,
  Palette,
  Trophy,
  Heart,
  Code,
  BookOpen,
  Users,
  Zap,
  Camera,
  Gamepad2,
  ArrowRight,
  X,
  ChevronRight,
} from "lucide-react";
import EventCard from "@/components/EventCard";
import Button from "@/components/Button";

type Event = {
  _id: string;
  title: string;
  description: string;
  venue: string;
  tags: string[];
  images: string[];
  ticketTypes: { price: number }[];
  organizer?: { name?: string };
};

type Category = {
  name: string;
  count: number;
};

const toSentenceCase = (value: string) =>
  value
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());

const FALLBACK_GRADIENTS = [
  "from-slate-500 to-slate-700",
  "from-fuchsia-500 to-pink-600",
  "from-cyan-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-violet-500 to-purple-700",
];

// Enhanced category mapping with better names and colors
const CATEGORY_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ReactNode;
    color: string;
    gradient: string;
    description: string;
  }
> = {
  music: {
    label: "Music & concerts",
    icon: <Music className="w-8 h-8" />,
    color: "text-pink-600",
    gradient: "from-pink-500 to-rose-600",
    description: "Live performances and music events",
  },
  food: {
    label: "Food & drink",
    icon: <Utensils className="w-8 h-8" />,
    color: "text-orange-600",
    gradient: "from-orange-500 to-amber-600",
    description: "Culinary experiences and dining events",
  },
  business: {
    label: "Business & networking",
    icon: <Briefcase className="w-8 h-8" />,
    color: "text-blue-600",
    gradient: "from-blue-500 to-cyan-600",
    description: "Professional networking and conferences",
  },
  arts: {
    label: "Arts & theater",
    icon: <Palette className="w-8 h-8" />,
    color: "text-purple-600",
    gradient: "from-purple-500 to-indigo-600",
    description: "Art exhibitions and theater shows",
  },
  sports: {
    label: "Sports & recreation",
    icon: <Trophy className="w-8 h-8" />,
    color: "text-green-600",
    gradient: "from-green-500 to-emerald-600",
    description: "Sports events and outdoor activities",
  },
  wellness: {
    label: "Health & wellness",
    icon: <Heart className="w-8 h-8" />,
    color: "text-red-600",
    gradient: "from-red-500 to-pink-600",
    description: "Fitness and wellness programs",
  },
  technology: {
    label: "Technology & innovation",
    icon: <Code className="w-8 h-8" />,
    color: "text-indigo-600",
    gradient: "from-indigo-500 to-purple-600",
    description: "Tech talks and innovation events",
  },
  education: {
    label: "Education & learning",
    icon: <BookOpen className="w-8 h-8" />,
    color: "text-blue-700",
    gradient: "from-blue-600 to-blue-500",
    description: "Workshops and educational seminars",
  },
  community: {
    label: "Community & social",
    icon: <Users className="w-8 h-8" />,
    color: "text-teal-600",
    gradient: "from-teal-500 to-green-600",
    description: "Community gatherings and meetups",
  },
  entertainment: {
    label: "Entertainment",
    icon: <Gamepad2 className="w-8 h-8" />,
    color: "text-fuchsia-600",
    gradient: "from-fuchsia-500 to-purple-600",
    description: "Entertainment and gaming events",
  },
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/events/taxonomy").then((r) => r.json()),
      fetch("/api/events?status=published&pageSize=50").then((r) => r.json()),
    ])
      .then(([taxRes, eventsRes]) => {
        if (taxRes.success) setCategories(taxRes.data.categories);
        if (eventsRes.success) {
          setEvents(eventsRes.data.items);
          setFilteredEvents(eventsRes.data.items);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Filter events by selected category
  useEffect(() => {
    if (selectedCategory) {
      setFilteredEvents(
        events.filter((event) =>
          event.tags?.some((tag) =>
            tag.toLowerCase().includes(selectedCategory.toLowerCase()),
          ),
        ),
      );
    } else {
      setFilteredEvents(events);
    }
  }, [selectedCategory, events]);

  const selectedCategoryConfig = selectedCategory
    ? CATEGORY_CONFIG[selectedCategory.toLowerCase()] || {
        label: toSentenceCase(selectedCategory),
        icon: <Zap />,
        color: "text-gray-600",
        gradient: "from-gray-500 to-gray-600",
      }
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-brown-light via-background to-white py-14 md:py-20 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="font-dynapuff text-4xl md:text-5xl font-bold text-text-dark mb-4">
              Event Categories
            </h1>
            <p className="text-lg text-text-light leading-relaxed">
              Explore events across diverse categories and discover what excites
              you. From music and arts to technology and wellness, find your
              next unforgettable experience.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Selected Category Info */}
        {selectedCategory && (
          <div
            className={`mb-10 p-6 rounded-xl border border-border bg-gradient-to-r ${selectedCategoryConfig?.gradient} text-white`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  {selectedCategoryConfig?.icon}
                  <h2 className="text-2xl font-bold">
                    {selectedCategoryConfig?.label}
                  </h2>
                </div>
                <p className="text-white/90">
                  {selectedCategoryConfig?.description}
                </p>
                <p className="text-sm text-white/75 mt-2">
                  {filteredEvents.length} events available
                </p>
              </div>
              <button
                onClick={() => setSelectedCategory(null)}
                className="p-2 hover:bg-white/20 rounded-lg transition"
                aria-label="Clear filter"
              >
                <X size={24} />
              </button>
            </div>
          </div>
        )}

        {/* Categories Grid */}
        <div className="mb-16">
          <h2 className="font-dynapuff text-3xl font-bold text-text-dark mb-8">
            Browse Categories
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {categories.map((category, index) => {
              const config = CATEGORY_CONFIG[category.name.toLowerCase()] || {
                label: toSentenceCase(category.name),
                icon: <Zap className="w-8 h-8" />,
                color: "text-gray-600",
                gradient: FALLBACK_GRADIENTS[index % FALLBACK_GRADIENTS.length],
                description: "Events",
              };

              const isSelected = selectedCategory === category.name;
              return (
                <button
                  key={category.name}
                  onClick={() =>
                    setSelectedCategory(isSelected ? null : category.name)
                  }
                  className={`group relative overflow-hidden rounded-2xl p-6 text-white font-bold transition-all duration-300 ${
                    isSelected
                      ? `bg-gradient-to-br ${config.gradient} ring-2 ring-white scale-105 shadow-2xl`
                      : `bg-gradient-to-br ${config.gradient} hover:shadow-lg hover:scale-105`
                  }`}
                >
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>

                  <div className="relative z-10 flex flex-col items-center gap-3">
                    <div className="text-white opacity-100 group-hover:scale-110 transition-transform">
                      {config.icon}
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-sm md:text-base leading-tight">
                        {config.label}
                      </p>
                      <p className="text-xs opacity-90 mt-2">
                        {category.count || 0} events
                      </p>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-white/30 backdrop-blur rounded-full p-1">
                      <ChevronRight size={16} className="text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Events Section */}
        {!loading ? (
          <>
            {filteredEvents.length > 0 ? (
              <div>
                <div className="mb-8">
                  <h2 className="font-dynapuff text-3xl font-bold text-text-dark mb-2">
                    {selectedCategory
                      ? `${selectedCategoryConfig?.label} Events`
                      : "All Featured Events"}
                  </h2>
                  <p className="text-text-light">
                    {filteredEvents.length} events found{" "}
                    {selectedCategory && `in ${selectedCategoryConfig?.label}`}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredEvents.slice(0, 12).map((event) => (
                    <EventCard
                      key={event._id}
                      eventId={event._id}
                      tags={event.tags}
                      imageUrl={event.images[0] ?? "/images/party.png"}
                      imageAlt={event.title}
                      title={event.title}
                      organizer={`By ${event.organizer?.name ?? "Unknown"}`}
                      descriptions={[event.description]}
                      location={event.venue}
                      price={
                        event.ticketTypes.some((t) => t.price === 0)
                          ? "Free"
                          : `From Rs.${Math.min(...event.ticketTypes.map((t) => t.price))}`
                      }
                    />
                  ))}
                </div>

                {filteredEvents.length > 12 && (
                  <div className="mt-10 text-center">
                    <Link
                      href={`/explore-events${selectedCategory ? `?category=${selectedCategory}` : ""}`}
                    >
                      <button className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition font-medium">
                        View All Events
                        <ArrowRight size={18} />
                      </button>
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-surface mb-6">
                  <Zap className="text-text-light" size={40} />
                </div>
                <h3 className="text-2xl font-bold text-text-dark mb-3">
                  No events found
                </h3>
                <p className="text-text-light mb-8 max-w-md mx-auto">
                  There are no events in this category yet. Check back soon or
                  explore other categories!
                </p>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition font-medium"
                >
                  View All Events
                  <ArrowRight size={18} />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-96 bg-surface rounded-xl animate-pulse"
              />
            ))}
          </div>
        )}
      </div>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-brown-normal to-brown-dark py-16 md:py-20 text-white mt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-dynapuff text-3xl md:text-4xl font-bold mb-4">
            Have an event to share?
          </h2>
          <p className="text-lg text-brown-light mb-8 max-w-2xl mx-auto">
            Create your own event and bring your community together. Host
            memorable experiences on Vivnt and reach event enthusiasts.
          </p>
          <Link href="/create-event/step-1">
            <button className="inline-flex items-center gap-2 px-8 py-3 bg-white text-brown-dark rounded-lg hover:bg-brown-light transition font-bold">
              Create an Event
              <ArrowRight size={20} />
            </button>
          </Link>
        </div>
      </section>
    </div>
  );
}
