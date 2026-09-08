import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useGetPublicHistory, getGetPublicHistoryQueryKey } from "@workspace/api-client-react";
import type {
  AdminHistorySession,
  AdminHistoryTopic,
  PublicAttendee,
  PublicMemberRef,
} from "@workspace/api-client-react";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ResultsBar, CandidateResultsBar } from "@/components/results-bar";
import {
  ExternalLink,
  FileDown,
  LogIn,
  MapPin,
  Clock,
  Radio,
  CalendarDays,
  Archive,
  Video,
  Users,
  UserX,
  ShieldCheck,
  BarChart2,
  Info,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type PublicMember = { name: string; group: string | null; faculty: string | null };

type EstamentoKey = "cosefech" | "consejero" | "cee" | "otro";

const ESTAMENTO: Record<EstamentoKey, { label: string; color: string; bg: string; text: string; border: string }> = {
  cosefech: { label: "COSEFECH", color: "#B45309", bg: "#FEF9EE", text: "text-amber-800", border: "border-amber-300" },
  consejero: { label: "Consejerías FECh", color: "#1D4ED8", bg: "#EFF6FF", text: "text-blue-800", border: "border-blue-300" },
  cee: { label: "CEE — Delegades", color: "#065F46", bg: "#F0FDF4", text: "text-emerald-800", border: "border-emerald-300" },
  otro: { label: "Otros", color: "#6B21A8", bg: "#FAF5FF", text: "text-purple-800", border: "border-purple-300" },
};

function estamentoOf(group: string | null): EstamentoKey {
  if (!group) return "otro";
  if (group === "Consejeros FECh") return "consejero";
  if (group === "COSEFECH") return "cosefech";
  if (group === "CEE" || group.startsWith("CE") || group.startsWith("Delegade")) return "cee";
  return "otro";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Hemicycle ────────────────────────────────────────────────────────────────

function Hemicycle({ members }: { members: PublicMember[] }) {
  const [hovered, setHovered] = useState<{ name: string; group: string | null; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Sort members: COSEFECH → Consejeros → CEE → otros, then alphabetically within each
  const ORDER: Record<EstamentoKey, number> = { cosefech: 0, consejero: 1, cee: 2, otro: 3 };
  const sorted = [...members].sort((a, b) => {
    const ea = ORDER[estamentoOf(a.group)];
    const eb = ORDER[estamentoOf(b.group)];
    if (ea !== eb) return ea - eb;
    return a.name.localeCompare(b.name, "es");
  });

  // Assign to rings
  const cosefech = sorted.filter((m) => estamentoOf(m.group) === "cosefech");
  const consejeros = sorted.filter((m) => estamentoOf(m.group) === "consejero");
  const cee = sorted.filter((m) => estamentoOf(m.group) === "cee");
  const otros = sorted.filter((m) => estamentoOf(m.group) === "otro");

  // Split consejeros across 3 rings
  const chunk = Math.ceil(consejeros.length / 3);
  const cons1 = consejeros.slice(0, chunk);
  const cons2 = consejeros.slice(chunk, chunk * 2);
  const cons3 = consejeros.slice(chunk * 2);

  const cx = 370;
  const cy = 395;
  const SEAT_R = 7;

  // Rings: [members, radius]
  const rings: [PublicMember[], number][] = [
    [[...otros, ...cosefech], 95],
    [cons1, 165],
    [cons2, 235],
    [cons3, 305],
    [cee, 375],
  ];

  type Seat = { x: number; y: number; member: PublicMember; estamento: EstamentoKey };
  const seats: Seat[] = [];

  for (const [ringMembers, r] of rings) {
    if (ringMembers.length === 0) continue;
    const n = ringMembers.length;
    const startDeg = 178;
    const endDeg = 2;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const deg = startDeg - (startDeg - endDeg) * t;
      const rad = (deg * Math.PI) / 180;
      const x = cx + r * Math.cos(rad);
      const y = cy - r * Math.sin(rad);
      seats.push({ x, y, member: ringMembers[i], estamento: estamentoOf(ringMembers[i].group) });
    }
  }

  return (
    <div className="relative w-full overflow-x-auto">
      <svg
        ref={svgRef}
        viewBox="0 0 740 410"
        className="w-full max-w-3xl mx-auto"
        style={{ height: "auto" }}
      >
        {/* Base arc line */}
        <path
          d="M 10 395 A 360 360 0 0 1 730 395"
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="1.5"
        />
        {/* Speaker podium */}
        <ellipse cx={cx} cy={398} rx={18} ry={6} fill="#D1D5DB" />
        <rect x={cx - 4} y={385} width={8} height={13} rx={2} fill="#9CA3AF" />

        {/* Seats */}
        {seats.map((seat, i) => {
          const cfg = ESTAMENTO[seat.estamento];
          return (
            <circle
              key={i}
              cx={seat.x}
              cy={seat.y}
              r={SEAT_R}
              fill={cfg.color}
              opacity={0.85}
              stroke="white"
              strokeWidth={1.2}
              className="cursor-pointer transition-all duration-150"
              style={{ filter: hovered?.name === seat.member.name ? "brightness(1.3) drop-shadow(0 0 4px rgba(0,0,0,0.4))" : undefined }}
              onMouseEnter={(e) => {
                const svg = svgRef.current;
                if (!svg) return;
                const rect = svg.getBoundingClientRect();
                const scale = rect.width / 740;
                setHovered({
                  name: seat.member.name,
                  group: seat.member.group,
                  x: seat.x * scale + rect.left - rect.left,
                  y: seat.y * scale,
                });
              }}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}

        {/* Tooltip */}
        {hovered && (() => {
          const seat = seats.find((s) => s.member.name === hovered.name);
          if (!seat) return null;
          const cfg = ESTAMENTO[seat.estamento];
          const w = 170;
          const h = 44;
          let tx = seat.x - w / 2;
          let ty = seat.y - h - 12;
          if (tx < 5) tx = 5;
          if (tx + w > 735) tx = 735 - w;
          if (ty < 5) ty = seat.y + 14;
          return (
            <g>
              <rect x={tx} y={ty} width={w} height={h} rx={6} fill="white" stroke="#E5E7EB" strokeWidth={1} style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.15))" }} />
              <text x={tx + 8} y={ty + 16} fontSize={9} fontWeight="600" fill={cfg.color}>{cfg.label}</text>
              <text x={tx + 8} y={ty + 30} fontSize={10} fontWeight="500" fill="#111827">
                {seat.member.name.length > 22 ? seat.member.name.slice(0, 21) + "…" : seat.member.name}
              </text>
              {seat.member.faculty && (
                <text x={tx + 8} y={ty + 41} fontSize={8.5} fill="#6B7280">{seat.member.faculty}</text>
              )}
            </g>
          );
        })()}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-3 mt-2">
        {(["cosefech", "consejero", "cee"] as EstamentoKey[]).map((key) => {
          const cfg = ESTAMENTO[key];
          const count = members.filter((m) => estamentoOf(m.group) === key).length;
          return (
            <div key={key} className="flex items-center gap-1.5 text-xs">
              <span className="h-3 w-3 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: cfg.color }} />
              <span className="font-medium text-gray-700">{cfg.label}</span>
              <span className="text-gray-400">({count})</span>
            </div>
          );
        })}
      </div>
      <p className="text-center text-xs text-muted-foreground mt-1">
        Pasa el cursor sobre un asiento para ver el nombre del integrante
      </p>
    </div>
  );
}

// ─── Attendance History ────────────────────────────────────────────────────────

type MemberAttendance = {
  name: string;
  group: string | null;
  faculty: string | null;
  estamento: EstamentoKey;
  attended: number;
  total: number;
  sessions: { title: string; date: string; present: boolean }[];
};

function buildAttendanceData(sessions: AdminHistorySession[]): MemberAttendance[] {
  const past = sessions.filter((s) => s.phase === "pasado");
  const memberMap = new Map<string, MemberAttendance>();

  for (const s of past) {
    const allInSession = [
      ...(s.attendees ?? []).map((a) => ({ name: a.name, group: a.group ?? null, faculty: null, present: true })),
      ...(s.absentees ?? []).map((a) => ({ name: a.name, group: a.group ?? null, faculty: null, present: false })),
    ];
    for (const m of allInSession) {
      if (!memberMap.has(m.name)) {
        memberMap.set(m.name, {
          name: m.name,
          group: m.group,
          faculty: null,
          estamento: estamentoOf(m.group),
          attended: 0,
          total: 0,
          sessions: [],
        });
      }
      const entry = memberMap.get(m.name)!;
      entry.total++;
      if (m.present) entry.attended++;
      entry.sessions.push({ title: s.title, date: formatShortDate(s.scheduledAt), present: m.present });
    }
  }

  return Array.from(memberMap.values()).sort((a, b) => {
    const ORDER: Record<EstamentoKey, number> = { cosefech: 0, consejero: 1, cee: 2, otro: 3 };
    if (ORDER[a.estamento] !== ORDER[b.estamento]) return ORDER[a.estamento] - ORDER[b.estamento];
    return a.name.localeCompare(b.name, "es");
  });
}

function AttendanceHistory({ sessions }: { sessions: AdminHistorySession[] }) {
  const [activeTab, setActiveTab] = useState<EstamentoKey | "todos">("todos");
  const data = buildAttendanceData(sessions);

  const tabs: { key: EstamentoKey | "todos"; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "consejero", label: "Consejerías FECh" },
    { key: "cee", label: "CEE" },
    { key: "cosefech", label: "COSEFECH" },
  ];

  const filtered = activeTab === "todos" ? data : data.filter((m) => m.estamento === activeTab);

  if (data.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground bg-white rounded-lg border">
        Aún no hay sesiones cerradas para calcular asistencias.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={
              "rounded-full px-4 py-1.5 text-sm font-medium transition-all border " +
              (activeTab === t.key
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-primary/50 hover:text-primary")
            }
          >
            {t.label}
            <span className="ml-1.5 text-xs opacity-70">
              ({activeTab === t.key || t.key === "todos"
                ? t.key === "todos" ? data.length : data.filter((m) => m.estamento === t.key).length
                : data.filter((m) => m.estamento === t.key).length})
            </span>
          </button>
        ))}
      </div>

      {/* Member cards */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((m) => {
          const pct = m.total > 0 ? Math.round((m.attended / m.total) * 100) : 0;
          const cfg = ESTAMENTO[m.estamento];
          return (
            <div
              key={m.name}
              className={"rounded-lg border bg-white p-3 space-y-2 " + cfg.border}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">{m.name}</p>
                  {m.group && (
                    <p className="text-xs truncate" style={{ color: cfg.color }}>{m.group}</p>
                  )}
                </div>
                <span
                  className={"shrink-0 rounded-full px-2 py-0.5 text-xs font-bold " + cfg.text}
                  style={{ backgroundColor: cfg.bg }}
                >
                  {pct}%
                </span>
              </div>
              <div className="space-y-1">
                <Progress value={pct} className="h-1.5" />
                <p className="text-xs text-muted-foreground">
                  {m.attended} de {m.total} sesion{m.total !== 1 ? "es" : ""}
                </p>
              </div>
              {m.sessions.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {m.sessions.map((s, i) => (
                    <span
                      key={i}
                      title={`${s.title} — ${s.date}`}
                      className={
                        "h-4 w-4 rounded-full text-[9px] font-bold flex items-center justify-center " +
                        (s.present ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600")
                      }
                    >
                      {s.present ? "✓" : "✗"}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Attendance Roster ─────────────────────────────────────────────────────────

function AttendeeChip({ label, tone }: { label: string; tone: "presencial" | "online" | "absent" }) {
  const cls =
    tone === "presencial" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : tone === "online" ? "bg-sky-50 text-sky-700 border-sky-200"
    : "bg-gray-50 text-gray-500 border-gray-200";
  return <span className={"rounded-full border px-2.5 py-0.5 text-xs " + cls}>{label}</span>;
}

function AttendanceRoster({ attendees, absentees }: { attendees: PublicAttendee[]; absentees: PublicMemberRef[] }) {
  const presencial = attendees.filter((a) => a.modality === "presencial");
  const online = attendees.filter((a) => a.modality === "online");

  if (attendees.length === 0 && absentees.length === 0)
    return <p className="text-sm text-muted-foreground">Sin registro de asistencia.</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs font-medium">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
          <MapPin className="h-3.5 w-3.5" /> Presencial: {presencial.length}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1 text-sky-800">
          <Video className="h-3.5 w-3.5" /> Online: {online.length}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-gray-600">
          <UserX className="h-3.5 w-3.5" /> Ausentes: {absentees.length}
        </span>
      </div>

      {presencial.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <MapPin className="h-3.5 w-3.5" /> Asistentes presenciales
          </div>
          <div className="flex flex-wrap gap-1.5">
            {presencial.map((a, i) => <AttendeeChip key={`p-${i}`} label={a.name} tone="presencial" />)}
          </div>
        </div>
      )}

      {online.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-sky-700">
            <Video className="h-3.5 w-3.5" /> Asistentes online
          </div>
          <div className="flex flex-wrap gap-1.5">
            {online.map((a, i) => <AttendeeChip key={`o-${i}`} label={a.name} tone="online" />)}
          </div>
        </div>
      )}

      {absentees.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-500">
            <UserX className="h-3.5 w-3.5" /> Ausentes
          </div>
          <div className="flex flex-wrap gap-1.5">
            {absentees.map((a, i) => (
              <AttendeeChip
                key={`a-${i}`}
                label={a.justified ? `${a.name} · Justificada` : a.name}
                tone="absent"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Topic Card ────────────────────────────────────────────────────────────────

function PublicTopicCard({ topic: t }: { topic: AdminHistoryTopic }) {
  return (
    <Card className="p-4 border-primary/10">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="font-medium">{t.title}</div>
        {t.approved !== null && (
          <Badge variant="outline" className={t.approved
            ? "bg-lime-50 text-lime-700 border-lime-200 text-[10px]"
            : "bg-red-50 text-red-700 border-red-200 text-[10px]"}>
            {t.approved ? "APROBADO" : "RECHAZADO"}
          </Badge>
        )}
      </div>
      {t.detail && <p className="text-xs text-muted-foreground mb-3">{t.detail}</p>}
      {t.type === "candidato"
        ? <CandidateResultsBar candidates={t.candidates ?? []} />
        : <ResultsBar percentages={t.percentages} weights={t.weights} />}
      {(t.ballots?.length ?? 0) > 0 && (
        <details className="mt-3 group">
          <summary className="flex cursor-pointer select-none items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
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
                    : b.voteLabel ? <span className="font-medium capitalize">{b.voteLabel}</span>
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

// ─── Session cards ─────────────────────────────────────────────────────────────

function MeetingLinkButton({ href, live }: { href: string; live?: boolean }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className={"group inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl focus:outline-none focus-visible:ring-4 " +
        (live ? "bg-gradient-to-r from-rose-500 via-fuchsia-500 to-indigo-500 focus-visible:ring-fuchsia-300 animate-pulse"
          : "bg-gradient-to-r from-sky-500 via-cyan-500 to-teal-500 focus-visible:ring-cyan-300")}>
      <Video className="h-5 w-5" />
      {live ? "Unirse al pleno en vivo" : "Enlace del pleno"}
      <ExternalLink className="h-4 w-4 opacity-80 transition-transform group-hover:translate-x-0.5" />
    </a>
  );
}

function ActaButton({ sessionId, fileName }: { sessionId: number; fileName: string | null | undefined }) {
  return (
    <a href={`/api/public/sessions/${sessionId}/acta`} download={fileName ?? undefined}
      className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-5 py-3 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-300">
      <FileDown className="h-5 w-5" />
      Descargar acta
      {fileName ? <span className="font-normal opacity-90">({fileName})</span> : null}
    </a>
  );
}

function ActiveCard({ s }: { s: AdminHistorySession }) {
  const when = formatDate(s.scheduledAt);
  return (
    <Card className="overflow-hidden border-rose-200 shadow-md ring-1 ring-rose-100">
      <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-indigo-500" />
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-lg font-bold text-gray-900">{s.title}</h4>
            {when && <p className="text-sm text-muted-foreground mt-0.5">{when}</p>}
          </div>
          <Badge className="shrink-0 gap-1 bg-rose-500 text-white hover:bg-rose-500">
            <Radio className="h-3 w-3 animate-pulse" /> EN VIVO
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          {s.location && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {s.location}</span>}
          <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {s.presentCount}/{s.totalMembers} presentes</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {s.meetingLink && <MeetingLinkButton href={s.meetingLink} live />}
          {s.hasActa && <ActaButton sessionId={s.sessionId} fileName={s.actaFileName} />}
        </div>
        <div className="rounded-lg border bg-muted/30 p-4">
          <AttendanceRoster attendees={s.attendees ?? []} absentees={s.absentees ?? []} />
        </div>
      </div>
    </Card>
  );
}

function UpcomingCard({ s }: { s: AdminHistorySession }) {
  const when = formatDate(s.scheduledAt);
  return (
    <Card className="overflow-hidden border-indigo-100">
      <div className="h-1.5 w-full bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400" />
      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h4 className="text-lg font-bold text-gray-900">{s.title}</h4>
          <Badge className="shrink-0 bg-indigo-100 text-indigo-700 hover:bg-indigo-100">PRÓXIMO</Badge>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          {when && <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> {when}</span>}
          {s.location && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {s.location}</span>}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {s.meetingLink && <MeetingLinkButton href={s.meetingLink} />}
          {s.hasActa && <ActaButton sessionId={s.sessionId} fileName={s.actaFileName} />}
        </div>
      </div>
    </Card>
  );
}

function PastSession({ s }: { s: AdminHistorySession }) {
  const when = formatDate(s.scheduledAt);
  return (
    <AccordionItem value={String(s.sessionId)} className="border rounded-lg bg-white px-4">
      <AccordionTrigger className="hover:no-underline">
        <div className="flex flex-1 items-center justify-between gap-3 pr-3 text-left">
          <div>
            <div className="font-semibold text-gray-900">{s.title}</div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
              {s.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.location}</span>}
              {when && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{when}</span>}
              <span>{s.topics.length} votación(es)</span>
              <span>{s.presentCount}/{s.totalMembers} presentes</span>
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
          <div className="text-xs text-muted-foreground space-y-1 border-b pb-3">
            <div className="flex justify-between">
              <span>Ponderación presente:</span>
              <span className="font-semibold text-foreground">
                {s.presentWeight.toFixed(2)} / {s.totalWeight.toFixed(2)}
              </span>
            </div>
            <Progress value={s.totalWeight > 0 ? (s.presentWeight / s.totalWeight) * 100 : 0} className="h-2" />
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
              <Users className="h-4 w-4" /> Asistencia
            </div>
            <AttendanceRoster attendees={s.attendees ?? []} absentees={s.absentees ?? []} />
          </div>
          {s.topics.length === 0
            ? <div className="text-sm text-muted-foreground py-2">Esta sesión no tuvo votaciones.</div>
            : s.topics.map((t) => <PublicTopicCard key={t.topicId} topic={t} />)}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
      <div>
        <h3 className="text-xl font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PublicHome() {
  const [, setLocation] = useLocation();

  const { data: history, isLoading: historyLoading } = useGetPublicHistory({
    query: { queryKey: getGetPublicHistoryQueryKey() },
  });

  const { data: members, isLoading: membersLoading } = useQuery<PublicMember[]>({
    queryKey: ["public-members"],
    queryFn: () => fetch("/api/public/members").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const sessions = history ?? [];
  const active = sessions.filter((s) => s.phase === "activo");
  const upcoming = sessions.filter((s) => s.phase === "futuro");
  const past = sessions.filter((s) => s.phase === "pasado");

  const totalSessions = past.length;
  const totalVotes = past.reduce((sum, s) => sum + s.topics.length, 0);
  const memberCount = members?.length ?? 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="text-sm font-bold text-gray-800">Pleno FECh</span>
            <span className="hidden sm:inline text-xs text-muted-foreground">— Portal de Transparencia</span>
          </div>
          <Button size="sm" onClick={() => setLocation("/login")}>
            <LogIn className="h-4 w-4 mr-2" /> Ingresar
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-16">

        {/* ── Hero ── */}
        <section className="space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200">
              <ShieldCheck className="h-3.5 w-3.5" /> Transparencia institucional
            </div>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl leading-tight">
              <span className="bg-gradient-to-r from-blue-700 via-indigo-600 to-violet-700 bg-clip-text text-transparent">
                Sistema Plenario
              </span>
              <br />
              <span className="text-gray-900">Federación de Estudiantes</span>
            </h1>
            <p className="text-lg text-gray-500 font-light">Universidad de Chile</p>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-justify text-[15px] leading-relaxed text-gray-700">
              El Sistema Plenario es la instancia máxima de deliberación y decisión de la Federación de
              Estudiantes de la Universidad de Chile (FECh). Este portal publica en tiempo real la composición
              del pleno, las asistencias y los resultados de votaciones, garantizando la transparencia
              democrática frente a toda la comunidad estudiantil.
            </p>
          </div>

          {/* Stats */}
          {!historyLoading && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Integrantes", value: memberCount || "—", icon: <Users className="h-5 w-5" /> },
                { label: "Sesiones realizadas", value: totalSessions, icon: <CalendarDays className="h-5 w-5" /> },
                { label: "Votaciones", value: totalVotes, icon: <BarChart2 className="h-5 w-5" /> },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border bg-white p-4 text-center shadow-sm">
                  <div className="flex justify-center mb-1 text-primary">{stat.icon}</div>
                  <div className="text-2xl font-black text-gray-900">{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Composición del Pleno ── */}
        <section className="space-y-5">
          <SectionHeading
            icon={<Users className="h-5 w-5" />}
            title="Composición del Pleno FECh"
            subtitle="Estructura actual del órgano máximo de la Federación, organizada por estamento."
          />
          {membersLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : members && members.length > 0 ? (
            <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-6">
              <Hemicycle members={members} />

              {/* Members by estamento */}
              <div className="space-y-4 pt-2 border-t">
                {(["cosefech", "consejero", "cee"] as EstamentoKey[]).map((key) => {
                  const cfg = ESTAMENTO[key];
                  const group = members
                    .filter((m) => estamentoOf(m.group) === key)
                    .sort((a, b) => a.name.localeCompare(b.name, "es"));
                  if (group.length === 0) return null;
                  return (
                    <div key={key}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                        <h4 className="text-sm font-bold" style={{ color: cfg.color }}>{cfg.label}</h4>
                        <span className="text-xs text-muted-foreground">({group.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {group.map((m) => (
                          <span
                            key={m.name}
                            className={"rounded-full border px-2.5 py-0.5 text-xs font-medium " + cfg.text + " " + cfg.border}
                            style={{ backgroundColor: cfg.bg }}
                            title={m.faculty ?? undefined}
                          >
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
            <div className="p-8 text-center text-muted-foreground bg-white rounded-lg border">
              No hay datos de composición disponibles.
            </div>
          )}
        </section>

        {/* ── Active sessions ── */}
        {active.length > 0 && (
          <section className="space-y-4">
            <SectionHeading
              icon={<Radio className="h-5 w-5" />}
              title="Plenos activos"
              subtitle="Sesiones en curso — únete al enlace en vivo."
            />
            <div className="space-y-4">
              {active.map((s) => <ActiveCard key={s.sessionId} s={s} />)}
            </div>
          </section>
        )}

        {/* ── Attendance history ── */}
        {past.length > 0 && (
          <section className="space-y-5">
            <SectionHeading
              icon={<BarChart2 className="h-5 w-5" />}
              title="Histórico de Asistencias por Integrante"
              subtitle="Registro de presencia de cada integrante del pleno a través de las sesiones realizadas."
            />
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <AttendanceHistory sessions={sessions} />
            </div>
          </section>
        )}

        {/* ── Upcoming sessions ── */}
        {upcoming.length > 0 && (
          <section className="space-y-4">
            <SectionHeading
              icon={<CalendarDays className="h-5 w-5" />}
              title="Próximos plenos"
              subtitle="Sesiones agendadas por la Mesa Directiva."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {upcoming.map((s) => <UpcomingCard key={s.sessionId} s={s} />)}
            </div>
          </section>
        )}

        {/* ── Past sessions ── */}
        <section className="space-y-4">
          <SectionHeading
            icon={<Archive className="h-5 w-5" />}
            title="Actas y resultados de sesiones"
            subtitle="Asistencia ponderada y resultados completos de cada sesión cerrada."
          />
          {historyLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : past.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground bg-white rounded-lg border">
              Aún no hay sesiones cerradas para mostrar.
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-3">
              {past.map((s) => <PastSession key={s.sessionId} s={s} />)}
            </Accordion>
          )}
        </section>

        {active.length === 0 && upcoming.length === 0 && past.length === 0 && !historyLoading && (
          <div className="p-12 text-center text-muted-foreground bg-white rounded-lg border rounded-2xl">
            <Info className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Aún no hay plenos registrados.</p>
            <p className="text-sm mt-1">El historial aparecerá aquí una vez que se realicen sesiones.</p>
          </div>
        )}
      </main>

      <footer className="border-t bg-white py-8 mt-16">
        <div className="max-w-5xl mx-auto px-4 space-y-1 text-center text-xs text-muted-foreground">
          <p className="font-semibold text-gray-600">Federación de Estudiantes de la Universidad de Chile</p>
          <p>Portal de Transparencia Plenaria · Sistema de Votación Ponderada</p>
        </div>
      </footer>
    </div>
  );
}
