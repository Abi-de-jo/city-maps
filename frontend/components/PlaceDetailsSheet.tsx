"use client";

import {
  Bookmark, ChevronDown, ChevronUp, Clock3, Globe, Image as ImageIcon,
  MapPin, Navigation, Phone, Share2, X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getPlace, submitReview } from "@/lib/api";
import type { Place, PlacePrediction } from "@/lib/types";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function openingState(hours?: Place["opening_hours"]) {
  if (!hours) return undefined;
  const ranges = hours[DAYS[new Date().getDay()]];
  if (!Array.isArray(ranges) || !ranges.length) return undefined;
  const minutes = new Date().getHours() * 60 + new Date().getMinutes();
  const open = ranges.some((range) => {
    const [start, end] = range.split("-").map((value) => {
      const [hour, minute] = value.split(":").map(Number);
      return hour * 60 + minute;
    });
    return Number.isFinite(start) && Number.isFinite(end) && minutes >= start && minutes <= end;
  });
  return open ? "Open" : "Closed";
}

type Props = {
  selected: PlacePrediction;
  onClose: () => void;
  onDirections: (place: PlacePrediction) => void;
};

export default function PlaceDetailsSheet({ selected, onClose, onDirections }: Props) {
  const [place, setPlace] = useState<Place>({ ...selected });
  const [loading, setLoading] = useState(true);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const status = useMemo(() => openingState(place.opening_hours), [place.opening_hours]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getPlace(selected.place_id)
      .then((next) => { if (active) setPlace({ ...next, location: { lat: next.lat ?? selected.location.lat, lng: next.lng ?? selected.location.lng } }); })
      .catch(() => { if (active) setPlace({ ...selected }); })
      .finally(() => { if (active) setLoading(false); });
    const savedIds = JSON.parse(localStorage.getItem("city-map-saved") ?? "[]") as string[];
    setSaved(savedIds.includes(selected.place_id));
    return () => { active = false; };
  }, [selected]);

  const toggleSaved = () => {
    const savedIds = JSON.parse(localStorage.getItem("city-map-saved") ?? "[]") as string[];
    const next = saved ? savedIds.filter((id) => id !== selected.place_id) : [...new Set([...savedIds, selected.place_id])];
    localStorage.setItem("city-map-saved", JSON.stringify(next));
    setSaved(!saved);
  };

  const share = async () => {
    const url = new URL(location.href);
    url.searchParams.set("place", selected.place_id);
    if (navigator.share) await navigator.share({ title: place.name, text: place.address, url: url.toString() });
    else await navigator.clipboard.writeText(url.toString());
  };

  const review = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setFormMessage("Submitting…");
    try {
      await submitReview(selected.place_id, {
        author_name: String(form.get("author_name")),
        rating: Number(form.get("rating")),
        text: String(form.get("text")),
      });
      const refreshed = await getPlace(selected.place_id);
      setPlace({ ...refreshed, location: { lat: refreshed.lat!, lng: refreshed.lng! } });
      event.currentTarget.reset();
      setFormMessage("Review added.");
    } catch (reason) {
      setFormMessage(reason instanceof Error ? reason.message : "Review could not be added.");
    }
  };

  const photo = place.photo_urls?.[0];
  const hours = place.opening_hours ?? {};

  return (
    <aside className="place-sheet" aria-label={`Details for ${place.name}`}>
      <div className="place-hero">
        {photo ? <img src={photo} alt={place.name} /> : <div className="place-hero-empty"><ImageIcon size={44} /><span>No photo available</span></div>}
        <button className="icon-button place-close" aria-label="Close place details" onClick={onClose}><X /></button>
      </div>
      <div className="place-body">
        <h1 className="place-title">{place.name}</h1>
        <div className="place-category">{place.category?.replaceAll("_", " ")}</div>
        <div className="rating-line">
          {Boolean(place.review_count) && <><span>{place.average_rating?.toFixed(1)}</span><span className="stars" aria-label={`${place.average_rating} out of 5 stars`}>★★★★★</span><span>({place.review_count})</span></>}
          {status && <span className="open-badge">{status}</span>}
          {loading && <span>Loading details…</span>}
        </div>
      </div>
      <div className="place-actions">
        <button className="action-button" onClick={() => onDirections(place)}><span className="action-circle"><Navigation size={18} /></span>Directions</button>
        <button className="action-button" onClick={toggleSaved}><span className="action-circle"><Bookmark size={18} fill={saved ? "currentColor" : "none"} /></span>{saved ? "Saved" : "Save"}</button>
        <button className="action-button" onClick={share}><span className="action-circle"><Share2 size={18} /></span>Share</button>
      </div>
      <div className="place-info">
        {place.address && <div className="info-row"><MapPin size={19} color="#1a73e8" /><span>{place.address}</span></div>}
        {place.phone && <div className="info-row"><Phone size={19} color="#1a73e8" /><a href={`tel:${place.phone}`}>{place.phone}</a></div>}
        {place.website && <div className="info-row"><Globe size={19} color="#1a73e8" /><a href={place.website} target="_blank" rel="noreferrer">Visit website</a></div>}
        {Object.keys(hours).length > 0 && (
          <div className="info-row"><Clock3 size={19} color="#1a73e8" /><div><button className="hours-button" onClick={() => setHoursOpen(!hoursOpen)}><span>{status ?? "Opening hours"}</span>{hoursOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}</button>{hoursOpen && (hours.raw ? <p className="hours-list">{hours.raw}</p> : <ul className="hours-list">{DAYS.map((day) => <li key={day}><span>{day}</span><span>{hours[day]?.join(", ") ?? "Closed"}</span></li>)}</ul>)}</div></div>
        )}
      </div>
      <section className="review-section">
        <h2 className="section-title">Reviews</h2>
        <form className="review-form" onSubmit={review}>
          <input className="form-input" name="author_name" required maxLength={100} placeholder="Your name" aria-label="Your name" />
          <select className="form-input" name="rating" required defaultValue="5" aria-label="Rating"><option value="5">5 stars</option><option value="4">4 stars</option><option value="3">3 stars</option><option value="2">2 stars</option><option value="1">1 star</option></select>
          <textarea className="form-input" name="text" required minLength={1} maxLength={2000} placeholder="Share your experience" aria-label="Review" />
          <button className="primary-button" type="submit">Post review</button>
          {formMessage && <span role="status">{formMessage}</span>}
        </form>
        <div>{place.reviews?.map((item) => <article className="review-card" key={item.review_id}><div className="review-author">{item.author_name}</div><div className="stars" aria-label={`${item.rating} out of 5 stars`}>{"★".repeat(item.rating)}</div><p className="review-text">{item.text}</p></article>)}</div>
      </section>
    </aside>
  );
}
