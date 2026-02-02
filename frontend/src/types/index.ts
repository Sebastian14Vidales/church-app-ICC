import z from "zod"

// courses
export const courseLevelSchema = z.enum(["basic", "intermediate", "advanced"])
export type CourseLevel = z.infer<typeof courseLevelSchema>

export const createCourseSchema = z.object({
    _id: z.string(),
    name: z.string(),
    description: z.string(),
    level: courseLevelSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
})

export type Course = z.infer<typeof createCourseSchema>
export type CourseFormData = Pick<Course, "name" | "description" | "level">