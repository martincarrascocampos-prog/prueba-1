import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const unidadesAcademicasTable = pgTable("unidades_academicas", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUnidadAcademicaSchema = createInsertSchema(unidadesAcademicasTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUnidadAcademica = z.infer<typeof insertUnidadAcademicaSchema>;
export type UnidadAcademica = typeof unidadesAcademicasTable.$inferSelect;
