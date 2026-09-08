import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL requerida");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const MEMBER_PASSWORD = "1234";
const ADMIN_PASSWORD = "1906";

const members = [
  { username: "mesa.fech", display_name: "Mesa Directiva FECh", group: "Mesa Directiva FECh", faculty: "—", voting_weight: 15.0 },
  { username: "sofia.vallejos", display_name: "Sofía Vallejos", group: "Consejeros FECh", faculty: "FAU", voting_weight: 0.75 },
  { username: "violeta.mlynarz", display_name: "Violeta Mlynarz", group: "Consejeros FECh", faculty: "FAU", voting_weight: 0.75 },
  { username: "camilo.zuniga", display_name: "Camilo Zúñiga", group: "Consejeros FECh", faculty: "FAU", voting_weight: 0.75 },
  { username: "matias.penaloza", display_name: "Matías Peñaloza", group: "Consejeros FECh", faculty: "FAU", voting_weight: 0.75 },
  { username: "paulina.ordenes", display_name: "Paulina Órdenes", group: "Consejeros FECh", faculty: "FEN", voting_weight: 0.75 },
  { username: "nelson.guerra", display_name: "Nelson Guerra", group: "Consejeros FECh", faculty: "FEN", voting_weight: 0.75 },
  { username: "renata.sanchirico", display_name: "Renata Sanchirico", group: "Consejeros FECh", faculty: "FEN", voting_weight: 0.75 },
  { username: "ignacio.winner", display_name: "Ignacio Winner", group: "Consejeros FECh", faculty: "FEN", voting_weight: 0.75 },
  { username: "oliver.alarcon", display_name: "Oliver Alarcón", group: "Consejeros FECh", faculty: "FEN", voting_weight: 0.75 },
  { username: "nicolas.ortega", display_name: "Nicolás Ortega", group: "Consejeros FECh", faculty: "FEN", voting_weight: 0.75 },
  { username: "camilo.escudero", display_name: "Camilo Escudero", group: "Consejeros FECh", faculty: "Artes Centro", voting_weight: 0.75 },
  { username: "martina.candia", display_name: "Martina Candia", group: "Consejeros FECh", faculty: "Derecho", voting_weight: 0.75 },
  { username: "constanza.perez", display_name: "Constanza Pérez", group: "Consejeros FECh", faculty: "Derecho", voting_weight: 0.75 },
  { username: "eduardo.vio", display_name: "Eduardo Vio", group: "Consejeros FECh", faculty: "Derecho", voting_weight: 0.75 },
  { username: "remigio.monroy", display_name: "Remigio Monroy", group: "Consejeros FECh", faculty: "Derecho", voting_weight: 0.75 },
  { username: "amanda.osorio", display_name: "Amanda Osorio", group: "Consejeros FECh", faculty: "Derecho", voting_weight: 0.75 },
  { username: "angie.caicheo", display_name: "Angie Caicheo", group: "Consejeros FECh", faculty: "Derecho", voting_weight: 0.75 },
  { username: "ariela.vasquez", display_name: "Ariela Vásquez", group: "Consejeros FECh", faculty: "FAGOB", voting_weight: 0.75 },
  { username: "matilda.petrasic", display_name: "Matilda Petrasic", group: "Consejeros FECh", faculty: "FAGOB", voting_weight: 0.75 },
  { username: "bruno.ligato", display_name: "Bruno Ligato", group: "Consejeros FECh", faculty: "FAGOB", voting_weight: 0.75 },
  { username: "tito.riera", display_name: "Tito Riera", group: "Consejeros FECh", faculty: "FAGOB", voting_weight: 0.75 },
  { username: "eileen.muller", display_name: "Eileen Müller", group: "Consejeros FECh", faculty: "FAGRO", voting_weight: 0.75 },
  { username: "fernando.gonzalez", display_name: "Fernando González", group: "Consejeros FECh", faculty: "FAGRO", voting_weight: 0.75 },
  { username: "jan.meyer", display_name: "Jan Meyer", group: "Consejeros FECh", faculty: "FCFCN", voting_weight: 0.75 },
  { username: "belen.ortiz", display_name: "Belén Ortiz", group: "Consejeros FECh", faculty: "FAVET", voting_weight: 0.75 },
  { username: "alonso.martinez", display_name: "Alonso Martínez", group: "Consejeros FECh", faculty: "FAVET", voting_weight: 0.75 },
  { username: "cristobal.cortez", display_name: "Cristóbal Cortez", group: "Consejeros FECh", faculty: "FaCQyF", voting_weight: 0.75 },
  { username: "bassam.lopez", display_name: "Bassam López", group: "Consejeros FECh", faculty: "FaO", voting_weight: 0.75 },
  { username: "maria.gonzalez", display_name: "María González", group: "Consejeros FECh", faculty: "FACMED", voting_weight: 0.75 },
  { username: "andrea.quintana", display_name: "Andrea Quintana", group: "Consejeros FECh", faculty: "FACMED", voting_weight: 0.75 },
  { username: "emilio.egana", display_name: "Emilio Egaña", group: "Consejeros FECh", faculty: "FACMED", voting_weight: 0.75 },
  { username: "monserrat.patino", display_name: "Monserrat Patiño", group: "Consejeros FECh", faculty: "FACMED", voting_weight: 0.75 },
  { username: "maximiliano.santibanez", display_name: "Maximiliano Santibáñez", group: "Consejeros FECh", faculty: "FACMED", voting_weight: 0.75 },
  { username: "cristobal.pino", display_name: "Cristóbal Pino", group: "Consejeros FECh", faculty: "FACMED", voting_weight: 0.75 },
  { username: "javiera.amestica", display_name: "Javiera Améstica", group: "Consejeros FECh", faculty: "FACMED", voting_weight: 0.75 },
  { username: "farylen.martinez", display_name: "Farylen Martínez", group: "Consejeros FECh", faculty: "FCEI", voting_weight: 0.75 },
  { username: "emilia.munoz", display_name: "Emilia Muñoz", group: "Consejeros FECh", faculty: "FCEI", voting_weight: 0.75 },
  { username: "sebastian.reyes", display_name: "Sebastián Reyes", group: "Consejeros FECh", faculty: "FCEI", voting_weight: 0.75 },
  { username: "vicente.nunez", display_name: "Vicente Núñez", group: "Consejeros FECh", faculty: "FCEI", voting_weight: 0.75 },
  { username: "amira.salinas", display_name: "Amira Salinas", group: "Consejeros FECh", faculty: "FYHH", voting_weight: 0.75 },
  { username: "danarys.araya", display_name: "Danarys Araya", group: "Consejeros FECh", faculty: "FYHH", voting_weight: 0.75 },
  { username: "emiliano.urra", display_name: "Emiliano Urra", group: "Consejeros FECh", faculty: "FYHH", voting_weight: 0.75 },
  { username: "tomas.mondaca", display_name: "Tomás Mondaca", group: "Consejeros FECh", faculty: "FYHH", voting_weight: 0.75 },
  { username: "luciano.pizarro", display_name: "Luciano Pizarro", group: "Consejeros FECh", faculty: "FYHH", voting_weight: 0.75 },
  { username: "joaquin.abarca", display_name: "Joaquín Abarca", group: "Consejeros FECh", faculty: "FACSO", voting_weight: 0.75 },
  { username: "cahuil.ortiz", display_name: "Cahuil Ortiz", group: "Consejeros FECh", faculty: "FACSO", voting_weight: 0.75 },
  { username: "farid.jalilie", display_name: "Farid Jalilie", group: "Consejeros FECh", faculty: "FACSO", voting_weight: 0.75 },
  { username: "matias.vega", display_name: "Matías Vega", group: "Consejeros FECh", faculty: "FACSO", voting_weight: 0.75 },
  { username: "martina.abarca", display_name: "Martina Abarca", group: "Consejeros FECh", faculty: "FACSO", voting_weight: 0.75 },
  { username: "constanza.saldias", display_name: "Constanza Saldías", group: "Consejeros FECh", faculty: "FACSO", voting_weight: 0.75 },
  { username: "mario.elgueta", display_name: "Mario Elgueta", group: "Consejeros FECh", faculty: "FACIEN", voting_weight: 0.75 },
  { username: "josefina.rio", display_name: "Josefina del Río", group: "Consejeros FECh", faculty: "F. Artes", voting_weight: 0.75 },
  { username: "rayen.pitriqueo", display_name: "Rayén Pitriqueo", group: "Consejeros FECh", faculty: "FCFM", voting_weight: 0.75 },
  { username: "david.olivares", display_name: "David Olivares", group: "Consejeros FECh", faculty: "FCFM", voting_weight: 0.75 },
  { username: "caio.navarro", display_name: "Caio Navarro", group: "Consejeros FECh", faculty: "FCFM", voting_weight: 0.75 },
  { username: "sebastian.flores", display_name: "Sebastián Flores", group: "Consejeros FECh", faculty: "FCFM", voting_weight: 0.75 },
  { username: "felipe.utz", display_name: "Felipe Utz", group: "Consejeros FECh", faculty: "FCFM", voting_weight: 0.75 },
  { username: "francisco.perez", display_name: "Francisco Pérez", group: "Consejeros FECh", faculty: "FCFM", voting_weight: 0.75 },
  { username: "alexander.epuleo", display_name: "Alexander Epuleo", group: "Consejeros FECh", faculty: "Escaños Indígenas", voting_weight: 0.75 },
  { username: "maria.nunez", display_name: "María Núñez", group: "Consejeros FECh", faculty: "Escaños Indígenas", voting_weight: 0.75 },
  { username: "CEIA", display_name: "Delegade CEIA — CE de Ingeniería Agronómica", group: "CEE", faculty: "CEIA", voting_weight: 0.67 },
  { username: "CEIREN", display_name: "Delegade CEIREN — CE de Ing. en Recursos Naturales", group: "CEE", faculty: "CEIREN", voting_weight: 0.44 },
  { username: "CEIF", display_name: "Delegade CEIF — CE de Ingeniería Forestal", group: "CEE", faculty: "CEIF", voting_weight: 0.42 },
  { username: "CEV", display_name: "Delegade CEV — CE de Veterinaria", group: "CEE", faculty: "CEV", voting_weight: 1.31 },
  { username: "CEO", display_name: "Delegade CEO — CE de Odontología", group: "CEE", faculty: "CEO", voting_weight: 0.76 },
  { username: "CEFaQ", display_name: "Delegade CEFaQ — CE de Ciencias Químicas y Farmacéuticas", group: "CEE", faculty: "CEFaQ", voting_weight: 1.84 },
  { username: "CES", display_name: "Delegade CES — CE de Salud (FACMED)", group: "CEE", faculty: "CES", voting_weight: 4.42 },
  { username: "CEI", display_name: "Delegade CEI — CE de Ingeniería (FCFM)", group: "CEE", faculty: "CEI", voting_weight: 5.83 },
  { username: "CEG", display_name: "Delegade CEG — CE de Geografía", group: "CEE", faculty: "CEG", voting_weight: 0.17 },
  { username: "CEDIS", display_name: "Delegade CEDIS — CE de Diseño", group: "CEE", faculty: "CEDIS", voting_weight: 0.75 },
  { username: "CEArq", display_name: "Delegade CEArq — Mesa Interina de Arquitectura", group: "CEE", faculty: "CEArq", voting_weight: 1.34 },
  { username: "CEIIA", display_name: "Delegade CEIIA — CE de Ing. en Información y Auditoría", group: "CEE", faculty: "CEIIA", voting_weight: 1.33 },
  { username: "CEIC", display_name: "Delegade CEIC — CE de Ingeniería Comercial", group: "CEE", faculty: "CEIC", voting_weight: 2.98 },
  { username: "CECIP", display_name: "Delegade CECIP — CE de Ciencia Política", group: "CEE", faculty: "CECIP", voting_weight: 0.25 },
  { username: "CEAP", display_name: "Delegade CEAP — CE de Administración Pública", group: "CEE", faculty: "CEAP", voting_weight: 0.70 },
  { username: "CED", display_name: "Delegade CED — CE de Derecho", group: "CEE", faculty: "CED", voting_weight: 3.27 },
  { username: "CEET", display_name: "Delegade CEET — CE de Teatro", group: "CEE", faculty: "CEET", voting_weight: 0.21 },
  { username: "CEFA", display_name: "Delegade CEFA — CE Facultad de Artes", group: "CEE", faculty: "CEFA", voting_weight: 0.69 },
  { username: "CETHA-DEAV", display_name: "Delegade CETHA-DEAV — CE de Teoría e Historia del Arte", group: "CEE", faculty: "CETHA-DEAV", voting_weight: 0.48 },
  { username: "CECO", display_name: "Delegade CECO — CE de Comunicaciones", group: "CEE", faculty: "CECO", voting_weight: 1.05 },
  { username: "CEBa", display_name: "Delegade CEBa — CE de Bachillerato", group: "CEE", faculty: "CEBa", voting_weight: 0.49 },
  { username: "CEC", display_name: "Delegade CEC — CE de Ciencias (FACIEN)", group: "CEE", faculty: "CEC", voting_weight: 1.34 },
  { username: "CEFH", display_name: "Delegade CEFH — CE de Filosofía y Humanidades", group: "CEE", faculty: "CEFH", voting_weight: 1.79 },
  { username: "CECSO", display_name: "Delegade CECSO — CE de Ciencias Sociales", group: "CEE", faculty: "CECSO", voting_weight: 2.45 },
  { username: "SESEGEN", display_name: "Secretaría de Sexualidades y Géneros", group: "COSEFECH", faculty: "SESEGEN", voting_weight: 0.63 },
  { username: "SEDISGEN", display_name: "Secretaría de Diversidades y Disidencias Sexuales y de Género", group: "COSEFECH", faculty: "SEDISGEN", voting_weight: 0.63 },
  { username: "TTVV", display_name: "Secretaría de Extensión y Trabajos Voluntarios", group: "COSEFECH", faculty: "TTVV", voting_weight: 0.63 },
  { username: "Cultura", display_name: "Secretaría de Cultura", group: "COSEFECH", faculty: "Cultura", voting_weight: 0.63 },
  { username: "SECMA", display_name: "Secretaría de Ecología y Medioambiente", group: "COSEFECH", faculty: "SECMA", voting_weight: 0.63 },
  { username: "SEDEPELU", display_name: "Secretaría de Peludos", group: "COSEFECH", faculty: "SEDEPELU", voting_weight: 0.63 },
  { username: "SECICO", display_name: "Secretaría de Ciencias y Conocimiento", group: "COSEFECH", faculty: "SECICO", voting_weight: 0.63 },
  { username: "SEMEDDHH", display_name: "Secretaría de Memoria y Derechos Humanos", group: "COSEFECH", faculty: "SEMEDDHH", voting_weight: 0.63 },
];

async function seed() {
  const client = await pool.connect();
  try {
    const memberHash = await bcrypt.hash(MEMBER_PASSWORD, 10);
    const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    await client.query(`
      INSERT INTO users (username, display_name, "group", faculty, password, plain_password, voting_weight, rol)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (username) DO NOTHING
    `, ["FECH", "Administrador FECh", "Administración", "FECh", adminHash, ADMIN_PASSWORD, "0", "admin"]);

    console.log("Admin creado");

    let count = 0;
    for (const m of members) {
      await client.query(`
        INSERT INTO users (username, display_name, "group", faculty, password, plain_password, voting_weight, rol)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (username) DO NOTHING
      `, [m.username, m.display_name, m.group, m.faculty, memberHash, MEMBER_PASSWORD, String(m.voting_weight), "miembro"]);
      count++;
    }

    console.log(`${count} miembros insertados`);
    console.log("Seed completado");
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Error en seed:", err);
  process.exit(1);
});
