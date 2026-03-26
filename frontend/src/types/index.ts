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

// Roles
export const roleSchema = z.object({
    _id: z.string(),
    name: z.string(),
})

export const rolesSchema = z.array(roleSchema)

export type Role = z.infer<typeof roleSchema>

// Members
export const memberRoleSchema = z.enum([
    "Estudiante",
    "Miembro",
    "Profesor",
    "Pastor",
    "Admin",
    "Superadmin",
])

export const memberSchema = z.object({
    _id: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    documentID: z.string(),
    birthdate: z.string(),
    neighborhood: z.string(),
    phoneNumber: z.string(),
    bloodType: z.string(),
    role: roleSchema,
    user: z.object({
        _id: z.string(),
        email: z.string().email(),
        name: z.string(),
        confirmed: z.boolean().optional(),
        active: z.boolean().optional(),
    }).nullable().optional(),
})

export const membersSchema = z.array(memberSchema)

export const createMemberResponseSchema = z.object({
    message: z.string(),
    profile: memberSchema,
    accessUserCreated: z.boolean(),
    temporaryPassword: z.string().optional(),
})

export type Member = z.infer<typeof memberSchema>
export type CreateMemberResponse = z.infer<typeof createMemberResponseSchema>
export type MemberRoleName = z.infer<typeof memberRoleSchema>
export type MemberFormData = {
    firstName: string
    lastName: string
    documentID: string
    birthdate: string
    neighborhood: string
    phoneNumber: string
    bloodType: string
    roleName: MemberRoleName | ""
    email?: string
    password?: string
}

