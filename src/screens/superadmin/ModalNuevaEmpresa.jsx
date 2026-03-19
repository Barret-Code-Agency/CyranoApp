// src/screens/superadmin/ModalNuevaEmpresa.jsx
import { useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";

// Módulos activos por defecto al crear una empresa nueva
export const MODULOS_DEF = [
    {
        grupo: "Gerencia de Operaciones",
        icon:  "🏢",
        color: "blue",
        modulos: [
            { key: "supervision",         label: "Supervisión",             desc: "Panel de supervisión y control"                          },
            { key: "gestion_datos",       label: "Gestión de datos",        desc: "Clientes, objetivos y datos operativos"                  },
            { key: "dashboards_gestion",  label: "Dashboards de gestión",   desc: "Métricas y KPIs de la empresa"                          },
            { key: "dashboard_personal",  label: "Dashboard de personal",   desc: "Estado y novedades del personal"                        },
            { key: "turnos",              label: "Turnos de trabajo",        desc: "Cargá y gestioná los turnos del personal del contrato"  },
            { key: "informes",            label: "Informes",                 desc: "Ver y redactar informes del contrato"                   },
            { key: "asig_personal",       label: "Asignación de personal",  desc: "Asigná vigiladores a los puestos del contrato"          },
            { key: "horas_extras",        label: "Horas extras",            desc: "Registrá y gestioná las horas extras del personal"      },
            { key: "horas_no_prestadas",  label: "Horas no prestadas",      desc: "Registrá ausencias y horas no cumplidas"                },
            { key: "gestion_clientes",    label: "Gestión de Clientes",     desc: "Cargá clientes, objetivos y puestos del contrato"       },
            { key: "plan_seguridad",      label: "Plan de seguridad",       desc: "Cargar y editar planes de seguridad"                    },
            { key: "plan_capacitacion",   label: "Plan de capacitación",    desc: "Gestión de capacitaciones"                              },
            { key: "analisis_riesgos",    label: "Análisis de riesgos",     desc: "Relevamiento de riesgos"                                },
        ],
    },
    {
        grupo: "Supervisor / Encargado",
        icon:  "🔍",
        color: "green",
        modulos: [
            { key: "rondas_plantillas",        label: "Planif. y control de rondas",   desc: "Crear y configurar rondas GPS"           },
            { key: "rondas_monitor",           label: "Monitor de rondas",             desc: "Ver rondas en tiempo real"               },
            { key: "control_cobertura",        label: "Control de cobertura",          desc: "Cobertura operativa del puesto"          },
            { key: "planillas",                label: "Planillas",                     desc: "Planillas operativas (compartido)"       },
            { key: "informes",                 label: "Informes",                      desc: "Ver e informes (compartido)"             },
            { key: "turnos",                   label: "Turnos de trabajo",             desc: "Cargar y gestionar turnos"               },
            { key: "auditoria_puesto",         label: "Auditoría de Puesto",           desc: "Auditorías operativas del puesto"        },
            { key: "felicitaciones_sanciones", label: "Felicitaciones y Sanciones",   desc: "Registro de felicitaciones y sanciones"  },
            { key: "informe_gestion",          label: "Informe de Gestión",            desc: "Informe de gestión del período"          },
            { key: "informe_visita",           label: "Informe de Visita al Cliente",  desc: "Novedades de la visita al cliente"       },
        ],
    },
    {
        grupo: "Administrativo",
        icon:  "🗂️",
        color: "orange",
        modulos: [
            { key: "legajos",       label: "Legajos",          desc: "Legajos del personal del contrato"  },
            { key: "facturacion",   label: "Facturación",      desc: "Gestión de facturación"             },
            { key: "control_horas", label: "Control de horas", desc: "Control de horas trabajadas"        },
            { key: "ausentismo",    label: "Ausentismo",       desc: "Registro de ausentismo"             },
        ],
    },
    {
        grupo: "Vigilador",
        icon:  "👷",
        color: "gray",
        modulos: [
            { key: "libro_actas",         label: "Libro de Actas Digital",         desc: "Registro digital de novedades"       },
            { key: "realizar_ronda",      label: "Realizar Ronda",                 desc: "Ejecutar rondas de vigilancia"       },
            { key: "control_vehicular",   label: "Control de Vehículo",            desc: "Checklist del vehículo asignado"     },
            { key: "planillas",           label: "Planillas",                      desc: "Planillas operativas del puesto"     },
            { key: "informes",            label: "Informes",                       desc: "Crear y consultar informes del puesto"},
            { key: "turnos_ver",          label: "Mis Turnos",                     desc: "Ver turnos asignados"                },
            { key: "pedido_insumos",      label: "Pedido de Insumos",              desc: "Solicitar materiales o insumos"      },
            { key: "inventarios",         label: "Inventarios",                    desc: "Gestión de inventario del puesto"    },
            { key: "muro_procedimientos", label: "Muro de Procedimientos",         desc: "Procedimientos operativos vigentes"  },
            { key: "muro_comunicacion",   label: "Muro de Comunicación",           desc: "Novedades y comunicados de empresa"  },
            { key: "capacitacion",        label: "Capacitación y Entrenamiento",   desc: "Cursos y materiales de formación"    },
        ],
    },
];

export const MODULOS_DEFAULT = Object.fromEntries(
    MODULOS_DEF.flatMap(g => g.modulos.map(m => [m.key, true]))
);

export default function ModalNuevaEmpresa({ onCrear, onCerrar }) {
    const [form, setForm]       = useState({ id: "", nombre: "" });
    const [error, setError]     = useState("");
    const [loading, setLoading] = useState(false);

    const cambiar = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const crear = async () => {
        const id     = form.id.trim().toLowerCase().replace(/\s+/g, "_");
        const nombre = form.nombre.trim();
        if (!id)     return setError("El ID es requerido.");
        if (!nombre) return setError("El nombre es requerido.");
        setError(""); setLoading(true);
        try {
            const ref = doc(db, "empresas", id);
            await setDoc(ref, {
                nombre,
                activo:   true,
                modulos:  MODULOS_DEFAULT,
                creadoEn: serverTimestamp(),
            });
            onCrear({ id, nombre, activo: true, modulos: MODULOS_DEFAULT });
        } catch (e) {
            setError("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="sa-modal-overlay" onClick={onCerrar}>
            <div className="sa-modal-box" onClick={e => e.stopPropagation()}>
                <div className="sa-modal-title">Nueva empresa</div>

                <div className="sa-ur-field">
                    <label className="sa-ur-label">ID de la empresa</label>
                    <input
                        className="sa-ur-input"
                        name="id"
                        value={form.id}
                        onChange={cambiar}
                        placeholder="ej: brinks"
                        autoFocus
                    />
                    <span className="sa-ur-hint">Sin espacios, en minúsculas. Ej: brinks, prosegur</span>
                </div>

                <div className="sa-ur-field">
                    <label className="sa-ur-label">Nombre visible</label>
                    <input
                        className="sa-ur-input"
                        name="nombre"
                        value={form.nombre}
                        onChange={cambiar}
                        placeholder="ej: Brinks Argentina"
                        onKeyDown={e => e.key === "Enter" && crear()}
                    />
                </div>

                {error && <div className="sa-msg sa-msg--err">{error}</div>}

                <div className="sa-modal-actions">
                    <button className="sa-ur-btn-save" onClick={crear} disabled={loading}>
                        {loading ? "Creando…" : "✅ Crear empresa"}
                    </button>
                    <button className="sa-ur-btn-cancel" onClick={onCerrar}>Cancelar</button>
                </div>
            </div>
        </div>
    );
}
