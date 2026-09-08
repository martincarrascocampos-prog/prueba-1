import { pgTable, text, serial, timestamp, boolean, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sessionStatusEnum = pgEnum("session_status", ["abierta", "cerrada"]);

export const plenariasTable = pgTable("plenarias", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  location: text("location"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  status: sessionStatusEnum("status").notNull().default("cerrada"),
  sessionCode: text("session_code").notNull().unique(),
  meetingLink: text("meeting_link"),
  actaObjectPath: text("acta_object_path"),
  actaFileName: text("acta_file_name"),
  speakingRoundOpen: boolean("speaking_round_open").notNull().default(false),
  speakingRoundAgendaPointId: integer("speaking_round_agenda_point_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPlenariaSchema = createInsertSchema(plenariasTable).omit({ id: true, createdAt: true });
export type InsertPlenaria = z.infer<typeof insertPlenariaSchema>;
export type Plenaria = typeof plenariasTable.$inferSelect;
