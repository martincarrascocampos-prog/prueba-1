import { useState, useRef } from "react";
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
} from "@workspace/api-client-react";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ResultsBar, CandidateResultsBar } from "@/components/results-bar";
import {
  ExternalLink, FileDown, LogIn, MapPin, Clock, Radio, CalendarDays, Archive,
  Video, Users, UserX, ShieldCheck, BarChart2, Info, Home, ListOrdered, Scale,
} from "lucide-react";

// ─── Estamentos ──────────────────────────────────────────────────────────────
// El color es identidad, no decoración: cada estamento mantiene el suyo en el
// hemiciclo, en la nómina, en las asistencias y en los votos.

type EstamentoKey = "cosefech" | "consejero" | "cee" | "otro";

const ESTAMENTO: Record<
  EstamentoKey,
  { label: string; hex: string; chip: string; dot: string; text: string }
> = {
  cosefech: {
    label: "COSEFECH", hex: "#FF7A00",
    chip: "bg-orange-50 text-orange-700 border-orange-200",
    dot: "bg-orange-500", text: "text-orange-600",
  },
  consejero: {
    label: "Consejerías FECh", hex: "#0B5FFF",
    chip: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-600", text: "text-blue-600",
  },
  cee: {
    label: "CEE — Delegades", hex: "#00B368",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500", text: "text-emerald-600",
  },
  otro: {
    label: "Otros", hex: "#7C3AFF",
    chip: "bg-violet-50 text-violet-700 border-violet-200",
    dot: "bg-violet-500", text: "text-violet-600",
  },
};

function estamentoOf(group: string | null | undefined): EstamentoKey {
  if (!group) return "otro";
  if (group === "Consejeros FECh") return "consejero";
  if (group === "COSEFECH") return "cosefech";
  if (group === "CEE" || group.startsWith("CE") || group.startsWith("Delegade")) return "cee";
  return "otro";
}

const ORDEN: Record<EstamentoKey, number> = { cosefech: 0, consejero: 1, cee: 2, otro: 3 };

// ─── Pestañas ────────────────────────────────────────────────────────────────

type TabId = "inicio" | "composicion" | "asistencias" | "sesiones";

const TABS: { id: TabId; label: string; icon: typeof Home; on: string; hover: string }[] = [
  { id: "inicio", label: "Inicio", icon: Home,
    on: "bg-rose-50 border-rose-500 text-rose-600", hover: "hover:bg-rose-50 hover:text-rose-600" },
  { id: "composicion", label: "Composición del Pleno", icon: Users,
    on: "bg-emerald-50 border-emerald-500 text-emerald-600", hover: "hover:bg-emerald-50 hover:text-emerald-600" },
  { id: "asistencias", label: "Asistencias", icon: BarChart2,
    on: "bg-cyan-50 border-cyan-500 text-cyan-600", hover: "hover:bg-cyan-50 hover:text-cyan-600" },
  { id: "sesiones", label: "Sesiones y Votaciones", icon: Archive,
    on: "bg-violet-50 border-violet-500 text-violet-600", hover: "hover:bg-violet-50 hover:text-violet-600" },
];

// ─── Utilidades ──────────────────────────────────────────────────────────────

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString("es-CL", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Tabla de la sesión ──────────────────────────────────────────────────────

function AgendaList({ points }: { points: PublicAgendaPoint[] }) {
  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">Esta sesión no tiene tabla publicada.</p>;
  }
  const ordered = [...points].sort((a, b) => a.position - b.position);
  const total = ordered.reduce((s, p) => s + (p.estimatedMinutes ?? 0), 0);
  const h = Math.floor(total / 60);
  const m = total % 60;

  return (
    <div>
      <ol className="space-y-1.5">
        {ordered.map((p, i) => (
          <li key={`${p.position}-${i}`}
            className="flex items-center gap-3 rounded-lg border bg-white px-3 py-2">
            <span className="w-5 shrink-0 text-xs font-bold tabular-nums text-blue-600">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0 flex-1 text-sm leading-snug">{p.title}</span>
            {p.estimatedMinutes != null && (
              <span className="flex shrink-0 items-center gap-1 text-xs tabular-nums text-muted-foreground">
                <Clock className="h-3 w-3" />{p.estimatedMinutes} min
              </span>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-2 flex flex-wrap justify-between gap-2 px-1 text-xs text-muted-foreground">
        <span>{ordered.length} punto{ordered.length !== 1 ? "s" : ""} de tabla</span>
        {total > 0 && (
          <span>Duración estimada <b className="tabular-nums text-foreground">
            {h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`}</b></span>
        )}
      </div>
    </div>
  );
}

// ─── Hemiciclo ───────────────────────────────────────────────────────────────

function Hemicycle({ members }: { members: PublicMember[] }) {
  const [hovered, setHovered] = useState<PublicMember | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const sorted = [...members].sort((a, b) => {
    const d = ORDEN[estamentoOf(a.group)] - ORDEN[estamentoOf(b.group)];
    return d || a.name.localeCompare(b.name, "es");
  });

  const cosefech = sorted.filter((m) => estamentoOf(m.group) === "cosefech");
  const consejeros = sorted.filter((m) => estamentoOf(m.group) === "consejero");
  const cee = sorted.filter((m) => estamentoOf(m.group) === "cee");
  const otros = sorted.filter((m) => estamentoOf(m.group) === "otro");

  // Las consejerías son el estamento más numeroso: se reparten en tres anillos
  // para que ninguno quede sobrepoblado.
  const k = Math.ceil(consejeros.length / 3) || 1;
  const rings: [PublicMember[], number][] = [
    [[...otros, ...cosefech], 95],
    [consejeros.slice(0, k), 167],
    [consejeros.slice(k, 2 * k), 239],
    [consejeros.slice(2 * k), 311],
    [cee, 383],
  ];

  const cx = 410, cy = 430, R = 9.5;
  const seats: { x: number; y: number; m: PublicMember; e: EstamentoKey }[] = [];
  for (const [group, r] of rings) {
    if (group.length === 0) continue;
    group.forEach((m, i) => {
      const t = group.length === 1 ? 0.5 : i / (group.length - 1);
      const rad = ((178 - 176 * t) * Math.PI) / 180;
      seats.push({
        x: cx + r * Math.cos(rad),
        y: cy - r * Math.sin(rad),
        m, e: estamentoOf(m.group),
      });
    });
  }

  return (
    <div className="relative w-full">
      <svg ref={svgRef} viewBox="0 0 820 445" className="mx-auto block w-full max-w-3xl">
        <path d="M 24 430 A 386 386 0 0 1 796 430" fill="none" stroke="#E6ECF5" strokeWidth="1.5" />
        <ellipse cx={cx} cy={cy + 4} rx={25} ry={7} fill="#E6ECF5" />
        <rect x={cx - 5} y={cy - 15} width={10} height={17} rx={3} fill="#8494AC" />
        {seats.map((s, i) => (
          <circle
            key={i} cx={s.x} cy={s.y} r={hovered === s.m ? R + 3.5 : R}
            fill={ESTAMENTO[s.e].hex} stroke="white" strokeWidth={2}
            className="cursor-pointer transition-all duration-100"
            onMouseEnter={(e) => { setHovered(s.m); setPos({ x: e.clientX, y: e.clientY }); }}
            onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none fixed z-50 max-w-[210px] rounded-lg border bg-white px-3 py-2 shadow-lg"
          style={{ left: pos.x + 15, top: pos.y - 8 }}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: ESTAMENTO[estamentoOf(hovered.group)].hex }}>
            {ESTAMENTO[estamentoOf(hovered.group)].label}
          </div>
          <div className="text-sm font-semibold leading-tight">{hovered.name}</div>
          {hovered.faculty && <div className="text-xs text-muted-foreground">{hovered.faculty}</div>}
        </div>
      )}

      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {(["cosefech", "consejero", "cee"] as EstamentoKey[]).map((k) => {
          const cfg = ESTAMENTO[k];
          const n = members.filter((m) => estamentoOf(m.group) === k).length;
          if (n === 0) return null;
          return (
            <span key={k} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${cfg.chip}`}>
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cfg.dot}`} />
              {cfg.label}<span className="font-normal opacity-70">{n}</span>
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

// ─── Histórico de asistencias ────────────────────────────────────────────────

type MemberAttendance = {
  name: string; group: string | null; estamento: EstamentoKey;
  attended: number; total: number;
  sessions: { title: string; date: string; present: boolean }[];
};

function buildAttendanceData(sessions: AdminHistorySession[]): MemberAttendance[] {
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

const ATT_TABS: { key: EstamentoKey | "todos"; label: string; on: string }[] = [
  { key: "todos", label: "Todos", on: "bg-cyan-500 border-cyan-500 text-white" },
  { key: "consejero", label: "Consejerías FECh", on: "bg-blue-600 border-blue-600 text-white" },
  { key: "cee", label: "CEE", on: "bg-emerald-500 border-emerald-500 text-white" },
  { key: "cosefech", label: "COSEFECH", on: "bg-orange-500 border-orange-500 text-white" },
];

function AttendanceHistory({ sessions }: { sessions: AdminHistorySession[] }) {
  const [tab, setTab] = useState<EstamentoKey | "todos">("todos");
  const data = buildAttendanceData(sessions);

  if (data.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center text-muted-foreground">
        Aún no hay sesiones cerradas para calcular asistencias.
      </div>
    );
  }

  const shown = tab === "todos" ? data : data.filter((m) => m.estamento === tab);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {ATT_TABS.map((t) => {
          const n = t.key === "todos" ? data.length : data.filter((m) => m.estamento === t.key).length;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`rounded-full border-[1.5px] px-4 py-1.5 text-sm font-semibold transition-colors ${
                tab === t.key ? t.on : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"}`}>
              {t.label} ({n})
            </button>
          );
        })}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((m) => {
          const pct = m.total > 0 ? Math.round((m.attended / m.total) * 100) : 0;
          const cfg = ESTAMENTO[m.estamento];
          return (
            <div key={m.name} className="rounded-xl border border-l-[3px] bg-white p-3.5"
              style={{ borderLeftColor: cfg.hex }}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{m.name}</p>
                  {m.group && <p className={`truncate text-xs ${cfg.text}`}>{m.group}</p>}
                </div>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums text-white"
                  style={{ backgroundColor: cfg.hex }}>{pct}%</span>
              </div>
              <Progress value={pct} className="h-1.5" />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {m.attended} de {m.total} sesion{m.total !== 1 ? "es" : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {m.sessions.map((s, i) => (
                  <span key={i} title={`${s.title} — ${s.date}`}
                    className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white ${
                      s.present ? "bg-lime-600" : "bg-rose-500"}`}>
                    {s.present ? "✓" : "✗"}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Nómina de una sesión ────────────────────────────────────────────────────

function AttendanceRoster({ attendees, absentees }: { attendees: PublicAttendee[]; absentees: PublicMemberRef[] }) {
  const presencial = attendees.filter((a) => a.modality === "presencial");
  const online = attendees.filter((a) => a.modality === "online");

  if (attendees.length === 0 && absentees.length === 0)
    return <p className="text-sm text-muted-foreground">Sin registro de asistencia.</p>;

  const Section = ({ icon, label, color, items }: {
    icon: React.ReactNode; label: string; color: string; items: { name: string; justified?: boolean }[];
  }) => items.length === 0 ? null : (
    <div>
      <div className={`mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide ${color}`}>
        {icon} {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((a, i) => (
          <span key={i} className="rounded-full border px-2.5 py-0.5 text-xs">
            {a.justified ? `${a.name} · Justificada` : a.name}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs font-semibold text-white">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1">
          <MapPin className="h-3.5 w-3.5" /> Presencial: {presencial.length}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500 px-3 py-1">
          <Video className="h-3.5 w-3.5" /> Online: {online.length}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-400 px-3 py-1">
          <UserX className="h-3.5 w-3.5" /> Ausentes: {absentees.length}
        </span>
      </div>
      <Section icon={<MapPin className="h-3.5 w-3.5" />} label="Asistentes presenciales"
        color="text-emerald-600" items={presencial} />
      <Section icon={<Video className="h-3.5 w-3.5" />} label="Asistentes online"
        color="text-cyan-600" items={online} />
      <Section icon={<UserX className="h-3.5 w-3.5" />} label="Ausentes"
        color="text-gray-500" items={absentees} />
    </div>
  );
}

// ─── Votación ────────────────────────────────────────────────────────────────

function PublicTopicCard({ topic: t }: { topic: AdminHistoryTopic }) {
  return (
    <Card className="p-4">
      <div className="mb-1 flex items-start justify-between gap-3">
        <div className="font-semibold">{t.title}</div>
        {t.approved !== null && (
          <Badge className={`shrink-0 text-[10px] text-white hover:opacity-100 ${
            t.approved ? "bg-lime-600 hover:bg-lime-600" : "bg-rose-500 hover:bg-rose-500"}`}>
            {t.approved ? "APROBADO" : "RECHAZADO"}
          </Badge>
        )}
      </div>
      {/* El detalle es el contenido de la moción: sin él sólo queda el título. */}
      {t.detail && (
        <div className="my-3 rounded-r-lg border-l-[3px] border-blue-500 bg-blue-50/60 px-3 py-2">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-blue-600">
            Detalle de la moción
          </div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600">{t.detail}</p>
        </div>
      )}
      {t.type === "candidato"
        ? <CandidateResultsBar candidates={t.candidates ?? []} />
        : <ResultsBar percentages={t.percentages} weights={t.weights} />}
      {(t.ballots?.length ?? 0) > 0 && (
        <details className="group mt-3">
          <summary className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100">
            <Users className="h-3.5 w-3.5" /> Detalle de votos por integrante ({t.ballots!.length})
          </summary>
          <div className="mt-2 max-h-72 divide-y overflow-y-auto rounded-lg border">
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
    </Card>
  );
}

// ─── Botones de sesión ───────────────────────────────────────────────────────

function MeetingLinkButton({ href, live }: { href: string; live?: boolean }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className={`group inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] focus:outline-none focus-visible:ring-4 ${
        live
          ? "bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-600 focus-visible:ring-fuchsia-300"
          : "bg-gradient-to-r from-cyan-500 to-blue-600 focus-visible:ring-cyan-300"}`}>
      <Video className="h-5 w-5" />
      {live ? "Unirse al pleno en vivo" : "Enlace del pleno"}
      <ExternalLink className="h-4 w-4 opacity-80 transition-transform group-hover:translate-x-0.5" />
    </a>
  );
}

function ActaButton({ sessionId, fileName }: { sessionId: number; fileName: string | null | undefined }) {
  return (
    <a href={`/api/public/sessions/${sessionId}/acta`} download={fileName ?? undefined}
      className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-300">
      <FileDown className="h-5 w-5" />
      Descargar acta
      {fileName ? <span className="font-normal opacity-90">({fileName})</span> : null}
    </a>
  );
}

// ─── Encabezado de sección ───────────────────────────────────────────────────

function SectionHeading({ icon, title, subtitle, color, bg }: {
  icon: React.ReactNode; title: string; subtitle?: string; color: string; bg: string;
}) {
  return (
    <div className="mb-5 flex items-start gap-3.5">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${bg} ${color}`}>{icon}</div>
      <div>
        <h3 className="text-lg font-bold leading-tight">{title}</h3>
        {subtitle && <p className="text-[13px] text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Sesiones ────────────────────────────────────────────────────────────────

function LiveSessionHero({ s }: { s: AdminHistorySession }) {
  const when = formatDate(s.scheduledAt);
  const pct = s.totalWeight > 0 ? (s.presentWeight / s.totalWeight) * 100 : 0;
  return (
    <Card className="mb-8 overflow-hidden border-[1.5px] border-rose-500 shadow-xl">
      <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-600" />
      <div className="space-y-5 p-6">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-3 py-1 text-[11px] font-bold tracking-wider text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> PLENO EN CURSO
          </span>
          <h2 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">{s.title}</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-[13px] font-medium">
          {when && <span className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 text-violet-600">
            <CalendarDays className="h-3.5 w-3.5" />{when}</span>}
          {s.location && <span className="inline-flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-1.5 text-orange-600">
            <MapPin className="h-3.5 w-3.5" />{s.location}</span>}
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-emerald-600">
            <Users className="h-3.5 w-3.5" />{s.presentCount} de {s.totalMembers} presentes</span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {s.meetingLink && <MeetingLinkButton href={s.meetingLink} live />}
          {s.hasActa && <ActaButton sessionId={s.sessionId} fileName={s.actaFileName} />}
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-600">
            <Scale className="h-3.5 w-3.5" /> Quórum en tiempo real
          </div>
          <div className="mb-2 flex justify-between text-[13px]">
            <span className="text-muted-foreground">Ponderación presente</span>
            <span className="font-semibold tabular-nums">{s.presentWeight.toFixed(2)} / {s.totalWeight.toFixed(2)}</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>
        {(s.agenda?.length ?? 0) > 0 && (
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-blue-600">
              <ListOrdered className="h-3.5 w-3.5" /> Tabla de la sesión
            </div>
            <AgendaList points={s.agenda!} />
          </div>
        )}
        <div className="rounded-xl border bg-slate-50 p-4">
          <AttendanceRoster attendees={s.attendees ?? []} absentees={s.absentees ?? []} />
        </div>
      </div>
    </Card>
  );
}

function UpcomingCard({ s }: { s: AdminHistorySession }) {
  const when = formatDate(s.scheduledAt);
  return (
    <Card className="overflow-hidden border-t-[3px] border-t-violet-500">
      <div className="space-y-3 p-5">
        <span className="inline-block rounded-full bg-violet-500 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-white">
          PRÓXIMO
        </span>
        <h4 className="text-lg font-bold leading-tight">{s.title}</h4>
        <div className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
          {when && <span className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-violet-500" />{when}</span>}
          {s.location && <span className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-violet-500" />{s.location}</span>}
        </div>
        {(s.agenda?.length ?? 0) > 0 && (
          <details className="pt-1">
            <summary className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-600 hover:bg-violet-100">
              <ListOrdered className="h-3.5 w-3.5" /> Ver tabla ({s.agenda!.length} puntos)
            </summary>
            <div className="mt-3"><AgendaList points={s.agenda!} /></div>
          </details>
        )}
        {s.meetingLink && <div className="pt-1"><MeetingLinkButton href={s.meetingLink} /></div>}
      </div>
    </Card>
  );
}

function PastSession({ s }: { s: AdminHistorySession }) {
  const when = formatDate(s.scheduledAt);
  const pct = s.totalWeight > 0 ? (s.presentWeight / s.totalWeight) * 100 : 0;
  return (
    <AccordionItem value={String(s.sessionId)} className="rounded-xl border bg-white px-4">
      <AccordionTrigger className="hover:no-underline">
        <div className="flex flex-1 items-center justify-between gap-3 pr-3 text-left">
          <div>
            <div className="font-semibold">{s.title}</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {s.location && <span className="inline-flex items-center gap-1 rounded bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-600">
                <MapPin className="h-3 w-3" />{s.location}</span>}
              {when && <span className="inline-flex items-center gap-1 rounded bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-600">
                <Clock className="h-3 w-3" />{when}</span>}
              {(s.agenda?.length ?? 0) > 0 && (
                <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-600">
                  {s.agenda!.length} puntos de tabla</span>
              )}
              <span className="rounded bg-pink-50 px-2 py-0.5 text-[11px] font-semibold text-pink-600">
                {s.topics.length} votación{s.topics.length !== 1 ? "es" : ""}</span>
              <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                {s.presentCount}/{s.totalMembers} presentes</span>
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0">CERRADA</Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4 pb-2">
          {(s.meetingLink || s.hasActa) && (
            <div className="flex flex-wrap gap-2">
              {s.meetingLink && <MeetingLinkButton href={s.meetingLink} />}
              {s.hasActa && <ActaButton sessionId={s.sessionId} fileName={s.actaFileName} />}
            </div>
          )}
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-600">
              <Scale className="h-3.5 w-3.5" /> Quórum de la sesión
            </div>
            <div className="mb-2 flex justify-between text-[13px]">
              <span className="text-muted-foreground">Ponderación presente</span>
              <span className="font-semibold tabular-nums">
                {s.presentWeight.toFixed(2)} / {s.totalWeight.toFixed(2)} · {pct.toFixed(1)}%
              </span>
            </div>
            <Progress value={pct} className="h-2" />
          </div>
          {(s.agenda?.length ?? 0) > 0 && (
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-blue-600">
                <ListOrdered className="h-3.5 w-3.5" /> Tabla tratada
              </div>
              <AgendaList points={s.agenda!} />
            </div>
          )}
          <div className="rounded-xl border bg-slate-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4" /> Asistencia
            </div>
            <AttendanceRoster attendees={s.attendees ?? []} absentees={s.absentees ?? []} />
          </div>
          {s.topics.length === 0
            ? <div className="py-2 text-sm text-muted-foreground">Esta sesión no tuvo votaciones.</div>
            : s.topics.map((t) => <PublicTopicCard key={t.topicId} topic={t} />)}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function PublicHome() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<TabId>("inicio");

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

  const totalVotes = past.reduce((sum, s) => sum + s.topics.length, 0);
  const totalPoints = past.reduce((sum, s) => sum + (s.agenda?.length ?? 0), 0);

  const go = (id: TabId) => { setTab(id); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 via-violet-600 to-pink-600">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold leading-tight">Pleno FECh</div>
              <div className="text-[11px] leading-tight text-muted-foreground">Portal de Transparencia</div>
            </div>
          </div>
          <Button size="sm" onClick={() => setLocation("/login")}>
            <LogIn className="mr-2 h-4 w-4" /> Ingresar
          </Button>
        </div>

        <nav className="overflow-x-auto border-t">
          <div className="mx-auto flex max-w-5xl gap-1 px-3 py-2">
            {TABS.map((t) => {
              const Icon = t.icon;
              const on = tab === t.id;
              return (
                <button key={t.id} onClick={() => go(t.id)}
                  className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-3.5 py-2 text-[13px] font-medium transition-colors ${
                    on ? `${t.on} font-semibold` : `border-transparent text-gray-600 ${t.hover}`}`}>
                  <Icon className="h-4 w-4" />
                  {t.label}
                  {t.id === "inicio" && active.length > 0 && (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
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

            <div className="mb-6">
              <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                <ShieldCheck className="h-3.5 w-3.5" /> Transparencia institucional
              </span>
              <h1 className="text-4xl font-black leading-[1.13] tracking-tight sm:text-5xl">
                <span className="bg-gradient-to-r from-blue-600 via-violet-600 to-pink-600 bg-clip-text text-transparent">
                  Sistema Plenario
                </span>
                <br />Federación de Estudiantes
              </h1>
              <p className="mt-2 text-lg font-light text-muted-foreground">Universidad de Chile</p>
            </div>

            <div className="mb-6 rounded-xl border border-l-4 border-l-blue-600 bg-white p-5 text-[15px] leading-relaxed text-gray-600">
              <p>
                El <b className="text-foreground">Pleno FECh</b> es la instancia máxima de deliberación y decisión
                de la Federación de Estudiantes de la Universidad de Chile. Reúne a las Consejerías FECh, a las
                delegaciones de los Centros de Estudiantes y al Consejo Superior bajo un sistema de votación ponderada.
              </p>
              <p className="mt-3">
                Este portal publica la tabla de cada sesión, la composición del pleno, el registro de asistencias
                y los resultados completos de cada votación.
              </p>
            </div>

            {!historyLoading && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { v: members?.length ?? "—", l: "Integrantes", icon: Users, c: "text-blue-600", b: "bg-blue-50", t: "border-t-blue-600" },
                  { v: past.length, l: "Sesiones realizadas", icon: CalendarDays, c: "text-emerald-600", b: "bg-emerald-50", t: "border-t-emerald-500" },
                  { v: totalPoints, l: "Puntos de tabla", icon: ListOrdered, c: "text-orange-600", b: "bg-orange-50", t: "border-t-orange-500" },
                  { v: totalVotes, l: "Votaciones", icon: BarChart2, c: "text-violet-600", b: "bg-violet-50", t: "border-t-violet-500" },
                ].map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.l} className={`rounded-xl border border-t-[3px] bg-white p-4 ${s.t}`}>
                      <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${s.b} ${s.c}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className={`text-2xl font-black tabular-nums ${s.c}`}>{s.v}</div>
                      <div className="mt-1 text-[10.5px] uppercase tracking-wider text-muted-foreground">{s.l}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {upcoming.length > 0 && (
              <section className="mt-10">
                <SectionHeading icon={<CalendarDays className="h-[17px] w-[17px]" />}
                  title="Próximos plenos" subtitle="Sesiones agendadas, con su tabla."
                  color="text-violet-600" bg="bg-violet-50" />
                <div className="grid gap-3 sm:grid-cols-2">
                  {upcoming.map((s) => <UpcomingCard key={s.sessionId} s={s} />)}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ── Composición ── */}
        {tab === "composicion" && (
          <section>
            <SectionHeading icon={<Users className="h-[17px] w-[17px]" />}
              title="Composición del Pleno FECh"
              subtitle="Estructura actual del órgano máximo de la Federación, organizada por estamento."
              color="text-emerald-600" bg="bg-emerald-50" />
            {membersLoading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : members && members.length > 0 ? (
              <div className="space-y-6 rounded-2xl border bg-white p-6">
                <Hemicycle members={members} />
                <div className="space-y-5 border-t pt-5">
                  {(["cosefech", "consejero", "cee"] as EstamentoKey[]).map((k) => {
                    const cfg = ESTAMENTO[k];
                    const group = members
                      .filter((m) => estamentoOf(m.group) === k)
                      .sort((a, b) => a.name.localeCompare(b.name, "es"));
                    if (group.length === 0) return null;
                    return (
                      <div key={k}>
                        <div className="mb-2.5 flex flex-wrap items-center gap-2">
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cfg.dot}`} />
                          <h4 className={`text-xs font-bold uppercase tracking-wider ${cfg.text}`}>{cfg.label}</h4>
                          <span className="text-xs text-muted-foreground">{group.length} integrantes</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {group.map((m) => (
                            <span key={m.name} title={m.faculty ?? undefined}
                              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.chip}`}>
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
              <div className="rounded-xl border bg-white p-8 text-center text-muted-foreground">
                No hay datos de composición disponibles.
              </div>
            )}
          </section>
        )}

        {/* ── Asistencias ── */}
        {tab === "asistencias" && (
          <section>
            <SectionHeading icon={<BarChart2 className="h-[17px] w-[17px]" />}
              title="Histórico de Asistencias"
              subtitle="Registro de presencia de cada integrante a través de las sesiones realizadas."
              color="text-cyan-600" bg="bg-cyan-50" />
            {historyLoading
              ? <div className="flex justify-center py-12"><Spinner /></div>
              : <AttendanceHistory sessions={sessions} />}
          </section>
        )}

        {/* ── Sesiones ── */}
        {tab === "sesiones" && (
          <section>
            <SectionHeading icon={<Archive className="h-[17px] w-[17px]" />}
              title="Actas y Resultados de Sesiones"
              subtitle="Tabla, asistencia y resultados completos de cada pleno cerrado."
              color="text-violet-600" bg="bg-violet-50" />
            {historyLoading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : past.length === 0 ? (
              <div className="rounded-xl border bg-white p-12 text-center text-muted-foreground">
                <Info className="mx-auto mb-3 h-8 w-8 opacity-40" />
                <p className="font-semibold text-foreground">Aún no hay sesiones cerradas.</p>
                <p className="mt-1 text-sm">El historial aparecerá aquí una vez que se realicen plenos.</p>
              </div>
            ) : (
              <Accordion type="multiple" className="space-y-3">
                {past.map((s) => <PastSession key={s.sessionId} s={s} />)}
              </Accordion>
            )}
          </section>
        )}
      </main>

      <footer className="mt-16 border-t bg-white py-8">
        <div className="mx-auto max-w-5xl space-y-1 px-4 text-center">
          <div className="mx-auto mb-4 h-[3px] w-28 rounded bg-gradient-to-r from-blue-600 via-violet-600 via-pink-600 to-orange-500" />
          <p className="text-[13px] font-semibold text-muted-foreground">
            Federación de Estudiantes de la Universidad de Chile
          </p>
          <p className="text-xs text-muted-foreground">
            Portal de Transparencia Plenaria · Sistema de Votación Ponderada
          </p>
        </div>
      </footer>
    </div>
  );
}
