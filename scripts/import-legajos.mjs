// scripts/import-legajos.mjs
// Importa legajos a Firestore
// Ejecutar: node scripts/import-legajos.mjs

import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
    apiKey:            "AIzaSyA8cZfXy4CsNEHjUqNUXL0XrRrrAAht530",
    authDomain:        "cyranoapp-a7d2c.firebaseapp.com",
    projectId:         "cyranoapp-a7d2c",
    storageBucket:     "cyranoapp-a7d2c.firebasestorage.app",
    messagingSenderId: "927032283173",
    appId:             "1:927032283173:web:f6f897cb34648f7f132fcc",
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

const EMPRESA = "Brinks";

const LEGAJOS = [
    {
        legajo: "20250", nombre: "GIRELLI RODOLFO SEBASTIAN",
        cargo: "Supervisor Santa Cruz", tarea: "Supervisor (FC)", sexo: "M",
        fechaIngreso: "01/08/2021", dni: "", cuil: "", domicilio: "", nacimiento: "",
        sab1: "0", sab2: "", sab3: "", sab4: "",
        servicio: "Panamerican Silver", hijos: "3", centroCosto: "217",
        proyecto: "Seguridad Fisica Cerro Moro", sucursal: "Santa Cruz", zona: "Santa Cruz",
        foto: "20250.jpg",
    },
    {
        legajo: "20286", nombre: "ZUÑIGA ROLANDO ALFONSO",
        cargo: "Chofer", tarea: "Chofer", sexo: "M",
        fechaIngreso: "18/10/2021", dni: "35383582", cuil: "2035383582",
        domicilio: "Marta Crowe 226, Caleta Olivia", nacimiento: "28/04/1991",
        sab1: "0", sab2: "0", sab3: "0", sab4: "0",
        servicio: "Panamerican Silver", hijos: "1", centroCosto: "217",
        proyecto: "Seguridad Fisica Cerro Moro", sucursal: "Santa Cruz", zona: "Santa Cruz",
        foto: "20286.jpg",
    },
    {
        legajo: "20285", nombre: "AGUIRRE ENRIQUE ANDRES",
        cargo: "Supervisor (FC)", tarea: "Supervisor (FC)", sexo: "M",
        fechaIngreso: "18/10/2021", dni: "27598673", cuil: "23275986739",
        domicilio: "Angel Manciella Mbk 8, Piso 3, Dto.", nacimiento: "20/08/1979",
        sab1: "0", sab2: "1", sab3: "0", sab4: "0",
        servicio: "Panamerican Silver", hijos: "2", centroCosto: "217",
        proyecto: "Seguridad Fisica Cerro Moro", sucursal: "Santa Cruz", zona: "Santa Cruz",
        foto: "20285.jpg",
    },
    {
        legajo: "20239", nombre: "CACERES ROCIO BELEN",
        cargo: "Vigilador Principal", tarea: "Encargado", sexo: "F",
        fechaIngreso: "01/08/2021", dni: "37809880", cuil: "27378098802",
        domicilio: "Talleres Volcan 1873, Caleta Olivia", nacimiento: "10/02/1994",
        sab1: "0", sab2: "0", sab3: "1", sab4: "0",
        servicio: "Panamerican Silver", hijos: "", centroCosto: "217",
        proyecto: "Seguridad Fisica Cerro Moro", sucursal: "Santa Cruz", zona: "Santa Cruz",
        foto: "20239.jpg",
    },
    {
        legajo: "20240", nombre: "CARPIO GLORIA VICTORIA",
        cargo: "Vigilador Principal", tarea: "Encargado", sexo: "F",
        fechaIngreso: "01/08/2021", dni: "26520615", cuil: "27265206153",
        domicilio: "Uruguay 780, Caleta Olivia", nacimiento: "12/02/1978",
        sab1: "0", sab2: "1", sab3: "0", sab4: "0",
        servicio: "Panamerican Silver", hijos: "", centroCosto: "217",
        proyecto: "Seguridad Fisica Cerro Moro", sucursal: "Santa Cruz", zona: "Santa Cruz",
        foto: "20240.jpg",
    },
];

async function importar() {
    const col = collection(db, "legajos");
    for (const l of LEGAJOS) {
        await addDoc(col, { ...l, empresa: EMPRESA, creadoEn: serverTimestamp() });
        console.log(`✅ Importado: ${l.legajo} — ${l.nombre}`);
    }
    console.log("\n✔ Importación completa.");
    process.exit(0);
}

importar().catch(e => { console.error("❌ Error:", e.message); process.exit(1); });
