import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { Teacher } from "./TeacherCard";

const greenIcon = L.divIcon({
  html: `<div style="background:#1B6B3A;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid white;display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);color:white;font-weight:bold;font-size:12px;">★</span></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  className: "",
});

interface NearbyTeacher extends Teacher { lat: number; lng: number; }

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center, 12); }, [center, map]);
  return null;
}

export default function NearbyMap({ center, tutors }: { center: [number, number]; tutors: NearbyTeacher[] }) {
  return (
    <MapContainer center={center} zoom={12} className="h-full w-full" scrollWheelZoom>
      <Recenter center={center} />
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {tutors.map((t) => (
        <Marker key={t.id} position={[t.lat, t.lng]} icon={greenIcon}>
          <Popup>
            <div className="space-y-1">
              <p className="font-semibold">{t.full_name}</p>
              <p className="text-xs">{t.subjects?.join(", ")}</p>
              <p className="text-xs">Rs. {t.hourly_rate}/hr</p>
              <Link to="/teachers/$id" params={{ id: String(t.id) }} className="text-xs font-semibold" style={{ color: "#1B6B3A" }}>
                View Profile →
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
