// src/context/AppDataContext.jsx
import { createContext, useContext, useState, useEffect } from "react";

const load = (key, fallback) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
};
const save = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

// ── Clasificación automática de control según fecha/hora ─────────────────────
export const clasificarControl = (horaInicio, fechaISO) => {
    if (!horaInicio) return { turno: "diurno", esFinDeSemana: false };
    const [h, m]   = horaInicio.split(":").map(Number);
    const minutos  = h * 60 + (m || 0);
    const nocturno = minutos >= 18 * 60 || minutos < 6 * 60; // 18:00–05:59
    let esFinDeSemana = false;
    if (fechaISO) {
        const d = new Date(fechaISO);
        esFinDeSemana = d.getDay() === 0 || d.getDay() === 6;
    }
    return { turno: nocturno ? "nocturno" : "diurno", esFinDeSemana };
};

// ── Defaults reales ───────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
    supervisorEmail: "supervisor@empresa.com",
    vehiculos: [
        "Prisma — AC 349 CR",
        "Prisma — AC 349 CZ",
        "Prisma — AC 360 WC",
        "Corolla — OPR 557",
        "Corolla — AC 349 CQ",
        "Corolla — AC 349 CS",
        "Hilux — AF 373 JP",
        "Hilux — AF 967 YA",
        "Hilux — AF 295 SB",
        "Hilux — AG 220 JI",
    ],
    objetivos: [
        "Reginald Lee — Ranelagh",
        "Reginald Lee — Lobos",
        "Reginald Lee — La Plata",
        "Reginald Lee — Mar del Plata",
        "Ovnisa Berazategui",
        "Brinks Pergamino",
        "Brinks Berón de Astrada",
        "Brinks Móvil",
        "Cerro Moro — General",
        "Cerro Moro — Puesto 1",
        "Cerro Moro — Puesto 2",
        "Cerro Moro — Puesto 3",
        "Cerro Moro — Puesto 4",
        "Cerro Moro — CCTV General",
        "Cerro Moro — CCTV Fundición",
        "Cerro Moro — Naty",
        "Cerro Moro — Administrativas",
        "Cerro Moro — Encargados",
        "Cerro Moro — Supervisor",
    ],
    tiposActividad: [
        "Reparaciones (taller)",
        "Traslado de personal",
        "Traslado de elementos",
        "Tareas administrativas",
        "Otras actividades",
    ],
    vigiladores: [
        "PEDRAZA JUAN MANUEL","BECERRA HECTOR RAFAEL","CACERES JUAN JOSE",
        "CACERES ROCIO BELEN","CARPIO GLORIA VICTORIA","CASTELLANO SERGIO ARMANDO",
        "CEJAS MARIA PAULA","DIAS DANA LUCIA","FUNES GABRIELA EDITH",
        "GUTIERREZ MARCOS JOSE","HERRERA CARLOS ALEJANDRO","JULIO PAOLA GIMENA",
        "LEDESMA MATIAS EZEQUIEL","MARCIAL ERICA MARCELA","MARTINEZ SERGIO IVAN",
        "MERCADO ERICK LEONARDO","MONTIVERO EMANUEL ANTONIO","MORINIGO JOSE",
        "NIETO CLAUDIO MARTIN","PINTOS ALEXIS EMMANUEL","SEGURA DIEGO GABRIEL",
        "TORRES GUSTAVO ADOLFO","TRONCOSO EVELYN BEATRIZ","VARELA FRANCISCO ANTONIO",
        "VILLAGRA EMANUEL FRANCISCO","ZUÑIGA NERY AGUSTIN","MARTINEZ DAVID",
        "RODRIGUEZ PATRICIA ELIZABET","ARIAS MARCELO FABIAN","AGUIRRE ENRIQUE ANDRES",
        "COPA ANA PAULA","DIAZ JONATHAN JAVIER","OYARZO SANCHEZ MIGUEL ALEJANDRO",
        "ROMERO CICCIOLI DANIEL MATIAS EZEQUIEL","REYNOSO GUSTAVO ALEJANDRO",
        "NAVARRO MANUEL FRANCISCO","LUNA MORALES MAYRA LISET","BORDON SOLEDAD DEL VALLE",
        "CASAS CARLOS DAVID","ROMERO SEBASTIAN EDUARDO","QUIROGA DANA MICAELA YASMIN",
        "VEGA FRANCO EDUARDO","VILLAFAÑE CARLOS MAXIMILIANO","DUARTE TIAGO MARCELO EZEQUIEL",
        "AEDO CINTHIA ANAHI","AMAYA CRISTIAN ARMANDO","CHACOMA SERGIO RAUL",
        "CAMPUZANO WALTER DAVID","AGULLO RODRIGUEZ LUCIANO ADRIAN","NUÑEZ FRANCISCO DIEGO",
        "CENTENO PATRICIA BRENDA","UBILLOS AGUSTIN SEBASTIAN","AVILA ALEJANDRO MAURICIO",
        "RIVERO GIULIANA DANIELA","RIOS ADRIEL GUILLERMO OSCAR","CONSTANCIO DAMIAN NAHUEL",
        "PEREIRA CARMEN GABRIELA","HERRERA GONZALO EZEQUIEL","AGÜERO FARIAS MARIA ELIZABETH",
        "JARA ELIO MATIAS","MESSINA JESSICA ADRIANA","KUC PAULO EMANUEL",
        "GODOY FERNANDO MIGUEL","RIVAROLA LUCAS FERNANDO","DERAMO NICOLAS MARIO",
        "RACEDO JULIO DANTE","ROLON SANTIAGO RAMON","FERNANDEZ CECILIA",
        "VILLA ALBERTO MATIAS","CAMPOS MAXIMILIANO HERNAN","ROMERO JORGE RAFAEL",
        "CAMPERO JOSE DAMIAN","ALMIRON WALTER DARIO","QUINTAS HORACIO GABRIEL",
        "DOS SANTOS CLAUDIO HERNAN ANIBAL","GONZALEZ ROBERTO ANTONIO","LOPEZ HUGO GERARDO",
        "MORO CRISTIAN EDUARDO","RODRIGUEZ LUCIANO MATIAS","ROJAS OSCAR OSVALDO",
        "ACUÑA NAHUEL GONZALO","CUGLIARI HERNAN GABRIEL","GUIÑEZ DUARTE CESAR DANIEL",
        "BUSTO LUCAS ABRAHAM","CANELAS DAMIAN","COSCUETA GUSTAVO WALTER",
        "LOBOSCO CRISTIAN IVAN","ARNAUDO JUAN","LOPEZ MARIO VICENTE",
        "QUINTEROS WALTER OMAR","VELAZQUEZ CLAUDIO ERNESTO","ALMADA CRISTIAN DANIEL",
        "BELLO GUSTAVO NORBERTO","BENITEZ GUSTAVO","BOZZO ANTONIO",
        "CASTRO ANTONIO HORACIO","COMAN JULIO ISMAEL","DUARTE DIEGO MARTIN",
        "JUAREZ LUIS MANUEL","KLOSTER RAFAEL ALBERTO","LENCINA MARIO ANTONIO",
        "LIMENZA GELMA RODOLFO FEDERICO","LOPEZ SERGIO ALBERTO","MARIN MARIO JAVIER",
        "MATA RAUL ALBERTO","MEDINA JAVIER","ORTIZ DANIEL","QUINTANA VICTOR HUGO",
        "REVILLA RODRIGUEZ HUGO ALEXANDER","RIOS FRANCISCO DANIEL","ROMERO LEANDRO FABIAN",
        "SUANO JAVIER NESTOR","TUDESCO JOSE LUIS ALBERTO","VELAZQUEZ CARLOS ALBERTO",
        "ZAKOVICZ JORGE RUBEN","LOPEZ MARCELO DANIEL","CABALLERO ADRIAN MARCELO",
        "KARBOVNICZEK JOSE PEDRO","CALVENTE BLAS LEONARDO","CORREA DANIEL SEBASTIAN",
        "SANTANA EZEQUIEL MATIAS","NUÑEZ ALEJO ISMAEL","VIZGARRA MARCELO ENRIQUE",
        "GORDILLO GERARDO AGUSTIN","LAGORIO BRIAN","ACEVEDO FERNANDO MATIAS",
        "RODRIGUEZ LUIS ALBERTO","ESPINDOLA SERGIO WALTER","LOPEZ MANUEL ALEJANDRO",
        "FERNANDEZ ALEJANDRO DANIEL","FERNANDEZ LUIS MARTIN","PETRUCCI JOSE RUBEN",
        "RUIZ EBER JUAN","MOREL FABIAN CELESTINO","RUIZ BELEN DE LOS ANGELES",
        "ALBARENGA BRAIAN MARTIN","GONZALEZ CARLA JACQUELINE","BLANCO CLAUDIO LUJAN",
        "BLANCO CRISTIAN ABRAHAM","UGARTEMENDIA NAHUEL CRUZ","GARCIA MIGUEL ANGEL",
    ],
    supervisores: [
        "Fernando Hector Delgado",
        "Juan Nazareno Hrchan",
        "Horacio Gabriel Quintas",
        "Rodolfo Sebastian Girelli",
        "Ignacio Alvarez",
        "Rolando Alfonso Zuñiga",
        "Andres Enrique Aguirre",
    ],
};

// ── Plan de supervisión por defecto ──────────────────────────────────────────
// Todos 1 visita/semana (≈4/mes). La Plata también 1/semana pero solo nocturnas.
// Las restricciones de turno se anotan en "restriccion"
const DEFAULT_PLAN = [
    { objetivo: "Reginald Lee — Ranelagh (Puestos Fijos)", visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
    { objetivo: "Reginald Lee — Lobos",          visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
    { objetivo: "Reginald Lee — La Plata",        visitasPorSemana: 1, restriccion: "Solo nocturnas — 1 fin de semana por mes" },
    { objetivo: "Reginald Lee — Mar del Plata",   visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
    { objetivo: "Ovnisa Berazategui",             visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
    { objetivo: "Brinks Pergamino",               visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
    { objetivo: "Brinks Berón de Astrada",        visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
    { objetivo: "Brinks Móvil",                   visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
    { objetivo: "Cerro Moro — General",           visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
    { objetivo: "Cerro Moro — Puesto 1",          visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
    { objetivo: "Cerro Moro — Puesto 2",          visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
    { objetivo: "Cerro Moro — Puesto 3",          visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
    { objetivo: "Cerro Moro — CCTV General",      visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
    { objetivo: "Cerro Moro — CCTV Fundición",    visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
    { objetivo: "Cerro Moro — Naty",              visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
    { objetivo: "Cerro Moro — Administrativas",   visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
    { objetivo: "Cerro Moro — Encargados",        visitasPorSemana: 1, restriccion: "1 fin de semana + 1 nocturna por mes" },
];

// ── Generador de jornadas simuladas ─────────────────────────────────────────
const SUPERVISORES_SIM = [
    "Fernando Hector Delgado",
    "Juan Nazareno Hrchan",
    "Horacio Gabriel Quintas",
];

const OBJETIVOS_SIM = [
    "Cerro Moro — Puesto 1",
    "Cerro Moro — Puesto 2",
    "Cerro Moro — General",
    "Reginald Lee — Ranelagh (Puestos Fijos)",
    "Ovnisa Berazategui",
    "Brinks Pergamino",
];

const VIGILADORES_SIM = [
    "PEDRAZA JUAN MANUEL","BECERRA HECTOR RAFAEL","CACERES JUAN JOSE",
    "HERRERA CARLOS ALEJANDRO","TORRES GUSTAVO ADOLFO","SEGURA DIEGO GABRIEL",
];

const VEHICULOS_SIM = [
    "Corolla — AC 349 CQ",
    "Hilux — AF 373 JP",
    "Prisma — AC 349 CR",
];

const TIPOS_OTRA = [
    "Traslado de personal",
    "Tareas administrativas",
    "Reparaciones (taller)",
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const isoFecha = (daysAgo, hora) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const [h, m] = hora.split(":").map(Number);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
};

const addMin = (hora, min) => {
    const [h, m] = hora.split(":").map(Number);
    const total  = h * 60 + m + min;
    return `${String(Math.floor(total / 60) % 24).padStart(2,"0")}:${String(total % 60).padStart(2,"0")}`;
};

const genControl = (daysAgo, horaInicio, objetivo, vigilador) => {
    const horaFin = addMin(horaInicio, 25 + Math.floor(Math.random() * 20));
    const ratings = Object.fromEntries([
        "Presencia","Cumplimiento de horarios","Completado de libro y registros",
        "Estado del equipamiento","Orden y aseo del puesto","Conocimiento de consignas"
    ].map((c) => [c, 5 + Math.floor(Math.random() * 6)]));
    const iso = isoFecha(daysAgo, horaInicio);
    const { turno, esFinDeSemana } = clasificarControl(horaInicio, iso);
    return {
        id: `ctrl-${daysAgo}-${horaInicio}`,
        tipo: "ctrl",
        estado: "completada",
        objetivo,
        vigilador,
        paginaLibro: String(100 + Math.floor(Math.random() * 900)),
        horaInicio,
        horaFin,
        ubicacionGPS: "-34.6037° S, -58.3816° O",
        ratings,
        anomalia: "No",
        turno,
        esFinDeSemana,
        iniciadaEn: iso,
        finalizadaEn: isoFecha(daysAgo, horaFin),
    };
};

const genCap = (daysAgo, horaInicio) => {
    const temas = [
        "Procedimientos de emergencia y evacuación",
        "Uso correcto de equipamiento de seguridad",
        "Protocolo de acceso y control de visitas",
        "Normativa de uso de CCTV y registros",
        "Primeros auxilios básicos",
    ];
    const horaFin = addMin(horaInicio, 45 + Math.floor(Math.random() * 30));
    return {
        id: `cap-${daysAgo}-${horaInicio}`,
        tipo: "cap",
        estado: "completada",
        fecha: new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10),
        horaInicio,
        horaFin,
        tema: pick(temas),
        iniciadaEn: isoFecha(daysAgo, horaInicio),
        finalizadaEn: isoFecha(daysAgo, horaFin),
    };
};

const genOtra = (daysAgo, horaInicio) => {
    const horaFin = addMin(horaInicio, 30 + Math.floor(Math.random() * 60));
    return {
        id: `otra-${daysAgo}-${horaInicio}`,
        tipo: "otra",
        estado: "completada",
        horaInicio,
        horaFin,
        actividad: pick(TIPOS_OTRA),
        lugarInicio: "-34.6037° S, -58.3816° O",
        lugarFin: "-34.6140° S, -58.4010° O",
        observaciones: "Sin novedades.",
        iniciadaEn: isoFecha(daysAgo, horaInicio),
        finalizadaEn: isoFecha(daysAgo, horaFin),
    };
};

// 3 supervisores × ~7 jornadas = ~21 jornadas con 2-4 actividades cada una
const generarJornadasSimuladas = () => {
    const jornadas = [];
    let jIdx = 0;

    const horariosDia = [
        // [daysAgo, horaInicio jornada, kmIni, actividades]
        // cada supervisor tiene 7 jornadas distintas
    ];

    const config = [
        // supervisor 0 — Fernando Delgado — turno día
        {
            sup: SUPERVISORES_SIM[0], email: "fdelgado@empresa.com", vehiculo: VEHICULOS_SIM[0],
            turnos: [
                { d: 1,  ini: "08:15", km: 87450, acts: [
                    genControl(1,  "09:10", OBJETIVOS_SIM[0], VIGILADORES_SIM[0]),
                    genControl(1,  "10:45", OBJETIVOS_SIM[1], VIGILADORES_SIM[1]),
                    genCap(1, "14:00"),
                ]},
                { d: 3,  ini: "08:00", km: 87720, acts: [
                    genControl(3,  "09:00", OBJETIVOS_SIM[2], VIGILADORES_SIM[2]),
                    genControl(3,  "11:30", OBJETIVOS_SIM[3], VIGILADORES_SIM[3]),
                    genOtra(3, "15:00"),
                ]},
                { d: 5,  ini: "07:45", km: 88010, acts: [
                    genControl(5,  "08:30", OBJETIVOS_SIM[0], VIGILADORES_SIM[4]),
                    genOtra(5, "10:15"),
                    genControl(5,  "13:00", OBJETIVOS_SIM[4], VIGILADORES_SIM[5]),
                ]},
                { d: 8,  ini: "08:20", km: 88280, acts: [
                    genControl(8,  "09:15", OBJETIVOS_SIM[1], VIGILADORES_SIM[0]),
                    genControl(8,  "11:00", OBJETIVOS_SIM[5], VIGILADORES_SIM[2]),
                    genCap(8, "14:30"),
                    genOtra(8, "16:00"),
                ]},
                { d: 10, ini: "08:05", km: 88550, acts: [
                    genControl(10, "09:00", OBJETIVOS_SIM[2], VIGILADORES_SIM[1]),
                    genControl(10, "10:50", OBJETIVOS_SIM[3], VIGILADORES_SIM[3]),
                ]},
                { d: 12, ini: "07:50", km: 88800, acts: [
                    genControl(12, "08:45", OBJETIVOS_SIM[0], VIGILADORES_SIM[5]),
                    genCap(12, "11:00"),
                    genOtra(12, "13:30"),
                ]},
                { d: 15, ini: "08:30", km: 89100, acts: [
                    genControl(15, "09:20", OBJETIVOS_SIM[4], VIGILADORES_SIM[4]),
                    genControl(15, "11:10", OBJETIVOS_SIM[1], VIGILADORES_SIM[0]),
                    genOtra(15, "14:00"),
                ]},
            ],
        },
        // supervisor 1 — Juan Hrchan — turno mixto
        {
            sup: SUPERVISORES_SIM[1], email: "jhrchan@empresa.com", vehiculo: VEHICULOS_SIM[1],
            turnos: [
                { d: 2,  ini: "19:00", km: 54200, acts: [
                    genControl(2,  "20:00", OBJETIVOS_SIM[2], VIGILADORES_SIM[2]),
                    genControl(2,  "22:30", OBJETIVOS_SIM[3], VIGILADORES_SIM[3]),
                    genOtra(2, "01:00"),
                ]},
                { d: 4,  ini: "18:30", km: 54480, acts: [
                    genControl(4,  "19:30", OBJETIVOS_SIM[5], VIGILADORES_SIM[1]),
                    genControl(4,  "21:45", OBJETIVOS_SIM[0], VIGILADORES_SIM[4]),
                    genCap(4, "23:30"),
                ]},
                { d: 6,  ini: "19:15", km: 54760, acts: [
                    genControl(6,  "20:10", OBJETIVOS_SIM[1], VIGILADORES_SIM[5]),
                    genOtra(6, "22:00"),
                    genControl(6,  "23:50", OBJETIVOS_SIM[4], VIGILADORES_SIM[0]),
                ]},
                { d: 9,  ini: "18:45", km: 55040, acts: [
                    genControl(9,  "19:50", OBJETIVOS_SIM[2], VIGILADORES_SIM[2]),
                    genControl(9,  "22:00", OBJETIVOS_SIM[3], VIGILADORES_SIM[3]),
                    genCap(9, "00:30"),
                    genOtra(9, "02:00"),
                ]},
                { d: 11, ini: "19:00", km: 55300, acts: [
                    genControl(11, "20:05", OBJETIVOS_SIM[0], VIGILADORES_SIM[1]),
                    genControl(11, "22:20", OBJETIVOS_SIM[5], VIGILADORES_SIM[5]),
                ]},
                { d: 13, ini: "18:00", km: 55580, acts: [
                    genControl(13, "19:10", OBJETIVOS_SIM[4], VIGILADORES_SIM[4]),
                    genOtra(13, "21:00"),
                    genControl(13, "23:00", OBJETIVOS_SIM[1], VIGILADORES_SIM[0]),
                ]},
                { d: 16, ini: "19:30", km: 55850, acts: [
                    genControl(16, "20:30", OBJETIVOS_SIM[2], VIGILADORES_SIM[3]),
                    genControl(16, "22:45", OBJETIVOS_SIM[3], VIGILADORES_SIM[2]),
                    genCap(16, "01:00"),
                ]},
            ],
        },
        // supervisor 2 — Horacio Quintas — fin de semana + mixto
        {
            sup: SUPERVISORES_SIM[2], email: "hquintas@empresa.com", vehiculo: VEHICULOS_SIM[2],
            turnos: [
                { d: 0,  ini: "10:00", km: 32100, acts: [  // hoy (domingo)
                    genControl(0,  "11:00", OBJETIVOS_SIM[0], VIGILADORES_SIM[0]),
                    genCap(0, "13:30"),
                    genOtra(0, "15:00"),
                ]},
                { d: 2,  ini: "09:30", km: 32350, acts: [
                    genControl(2,  "10:30", OBJETIVOS_SIM[3], VIGILADORES_SIM[3]),
                    genControl(2,  "13:00", OBJETIVOS_SIM[5], VIGILADORES_SIM[1]),
                    genOtra(2, "15:30"),
                ]},
                { d: 4,  ini: "20:00", km: 32620, acts: [
                    genControl(4,  "21:00", OBJETIVOS_SIM[1], VIGILADORES_SIM[4]),
                    genControl(4,  "23:15", OBJETIVOS_SIM[2], VIGILADORES_SIM[5]),
                    genCap(4, "01:30"),
                ]},
                { d: 7,  ini: "09:00", km: 32900, acts: [
                    genControl(7,  "10:00", OBJETIVOS_SIM[4], VIGILADORES_SIM[2]),
                    genOtra(7, "12:00"),
                    genControl(7,  "14:30", OBJETIVOS_SIM[0], VIGILADORES_SIM[0]),
                ]},
                { d: 9,  ini: "19:45", km: 33150, acts: [
                    genControl(9,  "20:50", OBJETIVOS_SIM[2], VIGILADORES_SIM[3]),
                    genControl(9,  "23:00", OBJETIVOS_SIM[5], VIGILADORES_SIM[1]),
                ]},
                { d: 11, ini: "10:15", km: 33400, acts: [
                    genControl(11, "11:10", OBJETIVOS_SIM[3], VIGILADORES_SIM[5]),
                    genCap(11, "13:00"),
                    genOtra(11, "14:30"),
                    genControl(11, "16:00", OBJETIVOS_SIM[1], VIGILADORES_SIM[4]),
                ]},
                { d: 14, ini: "08:45", km: 33680, acts: [
                    genControl(14, "09:40", OBJETIVOS_SIM[0], VIGILADORES_SIM[2]),
                    genControl(14, "11:30", OBJETIVOS_SIM[4], VIGILADORES_SIM[0]),
                    genOtra(14, "13:45"),
                ]},
            ],
        },
    ];

    config.forEach(({ sup, email, vehiculo, turnos }) => {
        turnos.forEach(({ d, ini, km, acts }) => {
            const fecha    = new Date(Date.now() - d * 86400000);
            const fechaStr = fecha.toISOString().slice(0, 10);
            const kmFinal  = km + 80 + Math.floor(Math.random() * 120);
            const horaFin  = addMin(ini, 480 + Math.floor(Math.random() * 60));
            jornadas.push({
                jornadaID:    `J${String(++jIdx).padStart(4,"0")}`,
                fecha:         fechaStr,
                nombre:        sup,
                supervisor:    sup,
                email,
                vehiculo,
                kmInicial:     km,
                kmFinal,
                horaInicio:    ini,
                horaFin,
                estado:        "cerrada",
                actividades:   acts,
                creadaEn:      isoFecha(d, ini),
                cerradaEn:     isoFecha(d, horaFin),
            });
        });
    });

    return jornadas;
};

const SIMULATED_JORNADAS = generarJornadasSimuladas();

// ── Context ───────────────────────────────────────────────────────────────────
const AppDataContext = createContext(null);

export function AppDataProvider({ children }) {
    const [config,           setConfig]           = useState(() => load("cyrano_config",           DEFAULT_CONFIG));
    const [plan,             setPlan]             = useState(() => load("cyrano_plan",             DEFAULT_PLAN));
    const [planesSuper,      setPlanesSuper]      = useState(() => load("cyrano_planes_super",     {}));
    const [mantenimiento,    setMantenimiento]    = useState(() => load("cyrano_mantenimiento",    []));
    const [jornadas,         setJornadas]         = useState(() => load("cyrano_jornadas",         SIMULATED_JORNADAS));
    const [jornadaActiva,    setJornadaActiva]    = useState(() => load("cyrano_jornada_activa",   null));
    const [actividadActiva,  setActividadActiva]  = useState(() => load("cyrano_actividad_activa", null));

    useEffect(() => { save("cyrano_config",           config);          }, [config]);
    useEffect(() => { save("cyrano_plan",             plan);            }, [plan]);
    useEffect(() => { save("cyrano_planes_super",     planesSuper);     }, [planesSuper]);
    useEffect(() => { save("cyrano_mantenimiento",    mantenimiento);   }, [mantenimiento]);
    useEffect(() => { save("cyrano_jornadas",         jornadas);        }, [jornadas]);
    useEffect(() => { save("cyrano_jornada_activa",   jornadaActiva);   }, [jornadaActiva]);
    useEffect(() => { save("cyrano_actividad_activa", actividadActiva); }, [actividadActiva]);

    const updateConfig    = (key, value) => setConfig((p) => ({ ...p, [key]: value }));
    const resetConfig     = ()           => { setConfig(DEFAULT_CONFIG); localStorage.removeItem("cyrano_config"); };
    const savePlan        = (p)          => setPlan(p);

    // ── Planes por supervisor ────────────────────────────────────────────────
    // planesSuper[email] = {
    //   nombre, turnoBase: "diurno"|"nocturno"|"mixto",
    //   objetivos: [{ objetivo, visitasPorSemana, turno, patron, semanasCustom }]
    // }

    const savePlanSupervisor = (email, datos) => {
        setPlanesSuper((prev) => ({ ...prev, [email]: datos }));
    };

    const getPlanSupervisor = (email) =>
        planesSuper[email] || null;

    // Objetivos activos para una semana dada, con turno efectivo resuelto
    const getObjetivosSemana = (email, semana) => {
        const ps = planesSuper[email];
        if (!ps) return [];
        return (ps.objetivos || []).filter(o => {
            if (o.patron === "todas")   return true;
            if (o.patron === "impares") return semana === 1 || semana === 3;
            if (o.patron === "pares")   return semana === 2 || semana === 4;
            if (o.patron === "custom")  return (o.semanasCustom || []).includes(semana);
            return true;
        }).map(o => ({
            ...o,
            turnoEfectivo: (!o.turno || o.turno === "base")
                ? (ps.turnoBase || "mixto")
                : o.turno,
        }));
    };

    // Lista supervisores: los con plan registrado + los de config sin email
    const getSupervisoresConEmail = () => {
        const conEmail = Object.entries(planesSuper).map(([email, v]) => ({
            email, nombre: v.nombre || email, turnoBase: v.turnoBase || "mixto",
        }));
        const nombresConEmail = new Set(conEmail.map((s) => s.nombre));
        const sinEmail = (config.supervisores || [])
            .filter((n) => !nombresConEmail.has(n))
            .map((n) => ({ email: null, nombre: n, turnoBase: null }));
        return [...conEmail, ...sinEmail];
    };
    // ────────────────────────────────────────────────────────────────────────


    // ── Mantenimiento de vehículos ───────────────────────────────────────────
    const addMantenimiento = (evento) => {
        const nuevo = { ...evento, id: "M-" + Date.now().toString().slice(-8), creadoEn: new Date().toISOString() };
        setMantenimiento(prev => [nuevo, ...prev]);
        return nuevo;
    };

    const updateMantenimiento = (id, datos) =>
        setMantenimiento(prev => prev.map(m => m.id === id ? { ...m, ...datos } : m));

    const deleteMantenimiento = (id) =>
        setMantenimiento(prev => prev.filter(m => m.id !== id));

    // Alertas: próximos services en los próximos 30 días o vencidos
    const getAlertasMantenimiento = () => {
        const hoy = new Date(); hoy.setHours(0,0,0,0);
        const en30 = new Date(hoy); en30.setDate(en30.getDate() + 30);
        return mantenimiento
            .filter(m => m.proximoService?.fecha)
            .map(m => {
                const fecha = new Date(m.proximoService.fecha);
                const diasRestantes = Math.round((fecha - hoy) / 86400000);
                return { ...m, diasRestantes };
            })
            .filter(m => m.diasRestantes <= 30)
            .sort((a, b) => a.diasRestantes - b.diasRestantes);
    };
    // ────────────────────────────────────────────────────────────────────────

    const iniciarJornada  = (datos) => {
        const j = { ...datos, estado: "activa", actividades: [], creadaEn: new Date().toISOString() };
        setJornadaActiva(j);
        return j;
    };

    const actualizarJornadaActiva = (datos) =>
        setJornadaActiva((p) => p ? { ...p, ...datos } : p);

    const iniciarActividad = (tipo, datosInicio) => {
        const a = { id: Date.now().toString(), tipo, estado: "en_curso", ...datosInicio, iniciadaEn: new Date().toISOString() };
        // Clasificar automáticamente si es control
        if (tipo === "ctrl") {
            const { turno, esFinDeSemana } = clasificarControl(datosInicio.horaInicio, new Date().toISOString());
            a.turno         = turno;
            a.esFinDeSemana = esFinDeSemana;
        }
        setActividadActiva(a);
        return a;
    };

    const finalizarActividad = (datosFin) => {
        if (!actividadActiva || !jornadaActiva) return;
        const completa = { ...actividadActiva, ...datosFin, estado: "completada", finalizadaEn: new Date().toISOString() };
        setJornadaActiva((p) => ({ ...p, actividades: [...(p.actividades || []), completa] }));
        setActividadActiva(null);
    };

    const cancelarActividad = () => setActividadActiva(null);

    const cerrarJornada = (datosCierre) => {
        if (!jornadaActiva) return;
        const cerrada = { ...jornadaActiva, ...datosCierre, estado: "cerrada", cerradaEn: new Date().toISOString() };
        setJornadas((p) => [cerrada, ...p]);
        setJornadaActiva(null);
        setActividadActiva(null);
        return cerrada;
    };

    // Borrar datos simulados
    const limpiarSimulados = () => {
        const reales = jornadas.filter((j) => !j.jornadaID?.startsWith("J0"));
        setJornadas(reales);
    };

    return (
        <AppDataContext.Provider value={{
            data: config, updateConfig, resetConfig, update: updateConfig, resetToDefaults: resetConfig,
            plan, savePlan,
            planesSuper, savePlanSupervisor, getPlanSupervisor, getObjetivosSemana, getSupervisoresConEmail,
            mantenimiento, addMantenimiento, updateMantenimiento, deleteMantenimiento, getAlertasMantenimiento,
            jornadas, jornadaActiva, actividadActiva,
            iniciarJornada, actualizarJornadaActiva,
            iniciarActividad, finalizarActividad, cancelarActividad, cerrarJornada,
            limpiarSimulados,
        }}>
            {children}
        </AppDataContext.Provider>
    );
}

export function useAppData() {
    const ctx = useContext(AppDataContext);
    if (!ctx) throw new Error("useAppData debe usarse dentro de AppDataProvider");
    return ctx;
}
