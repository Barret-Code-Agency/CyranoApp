// src/screens/admin/EditableList.jsx
import { useState } from "react";

export default function EditableList({ icon, title, dataKey, items, onUpdate }) {
    const [newItem, setNewItem] = useState("");
    const handleAdd    = () => { const t = newItem.trim(); if (!t || items.includes(t)) return; onUpdate(dataKey, [...items, t]); setNewItem(""); };
    const handleDelete = (idx) => onUpdate(dataKey, items.filter((_, i) => i !== idx));
    const handleEdit   = (idx, value) => { const u = [...items]; u[idx] = value; onUpdate(dataKey, u); };
    return (
        <div className="admin-section">
            <div className="admin-section-header">
                <div className="admin-section-title"><span className="admin-section-icon">{icon}</span>{title}</div>
                <span className="admin-item-count">{items.length} ítem{items.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="admin-list">
                {items.length === 0 && <div className="admin-empty">Sin ítems.</div>}
                {items.map((item, idx) => (
                    <div key={idx} className="admin-item">
                        <span className="admin-item-drag">⠿</span>
                        <input className="admin-item-input" value={item} onChange={(e) => handleEdit(idx, e.target.value)} placeholder="Ítem vacío..." />
                        <button className="admin-btn-delete" onClick={() => handleDelete(idx)}>✕</button>
                    </div>
                ))}
            </div>
            <div className="admin-add-row">
                <input className="admin-add-input" placeholder={`Nuevo ${title.toLowerCase()}...`} value={newItem}
                    onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAdd()} />
                <button className="admin-btn-add" onClick={handleAdd} disabled={!newItem.trim()}>+</button>
            </div>
        </div>
    );
}
