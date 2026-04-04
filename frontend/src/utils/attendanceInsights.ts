import { type ClassSession, type CourseAssigned, type Member } from "@/types/index"
import { formatFullName } from "@/utils/text"

export type StudentSessionStatus = {
    classNumber: number
    date: string
    isRecorded: boolean
    present: boolean | null
}

export type StudentAttendanceSummary = {
    member: Member
    statuses: StudentSessionStatus[]
    presentCount: number
    absentCount: number
    attendanceRate: number
    lastRecordedStatus: boolean | null
}

export type CourseAttendanceMetrics = {
    totalStudents: number
    totalClasses: number
    recordedClasses: number
    remainingClasses: number
    progressRate: number
    averageAttendanceRate: number
    totalAttendances: number
    totalAbsences: number
    atRiskStudentsCount: number
    perfectAttendanceCount: number
    nextPendingClass: ClassSession | null
}

const getAttendanceEntryForMember = (session: ClassSession, memberId: string) =>
    session.attendance.find((entry) => entry.student._id === memberId)

export const buildStudentAttendanceSummaries = (
    assignment: CourseAssigned,
    sessions: ClassSession[],
): StudentAttendanceSummary[] => {
    const recordedSessions = sessions.filter((session) => Boolean(session._id))
    const totalRecordedSessions = recordedSessions.length

    return [...assignment.members]
        .map((member) => {
            const statuses = sessions.map((session) => {
                const attendanceEntry = getAttendanceEntryForMember(session, member._id)

                return {
                    classNumber: session.classNumber,
                    date: session.date,
                    isRecorded: Boolean(session._id),
                    present: attendanceEntry?.present ?? null,
                }
            })

            const recordedStatuses = statuses.filter((status) => status.isRecorded)
            const presentCount = recordedStatuses.filter((status) => status.present === true).length
            const absentCount = recordedStatuses.filter((status) => status.present === false).length
            const lastRecordedStatus =
                [...recordedStatuses].reverse().find((status) => status.present !== null)?.present ?? null

            return {
                member,
                statuses,
                presentCount,
                absentCount,
                attendanceRate: totalRecordedSessions
                    ? Math.round((presentCount / totalRecordedSessions) * 100)
                    : 0,
                lastRecordedStatus,
            }
        })
        .sort((left, right) => {
            if (right.absentCount !== left.absentCount) {
                return right.absentCount - left.absentCount
            }

            if (left.attendanceRate !== right.attendanceRate) {
                return left.attendanceRate - right.attendanceRate
            }

            return formatFullName(left.member.firstName, left.member.lastName).localeCompare(
                formatFullName(right.member.firstName, right.member.lastName),
                "es-CO",
            )
        })
}

export const buildCourseAttendanceMetrics = (
    assignment: CourseAssigned,
    sessions: ClassSession[],
    studentSummaries: StudentAttendanceSummary[],
): CourseAttendanceMetrics => {
    const recordedSessions = sessions.filter((session) => Boolean(session._id))
    const totalStudents = assignment.members.length
    const recordedClasses = recordedSessions.length
    const totalClasses = assignment.totalClasses
    const totalAttendances = recordedSessions.reduce(
        (total, session) => total + session.attendance.filter((entry) => entry.present).length,
        0,
    )
    const totalAbsences = recordedSessions.reduce(
        (total, session) => total + session.attendance.filter((entry) => !entry.present).length,
        0,
    )
    const averageAttendanceRate = recordedClasses && totalStudents
        ? Math.round((totalAttendances / (recordedClasses * totalStudents)) * 100)
        : 0

    return {
        totalStudents,
        totalClasses,
        recordedClasses,
        remainingClasses: Math.max(totalClasses - recordedClasses, 0),
        progressRate: totalClasses ? Math.round((recordedClasses / totalClasses) * 100) : 0,
        averageAttendanceRate,
        totalAttendances,
        totalAbsences,
        atRiskStudentsCount: studentSummaries.filter(
            (summary) => recordedClasses > 0 && summary.attendanceRate < 70,
        ).length,
        perfectAttendanceCount: studentSummaries.filter(
            (summary) => recordedClasses > 0 && summary.attendanceRate === 100,
        ).length,
        nextPendingClass: sessions.find((session) => !session._id) ?? null,
    }
}
