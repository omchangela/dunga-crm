export const formatINR = (n: number): string => {
    return new Intl.NumberFormat('en-IN', {
        style:                 'currency',
        currency:              'INR',
        maximumFractionDigits: 0
    }).format(n)
}

export const formatDate = (d: Date | string | null): string => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-IN', {
        day:   '2-digit',
        month: 'short',
        year:  'numeric'
    })
}

// calculate calendar deadline from working days
// excludes weekends (2 days every 7) and holidays (2 days every 30 calendar)
export const calculateDeadline = (
    timelines: any[],
    startDate: Date = new Date()
): {
    deadline:         Date | null
    calendarDays:     number
    totalWorkingDays: number
} => {

    if (!timelines || timelines.length === 0) {
        return { deadline: null, calendarDays: 0, totalWorkingDays: 0 }
    }

    const totalWorkingDays = timelines.reduce((sum, t) => {
        const days = parseInt(String(t.workingDays)) || 0
        return sum + days
    }, 0)

    if (totalWorkingDays === 0) {
        return { deadline: null, calendarDays: 0, totalWorkingDays: 0 }
    }

    let calendarDays    = Math.ceil((totalWorkingDays * 7) / 5)
    const holidayBuffer = Math.floor(calendarDays / 30) * 2
    calendarDays       += holidayBuffer

    const deadline = new Date(startDate)
    deadline.setDate(deadline.getDate() + calendarDays)

    return { deadline, calendarDays, totalWorkingDays }
}