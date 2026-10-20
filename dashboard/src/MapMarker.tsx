import { Marker, type Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  map: MapLibreMap;
  lat: number;
  lon: number;
  className: string;
  onClick?: () => void;
  children: ReactNode;
};

// A React-drawn element pinned to a spot on the map. MapLibre moves the element; React owns what
// is inside it, so a marker's content updates like any other component.
export function MapMarker({ map, lat, lon, className, onClick, children }: Props) {
  const [element] = useState(() => document.createElement("div"));
  const clicked = useRef(onClick);
  useEffect(() => {
    clicked.current = onClick;
  });

  useEffect(() => {
    const listener = () => clicked.current?.();
    element.addEventListener("click", listener);
    return () => element.removeEventListener("click", listener);
  }, [element]);

  useEffect(() => {
    const marker = new Marker({ element }).setLngLat([lon, lat]).addTo(map);
    return () => {
      marker.remove();
    };
  }, [map, element, lat, lon]);

  return createPortal(<div className={className}>{children}</div>, element);
}
