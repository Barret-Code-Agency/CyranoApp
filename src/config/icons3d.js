// src/config/icons3d.js
const B = "https://bvconuycpdvgzbvbkijl.supabase.co/storage/v1/object/public/sizes";
const u = (id, name) => `${B}/${id}-${name}/dynamic/200/color.webp`;

export const ICONS_3D = {
    // Documentos
    notebook:       u("628100", "notebook"),
    file:           u("ac021e", "file"),
    "file-text":    u("65d841", "file-text"),
    folder:         u("176980", "folder"),
    "folder-new":   u("34bc6f", "folder-new"),
    pencil:         u("66b0f8", "pencil"),
    // Personas
    boy:            u("a14880", "boy"),
    girl:           u("2dfe27", "girl"),
    // Navegación / Ubicación
    "map-pin":      u("1858b9", "map-pin"),
    location:       u("8bbd16", "location"),
    target:         u("49b6f4", "target"),
    zoom:           u("b4a0af", "zoom"),
    // Tiempo
    calendar:       u("f32794", "calendar"),
    clock:          u("8ef1fa", "clock"),
    // Seguridad
    shield:         u("b91186", "shield"),
    key:            u("778c78", "key"),
    lock:           u("457612", "lock"),
    locker:         u("e67951", "locker"),
    // Notificaciones
    bell:           u("ef4a90", "bell"),
    megaphone:      u("313578", "megaphone"),
    flash:          u("637858", "flash"),
    // Datos / Análisis
    chart:          u("4a4275", "chart"),
    calculator:     u("dd7474", "calculator"),
    // Premios / Logros
    medal:          u("39121b", "medal"),
    trophy:         u("49654f", "trophy"),
    star:           u("17125d", "star"),
    // Dinero
    money:          u("634add", "money"),
    "money-bag":    u("36f0c6", "money-bag"),
    // Herramientas
    tools:          u("ff5be0", "tools"),
    setting:        u("7e47be", "setting"),
    // Compras / Insumos
    bag:            u("f71a3e", "bag"),
    // Transporte
    travel:         u("fa6099", "travel"),
    // Misc
    computer:       u("5f20be", "computer"),
    forward:        u("923d52", "forward"),
    crown:          u("634b4b", "crown"),
    "trash-can":    u("add2ea", "trash-can"),
    bulb:           u("ddbd61", "bulb"),
};
