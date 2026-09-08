import { useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { 
  useGetSession, 
  useUpdateSession, 
  useDeleteSession, 
  useListAttendance, 
  useListTopics, 
  useCreateTopic,
  useUpdateTopic,
  useDeleteTopic,
  useListAgendaPoints,
  useCreateAgendaPoint,
  useUpdateAgendaPoint,
  useDeleteAgendaPoint,
  useReorderAgendaPoints,
  useToggleSpeakingRound,
  useUpdateMemberAttendance,
  useListMembers,
  getListMembersQueryKey,
  exportAttendance,
  exportResults,
  exportMatrix,
  getGetSessionQueryKey,
  getListAttendanceQueryKey,
  getListTopicsQueryKey,
  getListAgendaPointsQueryKey,
  type AgendaPoint,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as xlsx from "xlsx";
import { QRCodeSVG } from "qrcode.react";

import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { TopicResultsView } from "@/components/topic-results-view";
import { TopicBallotsPanel } from "@/components/topic-ballots-panel";
import { EditVotesDialog } from "@/components/edit-votes-dialog";
import { AttendanceByGroup } from "@/components/attendance-by-group";
import { AttendanceBarChart } from "@/components/attendance-bar-chart";
import { LiveRoster } from "@/components/live-roster";
import { SpeakingPanel } from "@/components/speaking-panel";
import { CurrentSpeaker } from "@/components/current-speaker";
import { useSessionLive } from "@/hooks/use-session-live";
import { formatMinutes } from "@/components/session-agenda";
import { SessionResources } from "@/components/session-resources";
import { useUpload } from "@workspace/object-storage-web";
import { RefreshCw, MapPin, Clock, Pencil, Maximize2, ArrowUp, ArrowDown, Trash2, Plus, Wifi, LogOut, Hand, FileUp, Users } from "lucide-react";

// Fixed voting divisions. Value = users.group used for eligibility (empty
// selection = pleno completo / open to all). Mesa Directiva is intentionally excluded.
const ESTAMENTO_OPTIONS: { value: string; label: string }[] = [
  { value: "CEE", label: "CEE (Delegades)" },
  { value: "Consejeros FECh", label: "Consejerías" },
  { value: "COSEFECH", label: "Cosefech" },
];

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

export default function AdminSessionDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Polling kept as a fallback at a larger interval; Socket.io drives instant updates.
  const { data: session, isLoading: sessionLoading } = useGetSession(id, { query: { enabled: !!id, refetchInterval: 30000, queryKey: getGetSessionQueryKey(id) } });
  const { data: attendance } = useListAttendance(id, { query: { enabled: !!id, refetchInterval: 30000, queryKey: getListAttendanceQueryKey(id) } });
  const { data: topics } = useListTopics(id, { query: { enabled: !!id, refetchInterval: 30000, queryKey: getListTopicsQueryKey(id) } });
  const { data: agenda } = useListAgendaPoints(id, { query: { enabled: !!id, refetchInterval: 30000, queryKey: getListAgendaPointsQueryKey(id) } });
  const { data: members } = useListMembers({ query: { queryKey: getListMembersQueryKey() } });

  const { connected: liveConnected } = useSessionLive(id || undefined);

  const updateSession = useUpdateSession();
  const deleteSession = useDeleteSession();
  const createTopic = useCreateTopic();
  const updateTopic = useUpdateTopic();
  const deleteTopic = useDeleteTopic();
  const createAgendaPoint = useCreateAgendaPoint();
  const updateAgendaPoint = useUpdateAgendaPoint();
  const deleteAgendaPoint = useDeleteAgendaPoint();
  const reorderAgendaPoints = useReorderAgendaPoints();
  const toggleSpeakingRound = useToggleSpeakingRound();
  const updateMemberAttendance = useUpdateMemberAttendance();
  
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicDetail, setNewTopicDetail] = useState("");
  const [newTopicPointId, setNewTopicPointId] = useState<string>("");
  const [newTopicType, setNewTopicType] = useState<"mocion" | "candidato">("mocion");
  const [newTopicMultiVote, setNewTopicMultiVote] = useState(false);
  const [newTopicWeighted, setNewTopicWeighted] = useState(true);
  const [newTopicWeightSource, setNewTopicWeightSource] = useState<"normal" | "alt">("normal");
  const [newTopicVotesPerVoter, setNewTopicVotesPerVoter] = useState("1");
  const [newTopicCandidates, setNewTopicCandidates] = useState<string[]>([""]);
  const [newTopicEstamentos, setNewTopicEstamentos] = useState<string[]>([]);
  const [openBallots, setOpenBallots] = useState<Record<number, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [roundPoint, setRoundPoint] = useState<string>("");
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editScheduledAt, setEditScheduledAt] = useState("");
  const [editMeetingLink, setEditMeetingLink] = useState("");

  const [newPointTitle, setNewPointTitle] = useState("");
  const [newPointHours, setNewPointHours] = useState("");
  const [newPointMinutes, setNewPointMinutes] = useState("");
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [votesEditOpen, setVotesEditOpen] = useState(false);
  const [attSearch, setAttSearch] = useState("");
  const [attSort, setAttSort] = useState<"nombre" | "grupo">("nombre");

  const sortedAgenda = [...(agenda ?? [])].sort((a, b) => a.position - b.position || a.id - b.id);

  // Attendance dialog: shared search + sort applied to presentes/retirados/ausentes.
  const filterSortAtt = <T extends { displayName: string; group?: string | null }>(rows: T[]): T[] => {
    const q = attSearch.trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          (r) =>
            r.displayName.toLowerCase().includes(q) ||
            (r.group ?? "").toLowerCase().includes(q),
        )
      : rows;
    return [...filtered].sort((a, b) => {
      if (attSort === "grupo") {
        const g = (a.group ?? "").localeCompare(b.group ?? "");
        if (g !== 0) return g;
      }
      return a.displayName.localeCompare(b.displayName);
    });
  };

  const invalidateAgenda = () =>
    queryClient.invalidateQueries({ queryKey: getListAgendaPointsQueryKey(id) });
  const invalidateAttendance = () =>
    queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey(id) });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(id) }),
      queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey(id) }),
      queryClient.invalidateQueries({ queryKey: getListTopicsQueryKey(id) }),
      queryClient.invalidateQueries({ queryKey: getListAgendaPointsQueryKey(id) }),
    ]);
    setRefreshing(false);
  };

  const handleAddPoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPointTitle) return;
    const h = parseInt(newPointHours, 10) || 0;
    const m = parseInt(newPointMinutes, 10) || 0;
    const total = h * 60 + m;
    createAgendaPoint.mutate(
      { id, data: { title: newPointTitle, estimatedMinutes: total > 0 ? total : null } },
      {
        onSuccess: () => {
          setNewPointTitle("");
          setNewPointHours("");
          setNewPointMinutes("");
          invalidateAgenda();
          toast({ title: "Punto agregado a la tabla" });
        },
      },
    );
  };

  const movePoint = (index: number, dir: -1 | 1) => {
    const arr = [...sortedAgenda];
    const target = index + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    reorderAgendaPoints.mutate(
      { id, data: { orderedIds: arr.map((p) => p.id) } },
      { onSuccess: () => invalidateAgenda() },
    );
  };

  const handleDeletePoint = (point: AgendaPoint) => {
    if (!confirm(`¿Eliminar el punto "${point.title}" de la tabla?`)) return;
    deleteAgendaPoint.mutate(
      { pointId: point.id },
      {
        onSuccess: () => {
          invalidateAgenda();
          queryClient.invalidateQueries({ queryKey: getListTopicsQueryKey(id) });
        },
      },
    );
  };

  const setMemberPresence = (
    userId: number,
    present: boolean,
    modality?: "online" | "presencial",
    justified?: boolean,
  ) => {
    updateMemberAttendance.mutate(
      { id, userId, data: { present, modality, justified } },
      { onSuccess: () => invalidateAttendance() },
    );
  };

  const openEdit = () => {
    setEditTitle(session?.title || "");
    setEditLocation(session?.location || "");
    setEditScheduledAt(toDatetimeLocal(session?.scheduledAt));
    setEditMeetingLink(session?.meetingLink || "");
    setEditOpen(true);
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSession.mutate({
      id,
      data: {
        title: editTitle,
        location: editLocation || undefined,
        scheduledAt: editScheduledAt ? new Date(editScheduledAt).toISOString() : undefined,
        meetingLink: editMeetingLink.trim() || null,
      },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(id) });
        setEditOpen(false);
        toast({ title: "Sesión actualizada" });
      },
      onError: () => toast({ title: "Error al actualizar", variant: "destructive" }),
    });
  };

  const downloadExcel = (data: { headers: string[], rows: string[][] }, filename: string) => {
    const sheet = xlsx.utils.aoa_to_sheet([data.headers, ...data.rows]);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, sheet, "Datos");
    xlsx.writeFile(wb, `${filename}.xlsx`);
  };

  const [exporting, setExporting] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  const { uploadFile, isUploading } = useUpload();
  const actaInputRef = useRef<HTMLInputElement>(null);

  const handleActaSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast({ title: "Solo se permiten archivos PDF", variant: "destructive" });
      return;
    }
    const result = await uploadFile(file);
    if (!result) {
      toast({ title: "Error al subir el acta", variant: "destructive" });
      return;
    }
    updateSession.mutate({
      id,
      data: { actaObjectPath: result.objectPath, actaFileName: file.name },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(id) });
        toast({ title: "Acta subida correctamente" });
      },
      onError: () => toast({ title: "Error al guardar el acta", variant: "destructive" }),
    });
  };

  const handleRemoveActa = () => {
    if (!confirm("¿Eliminar el acta de esta sesión?")) return;
    updateSession.mutate({
      id,
      data: { actaObjectPath: null, actaFileName: null },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(id) });
        toast({ title: "Acta eliminada" });
      },
    });
  };

  const handleExport = async (type: "attendance" | "results" | "matrix") => {
    setExporting(type);
    try {
      let data;
      if (type === "attendance") data = await exportAttendance(id);
      else if (type === "results") data = await exportResults(id);
      else data = await exportMatrix(id);
      downloadExcel(data, type === "attendance" ? `Asistencia_${id}` : type === "results" ? `Resultados_${id}` : `Matriz_Votos_${id}`);
    } catch {
      toast({ title: "Error al exportar", variant: "destructive" });
    } finally {
      setExporting(null);
    }
  };

  if (sessionLoading) return <AppLayout><div className="flex justify-center p-12"><Spinner /></div></AppLayout>;
  if (!session) return <AppLayout>Sesión no encontrada</AppLayout>;

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">{session.title}</h1>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={openEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2 items-center mt-2 flex-wrap">
            <Badge variant={session.status === "abierta" ? "default" : "secondary"}>
              {session.status.toUpperCase()}
            </Badge>
            <span className="text-muted-foreground">Código: <strong className="text-foreground">{session.sessionCode}</strong></span>
            {session.location && (
              <span className="text-muted-foreground flex items-center gap-1"><MapPin className="w-4 h-4" />{session.location}</span>
            )}
            {session.scheduledAt && (
              <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-4 h-4" />{new Date(session.scheduledAt).toLocaleString()}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          {session.status === "abierta" ? (
            <Button variant="destructive" onClick={() => {
              updateSession.mutate({ id, data: { status: "cerrada" } }, {
                onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(id) })
              });
            }}>Cerrar Sesión</Button>
          ) : (
            <Button variant="outline" onClick={() => {
              updateSession.mutate({ id, data: { status: "abierta" } }, {
                onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(id) })
              });
            }}>Reabrir Sesión</Button>
          )}
          <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => {
            if (confirm("¿Estás seguro de eliminar esta sesión y todos sus votos?")) {
              deleteSession.mutate({ id }, {
                onSuccess: () => setLocation("/admin")
              });
            }
          }}>Eliminar</Button>
        </div>
      </div>

      <div className="mb-6">
        <CurrentSpeaker sessionId={id} live={liveConnected} />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileUp className="h-5 w-5" /> Enlace y Acta</CardTitle>
          <CardDescription>El enlace y el acta (PDF) son visibles y descargables por todo el pleno.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SessionResources meetingLink={session.meetingLink} actaObjectPath={session.actaObjectPath} actaFileName={session.actaFileName} />
          {!session.meetingLink && !session.actaObjectPath && (
            <p className="text-sm text-muted-foreground">Aún no hay enlace ni acta. Usa "Editar" para el enlace y el botón para subir el acta.</p>
          )}
          <input ref={actaInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleActaSelected} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={isUploading || updateSession.isPending} onClick={() => actaInputRef.current?.click()}>
              <FileUp className="h-4 w-4 mr-2" />
              {isUploading ? "Subiendo..." : session.actaObjectPath ? "Reemplazar acta (PDF)" : "Subir acta (PDF)"}
            </Button>
            {session.actaObjectPath && (
              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" disabled={updateSession.isPending} onClick={handleRemoveActa}>
                <Trash2 className="h-4 w-4 mr-2" /> Eliminar acta
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lado izquierdo: Control de Asistencia y Acciones */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Asistencia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center mb-6">
                <button
                  type="button"
                  onClick={() => setQrOpen(true)}
                  className="group relative bg-white p-2 rounded-lg border shadow-sm transition-transform hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Ampliar código QR a pantalla completa"
                >
                  <QRCodeSVG value={session.sessionCode} size={150} />
                  <span className="absolute bottom-1 right-1 flex items-center justify-center h-7 w-7 rounded-md bg-black/60 text-white opacity-80 group-hover:opacity-100">
                    <Maximize2 className="h-4 w-4" />
                  </span>
                </button>
                <div className="mt-4 text-center">
                  <div className="text-3xl font-bold tracking-widest">{session.sessionCode}</div>
                  <div className="text-sm text-muted-foreground mt-1">Código de sesión · toca el QR para ampliar</div>
                </div>
              </div>

              <div className="space-y-2 text-sm border-t pt-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Presentes:</span>
                  <span className="font-semibold">{attendance?.present.length || 0} personas</span>
                </div>
                {(attendance?.checkedOut.length ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Retirados:</span>
                    <span className="font-semibold">{attendance?.checkedOut.length} personas</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ponderación Presente:</span>
                  <span className="font-semibold">{attendance?.presentWeight.toFixed(2) || "0.00"} / {attendance?.totalWeight.toFixed(2) || "0.00"}</span>
                </div>
                <Progress value={((attendance?.presentWeight || 0) / (attendance?.totalWeight || 1)) * 100} className="h-2 mt-2" />
              </div>

              <div className="border-t pt-4 mt-4 space-y-4">
                <div className="text-sm font-medium text-muted-foreground">Asistencia por estamento</div>
                <AttendanceBarChart present={attendance?.present ?? []} absent={[...(attendance?.absent ?? []), ...(attendance?.checkedOut ?? [])]} height={180} />
                <AttendanceByGroup present={attendance?.present ?? []} absent={[...(attendance?.absent ?? []), ...(attendance?.checkedOut ?? [])]} />
              </div>

              <div className="border-t pt-4 mt-4">
                <LiveRoster present={attendance?.present ?? []} checkedOut={attendance?.checkedOut ?? []} />
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <Button variant="secondary" className="w-full" onClick={() => setAttendanceOpen(true)}>
                  <Pencil className="h-4 w-4 mr-2" /> Editar asistencia
                </Button>
                <Button variant="secondary" className="w-full" onClick={() => setVotesEditOpen(true)}>
                  <Pencil className="h-4 w-4 mr-2" /> Editar votaciones
                </Button>
                <Button variant="outline" className="w-full" disabled={!!exporting} onClick={() => handleExport("attendance")}>
                  {exporting === "attendance" ? "Exportando..." : "Exportar Asistencia"}
                </Button>
                <Button variant="outline" className="w-full" disabled={!!exporting} onClick={() => handleExport("results")}>
                  {exporting === "results" ? "Exportando..." : "Exportar Resultados"}
                </Button>
                <Button variant="outline" className="w-full" disabled={!!exporting} onClick={() => handleExport("matrix")}>
                  {exporting === "matrix" ? "Exportando..." : "Exportar Matriz de Votos"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lado derecho: Tabla y Mociones propuestas */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tabla de la Sesión</CardTitle>
              <CardDescription>Puntos a tratar, en orden, con tiempo estimado.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddPoint} className="flex flex-col sm:flex-row gap-2 mb-6">
                <Input value={newPointTitle} onChange={e => setNewPointTitle(e.target.value)} placeholder="Título del punto" className="flex-1" />
                <div className="flex gap-2">
                  <Input type="number" min={0} value={newPointHours} onChange={e => setNewPointHours(e.target.value)} placeholder="h" className="w-16" />
                  <Input type="number" min={0} max={59} value={newPointMinutes} onChange={e => setNewPointMinutes(e.target.value)} placeholder="min" className="w-20" />
                  <Button type="submit" disabled={createAgendaPoint.isPending || !newPointTitle}><Plus className="h-4 w-4" /></Button>
                </div>
              </form>

              {sortedAgenda.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground border rounded-lg border-dashed">No hay puntos en la tabla todavía.</div>
              ) : (
                <ol className="space-y-2">
                  {sortedAgenda.map((p, i) => {
                    const t = formatMinutes(p.estimatedMinutes);
                    return (
                      <li key={p.id} className="flex items-center gap-3 rounded-md border bg-card p-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
                        <span className="flex-1 font-medium leading-tight">{p.title}</span>
                        {t && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                            <Clock className="h-3.5 w-3.5" />{t}
                          </span>
                        )}
                        <div className="flex items-center gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0 || reorderAgendaPoints.isPending} onClick={() => movePoint(i, -1)}>
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === sortedAgenda.length - 1 || reorderAgendaPoints.isPending} onClick={() => movePoint(i, 1)}>
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:text-red-700" onClick={() => handleDeletePoint(p)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <CardTitle className="flex items-center gap-2"><Hand className="h-5 w-5" /> Sistema de Palabra</CardTitle>
                  <CardDescription>Gestiona la cola de oradores, temporizadores y palabras colectivas.</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {session?.speakingRoundOpen ? (
                    <>
                      <Badge variant="default">
                        Ronda ABIERTA · {agenda?.find((p) => p.id === session?.speakingRoundAgendaPointId)?.title ?? "punto"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={toggleSpeakingRound.isPending}
                        onClick={() =>
                          toggleSpeakingRound.mutate(
                            { id, data: { open: false } },
                            {
                              onSuccess: () => {
                                queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(id) });
                                toast({ title: "Ronda de palabras cerrada" });
                              },
                              onError: () =>
                                toast({ title: "No se pudo cambiar la ronda de palabras", variant: "destructive" }),
                            },
                          )
                        }
                      >
                        Cerrar ronda
                      </Button>
                    </>
                  ) : (
                    <>
                      <Badge variant="secondary">Ronda de palabras CERRADA</Badge>
                      <Select value={roundPoint} onValueChange={setRoundPoint}>
                        <SelectTrigger className="w-[220px]">
                          <SelectValue placeholder="Punto de la tabla" />
                        </SelectTrigger>
                        <SelectContent>
                          {(agenda ?? []).map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="default"
                        disabled={toggleSpeakingRound.isPending || !roundPoint}
                        onClick={() => {
                          if (!roundPoint) {
                            toast({ title: "Selecciona un punto de la tabla para abrir la ronda", variant: "destructive" });
                            return;
                          }
                          toggleSpeakingRound.mutate(
                            { id, data: { open: true, agendaPointId: Number(roundPoint) } },
                            {
                              onSuccess: () => {
                                queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(id) });
                                toast({ title: "Ronda de palabras abierta" });
                              },
                              onError: () =>
                                toast({ title: "No se pudo cambiar la ronda de palabras", variant: "destructive" }),
                            },
                          );
                        }}
                      >
                        Abrir ronda
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <SpeakingPanel
                sessionId={id}
                agenda={agenda ?? []}
                isAdmin
                members={members ?? []}
                presentRecords={attendance?.present ?? []}
                speakingRoundOpen={session?.speakingRoundOpen ?? false}
                speakingRoundAgendaPointId={session?.speakingRoundAgendaPointId ?? null}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mociones propuestas</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => {
                e.preventDefault();
                if (!newTopicTitle) return;
                const isCandidato = newTopicType === "candidato";
                const candidates = newTopicCandidates.map((c) => c.trim()).filter(Boolean);
                if (isCandidato && candidates.length < 1) {
                  toast({ title: "Agrega al menos une candidate", variant: "destructive" });
                  return;
                }
                const isMulti = isCandidato && newTopicMultiVote;
                const votesPerVoter = isMulti ? Math.max(1, parseInt(newTopicVotesPerVoter, 10) || 1) : 1;
                createTopic.mutate({
                  id,
                  data: {
                    title: newTopicTitle,
                    detail: newTopicDetail.trim() || null,
                    agendaPointId: newTopicPointId ? Number(newTopicPointId) : null,
                    type: newTopicType,
                    candidateMode: isCandidato ? (isMulti ? "multiple" : "single") : null,
                    weighted: newTopicWeighted,
                    weightSource: newTopicWeighted && newTopicEstamentos.length > 0 ? newTopicWeightSource : "normal",
                    votesPerVoter,
                    candidates: isCandidato ? candidates : [],
                    estamentos: newTopicEstamentos,
                  },
                }, {
                  onSuccess: () => {
                    setNewTopicTitle("");
                    setNewTopicDetail("");
                    setNewTopicPointId("");
                    setNewTopicType("mocion");
                    setNewTopicMultiVote(false);
                    setNewTopicWeighted(true);
                    setNewTopicWeightSource("normal");
                    setNewTopicVotesPerVoter("1");
                    setNewTopicCandidates([""]);
                    setNewTopicEstamentos([]);
                    queryClient.invalidateQueries({ queryKey: getListTopicsQueryKey(id) });
                    toast({ title: "Tema creado" });
                  }
                });
              }} className="space-y-4 mb-6 rounded-lg border p-4 bg-gray-50/50">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input value={newTopicTitle} onChange={e => setNewTopicTitle(e.target.value)} placeholder="Título del nuevo tema" className="flex-1" />
                  {sortedAgenda.length > 0 && (
                    <Select value={newTopicPointId || "none"} onValueChange={(v) => setNewTopicPointId(v === "none" ? "" : v)}>
                      <SelectTrigger className="sm:w-52"><SelectValue placeholder="Punto de tabla" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin punto de tabla</SelectItem>
                        {sortedAgenda.map((p, i) => (
                          <SelectItem key={p.id} value={String(p.id)}>{i + 1}. {p.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-1">
                  <Label>Detalle (opcional)</Label>
                  <Textarea
                    value={newTopicDetail}
                    onChange={(e) => setNewTopicDetail(e.target.value)}
                    placeholder="Descripción o contexto de la votación"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Tipo de votación</Label>
                    <Select value={newTopicType} onValueChange={(v) => setNewTopicType(v as "mocion" | "candidato")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mocion">Moción (favor / contra / abstención)</SelectItem>
                        <SelectItem value="candidato">Voto de opciones múltiples</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Ponderación</Label>
                    <Select value={newTopicWeighted ? "weighted" : "flat"} onValueChange={(v) => setNewTopicWeighted(v === "weighted")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weighted">Ponderada (peso por miembre)</SelectItem>
                        <SelectItem value="flat">Simple (1 voto = 1)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {newTopicType === "candidato" && (
                  <div className="space-y-3 rounded-md border bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <Label>Opciones múltiples</Label>
                        <p className="text-xs text-muted-foreground">
                          {newTopicMultiVote
                            ? "Cada votante puede elegir varias opciones (máximo una vez cada una). Los votos no usados cuentan como abstención."
                            : "Cada votante elige une sole candidate."}
                        </p>
                      </div>
                      <Switch checked={newTopicMultiVote} onCheckedChange={setNewTopicMultiVote} />
                    </div>
                    {newTopicMultiVote && (
                      <div className="space-y-1">
                        <Label>Votos por votante</Label>
                        <Input type="number" min={1} value={newTopicVotesPerVoter} onChange={(e) => setNewTopicVotesPerVoter(e.target.value)} className="w-32" />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Candidates</Label>
                      {newTopicCandidates.map((c, i) => (
                        <div key={i} className="flex gap-2">
                          <Input
                            value={c}
                            onChange={(e) => setNewTopicCandidates((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                            placeholder={`Candidate ${i + 1}`}
                          />
                          <Button type="button" variant="ghost" size="icon" className="text-red-600 shrink-0" onClick={() => setNewTopicCandidates((prev) => prev.filter((_, j) => j !== i))} disabled={newTopicCandidates.length <= 1}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button type="button" variant="outline" size="sm" onClick={() => setNewTopicCandidates((prev) => [...prev, ""])}>
                        <Plus className="h-4 w-4 mr-2" /> Agregar candidate
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Habilitades (por división)</Label>
                  <p className="text-xs text-muted-foreground">Si no seleccionas ninguna, vota el pleno completo (todes les asistentes).</p>
                  <div className="flex flex-wrap gap-2">
                    {ESTAMENTO_OPTIONS.map((opt) => {
                      const active = newTopicEstamentos.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setNewTopicEstamentos((prev) => active ? prev.filter((n) => n !== opt.value) : [...prev, opt.value])}
                          className={`rounded-full border px-3 py-1 text-sm transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-gray-300 hover:bg-gray-100"}`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {newTopicWeighted && newTopicEstamentos.length > 0 && (
                  <div className="space-y-1">
                    <Label>Ponderación a usar</Label>
                    <p className="text-xs text-muted-foreground">Para votaciones por estamento puedes usar la ponderación alternativa de cada miembre.</p>
                    <Select value={newTopicWeightSource} onValueChange={(v) => setNewTopicWeightSource(v as "normal" | "alt")}>
                      <SelectTrigger className="sm:w-72"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Ponderación normal</SelectItem>
                        <SelectItem value="alt">Ponderación alternativa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Button type="submit" disabled={createTopic.isPending || !newTopicTitle}>Agregar tema</Button>
              </form>

              <div className="space-y-4">
                {topics?.map(topic => (
                  <Card key={topic.id} className="overflow-hidden border-primary/10">
                    <div className="p-4 flex items-start justify-between bg-gray-50/50">
                      <div>
                        <h3 className="font-semibold text-lg">{topic.title}</h3>
                        {topic.detail && (
                          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{topic.detail}</p>
                        )}
                        <div className="flex gap-2 items-center mt-1 flex-wrap">
                          <Badge variant={topic.status === "abierto" ? "default" : "secondary"}>
                            {topic.status === "abierto" ? "MOCIÓN ABIERTA" : "CERRADO"}
                          </Badge>
                          {topic.status === "cerrado" && (
                            <Badge variant="outline" className="bg-primary/5">
                              RESULTADOS FINALES
                            </Badge>
                          )}
                          {sortedAgenda.length > 0 && (
                            <Select
                              value={topic.agendaPointId ? String(topic.agendaPointId) : "none"}
                              onValueChange={(v) => {
                                updateTopic.mutate(
                                  { topicId: topic.id, data: { agendaPointId: v === "none" ? null : Number(v) } },
                                  { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTopicsQueryKey(id) }) },
                                );
                              }}
                            >
                              <SelectTrigger className="h-7 w-auto gap-1 text-xs"><SelectValue placeholder="Punto de tabla" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sin punto de tabla</SelectItem>
                                {sortedAgenda.map((p, i) => (
                                  <SelectItem key={p.id} value={String(p.id)}>{i + 1}. {p.title}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {topic.status === "abierto" ? (
                          <Button size="sm" variant="secondary" onClick={() => {
                            updateTopic.mutate({ topicId: topic.id, data: { status: "cerrado" } }, {
                              onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTopicsQueryKey(id) })
                            });
                          }}>Cerrar moción</Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => {
                            updateTopic.mutate({ topicId: topic.id, data: { status: "abierto" } }, {
                              onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTopicsQueryKey(id) })
                            });
                          }}>Reabrir</Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => {
                          if (confirm("¿Eliminar esta moción?")) {
                            deleteTopic.mutate({ topicId: topic.id }, {
                              onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTopicsQueryKey(id) })
                            });
                          }
                        }}>Borrar</Button>
                      </div>
                    </div>
                    <div className="p-4 pt-0">
                      <TopicResultsView topicId={topic.id} />
                      <div className="mt-4 border-t pt-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => setOpenBallots((prev) => ({ ...prev, [topic.id]: !prev[topic.id] }))}
                        >
                          <Users className="h-3.5 w-3.5 mr-1" />
                          {openBallots[topic.id] ? "Ocultar detalle por miembre" : "Ver detalle por miembre"}
                        </Button>
                        {openBallots[topic.id] && (
                          <div className="mt-3">
                            <TopicBallotsPanel
                              topicId={topic.id}
                              sessionId={id}
                              allowCheckout
                              live
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
                {topics?.length === 0 && <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">No hay mociones propuestas en esta sesión.</div>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-center">{session.title}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-6 py-4">
            <div className="bg-white p-4 rounded-xl border shadow-sm w-full max-w-[min(80vw,80vh)] [&>svg]:w-full [&>svg]:h-auto">
              <QRCodeSVG value={session.sessionCode} size={512} />
            </div>
            <div className="text-center">
              <div className="text-5xl sm:text-6xl font-bold tracking-[0.3em]">{session.sessionCode}</div>
              <div className="text-muted-foreground mt-2">Escanea el código o ingresa el código de sesión</div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Sesión</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSave} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="edit-title">Título</Label>
              <Input id="edit-title" value={editTitle} onChange={e => setEditTitle(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-location">Lugar</Label>
              <Input id="edit-location" value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="Ej: Casa Central" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-scheduledAt">Fecha y hora</Label>
              <Input id="edit-scheduledAt" type="datetime-local" value={editScheduledAt} onChange={e => setEditScheduledAt(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-meetingLink">Enlace de la sesión</Label>
              <Input id="edit-meetingLink" type="url" value={editMeetingLink} onChange={e => setEditMeetingLink(e.target.value)} placeholder="https://meet.google.com/... (visible para todo el pleno)" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={updateSession.isPending || !editTitle}>Guardar Cambios</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <EditVotesDialog
        sessionId={id}
        topics={topics ?? []}
        open={votesEditOpen}
        onOpenChange={setVotesEditOpen}
      />

      <Dialog open={attendanceOpen} onOpenChange={setAttendanceOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Asistencia</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 pb-2">
            <Input
              placeholder="Buscar por nombre o grupo…"
              value={attSearch}
              onChange={(e) => setAttSearch(e.target.value)}
              className="h-8 text-sm"
            />
            <Select value={attSort} onValueChange={(v) => setAttSort(v as "nombre" | "grupo")}>
              <SelectTrigger className="h-8 w-32 text-xs shrink-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nombre">Nombre</SelectItem>
                <SelectItem value="grupo">Grupo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-4">
            <div>
              <div className="text-sm font-medium mb-2">Presentes</div>
              {(filterSortAtt(attendance?.present ?? []).length ?? 0) === 0 ? (
                <div className="text-sm text-muted-foreground">Nadie presente.</div>
              ) : (
                <ul className="space-y-1.5">
                  {filterSortAtt(attendance?.present ?? []).map((m) => (
                    <li key={m.userId} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 truncate">{m.displayName}</span>
                      <Select value={m.modality} onValueChange={(v) => setMemberPresence(m.userId, true, v as "online" | "presencial")}>
                        <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="presencial">Presencial</SelectItem>
                          <SelectItem value="online">Online</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" className="h-7 text-red-600 hover:text-red-700" onClick={() => setMemberPresence(m.userId, false)}>
                        Ausente
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {(attendance?.checkedOut.length ?? 0) > 0 && (
              <div className="border-t pt-3">
                <div className="text-sm font-medium mb-2 text-muted-foreground">Retirados</div>
                <ul className="space-y-1.5">
                  {filterSortAtt(attendance?.checkedOut ?? []).map((m) => (
                    <li key={m.userId} className="flex items-center gap-2 text-sm">
                      <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="flex-1 truncate line-through text-muted-foreground">{m.displayName}</span>
                      <Button size="sm" variant="outline" className="h-7" onClick={() => setMemberPresence(m.userId, true, m.modality)}>
                        Reactivar
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="border-t pt-3">
              <div className="text-sm font-medium mb-2">Ausentes</div>
              {(filterSortAtt(attendance?.absent ?? []).length ?? 0) === 0 ? (
                <div className="text-sm text-muted-foreground">Todos asistieron.</div>
              ) : (
                <ul className="space-y-1.5">
                  {filterSortAtt(attendance?.absent ?? []).map((m) => {
                    const isJustified = attendance?.justifiedIds?.includes(m.id) ?? false;
                    return (
                      <li key={m.id} className="flex items-center gap-2 text-sm">
                        <span className="flex-1 truncate">
                          {m.displayName}
                          {isJustified && (
                            <span className="ml-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                              Inasistencia Justificada
                            </span>
                          )}
                        </span>
                        <Button size="sm" variant="outline" className="h-7" onClick={() => setMemberPresence(m.id, true, "presencial")}>
                          <MapPin className="h-3.5 w-3.5 mr-1" /> Presencial
                        </Button>
                        <Button size="sm" variant="outline" className="h-7" onClick={() => setMemberPresence(m.id, true, "online")}>
                          <Wifi className="h-3.5 w-3.5 mr-1" /> Online
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={`h-7 text-xs ${isJustified ? "text-amber-700 hover:text-amber-800" : "text-muted-foreground"}`}
                          title="Marcar la ausencia como Inasistencia Justificada (sigue sin contar para quórum ni votos)"
                          onClick={() => setMemberPresence(m.id, false, undefined, !isJustified)}
                        >
                          {isJustified ? "Quitar justificación" : "Justificar"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
