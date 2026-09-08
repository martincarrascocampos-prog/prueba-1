import { useLocation } from "wouter";
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
} from "lucide-react";

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MeetingLinkButton({ href, live }: { href: string; live?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        "group inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl focus:outline-none focus-visible:ring-4 " +
        (live
          ? "bg-gradient-to-r from-rose-500 via-fuchsia-500 to-indigo-500 focus-visible:ring-fuchsia-300 animate-pulse"
          : "bg-gradient-to-r from-sky-500 via-cyan-500 to-teal-500 focus-visible:ring-cyan-300")
      }
    >
      <Video className="h-5 w-5" />
      {live ? "Unirse al pleno en vivo" : "Enlace del pleno"}
      <ExternalLink className="h-4 w-4 opacity-80 transition-transform group-hover:translate-x-0.5" />
    </a>
  );
}

function ActaButton({ sessionId, fileName }: { sessionId: number; fileName: string | null | undefined }) {
  return (
    <a
      href={`/api/public/sessions/${sessionId}/acta`}
      download={fileName ?? undefined}
      className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-5 py-3 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-300"
    >
      <FileDown className="h-5 w-5" />
      Descargar acta
      {fileName ? <span className="font-normal opacity-90">({fileName})</span> : null}
    </a>
  );
}

function AttendeeChip({
  label,
  tone,
}: {
  label: string;
  tone: "presencial" | "online" | "absent";
}) {
  const cls =
    tone === "presencial"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "online"
        ? "bg-sky-50 text-sky-700 border-sky-200"
        : "bg-gray-50 text-gray-500 border-gray-200";
  return <span className={"rounded-full border px-2.5 py-0.5 text-xs " + cls}>{label}</span>;
}

function AttendanceRoster({
  attendees,
  absentees,
}: {
  attendees: PublicAttendee[];
  absentees: PublicMemberRef[];
}) {
  const presencial = attendees.filter((a) => a.modality === "presencial");
  const online = attendees.filter((a) => a.modality === "online");

  if (attendees.length === 0 && absentees.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin registro de asistencia.</p>;
  }

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
            {presencial.map((a, i) => (
              <AttendeeChip key={`p-${i}`} label={a.name} tone="presencial" />
            ))}
          </div>
        </div>
      )}

      {online.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-sky-700">
            <Video className="h-3.5 w-3.5" /> Asistentes online
          </div>
          <div className="flex flex-wrap gap-1.5">
            {online.map((a, i) => (
              <AttendeeChip key={`o-${i}`} label={a.name} tone="online" />
            ))}
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
                label={a.justified ? `${a.name} · Inasistencia Justificada` : a.name}
                tone="absent"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PublicTopicCard({ topic: t }: { topic: AdminHistoryTopic }) {
  return (
    <Card className="p-4 border-primary/10">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="font-medium">{t.title}</div>
        {t.approved !== null && (
          <Badge
            variant="outline"
            className={
              t.approved
                ? "bg-lime-50 text-lime-700 border-lime-200 text-[10px]"
                : "bg-red-50 text-red-700 border-red-200 text-[10px]"
            }
          >
            {t.approved ? "APROBADO" : "RECHAZADO"}
          </Badge>
        )}
      </div>
      {t.detail && <p className="text-xs text-muted-foreground mb-3">{t.detail}</p>}
      {t.type === "candidato" ? (
        <CandidateResultsBar candidates={t.candidates ?? []} />
      ) : (
        <ResultsBar percentages={t.percentages} weights={t.weights} />
      )}
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
                  {b.status === "absent" ? (
                    <span className="text-muted-foreground">Ausente</span>
                  ) : b.voteLabel ? (
                    <span className="font-medium capitalize">{b.voteLabel}</span>
                  ) : (
                    <span className="text-muted-foreground">No votó</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
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
          {when && (
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" /> {when}
            </span>
          )}
          {s.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> {s.location}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {s.meetingLink && <MeetingLinkButton href={s.meetingLink} />}
          {s.hasActa && <ActaButton sessionId={s.sessionId} fileName={s.actaFileName} />}
        </div>
      </div>
    </Card>
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
          {s.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> {s.location}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" /> {s.presentCount}/{s.totalMembers} presentes
          </span>
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

function PastSession({ s }: { s: AdminHistorySession }) {
  const when = formatDate(s.scheduledAt);
  return (
    <AccordionItem value={String(s.sessionId)} className="border rounded-lg bg-white px-4">
      <AccordionTrigger className="hover:no-underline">
        <div className="flex flex-1 items-center justify-between gap-3 pr-3 text-left">
          <div>
            <div className="font-semibold text-gray-900">{s.title}</div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
              {s.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {s.location}
                </span>
              )}
              {when && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {when}
                </span>
              )}
              <span>{s.topics.length} votación(es)</span>
              <span>
                {s.presentCount}/{s.totalMembers} presentes
              </span>
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0">
            CERRADA
          </Badge>
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

          {s.topics.length === 0 ? (
            <div className="text-sm text-muted-foreground py-2">Esta sesión no tuvo votaciones.</div>
          ) : (
            s.topics.map((t) => <PublicTopicCard key={t.topicId} topic={t} />)
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function SectionHeading({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
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

export default function PublicHome() {
  const [, setLocation] = useLocation();
  const { data: history, isLoading } = useGetPublicHistory({
    query: { queryKey: getGetPublicHistoryQueryKey() },
  });

  const sessions = history ?? [];
  const active = sessions.filter((s) => s.phase === "activo");
  const upcoming = sessions.filter((s) => s.phase === "futuro");
  const past = sessions.filter((s) => s.phase === "pasado");

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-white">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" /> Línea de transparencia
          </div>
          <Button onClick={() => setLocation("/login")}>
            <LogIn className="h-4 w-4 mr-2" /> Ingresar
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-12">
        {/* Hero */}
        <section className="space-y-5">
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            <span className="bg-gradient-to-r from-rose-500 via-amber-500 via-lime-500 via-sky-500 to-fuchsia-600 bg-clip-text text-transparent">
              Sistema Plenario FECh
            </span>
          </h1>
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-justify text-[15px] leading-relaxed text-gray-700">
              El Sistema Plenario constituye una iniciativa concebida y desarrollada por la Mesa Directiva de la
              Federación de Estudiantes de la Universidad de Chile, con un propósito tan nítido como ambicioso: dotar
              al Pleno de un funcionamiento ágil, dinámico y transparente, a la altura de la relevancia histórica que
              reviste esta instancia en la vida democrática de nuestra Federación.
            </p>
          </div>
        </section>

        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Spinner />
          </div>
        ) : (
          <>
            {/* Active */}
            {active.length > 0 && (
              <section className="space-y-4">
                <SectionHeading
                  icon={<Radio className="h-5 w-5" />}
                  title="Plenos activos"
                  subtitle="Sesiones en curso — únete al enlace en vivo."
                />
                <div className="space-y-4">
                  {active.map((s) => (
                    <ActiveCard key={s.sessionId} s={s} />
                  ))}
                </div>
              </section>
            )}

            {/* Upcoming */}
            {upcoming.length > 0 && (
              <section className="space-y-4">
                <SectionHeading
                  icon={<CalendarDays className="h-5 w-5" />}
                  title="Próximos plenos"
                  subtitle="Sesiones agendadas por la Mesa Directiva."
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  {upcoming.map((s) => (
                    <UpcomingCard key={s.sessionId} s={s} />
                  ))}
                </div>
              </section>
            )}

            {/* Past */}
            <section className="space-y-4">
              <SectionHeading
                icon={<Archive className="h-5 w-5" />}
                title="Detalle de plenos pasados"
                subtitle="Asistencia y resultados ponderados de cada sesión cerrada."
              />
              {past.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground bg-white rounded-lg border">
                  Aún no hay sesiones cerradas para mostrar.
                </div>
              ) : (
                <Accordion type="multiple" className="space-y-3">
                  {past.map((s) => (
                    <PastSession key={s.sessionId} s={s} />
                  ))}
                </Accordion>
              )}
            </section>

            {active.length === 0 && upcoming.length === 0 && past.length === 0 && (
              <div className="p-12 text-center text-muted-foreground bg-white rounded-lg border">
                Aún no hay plenos para mostrar.
              </div>
            )}
          </>
        )}
      </main>

      <footer className="border-t bg-white py-6">
        <div className="max-w-5xl mx-auto px-4 text-center text-xs text-muted-foreground">
          Federación de Estudiantes de la Universidad de Chile · Sistema Plenario
        </div>
      </footer>
    </div>
  );
}
