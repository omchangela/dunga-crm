export const renderFooter = (pageNumber: string): string => {
    return `
    <div class="footer">
        <div class="contact">
            <span>+91 8013902831</span>
            <span>sales@dungatechnologies.com</span>
            <span>www.dungatechnologies.com</span>
        </div>
        <div class="page-badge">${pageNumber}</div>
    </div>
    `
}