import { Marker, type Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  map: MapLibreMap;
  lat: number;
  lon: number;
  className: string;
  onClick?: () => void;
  // Makes the marker draggable; called with where it was dropped. Whatever comes of the drop, the
  // marker ends up at `lat` and `lon`, so a drop the app refuses snaps back.
  onDragEnd?: (lat: number, lon: number) => void | Promise<void>;
  children: ReactNode;
};

// A React-drawn element pinned to a spot on the map. MapLibre moves the element; React owns what
// is inside it, so a marker's content updates like any other component.
export function MapMarker({ map, lat, lon, className, onClick, onDragEnd, children }: Props) {
  const [element] = useState(() => document.createElement("div"));
  const clicked = useRef(onClick);
  const dropped = useRef(onDragEnd);
  const spot = useRef({ lat, lon });
  useEffect(() => {
    clicked.current = onClick;
    dropped.current = onDragEnd;
    spot.current = { lat, lon };
  });
  const draggable = onDragEnd !== undefined;

  useEffect(() => {
    const listener = () => clicked.current?.();
    element.addEventListener("click", listener);
    return () => element.removeEventListener("click", listener);
  }, [element]);

  useEffect(() => {
    const marker = new Marker({ element, draggable }).setLngLat([lon, lat]).addTo(map);
    marker.on("dragend", () => {
      const { lat: droppedLat, lng: droppedLon } = marker.getLngLat();
      void Promise.resolve(dropped.current?.(droppedLat, droppedLon)).finally(() =>
        marker.setLngLat([spot.current.lon, spot.current.lat]),
      );
    });
    return () => {
      marker.remove();
    };
  }, [map, element, lat, lon, draggable]);

  return createPortal(<div className={className}>{children}</div>, element);
}
