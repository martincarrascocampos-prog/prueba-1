import { useState, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import {
  useGetPublicHistory,
  getGetPublicHistoryQueryKey,
  useGetPublicMembers,
  getGetPublicMembersQueryKey,
} from "@workspace/api-client-react";
import type {
  AdminHistorySession,
  AdminHistoryTopic,
  PublicAttendee,
  PublicMemberRef,
  PublicMember,
  PublicAgendaPoint,
  PublicSpeaker,
} from "@workspace/api-client-react";
import { Spinner } from "@/components/ui/spinner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ResultsBar, CandidateResultsBar } from "@/components/results-bar";
import {
  ExternalLink, FileDown, LogIn, MapPin, Clock, Radio, CalendarDays, Archive,
  Video, Users, UserX, ShieldCheck, BarChart2, Info, Home, ListOrdered, Scale,
  Mic, Search, Hourglass, Sparkles, FileText, CheckCircle2, XCircle, MinusCircle,
} from "lucide-react";

// ─── Estamentos ──────────────────────────────────────────────────────────────
// Cada estamento tiene color y forma propios. La forma importa: distingue los
// grupos incluso en blanco y negro, y para quien no diferencia bien los colores.

type EstamentoKey = "mesa" | "cosefech" | "consejero" | "cee" | "otro";
type Shape = "star" | "triangle" | "circle" | "square" | "diamond";

const ESTAMENTO: Record<
  EstamentoKey,
  { label: string; short: string; hex: string; shape: Shape; chip: string; text: string; bg: string }
> = {
  mesa: {
    label: "Mesa Directiva", short: "Mesa", hex: "#E5006D", shape: "star",
    chip: "bg-pink-50 text-pink-700 border-pink-300", text: "text-pink-700", bg: "bg-pink-600",
  },
  cosefech: {
    label: "COSEFECH", short: "COSEFECH", hex: "#EA580C", shape: "triangle",
    chip: "bg-orange-50 text-orange-700 border-orange-300", text: "text-orange-700", bg: "bg-orange-600",
  },
  consejero: {
    label: "Consejerías FECh", short: "Consejerías", hex: "#1D4ED8", shape: "circle",
    chip: "bg-blue-50 text-blue-700 border-blue-300", text: "text-blue-700", bg: "bg-blue-700",
  },
  cee: {
    label: "CEE — Delegades", short: "CEE", hex: "#047857", shape: "square",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-300", text: "text-emerald-700", bg: "bg-emerald-700",
  },
  otro: {
    label: "Otros", short: "Otros", hex: "#6D28D9", shape: "diamond",
    chip: "bg-violet-50 text-violet-700 border-violet-300", text: "text-violet-700", bg: "bg-violet-700",
  },
};

function estamentoOf(group: string | null | undefined): EstamentoKey {
  if (!group) return "otro";
  if (group.startsWith("Mesa Directiva")) return "mesa";
  if (group === "COSEFECH") return "cosefech";
  if (group === "Consejeros FECh") return "consejero";
  if (group === "CEE" || group.startsWith("CE") || group.startsWith("Delegade")) return "cee";
  return "otro";
}

const ORDEN: Record<EstamentoKey, number> = { mesa: 0, cosefech: 1, consejero: 2, cee: 3, otro: 4 };
const ESTAMENTOS_VISIBLES: EstamentoKey[] = ["mesa", "cosefech", "consejero", "cee"];

// ─── Geometría de las formas ─────────────────────────────────────────────────

function starPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = (i % 2 === 0 ? r : r * 0.45);
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(cx + rad * Math.cos(ang)).toFixed(2)},${(cy + rad * Math.sin(ang)).toFixed(2)}`);
  }
  return pts.join(" ");
}

function polyPoints(cx: number, cy: number, r: number, sides: number, rotation: number): string {
  const pts: string[] = [];
  for (let i = 0; i < sides; i++) {
    const ang = (2 * Math.PI * i) / sides + rotation;
    pts.push(`${(cx + r * Math.cos(ang)).toFixed(2)},${(cy + r * Math.sin(ang)).toFixed(2)}`);
  }
  return pts.join(" ");
}

function Seat({ x, y, r, shape, fill, onEnter, onMove, onLeave }: {
  x: number; y: number; r: number; shape: Shape; fill: string;
  onEnter: (e: React.MouseEvent) => void; onMove: (e: React.MouseEvent) => void; onLeave: () => void;
}) {
  const common = {
    fill, stroke: "#FFFFFF", strokeWidth: 1.5,
    className: "cursor-pointer", onMouseEnter: onEnter, onMouseMove: onMove, onMouseLeave: onLeave,
  };
  switch (shape) {
    case "circle":
      return <circle cx={x} cy={y} r={r} {...common} />;
    case "square":
      return <rect x={x - r * 0.9} y={y - r * 0.9} width={r * 1.8} height={r * 1.8} {...common} />;
    case "triangle":
      return <polygon points={polyPoints(x, y, r * 1.15, 3, -Math.PI / 2)} {...common} />;
    case "star":
      return <polygon points={starPoints(x, y, r * 1.5)} {...common} />;
    case "diamond":
      return <polygon points={polyPoints(x, y, r * 1.1, 4, -Math.PI / 2)} {...common} />;
  }
}

// Marca de forma para leyendas y listados, en línea con el texto.
function ShapeMark({ estamento, size = 11 }: { estamento: EstamentoKey; size?: number }) {
  const cfg = ESTAMENTO[estamento];
  const c = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden>
      {cfg.shape === "circle" && <circle cx={c} cy={c} r={c * 0.85} fill={cfg.hex} />}
      {cfg.shape === "square" && <rect x={c * 0.2} y={c * 0.2} width={c * 1.6} height={c * 1.6} fill={cfg.hex} />}
      {cfg.shape === "triangle" && <polygon points={polyPoints(c, c, c, 3, -Math.PI / 2)} fill={cfg.hex} />}
      {cfg.shape === "star" && <polygon points={starPoints(c, c, c)} fill={cfg.hex} />}
      {cfg.shape === "diamond" && <polygon points={polyPoints(c, c, c, 4, -Math.PI / 2)} fill={cfg.hex} />}
    </svg>
  );
}

// ─── Pestañas ────────────────────────────────────────────────────────────────

type TabId = "inicio" | "facil" | "composicion" | "asistencias" | "palabra" | "sesiones";

const TABS: { id: TabId; label: string; icon: typeof Home; on: string }[] = [
  { id: "inicio", label: "Inicio", icon: Home, on: "border-pink-600 text-pink-700 bg-pink-50" },
  { id: "facil", label: "Pleno Fácil", icon: Sparkles, on: "border-teal-700 text-teal-700 bg-teal-50" },
  { id: "composicion", label: "Composición", icon: Users, on: "border-emerald-700 text-emerald-700 bg-emerald-50" },
  { id: "asistencias", label: "Asistencias", icon: BarChart2, on: "border-blue-700 text-blue-700 bg-blue-50" },
  { id: "palabra", label: "Uso de la palabra", icon: Mic, on: "border-orange-600 text-orange-700 bg-orange-50" },
  { id: "sesiones", label: "Sesiones", icon: Archive, on: "border-violet-700 text-violet-700 bg-violet-50" },
];

// ─── Utilidades ──────────────────────────────────────────────────────────────

const formatDate = (v: string | null | undefined): string | null => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toLocaleString("es-CL", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

const formatShortDate = (v: string | null | undefined): string => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
};

const hhmm = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
};

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

// Duración estimada según la tabla, que es una previsión, no un registro.
const estimatedMinutes = (s: AdminHistorySession) =>
  (s.agenda ?? []).reduce((sum, p) => sum + (p.estimatedMinutes ?? 0), 0);

// Duración real: solo existe en sesiones abiertas oficialmente y ya cerradas.
// Las horas de pleno que publica el portal cuentan únicamente estas.
const realMinutes = (s: AdminHistorySession) => s.officialMinutes ?? null;

// ─── Encabezado de sección ───────────────────────────────────────────────────

function SectionHeading({ icon, title, subtitle, color }: {
  icon: React.ReactNode; title: string; subtitle?: string; color: string;
}) {
  return (
    <div className="mb-5 border-l-4 pl-4" style={{ borderColor: color }}>
      <h3 className="flex items-center gap-2 text-lg font-bold leading-tight">
        <span style={{ color }}>{icon}</span>{title}
      </h3>
      {subtitle && <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

// ─── Tabla de la sesión ──────────────────────────────────────────────────────

function AgendaList({ points }: { points: PublicAgendaPoint[] }) {
  if (points.length === 0)
    return <p className="text-sm text-muted-foreground">Esta sesión no tiene tabla publicada.</p>;

  const ordered = [...points].sort((a, b) => a.position - b.position);
  const total = ordered.reduce((s, p) => s + (p.estimatedMinutes ?? 0), 0);

  return (
    <div className="border border-gray-300 bg-white">
      <table className="w-full text-sm">
        <tbody>
          {ordered.map((p, i) => (
            <tr key={`${p.position}-${i}`} className="border-b border-gray-200 last:border-b-0">
              <td className="w-10 border-r border-gray-200 bg-gray-50 px-2 py-2 text-center text-xs font-bold tabular-nums text-blue-700">
                {String(i + 1).padStart(2, "0")}
              </td>
              <td className="px-3 py-2 leading-snug">{p.title}</td>
              {p.estimatedMinutes != null && (
                <td className="w-20 px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">
                  {p.estimatedMinutes} min
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {total > 0 && (
        <div className="flex justify-between border-t border-gray-300 bg-gray-50 px-3 py-1.5 text-xs">
          <span className="text-muted-foreground">{ordered.length} puntos de tabla</span>
          <span className="font-semibold tabular-nums">{hhmm(total * 60)}</span>
        </div>
      )}
    </div>
  );
}

// ─── Hemiciclo ───────────────────────────────────────────────────────────────

function Hemicycle({ members }: { members: PublicMember[] }) {
  const [hovered, setHovered] = useState<PublicMember | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const seats = useMemo(() => {
    const sorted = [...members].sort((a, b) => {
      const d = ORDEN[estamentoOf(a.group)] - ORDEN[estamentoOf(b.group)];
      return d || a.name.localeCompare(b.name, "es");
    });
    const by = (k: EstamentoKey) => sorted.filter((m) => estamentoOf(m.group) === k);
    const consejeros = by("consejero");
    const k = Math.ceil(consejeros.length / 3) || 1;

    // La Mesa va al centro, adelante; las consejerías ocupan tres anillos por
    // ser el estamento más numeroso; los CEE cierran el hemiciclo.
    const rings: [PublicMember[], number][] = [
      [[...by("mesa"), ...by("otro"), ...by("cosefech")], 95],
      [consejeros.slice(0, k), 167],
      [consejeros.slice(k, 2 * k), 239],
      [consejeros.slice(2 * k), 311],
      [by("cee"), 383],
    ];

    const cx = 410, cy = 430;
    const out: { x: number; y: number; m: PublicMember; e: EstamentoKey }[] = [];
    for (const [group, r] of rings) {
      if (group.length === 0) continue;
      group.forEach((m, i) => {
        const t = group.length === 1 ? 0.5 : i / (group.length - 1);
        const rad = ((178 - 176 * t) * Math.PI) / 180;
        out.push({ x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad), m, e: estamentoOf(m.group) });
      });
    }
    return out;
  }, [members]);

  return (
    <div className="relative w-full">
      <svg ref={svgRef} viewBox="0 0 820 450" className="mx-auto block w-full max-w-3xl">
        <path d="M 24 430 A 386 386 0 0 1 796 430" fill="none" stroke="#D1D5DB" strokeWidth="1" />
        <rect x={385} y={416} width={50} height={4} fill="#9CA3AF" />
        <rect x={405} y={402} width={10} height={16} fill="#9CA3AF" />
        {seats.map((s, i) => (
          <Seat
            key={i} x={s.x} y={s.y} r={hovered === s.m ? 12 : 9}
            shape={ESTAMENTO[s.e].shape} fill={ESTAMENTO[s.e].hex}
            onEnter={(e) => { setHovered(s.m); setPos({ x: e.clientX, y: e.clientY }); }}
            onMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
            onLeave={() => setHovered(null)}
          />
        ))}
      </svg>

      {hovered && (
        <div className="pointer-events-none fixed z-50 max-w-[220px] border border-gray-400 bg-white px-3 py-2 shadow-md"
          style={{ left: pos.x + 14, top: pos.y - 8 }}>
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ color: ESTAMENTO[estamentoOf(hovered.group)].hex }}>
            <ShapeMark estamento={estamentoOf(hovered.group)} size={9} />
            {ESTAMENTO[estamentoOf(hovered.group)].label}
          </div>
          <div className="mt-0.5 text-sm font-semibold leading-tight">{hovered.name}</div>
          {hovered.faculty && <div className="text-xs text-muted-foreground">{hovered.faculty}</div>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap justify-center gap-2 border-t border-gray-200 pt-4">
        {ESTAMENTOS_VISIBLES.map((k) => {
          const cfg = ESTAMENTO[k];
          const n = members.filter((m) => estamentoOf(m.group) === k).length;
          if (n === 0) return null;
          return (
            <span key={k} className={`inline-flex items-center gap-2 border px-3 py-1 text-xs font-semibold ${cfg.chip}`}>
              <ShapeMark estamento={k} size={12} />
              {cfg.label}<span className="font-normal opacity-70 tabular-nums">{n}</span>
            </span>
          );
        })}
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Pasa el cursor sobre un asiento para ver el integrante
      </p>
    </div>
  );
}

// ─── Datos derivados ─────────────────────────────────────────────────────────

type MemberAttendance = {
  name: string; group: string | null; estamento: EstamentoKey;
  attended: number; total: number;
  sessions: { title: string; date: string; present: boolean }[];
};

function buildAttendance(sessions: AdminHistorySession[]): MemberAttendance[] {
  const past = sessions.filter((s) => s.phase === "pasado");
  const map = new Map<string, MemberAttendance>();
  for (const s of past) {
    const rows = [
      ...(s.attendees ?? []).map((a) => ({ name: a.name, group: a.group ?? null, present: true })),
      ...(s.absentees ?? []).map((a) => ({ name: a.name, group: a.group ?? null, present: false })),
    ];
    for (const r of rows) {
      let e = map.get(r.name);
      if (!e) {
        e = { name: r.name, group: r.group, estamento: estamentoOf(r.group), attended: 0, total: 0, sessions: [] };
        map.set(r.name, e);
      }
      e.total++;
      if (r.present) e.attended++;
      e.sessions.push({ title: s.title, date: formatShortDate(s.scheduledAt), present: r.present });
    }
  }
  return [...map.values()].sort((a, b) =>
    (ORDEN[a.estamento] - ORDEN[b.estamento]) || a.name.localeCompare(b.name, "es"));
}

type SpeakerRow = {
  name: string; group: string | null; estamento: EstamentoKey;
  seconds: number; turns: number; sessionsSpoken: number; attended: number; collective: boolean;
};

// El ranking se normaliza por sesiones asistidas: quien vino a dos plenos y
// habló diez minutos no debe quedar bajo quien vino a ocho y habló quince.
function buildSpeakers(sessions: AdminHistorySession[], attendance: MemberAttendance[]): SpeakerRow[] {
  const attendedBy = new Map(attendance.map((a) => [a.name, a.attended]));
  const map = new Map<string, SpeakerRow>();
  for (const s of sessions.filter((x) => x.phase === "pasado")) {
    for (const sp of s.speakers ?? []) {
      let e = map.get(sp.name);
      if (!e) {
        e = {
          name: sp.name, group: sp.group ?? null, estamento: estamentoOf(sp.group),
          seconds: 0, turns: 0, sessionsSpoken: 0,
          attended: attendedBy.get(sp.name) ?? 0, collective: false,
        };
        map.set(sp.name, e);
      }
      e.seconds += sp.seconds;
      e.turns += sp.turns;
      e.sessionsSpoken += 1;
      e.collective ||= sp.collective ?? false;
    }
  }
  return [...map.values()];
}

// ─── Nómina de una sesión ────────────────────────────────────────────────────

function AttendanceRoster({ attendees, absentees }: { attendees: PublicAttendee[]; absentees: PublicMemberRef[] }) {
  const presencial = attendees.filter((a) => a.modality === "presencial");
  const online = attendees.filter((a) => a.modality === "online");
  if (attendees.length === 0 && absentees.length === 0)
    return <p className="text-sm text-muted-foreground">Sin registro de asistencia.</p>;

  const Block = ({ label, color, items }: {
    label: string; color: string; items: { name: string; justified?: boolean }[];
  }) => items.length === 0 ? null : (
    <div>
      <div className={`mb-1.5 text-[11px] font-bold uppercase tracking-wide ${color}`}>{label}</div>
      <div className="flex flex-wrap gap-1">
        {items.map((a, i) => (
          <span key={i} className="border border-gray-300 bg-white px-2 py-0.5 text-xs">
            {a.justified ? `${a.name} · Justificada` : a.name}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs font-bold text-white">
        <span className="inline-flex items-center gap-1.5 bg-emerald-700 px-3 py-1">
          <MapPin className="h-3.5 w-3.5" /> Presencial {presencial.length}
        </span>
        <span className="inline-flex items-center gap-1.5 bg-blue-700 px-3 py-1">
          <Video className="h-3.5 w-3.5" /> Online {online.length}
        </span>
        <span className="inline-flex items-center gap-1.5 bg-gray-500 px-3 py-1">
          <UserX className="h-3.5 w-3.5" /> Ausentes {absentees.length}
        </span>
      </div>
      <Block label="Asistentes presenciales" color="text-emerald-700" items={presencial} />
      <Block label="Asistentes online" color="text-blue-700" items={online} />
      <Block label="Ausentes" color="text-gray-500" items={absentees} />
    </div>
  );
}

// ─── Registro de palabra de una sesión ───────────────────────────────────────

function SpeakersTable({ speakers }: { speakers: PublicSpeaker[] }) {
  if (speakers.length === 0)
    return <p className="text-sm text-muted-foreground">No se registraron intervenciones en esta sesión.</p>;

  const total = speakers.reduce((s, x) => s + x.seconds, 0);
  return (
    <div className="overflow-x-auto border border-gray-300 bg-white">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-gray-300 bg-gray-50 text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="px-3 py-2 text-left font-bold">Interviniente</th>
            <th className="w-24 px-3 py-2 text-right font-bold">Tiempo</th>
            <th className="w-20 px-3 py-2 text-right font-bold">Turnos</th>
          </tr>
        </thead>
        <tbody>
          {speakers.map((sp, i) => {
            const e = estamentoOf(sp.group);
            return (
              <tr key={i} className="border-b border-gray-200 last:border-b-0">
                <td className="px-3 py-1.5">
                  <span className="flex items-center gap-2">
                    <ShapeMark estamento={e} size={10} />
                    <span className="font-medium">{sp.name}</span>
                    {sp.collective && (
                      <span className="border border-teal-300 bg-teal-50 px-1.5 text-[10px] font-bold text-teal-700">
                        COLECTIVA
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{mmss(sp.seconds)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{sp.turns}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-300 bg-gray-50 text-xs font-bold">
            <td className="px-3 py-1.5">Total</td>
            <td className="px-3 py-1.5 text-right tabular-nums">{mmss(total)}</td>
            <td className="px-3 py-1.5 text-right tabular-nums">
              {speakers.reduce((s, x) => s + x.turns, 0)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Votación ────────────────────────────────────────────────────────────────

function PublicTopicCard({ topic: t }: { topic: AdminHistoryTopic }) {
  return (
    <div className="border border-gray-300 bg-white p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="font-semibold">{t.title}</div>
        {t.approved !== null && (
          <span className={`shrink-0 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white ${
            t.approved ? "bg-emerald-700" : "bg-red-700"}`}>
            {t.approved ? "APROBADO" : "RECHAZADO"}
          </span>
        )}
      </div>
      {t.detail && (
        <div className="mb-3 border-l-[3px] border-blue-700 bg-gray-50 px-3 py-2">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-blue-700">
            Detalle de la moción
          </div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">{t.detail}</p>
        </div>
      )}
      {t.type === "candidato"
        ? <CandidateResultsBar candidates={t.candidates ?? []} />
        : <ResultsBar percentages={t.percentages} weights={t.weights} />}
      {(t.ballots?.length ?? 0) > 0 && (
        <details className="mt-3">
          <summary className="inline-flex cursor-pointer select-none items-center gap-1.5 border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
            <Users className="h-3.5 w-3.5" /> Votos por integrante ({t.ballots!.length})
          </summary>
          <div className="mt-2 max-h-72 divide-y divide-gray-200 overflow-y-auto border border-gray-300">
            {t.ballots!.map((b, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs">
                <div className="min-w-0">
                  <span className={b.status === "absent" ? "text-muted-foreground line-through" : "font-medium"}>
                    {b.name}
                  </span>
                  {b.group && <span className="ml-1.5 text-muted-foreground">· {b.group}</span>}
                </div>
                <span className="shrink-0">
                  {b.status === "absent" ? <span className="text-muted-foreground">Ausente</span>
                    : b.voteLabel ? <span className="font-semibold capitalize">{b.voteLabel}</span>
                    : <span className="text-muted-foreground">No votó</span>}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ─── Botones ─────────────────────────────────────────────────────────────────

function MeetingLinkButton({ href, live }: { href: string; live?: boolean }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white ${
        live ? "bg-red-700 hover:bg-red-800" : "bg-blue-700 hover:bg-blue-800"}`}>
      <Video className="h-4 w-4" />
      {live ? "Unirse al pleno en vivo" : "Enlace del pleno"}
      <ExternalLink className="h-3.5 w-3.5 opacity-80" />
    </a>
  );
}

function ActaButton({ sessionId, fileName }: { sessionId: number; fileName: string | null | undefined }) {
  return (
    <a href={`/api/public/sessions/${sessionId}/acta`} download={fileName ?? undefined}
      className="inline-flex items-center gap-2 bg-orange-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-800">
      <FileDown className="h-4 w-4" /> Descargar acta
    </a>
  );
}

// ─── Sesiones ────────────────────────────────────────────────────────────────

function LiveSessionHero({ s }: { s: AdminHistorySession }) {
  const when = formatDate(s.scheduledAt);
  const pct = s.totalWeight > 0 ? (s.presentWeight / s.totalWeight) * 100 : 0;
  return (
    <div className="mb-8 border-2 border-red-700 bg-white">
      <div className="flex items-center gap-2 bg-red-700 px-4 py-1.5 text-[11px] font-bold tracking-wider text-white">
        <Radio className="h-3.5 w-3.5 animate-pulse" /> PLENO EN CURSO
      </div>
      <div className="space-y-5 p-5">
        <h2 className="text-2xl font-bold leading-tight">{s.title}</h2>
        <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-[13px]">
          {when && <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-gray-500" />{when}</span>}
          {s.location && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-gray-500" />{s.location}</span>}
          <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-gray-500" />{s.presentCount} de {s.totalMembers} presentes</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {s.meetingLink && <MeetingLinkButton href={s.meetingLink} live />}
          {s.hasActa && <ActaButton sessionId={s.sessionId} fileName={s.actaFileName} />}
        </div>
        <div className="border border-gray-300">
          <div className="flex items-center gap-2 border-b border-gray-300 bg-gray-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            <Scale className="h-3.5 w-3.5" /> Quórum en tiempo real
          </div>
          <div className="p-3">
            <div className="mb-1.5 flex justify-between text-[13px]">
              <span className="text-muted-foreground">Ponderación presente</span>
              <span className="font-bold tabular-nums">{s.presentWeight.toFixed(2)} / {s.totalWeight.toFixed(2)}</span>
            </div>
            <div className="h-3 w-full border border-gray-300 bg-gray-100">
              <div className="h-full bg-emerald-700" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
        {(s.agenda?.length ?? 0) > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-blue-700">
              <ListOrdered className="h-3.5 w-3.5" /> Tabla de la sesión
            </div>
            <AgendaList points={s.agenda!} />
          </div>
        )}
        <div className="border border-gray-300 p-3">
          <AttendanceRoster attendees={s.attendees ?? []} absentees={s.absentees ?? []} />
        </div>
      </div>
    </div>
  );
}

function UpcomingCard({ s }: { s: AdminHistorySession }) {
  const when = formatDate(s.scheduledAt);
  return (
    <div className="border border-gray-300 bg-white">
      <div className="border-b-2 border-violet-700 bg-violet-50 px-4 py-1.5 text-[10px] font-bold tracking-wider text-violet-700">
        PRÓXIMO PLENO
      </div>
      <div className="space-y-3 p-4">
        <h4 className="text-base font-bold leading-tight">{s.title}</h4>
        <div className="flex flex-col gap-1 text-[13px] text-muted-foreground">
          {when && <span className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" />{when}</span>}
          {s.location && <span className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />{s.location}</span>}
        </div>
        {(s.agenda?.length ?? 0) > 0 && (
          <details>
            <summary className="inline-flex cursor-pointer select-none items-center gap-1.5 border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
              <ListOrdered className="h-3.5 w-3.5" /> Ver tabla ({s.agenda!.length} puntos)
            </summary>
            <div className="mt-2"><AgendaList points={s.agenda!} /></div>
          </details>
        )}
        {s.meetingLink && <div><MeetingLinkButton href={s.meetingLink} /></div>}
      </div>
    </div>
  );
}

function PastSession({ s }: { s: AdminHistorySession }) {
  const when = formatDate(s.scheduledAt);
  const pct = s.totalWeight > 0 ? (s.presentWeight / s.totalWeight) * 100 : 0;
  const real = realMinutes(s);
  const est = estimatedMinutes(s);
  return (
    <AccordionItem value={String(s.sessionId)} className="border border-gray-300 bg-white px-4">
      <AccordionTrigger className="hover:no-underline">
        <div className="flex flex-1 items-center justify-between gap-3 pr-3 text-left">
          <div>
            <div className="font-semibold">{s.title}</div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              {s.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{s.location}</span>}
              {when && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{when}</span>}
              {real !== null
                ? <span className="flex items-center gap-1 font-semibold text-orange-700">
                    <Hourglass className="h-3 w-3" />{hhmm(real * 60)} de sesión
                  </span>
                : est > 0 && <span className="flex items-center gap-1">
                    <Hourglass className="h-3 w-3" />{hhmm(est * 60)} estimados
                  </span>}
              <span>{s.topics.length} votaciones</span>
              <span>{s.presentCount}/{s.totalMembers} presentes</span>
              {(s.speakers?.length ?? 0) > 0 && <span>{s.speakers!.length} intervinientes</span>}
            </div>
          </div>
          <span className="shrink-0 border border-gray-400 px-2 py-0.5 text-[10px] font-bold text-gray-600">CERRADA</span>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4 pb-3">
          {(s.meetingLink || s.hasActa) && (
            <div className="flex flex-wrap gap-2">
              {s.meetingLink && <MeetingLinkButton href={s.meetingLink} />}
              {s.hasActa && <ActaButton sessionId={s.sessionId} fileName={s.actaFileName} />}
            </div>
          )}
          <div className="border border-gray-300">
            <div className="border-b border-gray-300 bg-gray-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              Quórum de la sesión
            </div>
            <div className="p-3">
              <div className="mb-1.5 flex justify-between text-[13px]">
                <span className="text-muted-foreground">Ponderación presente</span>
                <span className="font-bold tabular-nums">
                  {s.presentWeight.toFixed(2)} / {s.totalWeight.toFixed(2)} · {pct.toFixed(1)}%
                </span>
              </div>
              <div className="h-3 w-full border border-gray-300 bg-gray-100">
                <div className="h-full bg-emerald-700" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
          {(s.agenda?.length ?? 0) > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                <ListOrdered className="h-3.5 w-3.5" /> Tabla tratada
              </div>
              <AgendaList points={s.agenda!} />
            </div>
          )}
          {(s.speakers?.length ?? 0) > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-orange-700">
                <Mic className="h-3.5 w-3.5" /> Uso de la palabra
              </div>
              <SpeakersTable speakers={s.speakers!} />
            </div>
          )}
          <div className="border border-gray-300 p-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider">Asistencia</div>
            <AttendanceRoster attendees={s.attendees ?? []} absentees={s.absentees ?? []} />
          </div>
          {s.topics.length === 0
            ? <div className="py-2 text-sm text-muted-foreground">Esta sesión no tuvo votaciones.</div>
            : <div className="space-y-3">{s.topics.map((t) => <PublicTopicCard key={t.topicId} topic={t} />)}</div>}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function PublicHome() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<TabId>("inicio");
  const [attFilter, setAttFilter] = useState<EstamentoKey | "todos">("todos");
  const [attSearch, setAttSearch] = useState("");
  const [speakSearch, setSpeakSearch] = useState("");
  const [speakSort, setSpeakSort] = useState<"total" | "promedio">("promedio");

  const { data: history, isLoading: historyLoading } = useGetPublicHistory({
    query: { queryKey: getGetPublicHistoryQueryKey() },
  });
  const { data: members, isLoading: membersLoading } = useGetPublicMembers({
    query: { queryKey: getGetPublicMembersQueryKey(), staleTime: 5 * 60 * 1000 },
  });

  const sessions = history ?? [];
  const active = sessions.filter((s) => s.phase === "activo");
  const upcoming = sessions.filter((s) => s.phase === "futuro");
  const past = sessions.filter((s) => s.phase === "pasado");

  const attendance = useMemo(() => buildAttendance(sessions), [sessions]);
  const speakers = useMemo(() => buildSpeakers(sessions, attendance), [sessions, attendance]);

  const totalVotes = past.reduce((sum, s) => sum + s.topics.length, 0);
  // Solo suman las sesiones con apertura oficial registrada.
  const oficiales = past.filter((s) => realMinutes(s) !== null);
  const totalMinutes = oficiales.reduce((sum, s) => sum + (realMinutes(s) ?? 0), 0);

  const go = (id: TabId) => { setTab(id); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 border-b-2 border-gray-800 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center bg-gray-900">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold uppercase leading-tight tracking-wide">Pleno FECh</div>
              <div className="text-[11px] leading-tight text-muted-foreground">Portal de Transparencia</div>
            </div>
          </div>
          <Button size="sm" className="rounded-none" onClick={() => setLocation("/login")}>
            <LogIn className="mr-2 h-4 w-4" /> Ingresar
          </Button>
        </div>
        <nav className="overflow-x-auto border-t border-gray-200">
          <div className="mx-auto flex max-w-5xl">
            {TABS.map((t) => {
              const Icon = t.icon;
              const on = tab === t.id;
              return (
                <button key={t.id} onClick={() => go(t.id)}
                  className={`flex shrink-0 items-center gap-2 whitespace-nowrap border-b-[3px] px-4 py-2.5 text-[13px] font-semibold transition-colors ${
                    on ? t.on : "border-transparent text-gray-600 hover:bg-gray-100"}`}>
                  <Icon className="h-4 w-4" />{t.label}
                  {t.id === "inicio" && active.length > 0 && (
                    <span className="h-2 w-2 animate-pulse bg-red-600" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* ── Inicio ── */}
        {tab === "inicio" && (
          <div>
            {active.map((s) => <LiveSessionHero key={s.sessionId} s={s} />)}

            <div className="mb-6 border-l-4 border-gray-900 pl-4">
              <h1 className="text-3xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
                Sistema Plenario
              </h1>
              <p className="mt-1 text-base font-medium text-gray-700">
                Federación de Estudiantes de la Universidad de Chile
              </p>
            </div>

            <div className="mb-6 border border-gray-300 bg-white p-5 text-[15px] leading-relaxed text-gray-700">
              <p>
                El <b className="text-foreground">Pleno FECh</b> es la instancia máxima de deliberación y
                decisión de la Federación. Reúne a la Mesa Directiva, las Consejerías FECh, las delegaciones
                de los Centros de Estudiantes y al Consejo Superior, bajo un sistema de votación ponderada.
              </p>
              <p className="mt-3">
                Este portal publica la tabla de cada sesión, la composición del pleno, el registro de
                asistencias, el uso de la palabra y los resultados completos de cada votación.
              </p>
            </div>

            {!historyLoading && (
              <div className="grid grid-cols-2 border-l border-t border-gray-300 sm:grid-cols-4">
                {[
                  { v: members?.length ?? "—", l: "Integrantes", icon: Users, c: "text-blue-700" },
                  { v: past.length, l: "Sesiones realizadas", icon: CalendarDays, c: "text-emerald-700" },
                  { v: totalMinutes > 0 ? hhmm(totalMinutes * 60) : "—", l: "Horas de pleno", icon: Hourglass, c: "text-orange-700" },
                  { v: totalVotes, l: "Votaciones", icon: BarChart2, c: "text-violet-700" },
                ].map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.l} className="border-b border-r border-gray-300 bg-white p-4">
                      <Icon className={`mb-2 h-4 w-4 ${s.c}`} />
                      <div className={`text-xl font-black tabular-nums ${s.c}`}>{s.v}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{s.l}</div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">
              {totalMinutes > 0
                ? `Horas medidas entre la apertura oficial y el cierre de ${oficiales.length} ${
                    oficiales.length === 1 ? "sesión" : "sesiones"}.`
                : "Las horas se registran desde que una sesión se abre oficialmente hasta que se cierra."}
            </p>

            {upcoming.length > 0 && (
              <section className="mt-10">
                <SectionHeading icon={<CalendarDays className="h-5 w-5" />} title="Próximos plenos"
                  subtitle="Sesiones agendadas, con su tabla." color="#6D28D9" />
                <div className="grid gap-3 sm:grid-cols-2">
                  {upcoming.map((s) => <UpcomingCard key={s.sessionId} s={s} />)}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ── Pleno Fácil ── */}
        {tab === "facil" && (
          <section>
            <SectionHeading icon={<Sparkles className="h-5 w-5" />} title="Pleno Fácil"
              subtitle="Qué se votó y qué se decidió, en una sola mirada. Sin detalles ni votos nominales."
              color="#0F766E" />

            {historyLoading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : past.length === 0 ? (
              <div className="border border-gray-300 bg-white p-12 text-center text-muted-foreground">
                Aún no hay sesiones cerradas.
              </div>
            ) : (
              <div className="space-y-8">
                {/* Resultados de las votaciones */}
                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-teal-800">
                    <BarChart2 className="h-4 w-4" /> Resultados de las votaciones
                  </h4>
                  <div className="space-y-5">
                    {past.map((s) => s.topics.length === 0 ? null : (
                      <div key={s.sessionId}>
                        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-gray-800 pb-1">
                          <span className="text-sm font-bold">{s.title}</span>
                          <span className="text-xs text-muted-foreground">{formatShortDate(s.scheduledAt)}</span>
                        </div>
                        <ul className="divide-y divide-gray-200 border border-t-0 border-gray-300 bg-white">
                          {s.topics.map((t) => {
                            const ok = t.approved;
                            const Icon = ok === null ? MinusCircle : ok ? CheckCircle2 : XCircle;
                            const color = ok === null ? "text-violet-700" : ok ? "text-emerald-700" : "text-red-700";
                            const label = ok === null ? "RESUELTA" : ok ? "APROBADA" : "RECHAZADA";
                            const bg = ok === null ? "bg-violet-700" : ok ? "bg-emerald-700" : "bg-red-700";
                            return (
                              <li key={t.topicId} className="flex items-center justify-between gap-4 px-4 py-3">
                                <span className="flex min-w-0 items-center gap-3">
                                  <Icon className={`h-5 w-5 shrink-0 ${color}`} />
                                  <span className="text-sm font-medium leading-snug">{t.title}</span>
                                </span>
                                <span className={`shrink-0 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white ${bg}`}>
                                  {label}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actas */}
                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-orange-800">
                    <FileText className="h-4 w-4" /> Actas de las sesiones
                  </h4>
                  {past.filter((s) => s.hasActa).length === 0 ? (
                    <div className="border border-gray-300 bg-white p-6 text-center text-sm text-muted-foreground">
                      Todavía no hay actas publicadas.
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-200 border border-gray-300 bg-white">
                      {past.filter((s) => s.hasActa).map((s) => (
                        <li key={s.sessionId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold">{s.title}</span>
                            <span className="text-xs text-muted-foreground">{formatShortDate(s.scheduledAt)}</span>
                          </span>
                          <a href={`/api/public/sessions/${s.sessionId}/acta`}
                            download={s.actaFileName ?? undefined}
                            className="inline-flex shrink-0 items-center gap-2 border border-orange-700 px-3 py-1.5 text-xs font-bold text-orange-700 hover:bg-orange-50">
                            <FileDown className="h-3.5 w-3.5" /> Descargar acta
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <p className="border-l-[3px] border-teal-700 bg-teal-50 px-3 py-2 text-xs leading-relaxed text-gray-700">
                  ¿Necesitas el detalle de una moción, los votos de cada integrante o la asistencia?
                  Está todo en la pestaña <b>Sesiones</b>.
                </p>
              </div>
            )}
          </section>
        )}

        {/* ── Composición ── */}
        {tab === "composicion" && (
          <section>
            <SectionHeading icon={<Users className="h-5 w-5" />} title="Composición del Pleno"
              subtitle="Cada estamento tiene su forma: estrella la Mesa, triángulo COSEFECH, círculo las Consejerías, cuadrado los CEE."
              color="#047857" />
            {membersLoading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : members && members.length > 0 ? (
              <div className="border border-gray-300 bg-white p-5">
                <Hemicycle members={members} />
                <div className="mt-6 space-y-5 border-t border-gray-200 pt-5">
                  {ESTAMENTOS_VISIBLES.map((k) => {
                    const cfg = ESTAMENTO[k];
                    const group = members.filter((m) => estamentoOf(m.group) === k)
                      .sort((a, b) => a.name.localeCompare(b.name, "es"));
                    if (group.length === 0) return null;
                    return (
                      <div key={k}>
                        <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-gray-200 pb-1.5">
                          <ShapeMark estamento={k} size={13} />
                          <h4 className={`text-xs font-bold uppercase tracking-wider ${cfg.text}`}>{cfg.label}</h4>
                          <span className="text-xs tabular-nums text-muted-foreground">{group.length}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {group.map((m) => (
                            <span key={m.name} title={m.faculty ?? undefined}
                              className={`border px-2 py-0.5 text-xs font-medium ${cfg.chip}`}>
                              {m.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="border border-gray-300 bg-white p-8 text-center text-muted-foreground">
                No hay datos de composición disponibles.
              </div>
            )}
          </section>
        )}

        {/* ── Asistencias ── */}
        {tab === "asistencias" && (
          <section>
            <SectionHeading icon={<BarChart2 className="h-5 w-5" />} title="Histórico de Asistencias"
              subtitle="Presencia de cada integrante a través de las sesiones realizadas." color="#1D4ED8" />

            {(() => {
              const q = attSearch.trim().toLowerCase();
              const shown = attendance
                .filter((m) => attFilter === "todos" || m.estamento === attFilter)
                .filter((m) => !q || m.name.toLowerCase().includes(q) || (m.group ?? "").toLowerCase().includes(q));

              if (attendance.length === 0)
                return <div className="border border-gray-300 bg-white p-8 text-center text-muted-foreground">
                  Aún no hay sesiones cerradas para calcular asistencias.
                </div>;

              return (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input value={attSearch} onChange={(e) => setAttSearch(e.target.value)}
                      placeholder="Buscar por nombre o estamento…"
                      className="rounded-none border-gray-300 pl-9" />
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(["todos", ...ESTAMENTOS_VISIBLES] as (EstamentoKey | "todos")[]).map((k) => {
                      const n = k === "todos" ? attendance.length : attendance.filter((m) => m.estamento === k).length;
                      if (n === 0 && k !== "todos") return null;
                      const on = attFilter === k;
                      return (
                        <button key={k} onClick={() => setAttFilter(k)}
                          className={`flex items-center gap-1.5 border px-3 py-1.5 text-xs font-semibold ${
                            on ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-white text-gray-700 hover:border-gray-500"}`}>
                          {k !== "todos" && <ShapeMark estamento={k} size={10} />}
                          {k === "todos" ? "Todos" : ESTAMENTO[k].short}
                          <span className="tabular-nums opacity-70">{n}</span>
                        </button>
                      );
                    })}
                  </div>

                  {shown.length === 0 ? (
                    <div className="border border-gray-300 bg-white p-8 text-center text-sm text-muted-foreground">
                      Ningún integrante coincide con «{attSearch}».
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {shown.map((m) => {
                        const pct = m.total > 0 ? Math.round((m.attended / m.total) * 100) : 0;
                        const cfg = ESTAMENTO[m.estamento];
                        return (
                          <div key={m.name} className="border border-gray-300 border-l-[3px] bg-white p-3"
                            style={{ borderLeftColor: cfg.hex }}>
                            <div className="mb-2 flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                                  <ShapeMark estamento={m.estamento} size={9} />{m.name}
                                </p>
                                {m.group && <p className={`truncate text-xs ${cfg.text}`}>{m.group}</p>}
                              </div>
                              <span className="shrink-0 px-1.5 py-0.5 text-xs font-bold tabular-nums text-white"
                                style={{ backgroundColor: cfg.hex }}>{pct}%</span>
                            </div>
                            <div className="h-2 w-full border border-gray-300 bg-gray-100">
                              <div className="h-full" style={{ width: `${pct}%`, backgroundColor: cfg.hex }} />
                            </div>
                            <p className="mt-1.5 text-xs text-muted-foreground">
                              {m.attended} de {m.total} sesiones
                            </p>
                            <div className="mt-2 flex flex-wrap gap-0.5">
                              {m.sessions.map((s, i) => (
                                <span key={i} title={`${s.title} — ${s.date}`}
                                  className={`flex h-4 w-4 items-center justify-center text-[9px] font-bold text-white ${
                                    s.present ? "bg-emerald-700" : "bg-red-700"}`}>
                                  {s.present ? "✓" : "✗"}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </section>
        )}

        {/* ── Uso de la palabra ── */}
        {tab === "palabra" && (
          <section>
            <SectionHeading icon={<Mic className="h-5 w-5" />} title="Uso de la Palabra"
              subtitle="Quiénes intervinieron en los plenos y cuánto tiempo usaron." color="#EA580C" />

            {speakers.length === 0 ? (
              <div className="border border-gray-300 bg-white p-8 text-center text-muted-foreground">
                Aún no hay intervenciones registradas en sesiones cerradas.
              </div>
            ) : (() => {
              const q = speakSearch.trim().toLowerCase();
              const ranked = [...speakers]
                .filter((s) => !q || s.name.toLowerCase().includes(q) || (s.group ?? "").toLowerCase().includes(q))
                .sort((a, b) => speakSort === "total"
                  ? b.seconds - a.seconds
                  : (b.seconds / Math.max(b.attended, 1)) - (a.seconds / Math.max(a.attended, 1)));
              const max = Math.max(...ranked.map((s) =>
                speakSort === "total" ? s.seconds : s.seconds / Math.max(s.attended, 1)), 1);

              return (
                <div className="space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <Input value={speakSearch} onChange={(e) => setSpeakSearch(e.target.value)}
                        placeholder="Buscar interviniente…" className="rounded-none border-gray-300 pl-9" />
                    </div>
                    <div className="flex">
                      {([["promedio", "Por sesión asistida"], ["total", "Tiempo total"]] as const).map(([k, l]) => (
                        <button key={k} onClick={() => setSpeakSort(k)}
                          className={`border px-3 py-2 text-xs font-semibold ${
                            speakSort === k ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-white text-gray-700 hover:border-gray-500"}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="border-l-[3px] border-orange-600 bg-orange-50 px-3 py-2 text-xs leading-relaxed text-gray-700">
                    El orden por <b>sesión asistida</b> divide el tiempo hablado entre los plenos a los que
                    cada quien asistió. Así, quien vino a dos sesiones y habló diez minutos no queda por
                    debajo de quien vino a ocho y habló quince.
                  </p>

                  <div className="overflow-x-auto border border-gray-300 bg-white">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead>
                        <tr className="border-b-2 border-gray-300 bg-gray-50 text-[10px] uppercase tracking-wider text-muted-foreground">
                          <th className="w-10 px-2 py-2 text-center font-bold">#</th>
                          <th className="px-3 py-2 text-left font-bold">Interviniente</th>
                          <th className="w-24 px-3 py-2 text-right font-bold">Total</th>
                          <th className="w-28 px-3 py-2 text-right font-bold">Por sesión</th>
                          <th className="w-20 px-3 py-2 text-right font-bold">Turnos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ranked.map((s, i) => {
                          const avg = s.seconds / Math.max(s.attended, 1);
                          const val = speakSort === "total" ? s.seconds : avg;
                          const cfg = ESTAMENTO[s.estamento];
                          return (
                            <tr key={s.name} className="border-b border-gray-200 last:border-b-0">
                              <td className="px-2 py-2 text-center text-xs font-bold tabular-nums text-muted-foreground">
                                {i + 1}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <ShapeMark estamento={s.estamento} size={10} />
                                  <span className="font-medium">{s.name}</span>
                                  {s.collective && (
                                    <span className="border border-teal-300 bg-teal-50 px-1.5 text-[10px] font-bold text-teal-700">
                                      COLECTIVA
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 h-1.5 w-full max-w-[220px] bg-gray-100">
                                  <div className="h-full" style={{ width: `${(val / max) * 100}%`, backgroundColor: cfg.hex }} />
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">{mmss(s.seconds)}</td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {s.attended > 0 ? mmss(avg) : "—"}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{s.turns}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {ranked.length === 0 && (
                    <div className="border border-gray-300 bg-white p-6 text-center text-sm text-muted-foreground">
                      Nadie coincide con «{speakSearch}».
                    </div>
                  )}
                </div>
              );
            })()}
          </section>
        )}

        {/* ── Sesiones ── */}
        {tab === "sesiones" && (
          <section>
            <SectionHeading icon={<Archive className="h-5 w-5" />} title="Actas y Resultados"
              subtitle="Tabla, asistencia, uso de la palabra y resultados de cada pleno cerrado." color="#6D28D9" />
            {historyLoading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : past.length === 0 ? (
              <div className="border border-gray-300 bg-white p-12 text-center text-muted-foreground">
                <Info className="mx-auto mb-3 h-8 w-8 opacity-40" />
                <p className="font-semibold text-foreground">Aún no hay sesiones cerradas.</p>
              </div>
            ) : (
              <Accordion type="multiple" className="space-y-2">
                {past.map((s) => <PastSession key={s.sessionId} s={s} />)}
              </Accordion>
            )}
          </section>
        )}
      </main>

      <footer className="mt-16 border-t-2 border-gray-800 bg-white py-6">
        <div className="mx-auto max-w-5xl px-4 text-center">
          <p className="text-[13px] font-bold uppercase tracking-wide text-gray-700">
            Federación de Estudiantes de la Universidad de Chile
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Portal de Transparencia Plenaria · Sistema de Votación Ponderada
          </p>
        </div>
      </footer>
    </div>
  );
}
