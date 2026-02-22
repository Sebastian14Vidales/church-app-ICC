import z from "zod"

//Courses
export const courseLevelSchema = z.enum(["basic", "intermediate", "advanced"])
export type CourseLevel = z.infer<typeof courseLevelSchema>

export const createCourseSchema = z.object({
    _id: z.string(),
    name: z.string(),
    description: z.string(),
    level: courseLevelSchema
})

export const dashboardCourseSchema = z.array(createCourseSchema)

export type Course = z.infer<typeof createCourseSchema>
export type CourseFormData = Omit<Course, "_id">


//CourseAssigned
export const CourseAssignedStatus = z.enum(["active", "completed", "cancelled"]);
export type CourseAssignedStatus = z.infer<typeof CourseAssignedStatus>;

export const CourseAssignedSchema = z.object({
    course: z.string(),
    professor: z.string(), 
    startDate: z.date(),
    startTime: z.string(),
    totalClasses: z.number(),
    endDate: z.date().optional(),
    location: z.string(),
    status: CourseAssignedStatus
});

export type CourseAssignedFormData = z.infer<typeof CourseAssignedSchema>


