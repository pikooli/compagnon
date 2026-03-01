"use client";

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

interface MapEmbedProps {
  address: string;
}

export function MapEmbed({ address }: MapEmbedProps) {
  if (!MAPS_API_KEY) return null;

  const src = `https://www.google.com/maps/embed/v1/place?key=${MAPS_API_KEY}&q=${encodeURIComponent(address)}`;

  return (
    <iframe
      title="Event location map"
      src={src}
      className="h-[250px] w-full rounded-xl border border-[#1e2d4a]"
      loading="lazy"
      allowFullScreen
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}
