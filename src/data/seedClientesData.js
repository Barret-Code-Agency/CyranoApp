// src/data/seedClientesData.js
// Datos iniciales de clientes, objetivos y puestos para importar en Firestore.

export const SEED_DATA = [
    {
        cliente:  { nombre: "BSC",                   codigo: "217/1" },
        objetivos: [
            {
                nombre:    "Sucursal Bs As",
                zona:      "CABA",
                provincia: "Buenos Aires",
                puestos: [
                    { nombre: "Administración", direccion: "Avenida Rabanal 3120, CABA", telefono: "" },
                ],
            },
            {
                nombre:    "Sucursal Santa Cruz",
                zona:      "Caleta Olivia",
                provincia: "Santa Cruz",
                puestos: [
                    { nombre: "Administración", direccion: "Administración Sur, Caleta Olivia", telefono: "" },
                ],
            },
        ],
    },
    {
        cliente:  { nombre: "Brinks Argentina S.A.", codigo: "220/139" },
        objetivos: [
            {
                nombre:    "Buenos Aires",
                zona:      "CABA",
                provincia: "Buenos Aires",
                puestos: [
                    { nombre: "Recepción Brinks",  direccion: "Avenida Rabanal 3120, CABA", telefono: "" },
                    { nombre: "Carga Segura",      direccion: "Avenida Rabanal 3120, CABA", telefono: "" },
                    { nombre: "Seguridad Planta",  direccion: "Avenida Rabanal 3120, CABA", telefono: "" },
                    { nombre: "Móvil",             direccion: "Avenida Rabanal 3120, CABA", telefono: "" },
                    { nombre: "Berón de Astrada",  direccion: "Avenida Rabanal 3120, CABA", telefono: "" },
                    { nombre: "Pergamino",         direccion: "Avenida Rabanal 3120, CABA", telefono: "" },
                ],
            },
        ],
    },
    {
        cliente:  { nombre: "Reginald Lee S.A.", codigo: "217-218/113" },
        objetivos: [
            {
                nombre:    "Ranelagh",
                zona:      "Berazategui",
                provincia: "Buenos Aires",
                puestos: [
                    { nombre: "CCTV",           direccion: "Camino Belgrano 3150, Berazategui", telefono: "" },
                    { nombre: "Encargados",     direccion: "Camino Belgrano 3150, Berazategui", telefono: "" },
                    { nombre: "Puesto 1",       direccion: "Camino Belgrano 3150, Berazategui", telefono: "" },
                    { nombre: "Puesto 2",       direccion: "Camino Belgrano 3150, Berazategui", telefono: "" },
                    { nombre: "Puesto 4",       direccion: "Camino Belgrano 3150, Berazategui", telefono: "" },
                    { nombre: "Puesto 7",       direccion: "Camino Belgrano 3150, Berazategui", telefono: "" },
                    { nombre: "Puesto 8",       direccion: "Camino Belgrano 3150, Berazategui", telefono: "" },
                    { nombre: "Encargado",      direccion: "Camino Belgrano 3150, Berazategui", telefono: "" },
                    { nombre: "Rondín",         direccion: "Camino Belgrano 3150, Berazategui", telefono: "" },
                    { nombre: "Cust. Camión",   direccion: "Camino Belgrano 3150, Berazategui", telefono: "" },
                ],
            },
            {
                nombre:    "Lobos",
                zona:      "Lobos",
                provincia: "Buenos Aires",
                puestos: [
                    { nombre: "Puesto Lobos", direccion: "Ruta Nac 205 y Salgado, Lobos", telefono: "" },
                ],
            },
            {
                nombre:    "La Plata",
                zona:      "La Plata",
                provincia: "Buenos Aires",
                puestos: [
                    { nombre: "Puesto La Plata", direccion: "Calle 12 N° 1599, Ringuelet, La Plata", telefono: "" },
                ],
            },
            {
                nombre:    "Mar del Plata",
                zona:      "Mar del Plata",
                provincia: "Buenos Aires",
                puestos: [
                    { nombre: "Puesto Mar del Plata", direccion: "Autovía 2 km 398, Mar del Plata", telefono: "" },
                ],
            },
        ],
    },
    {
        cliente:  { nombre: "Ovnisa", codigo: "217/117" },
        objetivos: [
            {
                nombre:    "Berazategui",
                zona:      "Hudson",
                provincia: "Buenos Aires",
                puestos: [
                    { nombre: "Berazategui", direccion: "Calle 51 N° 1757, Hudson, Berazategui", telefono: "" },
                ],
            },
        ],
    },
    {
        cliente:  { nombre: "Cerro Moro", codigo: "217-218/103" },
        objetivos: [
            {
                nombre:    "Cerro Moro",
                zona:      "Santa Cruz",
                provincia: "Santa Cruz",
                puestos: [
                    { nombre: "PAS Supervisor",        direccion: "Cerro Moro, Santa Cruz", telefono: "" },
                    { nombre: "PAS Administrativas",   direccion: "Cerro Moro, Santa Cruz", telefono: "" },
                    { nombre: "Patrulla (Chofer)",     direccion: "Cerro Moro, Santa Cruz", telefono: "" },
                    { nombre: "Patrulla (Vehículos)",  direccion: "Cerro Moro, Santa Cruz", telefono: "" },
                    { nombre: "Encargados",            direccion: "Cerro Moro, Santa Cruz", telefono: "" },
                    { nombre: "CCTV General",          direccion: "Cerro Moro, Santa Cruz", telefono: "" },
                    { nombre: "CCTV Fundición",        direccion: "Cerro Moro, Santa Cruz", telefono: "" },
                    { nombre: "Puesto 1",              direccion: "Cerro Moro, Santa Cruz", telefono: "" },
                    { nombre: "Puesto 2",              direccion: "Cerro Moro, Santa Cruz", telefono: "" },
                    { nombre: "Puesto 3",              direccion: "Cerro Moro, Santa Cruz", telefono: "" },
                    { nombre: "Puesto 4",              direccion: "Cerro Moro, Santa Cruz", telefono: "" },
                    { nombre: "Naty",                  direccion: "Cerro Moro, Santa Cruz", telefono: "" },
                    { nombre: "General",               direccion: "Cerro Moro, Santa Cruz", telefono: "" },
                ],
            },
        ],
    },
];
