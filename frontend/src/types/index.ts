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
    startDate: z.string(),
    startTime: z.string(),
    totalClasses: z.number(),
    endDate: z.string(),
    location: z.string(),
    status: CourseAssignedStatus
});

export type CourseAssignedFormData = z.infer<typeof CourseAssignedSchema>

// Roles
export const memberRoleSchema = z.enum([
    "Asistente",
    "Miembro",
    "Profesor",
    "Pastor",
    "Supervisor",
    "Admin",
    "Superadmin",
])

export const roleSchema = z.object({
    _id: z.string(),
    name: memberRoleSchema,
})

export const rolesSchema = z.array(roleSchema)

export type Role = z.infer<typeof roleSchema>

// Members
export const ministrySchema = z.enum([
    "Ministerio de Alabanza",
    "Ministerio de Danza (Niñas entre 7 y 14 años)",
    "Ministerio de Jóvenes",
    "Ministerio de Servidores",
    "Ministerio de Oración e Intercesión",
    "Ministerio de Hombres",
    "Ministerio de Mujeres",
    "Ministerio de Parejas y Familias",
    "Ministerio Iglesia Infantil",
    "Ministerio de Evangelismo y Consolidación G.V.E",
])

export const spiritualGrowthStageSchema = z.enum([
    "Consolidación",
    "Discipulado básico",
    "Carácter cristiano",
    "Sanidad y propósito",
    "Cosmovisión bíblica",
    "Doctrina cristiana",
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
    baptized: z.boolean().optional(),
    servesInMinistry: z.boolean().optional(),
    ministry: ministrySchema.optional().nullable(),
    ministryInterest: ministrySchema.optional().nullable(),
    spiritualGrowthStage: spiritualGrowthStageSchema.optional(),
    role: roleSchema,
    user: z.object({
        _id: z.string(),
        email: z.string().email(),
        name: z.string(),
        confirmed: z.boolean().optional(),
        active: z.boolean().optional(),
        roles: z.array(roleSchema).optional().default([]),
    }).nullable().default(null),
})

export const membersSchema = z.array(memberSchema)

export const courseParticipantSchema = memberSchema.pick({
    _id: true,
    firstName: true,
    lastName: true,
    documentID: true,
    birthdate: true,
    neighborhood: true,
    phoneNumber: true,
    bloodType: true,
    baptized: true,
    servesInMinistry: true,
    ministry: true,
    ministryInterest: true,
    spiritualGrowthStage: true,
    role: true,
    user: true,
})

export const courseParticipantsSchema = z.array(courseParticipantSchema)

export const assignedCourseSchema = z.object({
    _id: z.string(),
    course: createCourseSchema,
    professor: courseParticipantSchema,
    members: courseParticipantsSchema.default([]),
    startDate: z.string(),
    startTime: z.string(),
    totalClasses: z.number(),
    endDate: z.string(),
    location: z.string(),
    status: CourseAssignedStatus,
})

export const assignedCoursesSchema = z.array(assignedCourseSchema)
export type CourseAssigned = z.infer<typeof assignedCourseSchema>

export const classAttendanceSchema = z.object({
    student: courseParticipantSchema,
    present: z.boolean(),
    notes: z.string().default(""),
})

export const classSessionSchema = z.object({
    _id: z.string().nullable().default(null),
    classNumber: z.number(),
    date: z.string(),
    topic: z.string().default(""),
    observations: z.string().default(""),
    attendance: z.array(classAttendanceSchema).default([]),
})

export const classSessionsSchema = z.array(classSessionSchema)

export const attendanceOverviewSchema = z.object({
    assignment: assignedCourseSchema.nullable(),
    sessions: classSessionsSchema,
})

export const createMemberResponseSchema = z.object({
    message: z.string(),
    profile: memberSchema,
    accessUserCreated: z.boolean(),
    confirmationEmailSent: z.boolean().optional(),
})

export const messageResponseSchema = z.object({
    message: z.string(),
})

export const lifeGroupSchema = z.object({
    _id: z.string(),
    name: z.string(),
    neighborhood: z.string(),
    address: z.string(),
    supervisor: memberSchema.pick({
        _id: true,
        firstName: true,
        lastName: true,
        documentID: true,
        birthdate: true,
        neighborhood: true,
        phoneNumber: true,
        bloodType: true,
        baptized: true,
        servesInMinistry: true,
        ministry: true,
        ministryInterest: true,
        spiritualGrowthStage: true,
        role: true,
        user: true,
    }),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
})

export const lifeGroupsSchema = z.array(lifeGroupSchema)

export const createLifeGroupResponseSchema = z.object({
    message: z.string(),
    lifeGroup: lifeGroupSchema,
})

export const authUserSchema = z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string(),
    roles: z.array(memberRoleSchema),
    profileId: z.string().nullable(),
})

export const loginResponseSchema = z.object({
    message: z.string(),
    token: z.string(),
    user: authUserSchema,
})

export const currentSessionResponseSchema = z.object({
    user: authUserSchema,
})

export type Member = z.infer<typeof memberSchema>
export type ClassAttendance = z.infer<typeof classAttendanceSchema>
export type ClassSession = z.infer<typeof classSessionSchema>
export type AttendanceOverview = z.infer<typeof attendanceOverviewSchema>
export type CreateMemberResponse = z.infer<typeof createMemberResponseSchema>
export type AuthUser = z.infer<typeof authUserSchema>
export type MemberRoleName = z.infer<typeof memberRoleSchema>
export type MinistryName = z.infer<typeof ministrySchema>
export type SpiritualGrowthStage = z.infer<typeof spiritualGrowthStageSchema>
export type LifeGroup = z.infer<typeof lifeGroupSchema>
export type LifeGroupFormData = {
    name: string
    neighborhood: string
    address: string
}
export type MemberFormData = {
    firstName: string
    lastName: string
    documentID: string
    birthdate: string
    neighborhood: string
    phoneNumber: string
    bloodType: string
    baptized: "true" | "false" | ""
    servesInMinistry: "true" | "false" | ""
    ministry: MinistryName | ""
    ministryInterest: MinistryName | ""
    spiritualGrowthStage: SpiritualGrowthStage | ""
    roleNames: MemberRoleName[]
    email?: string
}
