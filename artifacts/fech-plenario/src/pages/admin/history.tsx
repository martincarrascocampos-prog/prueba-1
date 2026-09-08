import { useGetSessionsHistory, getGetSessionsHistoryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ResultsBar, CandidateResultsBar } from "@/components/results-bar";
import { SessionResources } from "@/components/session-resources";
import { TopicBallotsPanel } from "@/components/topic-ballots-panel";
import { RefreshCw, MapPin, Clock, Users } from "lucide-react";
import { useState } from "react";
import type { AdminHistoryTopic } from "@workspace/api-client-react";

function HistoryTopicCard({ topic: t }: { topic: AdminHistoryTopic }) {
  const [showBallots, setShowBallots] = useState(false);
  return (
    <Card className="p-4 border-primary/10">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="font-medium">{t.title}</div>
        <div className="flex gap-2 items-center">
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
      {t.type === "candidato" ? (
        <CandidateResultsBar candidates={t.candidates ?? []} />
      ) : (
        <ResultsBar percentages={t.percentages} weights={t.weights} />
      )}
      <div className="mt-3 border-t pt-2">
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setShowBallots((v) => !v)}>
          <Users className="h-3.5 w-3.5 mr-1" />
          {showBallots ? "Ocultar detalle por miembre" : "Ver detalle por miembre"}
        </Button>
        {showBallots && (
          <div className="mt-3">
            <TopicBallotsPanel topicId={t.topicId} enabled={showBallots} />
          </div>
        )}
      </div>
    </Card>
  );
}

export default function AdminHistory() {
  const { data: history, isLoading, isFetching, refetch } = useGetSessionsHistory({
    query: { refetchInterval: 30000, queryKey: getGetSessionsHistoryQueryKey() },
  });
  const queryClient = useQueryClient();

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Histórico de Sesiones</h1>
            <p className="text-muted-foreground text-sm mt-1">Todas las sesiones con sus mociones y resultados ponderados.</p>
          </div>
          <Button variant="outline" size="sm" disabled={isFetching} onClick={() => {
            queryClient.invalidateQueries({ queryKey: getGetSessionsHistoryQueryKey() });
            refetch();
          }}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>

        {isLoading ? (
          <div className="p-12 flex justify-center"><Spinner /></div>
        ) : !history || history.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground bg-white rounded-lg border">
            No hay sesiones registradas.
          </div>
        ) : (
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
                        <span>{s.presentCount}/{s.totalMembers} presentes</span>
                      </div>
                    </div>
                    <Badge variant={s.status === "abierta" ? "default" : "secondary"} className="shrink-0">
                      {s.status.toUpperCase()}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pb-2">
                    <SessionResources meetingLink={s.meetingLink} actaObjectPath={s.actaObjectPath} actaFileName={s.actaFileName} />
                    <div className="text-xs text-muted-foreground space-y-1 border-b pb-3">
                      <div className="flex justify-between">
                        <span>Ponderación presente:</span>
                        <span className="font-semibold text-foreground">{s.presentWeight.toFixed(2)} / {s.totalWeight.toFixed(2)}</span>
                      </div>
                      <Progress value={s.totalWeight > 0 ? (s.presentWeight / s.totalWeight) * 100 : 0} className="h-2" />
                    </div>
                    {s.topics.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-2">Esta sesión no tuvo mociones.</div>
                    ) : (
                      s.topics.map((t) => (
                        <HistoryTopicCard key={t.topicId} topic={t} />
                      ))
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </AppLayout>
  );
}
