import api from "@/lib/axios";
import { z } from "zod";

export const sermonSchema = z.object({
  _id: z.string(),
  title: z.string(),
  date: z.string(),
  time: z.string(),
  pastor: z.object({
    _id: z.string(),
    name: z.string(),
    email: z.string(),
  }),
  description: z.string().optional(),
});

export const createSermonSchema = z.object({
  title: z.string(),
  date: z.string(),
  time: z.string(),
  pastor: z.string(),
  description: z.string().optional(),
});

export type Sermon = z.infer<typeof sermonSchema>;
export type CreateSermonData = z.infer<typeof createSermonSchema>;

export const getAllSermons = async (): Promise<Sermon[]> => {
  const { data } = await api.get("/sermons");
  return data;
};

export const getSermonsByPastor = async (pastorId: string): Promise<Sermon[]> => {
  const { data } = await api.get(`/sermons/pastor/${pastorId}`);
  return data;
};

export const createSermon = async (sermonData: CreateSermonData): Promise<Sermon> => {
  const { data } = await api.post("/sermons", sermonData);
  return data.sermon;
};

export const updateSermon = async (id: string, updates: Partial<CreateSermonData>): Promise<Sermon> => {
  const { data } = await api.put(`/sermons/${id}`, updates);
  return data.sermon;
};

export const deleteSermon = async (id: string): Promise<void> => {
  await api.delete(`/sermons/${id}`);
};