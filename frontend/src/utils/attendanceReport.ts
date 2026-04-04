import { type ClassSession, type CourseAssigned } from "@/types/index"
import { formatFullName } from "@/utils/text"

type AttendanceReportParams = {
    assignment: CourseAssigned
    sessions: ClassSession[]
}

const PDF_PAGE_WIDTH = 612
const PDF_PAGE_HEIGHT = 792
const PDF_START_X = 40
const PDF_START_Y = 760
const PDF_LINE_HEIGHT = 14
const PDF_MAX_CHARS_PER_LINE = 88

const sanitizePdfText = (value: string) =>
    value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\x20-\x7E]/g, " ")
        .replace(/\s+/g, " ")
        .trim()

const escapePdfText = (value: string) =>
    sanitizePdfText(value)
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)")

const wrapText = (value: string, maxChars = PDF_MAX_CHARS_PER_LINE) => {
    const words = sanitizePdfText(value).split(" ").filter(Boolean)

    if (!words.length) {
        return [""]
    }

    const lines: string[] = []
    let currentLine = ""

    for (const word of words) {
        const nextLine = currentLine ? `${currentLine} ${word}` : word

        if (nextLine.length <= maxChars) {
            currentLine = nextLine
            continue
        }

        if (currentLine) {
            lines.push(currentLine)
        }

        currentLine = word
    }

    if (currentLine) {
        lines.push(currentLine)
    }

    return lines
}

const buildPageStream = (lines: string[]) => {
    const commands = [
        "BT",
        "/F1 11 Tf",
        `${PDF_LINE_HEIGHT} TL`,
        `${PDF_START_X} ${PDF_START_Y} Td`,
    ]

    lines.forEach((line, index) => {
        const escapedLine = escapePdfText(line)
        commands.push(index === 0 ? `(${escapedLine}) Tj` : `T* (${escapedLine}) Tj`)
    })

    commands.push("ET")
    return commands.join("\n")
}

const buildPdfDocument = (pages: string[]) => {
    const objects: string[] = []
    const totalPageObjects = pages.length * 2
    const fontObjectId = 3 + totalPageObjects

    objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj")

    const pageReferences = pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ")
    objects.push(`2 0 obj\n<< /Type /Pages /Kids [${pageReferences}] /Count ${pages.length} >>\nendobj`)

    pages.forEach((stream, index) => {
        const pageObjectId = 3 + index * 2
        const contentObjectId = pageObjectId + 1

        objects.push(
            `${pageObjectId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>\nendobj`,
        )
        objects.push(
            `${contentObjectId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`,
        )
    })

    objects.push(`${fontObjectId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`)

    let pdf = "%PDF-1.4\n"
    const offsets = [0]

    objects.forEach((object) => {
        offsets.push(pdf.length)
        pdf += `${object}\n`
    })

    const xrefOffset = pdf.length
    pdf += `xref\n0 ${objects.length + 1}\n`
    pdf += "0000000000 65535 f \n"

    offsets.slice(1).forEach((offset) => {
        pdf += `${String(offset).padStart(10, "0")} 00000 n \n`
    })

    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

    return pdf
}

export const downloadAttendancePdfReport = ({
    assignment,
    sessions,
}: AttendanceReportParams) => {
    const sortedSessions = [...sessions].sort((left, right) => left.classNumber - right.classNumber)
    const totalStudents = assignment.members.length
    const pageCapacity = Math.floor((PDF_START_Y - 40) / PDF_LINE_HEIGHT)
    const pages: string[][] = [[]]

    const appendLine = (line: string) => {
        const currentPage = pages[pages.length - 1]

        if (currentPage.length >= pageCapacity) {
            pages.push([])
        }

        pages[pages.length - 1].push(line)
    }

    const appendParagraph = (value: string, maxChars?: number) => {
        wrapText(value, maxChars).forEach(appendLine)
    }

    appendLine("Reporte de asistencias del curso")
    appendLine("")
    appendParagraph(`Curso: ${assignment.course.name}`)
    appendParagraph(`Descripcion: ${assignment.course.description}`)
    appendParagraph(
        `Profesor: ${formatFullName(assignment.professor.firstName, assignment.professor.lastName)}`,
    )
    appendParagraph(`Total de estudiantes inscritos: ${totalStudents}`)
    appendParagraph(`Clases con asistencia registrada: ${sortedSessions.length}`)
    appendParagraph(`Generado el: ${new Date().toLocaleString("es-CO")}`)
    appendLine("")

    if (!sortedSessions.length) {
        appendParagraph("No hay asistencias registradas para este curso.")
    }

    sortedSessions.forEach((session, sessionIndex) => {
        const presentCount = session.attendance.filter((entry) => entry.present).length
        const absentCount = session.attendance.length - presentCount
        const attendanceRate = session.attendance.length
            ? Math.round((presentCount / session.attendance.length) * 100)
            : 0

        appendParagraph(
            `Clase ${session.classNumber} - ${new Date(session.date).toLocaleDateString("es-CO")} - Asistieron: ${presentCount} - Fallaron: ${absentCount} - Cumplimiento: ${attendanceRate}%`,
        )

        session.attendance.forEach((entry) => {
            appendParagraph(
                `- ${formatFullName(entry.student.firstName, entry.student.lastName)} (${entry.student.documentID}): ${entry.present ? "ASISTE" : "FALLA"}`,
            )
        })

        if (sessionIndex < sortedSessions.length - 1) {
            appendLine("")
        }
    })

    const pdfPages = pages.map((page) => buildPageStream(page))
    const pdfContent = buildPdfDocument(pdfPages)
    const pdfBlob = new Blob([pdfContent], { type: "application/pdf" })
    const downloadUrl = URL.createObjectURL(pdfBlob)
    const link = document.createElement("a")

    link.href = downloadUrl
    link.download = `reporte-asistencia-${sanitizePdfText(assignment.course.name).replace(/\s+/g, "-").toLowerCase()}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(downloadUrl)
}
