// src/components/Icon3D.jsx
import { ICONS_3D } from "../config/icons3d";

/**
 * Renders a 3D icon from 3dicons.co CDN.
 * Falls back to emoji if icon not found.
 *
 * @param {string} name  - key from ICONS_3D
 * @param {string} emoji - fallback emoji
 * @param {number} size  - pixel size (default 40)
 * @param {string} className - extra CSS class
 */
export default function Icon3D({ name, emoji = "●", size = 40, className = "" }) {
    const src = ICONS_3D[name];
    if (!src) return <span style={{ fontSize: size * 0.7 }}>{emoji}</span>;
    return (
        <img
            src={src}
            alt={name}
            width={size}
            height={size}
            className={`icon-3d ${className}`}
            style={{ objectFit: "contain", display: "block", flexShrink: 0 }}
            loading="lazy"
            onError={e => { e.currentTarget.style.display = "none"; }}
        />
    );
}
