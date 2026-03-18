// src/data/seedClientesData.js
// Datos iniciales de clientes, objetivos y puestos para importar en Firestore.
// Cada puesto tiene un `numero` único dentro del cliente (ID Objetivo en planillas).

export const SEED_DATA = [
    {
        cliente:  { nombre: "BSC", codigo: "217/1" },
        objetivos: [
            {
                nombre: "Sucursal Bs As", zona: "CABA", provincia: "Buenos Aires",
                puestos: [
                    { numero: 1,  nombre: "Administración", direccion: "Avenida Rabanal 3120, CABA", telefono: "" },
                ],
            },
            {
                nombre: "Sucursal Santa Cruz", zona: "Caleta Olivia", provincia: "Santa Cruz",
                puestos: [
                    { numero: 2,  nombre: "Administración", direccion: "Administración Sur, Caleta Olivia", telefono: "" },
                ],
            },
        ],
    },
    {
        cliente:  { nombre: "Brinks Argentina S.A.", codigo: "220/139" },
        objetivos: [
            {
                nombre: "Buenos Aires", zona: "CABA", provincia: "Buenos Aires",
                puestos: [
                    { numero: 1,  nombre: "Recepción Brinks",  direccion: "Avenida Rabanal 3120, CABA", telefono: "" },
                    { numero: 2,  nombre: "Carga Segura",      direccion: "Avenida Rabanal 3120, CABA", telefono: "" },
                    { numero: 3,  nombre: "Seguridad Planta",  direccion: "Avenida Rabanal 3120, CABA", telefono: "" },
                    { numero: 4,  nombre: "Móvil",             direccion: "Avenida Rabanal 3120, CABA", telefono: "" },
                    { numero: 5,  nombre: "Berón de Astrada",  direccion: "Avenida Rabanal 3120, CABA", telefono: "" },
                    { numero: 6,  nombre: "Pergamino",         direccion: "Avenida Rabanal 3120, CABA", telefono: "" },
                ],
            },
        ],
    },
    {
        cliente:  { nombre: "Reginald Lee S.A.", codigo: "217/113" },
        objetivos: [
            {
                nombre: "Ranelagh", zona: "Berazategui", provincia: "Buenos Aires",
                puestos: [
                    { numero: 1,  nombre: "CCTV",           direccion: "Camino Belgrano 3150, Berazategui", telefono: "" },
                    { numero: 2,  nombre: "Encargados",     direccion: "Camino Belgrano 3150, Berazategui", telefono: "" },
                    { numero: 3,  nombre: "Puesto 1",       direccion: "Camino Belgrano 3150, Berazategui", telefono: "" },
                    { numero: 4,  nombre: "Puesto 2",       direccion: "Camino Belgrano 3150, Berazategui", telefono: "" },
                    { numero: 5,  nombre: "Puesto 4",       direccion: "Camino Belgrano 3150, Berazategui", telefono: "" },
                    { numero: 6,  nombre: "Puesto 7",       direccion: "Camino Belgrano 3150, Berazategui", telefono: "" },
                    { numero: 7,  nombre: "Puesto 8",       direccion: "Camino Belgrano 3150, Berazategui", telefono: "" },
                    { numero: 8,  nombre: "Encargados",     direccion: "Camino Belgrano 3150, Berazategui", telefono: "" },
                    { numero: 9,  nombre: "Rondín",         direccion: "Camino Belgrano 3150, Berazategui", telefono: "" },
                    { numero: 10, nombre: "Cust. Camión",   direccion: "Camino Belgrano 3150, Berazategui", telefono: "" },
                    { numero: 11, nombre: "General",        direccion: "Camino Belgrano 3150, Berazategui", telefono: "" },
                ],
            },
            {
                nombre: "Lobos", zona: "Lobos", provincia: "Buenos Aires",
                puestos: [
                    { numero: 11, nombre: "Puesto Lobos",       direccion: "Ruta Nac 205 y Salgado, Lobos", telefono: "" },
                ],
            },
            {
                nombre: "La Plata", zona: "La Plata", provincia: "Buenos Aires",
                puestos: [
                    { numero: 12, nombre: "Puesto La Plata",    direccion: "Calle 12 N° 1599, Ringuelet, La Plata", telefono: "" },
                ],
            },
            {
                nombre: "Mar del Plata", zona: "Mar del Plata", provincia: "Buenos Aires",
                puestos: [
                    { numero: 13, nombre: "Puesto Mar del Plata", direccion: "Autovía 2 km 398, Mar del Plata", telefono: "" },
                ],
            },
        ],
    },
    {
        cliente:  { nombre: "Ovnisa", codigo: "217/117" },
        objetivos: [
            {
                nombre: "Berazategui", zona: "Hudson", provincia: "Buenos Aires",
                puestos: [
                    { numero: 1,  nombre: "Berazategui", direccion: "Calle 51 N° 1757, Hudson, Berazategui", telefono: "" },
                ],
            },
        ],
    },
    {
        cliente:  { nombre: "Cerro Moro", codigo: "217/103" },
        objetivos: [
            {
                nombre: "Cerro Moro", zona: "Santa Cruz", provincia: "Santa Cruz",
                puestos: [
                    { numero: 1,  nombre: "PAS Supervisor",      direccion: "Cerro Moro, Santa Cruz", telefono: "" },
                    { numero: 2,  nombre: "PAS Administrativa",  direccion: "Cerro Moro, Santa Cruz", telefono: "" },
                    { numero: 3,  nombre: "PAS Patrulla Chofer", direccion: "Cerro Moro, Santa Cruz", telefono: "" },
                    { numero: 4,  nombre: "PAS Patrulla Vehiculo", direccion: "Cerro Moro, Santa Cruz", telefono: "" },
                    { numero: 5,  nombre: "PAS Encargados",      direccion: "Cerro Moro, Santa Cruz", telefono: "" },
                    { numero: 6,  nombre: "PAS CCTV Gral.",      direccion: "Cerro Moro, Santa Cruz", telefono: "" },
                    { numero: 7,  nombre: "PAS CCTV Fundicion",  direccion: "Cerro Moro, Santa Cruz", telefono: "" },
                    { numero: 8,  nombre: "PAS Puesto 1",        direccion: "Cerro Moro, Santa Cruz", telefono: "" },
                    { numero: 9,  nombre: "PAS Puesto 2",        direccion: "Cerro Moro, Santa Cruz", telefono: "" },
                    { numero: 10, nombre: "PAS Puesto 3",        direccion: "Cerro Moro, Santa Cruz", telefono: "" },
                    { numero: 11, nombre: "PAS Puesto 4",        direccion: "Cerro Moro, Santa Cruz", telefono: "" },
                    { numero: 12, nombre: "PAS Naty",            direccion: "Cerro Moro, Santa Cruz", telefono: "" },
                    { numero: 13, nombre: "General",             direccion: "Cerro Moro, Santa Cruz", telefono: "" },
                ],
            },
        ],
    },
];

// Helper: etiqueta completa para mostrar en pantallas y planillas
// Formato: "220/139 / 4 · Móvil"
export function labelPuesto(clienteCodigo, numero, nombrePuesto) {
    if (!clienteCodigo && !numero) return nombrePuesto || "";
    if (!numero) return `${clienteCodigo} · ${nombrePuesto}`;
    return `${clienteCodigo} / ${numero} · ${nombrePuesto}`;
}
