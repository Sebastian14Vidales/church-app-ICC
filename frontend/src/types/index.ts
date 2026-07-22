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
//
// CONTRACT NOTE (api-contract-engineer, ADR-0001 §D10):
// These legacy schemas `CourseAssignedStatus` (note: includes `cancelled`) and
// `CourseAssignedSchema` are kept to avoid breaking existing code during the
// EPC-COURSES-001 refactor (HU-02 / HU-08 implementation). The `frontend-engineer`
// will replace usages with the canonical `courseAssignedStatusSchema` and
// `courseAssignedSchema` below, then delete this block as part of the cleanup
// step performed by the `quality-engineer`. Do NOT add new usages of these
// legacy exports.
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

// ============================================================================
// cursos-api formal contract (EPC-COURSES-001, ADR-0001 §D10)
// Source of truth: docs/api/courses-api.md. Do not deviate here.
// The frontend-engineer materializes these; new views MUST use these schemas.
// ============================================================================

/** Enum de estado de una CourseAssigned. Sin `cancelled` (ADR §D2, AC2.3). */
export const courseAssignedStatusSchema = z.enum(["active", "completed"]);
export type CourseAssignedStatusValue = z.infer<typeof courseAssignedStatusSchema>;

/**
 * Helper genérico de envoltura paginada. Contrato:
 * `{ items: T[], total: number, page: number, limit: number }`.
 */
export const paginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
    z.object({
        items: z.array(itemSchema),
        total: z.number().int().nonnegative(),
        page: z.number().int().positive(),
        limit: z.number().int().positive(),
    });

/** Course del catálogo con sus timestamps. Forma pública del backend (§1.1). */
export const courseCatalogSchema = z.object({
    _id: z.string(),
    name: z.string(),
    description: z.string(),
    level: courseLevelSchema,
    isActive: z.boolean().default(true),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
});
export type CourseCatalog = z.infer<typeof courseCatalogSchema>;

export const paginatedCoursesSchema = paginatedResponseSchema(courseCatalogSchema);
export type PaginatedCourses = z.infer<typeof paginatedCoursesSchema>;

/**
 * `CourseAssigned` canónica (§5.2). Reemplaza a `assignedCourseSchema` una vez
 * el `frontend-engineer` haya migrado los usos. Incluye `endedAt` y `deletedAt`
 * opcionales/nullable (ADR §D3, §D6).
 */
export const courseAssignedCanonicalSchema = z.object({
    _id: z.string(),
    course: courseCatalogSchema,
    professor: courseParticipantSchema,
    members: z.array(courseParticipantSchema).default([]),
    startDate: z.string().datetime(),
    startTime: z.string(),
    totalClasses: z.number().int().nonnegative(),
    endDate: z.string().datetime(),
    endedAt: z.string().datetime().nullable().default(null),
    location: z.string(),
    status: courseAssignedStatusSchema,
    deletedAt: z.string().datetime().nullable().default(null),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
});
export type CourseAssignedCanonical = z.infer<typeof courseAssignedCanonicalSchema>;

export const courseAssignedArraySchema = z.array(courseAssignedCanonicalSchema);
export const paginatedCourseAssignedSchema =
    paginatedResponseSchema(courseAssignedCanonicalSchema);
export type PaginatedCourseAssignments = z.infer<typeof paginatedCourseAssignedSchema>;

/** Sub-schema de asistencia consolidada en el detalle de historial (§5.3). */
export const courseAssignedHistoryAttendanceSchema = z.object({
    member: courseParticipantSchema,
    present: z.boolean(),
    notes: z.string().default(""),
});

/** Sub-schema de sesión consolidada en el detalle de historial (§5.3). */
export const courseAssignedHistorySessionSchema = z.object({
    classNumber: z.number().int().positive(),
    date: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
    topic: z.string().default(""),
    observations: z.string().default(""),
    attendance: z.array(courseAssignedHistoryAttendanceSchema).default([]),
});

/** Variante con `sessions` consolidadas para el detalle de historial (§2.4, §5.3). */
export const courseAssignedHistoryItemSchema = courseAssignedCanonicalSchema.extend({
    sessions: z.array(courseAssignedHistorySessionSchema),
});
export type CourseAssignedHistoryItem = z.infer<typeof courseAssignedHistoryItemSchema>;

/** Query params de `GET /api/courses/assignments/history` (§5.4). */
export const courseAssignmentHistoryQuerySchema = z.object({
    professor: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    location: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type CourseAssignmentHistoryQuery = z.infer<typeof courseAssignmentHistoryQuerySchema>;

/** Query params de `GET /api/courses` (§5.4). */
export const courseListQuerySchema = z.object({
    name: z.string().optional(),
    level: courseLevelSchema.optional(),
    isActive: z.coerce.boolean().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type CourseListQuery = z.infer<typeof courseListQuerySchema>;

/** Query params de `GET /api/courses/assignments` (§5.4). */
export const courseAssignmentListQuerySchema = z.object({
    status: z.enum(["active", "completed"]).optional().default("active"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type CourseAssignmentListQuery = z.infer<typeof courseAssignmentListQuerySchema>;

/** Body de `POST /api/courses/assignments` y base para `PUT` (§5.5). */
export const courseAssignmentCreateBodySchema = z.object({
    course: z.string().regex(/^[0-9a-fA-F]{24}$/),
    professor: z.string().regex(/^[0-9a-fA-F]{24}$/),
    startDate: z.string(),
    startTime: z.string().min(1),
    totalClasses: z.number().int().min(1),
    location: z.string().min(1),
    status: courseAssignedStatusSchema.optional().default("active"),
});
export type CourseAssignmentCreateBody = z.infer<typeof courseAssignmentCreateBodySchema>;

export const courseAssignmentUpdateBodySchema = courseAssignmentCreateBodySchema.partial();
export type CourseAssignmentUpdateBody = z.infer<typeof courseAssignmentUpdateBodySchema>;

/** Body de `POST /api/courses/assignments/:id/reopen` (§5.5). */
export const reopenAssignmentBodySchema = z.object({
    totalClasses: z.number().int().min(1).optional(),
});
export type ReopenAssignmentBody = z.infer<typeof reopenAssignmentBodySchema>;

/** Body de `PUT /api/courses/my-attendance/classes/:classNumber` (§5.5). */
export const saveAttendanceBodySchema = z.object({
    attendance: z.array(z.object({
        studentId: z.string().regex(/^[0-9a-fA-F]{24}$/),
        present: z.boolean(),
        notes: z.string().optional(),
    })),
    topic: z.string().optional(),
    observations: z.string().optional(),
});
export type SaveAttendanceBody = z.infer<typeof saveAttendanceBodySchema>;

/** Body de `POST /api/courses/assignments/:id/members` (§5.5). */
export const assignmentMembersBodySchema = z.object({
    memberIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)),
});
export type AssignmentMembersBody = z.infer<typeof assignmentMembersBodySchema>;

/** Respuesta envuelta de mutación de asignación con `assignment` (§5.6). */
export const assignmentMutationResponseSchema = z.object({
    message: z.string(),
    assignment: courseAssignedCanonicalSchema,
});
export type AssignmentMutationResponse = z.infer<typeof assignmentMutationResponseSchema>;

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

export const encounterStageSchema = z.enum([
    "Ninguno",
    "Encuentro",
    "Reencuentro",
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
    encounterStage: encounterStageSchema.optional(),
    profession: z.string().optional().nullable(),
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
export type EncounterStage = z.infer<typeof encounterStageSchema>
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
    encounterStage: EncounterStage | ""
    roleNames: MemberRoleName[]
    profession?: string
    email?: string
}
