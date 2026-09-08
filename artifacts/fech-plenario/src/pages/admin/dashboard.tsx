import { useState } from "react";
import { Link } from "wouter";
import {
  useListSessions,
  useCreateSession,
  useGetStats,
  useListAttendance,
  useListTopics,
  getListSessionsQueryKey,
  getGetStatsQueryKey,
  getListAttendanceQueryKey,
  getListTopicsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { AttendanceRing } from "@/components/attendance-ring";
import { AttendanceByGroup } from "@/components/attendance-by-group";
import { AttendanceBarChart } from "@/components/attendance-bar-chart";
import { TopicResultsView } from "@/components/topic-results-view";
import { useToast } from "@/hooks/use-toast";
import { useLobbyLive } from "@/hooks/use-lobby-live";
import { useSessionLive } from "@/hooks/use-session-live";
import { MapPin, Clock, ArrowRight } from "lucide-react";

function LiveSessionPanel({ sessionId, title }: { sessionId: number; title: string }) {
  // Live sync: the dashboard's open-session panel (attendance + open mociones)
  // updates instantly instead of waiting on the 10–30s polls below, which stay
  // as a dropped-socket fallback.
  useSessionLive(sessionId);
  const { data: attendance } = useListAttendance(sessionId, {
    query: { refetchInterval: 30000, queryKey: getListAttendanceQueryKey(sessionId) },
  });
  const { data: topics } = useListTopics(sessionId, {
    query: { refetchInterval: 30000, queryKey: getListTopicsQueryKey(sessionId) },
  });

  const openTopics = topics?.filter((t) => t.status === "abierto") ?? [];
  const hasOpenVoting = openTopics.length > 0;

  const presentCount = attendance?.present.length ?? 0;
  const totalCount = (attendance?.present.length ?? 0) + (attendance?.absent.length ?? 0);
  const presentWeight = attendance?.presentWeight ?? 0;
  const totalWeight = attendance?.totalWeight ?? 0;
  const attendancePct = totalCount > 0 ? (presentCount / totalCount) * 100 : 0;
  const weightPct = totalWeight > 0 ? (presentWeight / totalWeight) * 100 : 0;

  const detailHref = `/admin/sessions/${sessionId}`;
  const linkClasses =
    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 h-9 px-4 py-2";

  const present = attendance?.present ?? [];
  const absent = attendance?.absent ?? [];

  return (
    <div className="space-y-4">
      <Card className="border-l-4 border-l-lime-500">
        <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle className="flex items-center gap-2 text-xl">
            <span className="h-3 w-3 rounded-full bg-lime-500 animate-pulse" />
            Asistencia en vivo · {title}
          </CardTitle>
          <Link href={detailHref} className={`${linkClasses} shrink-0`}>
            Ir a la sesión <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 items-center">
            <div className="flex flex-col items-center gap-4">
              <AttendanceRing percent={attendancePct} size={200} strokeWidth={18}>
                <div className="text-5xl font-bold text-gray-900">{presentCount}</div>
                <div className="text-sm text-muted-foreground">de {totalCount} presentes</div>
              </AttendanceRing>
              <div className="w-full max-w-xs space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ponderación presente</span>
                  <span className="font-semibold">{presentWeight.toFixed(2)} / {totalWeight.toFixed(2)}</span>
                </div>
                <Progress value={weightPct} className="h-2" />
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">Asistencia por estamento</div>
              <AttendanceBarChart present={present} absent={absent} />
            </div>
          </div>
          <div className="border-t pt-5">
            <AttendanceByGroup present={present} absent={absent} />
          </div>
        </CardContent>
      </Card>

      {hasOpenVoting && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-lime-500 animate-pulse" />
              Mociones en curso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {openTopics.map((topic) => (
              <div key={topic.id} className="border-b pb-6 last:border-0 last:pb-0">
                <h3 className="font-semibold text-lg leading-tight">{topic.title}</h3>
                <TopicResultsView topicId={topic.id} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useGetStats({ query: { refetchInterval: 30000, queryKey: getGetStatsQueryKey() } });
  const { data: sessions, isLoading: sessionsLoading } = useListSessions({ query: { refetchInterval: 30000, queryKey: getListSessionsQueryKey() } });
  const createSession = useCreateSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  useLobbyLive();
  const [newTitle, setNewTitle] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newScheduledAt, setNewScheduledAt] = useState("");
  const [newMeetingLink, setNewMeetingLink] = useState("");

  const openSession = sessions?.find((s) => s.status === "abierta");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;
    createSession.mutate({
      data: {
        title: newTitle,
        location: newLocation || undefined,
        scheduledAt: newScheduledAt ? new Date(newScheduledAt).toISOString() : undefined,
        meetingLink: newMeetingLink.trim() || undefined,
      },
    }, {
      onSuccess: () => {
        setNewTitle("");
        setNewLocation("");
        setNewScheduledAt("");
        setNewMeetingLink("");
        queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
        toast({ title: "Sesión creada exitosamente" });
      },
      onError: () => toast({ title: "Error al crear sesión", variant: "destructive" })
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Panel de Administración</h1>

        {openSession && <LiveSessionPanel sessionId={openSession.id} title={openSession.title} />}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-t-4 border-t-sky-500">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Miembres</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold text-sky-600">{statsLoading ? "-" : stats?.totalMembers}</div></CardContent>
          </Card>
          <Card className="border-t-4 border-t-lime-500">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Sesiones Totales</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold text-lime-600">{statsLoading ? "-" : stats?.totalSessions}</div></CardContent>
          </Card>
          <Card className="border-t-4 border-t-amber-400">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Sesiones Abiertas</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold text-amber-500">{statsLoading ? "-" : stats?.openSessions}</div></CardContent>
          </Card>
          <Card className="border-t-4 border-t-red-500">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Mociones Votadas</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold text-red-600">{statsLoading ? "-" : stats?.totalTopics}</div></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nueva Sesión</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="title">Título</Label>
                  <Input id="title" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Título de la sesión" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="location">Lugar</Label>
                  <Input id="location" value={newLocation} onChange={e => setNewLocation(e.target.value)} placeholder="Ej: Casa Central" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="scheduledAt">Fecha y hora</Label>
                  <Input id="scheduledAt" type="datetime-local" value={newScheduledAt} onChange={e => setNewScheduledAt(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="meetingLink">Enlace de la sesión</Label>
                <Input id="meetingLink" type="url" value={newMeetingLink} onChange={e => setNewMeetingLink(e.target.value)} placeholder="https://meet.google.com/... (visible para todo el pleno)" />
              </div>
              <Button type="submit" disabled={createSession.isPending || !newTitle}>Crear Sesión</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sesiones Plenarias</CardTitle>
          </CardHeader>
          <CardContent>
            {sessionsLoading ? <Spinner /> : (
              <div className="space-y-4">
                {sessions?.map(session => (
                  <div key={session.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                    <div>
                      <h3 className="font-medium text-lg">{session.title}</h3>
                      <div className="text-sm text-muted-foreground flex gap-3 items-center mt-1 flex-wrap">
                        <Badge variant={session.status === "abierta" ? "default" : "secondary"}>
                          {session.status.toUpperCase()}
                        </Badge>
                        {session.location && (
                          <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{session.location}</span>
                        )}
                        {session.scheduledAt && (
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{new Date(session.scheduledAt).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                    <Link href={`/admin/sessions/${session.id}`} className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 h-9 px-4 py-2">
                      Ver Detalles
                    </Link>
                  </div>
                ))}
                {sessions?.length === 0 && <div className="text-muted-foreground">No hay sesiones.</div>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
