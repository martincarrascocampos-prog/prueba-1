import { useGetMyVotes, useGetMyAttendance, useGetMyHistory } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ResultsBar, CandidateResultsBar, MyVoteBadge } from "@/components/results-bar";
import { SessionResources } from "@/components/session-resources";
import { CheckCircle2, XCircle, MapPin, Clock } from "lucide-react";

function HistoricoTab() {
  const { data: history, isLoading } = useGetMyHistory();

  if (isLoading) {
    return <div className="p-12 flex justify-center"><Spinner /></div>;
  }
  if (!history || history.length === 0) {
    return (
      <div className="p-12 text-center text-muted-foreground bg-white rounded-lg border">
        Aún no hay sesiones registradas.
      </div>
    );
  }

  return (
    <Accordion type="multiple" className="space-y-3">
      {history.map((s) => (
        <AccordionItem key={s.sessionId} value={String(s.sessionId)} className="border rounded-lg bg-white px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex flex-1 items-center justify-between gap-3 pr-3 text-left">
              <div>
                <div className="font-semibold text-gray-900">{s.title}</div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                  {s.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.location}</span>}
                  {s.scheduledAt && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(s.scheduledAt).toLocaleString()}</span>}
                  <span>{s.topics.length} moción(es)</span>
                </div>
              </div>
              {s.attended ? (
                <Badge variant="outline" className="bg-lime-50 text-lime-700 border-lime-200 shrink-0">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Asististe
                </Badge>
              ) : s.justified ? (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 shrink-0">
                  <XCircle className="w-3 h-3 mr-1" /> Inasistencia Justificada
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 shrink-0">
                  <XCircle className="w-3 h-3 mr-1" /> Ausente
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pb-2">
              <SessionResources meetingLink={s.meetingLink} actaObjectPath={s.actaObjectPath} actaFileName={s.actaFileName} />
              {s.topics.length === 0 ? (
                <div className="text-sm text-muted-foreground py-2">Esta sesión no tuvo mociones.</div>
              ) : (
                s.topics.map((t) => (
                  <Card key={t.topicId} className="p-4 border-primary/10">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="font-medium">{t.title}</div>
                        <div className="flex gap-2 items-center mt-1">
                          <Badge variant={t.status === "abierto" ? "default" : "secondary"} className="text-[10px]">
                            {t.status === "abierto" ? "ABIERTA" : "CERRADA"}
                          </Badge>
                          {t.approved !== null && (
                            <Badge variant="outline" className={t.approved ? "bg-lime-50 text-lime-700 border-lime-200 text-[10px]" : "bg-red-50 text-red-700 border-red-200 text-[10px]"}>
                              {t.approved ? "APROBADO" : "RECHAZADO"}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-muted-foreground uppercase">Mi voto</div>
                        <div className="mt-1"><MyVoteBadge myVote={t.myVote} attended={s.attended} /></div>
                      </div>
                    </div>
                    {/* Qué se sometió a votación: sin el detalle, el histórico
                        deja solo el título y se pierde el contenido de la moción. */}
                    {t.detail && (
                      <div className="mb-3 rounded-r-lg border-l-[3px] border-primary/60 bg-muted/40 px-3 py-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">
                          Detalle de la moción
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{t.detail}</p>
                      </div>
                    )}
                    {t.type === "candidato" ? (
                      <CandidateResultsBar candidates={t.candidates ?? []} />
                    ) : (
                      <ResultsBar percentages={t.percentages} weights={t.weights} />
                    )}
                  </Card>
                ))
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export default function MemberHistory() {
  const { data: votes, isLoading } = useGetMyVotes();
  const { data: attendance, isLoading: attendanceLoading } = useGetMyAttendance();

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Mi Historial</h1>

        <Tabs defaultValue="historico">
          <TabsList>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="votes">Mis Votos</TabsTrigger>
            <TabsTrigger value="attendance">Asistencias</TabsTrigger>
          </TabsList>

          <TabsContent value="historico">
            <HistoricoTab />
          </TabsContent>

          <TabsContent value="votes">
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              {isLoading ? (
                <div className="p-12 flex justify-center"><Spinner /></div>
              ) : votes && votes.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Sesión</TableHead>
                      <TableHead>Tema</TableHead>
                      <TableHead>Ponderación</TableHead>
                      <TableHead>Mi Voto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {votes.map((vote, i) => (
                      <TableRow key={i}>
                        <TableCell className="whitespace-nowrap">{new Date(vote.timestamp).toLocaleDateString()} {new Date(vote.timestamp).toLocaleTimeString()}</TableCell>
                        <TableCell className="text-muted-foreground">{vote.sessionTitle}</TableCell>
                        <TableCell className="font-medium">{vote.topicTitle}</TableCell>
                        <TableCell>{vote.weightAtVote}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              vote.option === "favor" ? "bg-lime-50 text-lime-700 border-lime-200" :
                              vote.option === "contra" ? "bg-red-50 text-red-700 border-red-200" :
                              "bg-yellow-50 text-yellow-700 border-yellow-200"
                            }
                          >
                            {vote.option.toUpperCase()}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-12 text-center text-muted-foreground">
                  Aún no has emitido ningún voto.
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="attendance">
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              {attendanceLoading ? (
                <div className="p-12 flex justify-center"><Spinner /></div>
              ) : attendance && attendance.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha de registro</TableHead>
                      <TableHead>Sesión</TableHead>
                      <TableHead>Lugar</TableHead>
                      <TableHead>Hora programada</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.map((a, i) => (
                      <TableRow key={i}>
                        <TableCell className="whitespace-nowrap">{new Date(a.timestamp).toLocaleDateString()} {new Date(a.timestamp).toLocaleTimeString()}</TableCell>
                        <TableCell className="font-medium">{a.sessionTitle}</TableCell>
                        <TableCell className="text-muted-foreground">{a.location || "—"}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">{a.scheduledAt ? new Date(a.scheduledAt).toLocaleString() : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-12 text-center text-muted-foreground">
                  Aún no tienes asistencias registradas.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
