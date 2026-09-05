const TERMS = [
    ['1. Project Scope', 'The estimation includes only the features, modules, and functionalities specifically mentioned in the proposal/estimation document.'],
    ['2. Change Requests', 'Any additional features, modifications, enhancements, integrations, or changes requested after approval of the estimation will be considered as a Change Request and will be charged separately.'],
    ['3. Estimation Validity', 'This estimation/quotation is valid for 7 days from the date of issue. After the validity period expires, pricing, timelines, and resource availability may change.'],
    ['4. Payment Terms', 'Payment terms and schedules shall be as specified in the estimation/quotation document. The client agrees to make payments according to the milestones and timelines mentioned therein.'],
    ['5. Project Commencement', 'The project timeline will commence only after receipt of the agreed advance payment and all required documents, content, credentials, approvals, and other necessary resources from the client.'],
    ['6. Timeline Extensions', 'Any delay in providing required information, approvals, content, feedback, or payments from the client\'s side may result in an extension of the project delivery timeline.'],
    ['7. Third-Party Services', 'Domain, Hosting, SSL Certificates, SMS Gateways, WhatsApp API, Payment Gateways, Google APIs, Apple Developer Account, Google Play Console Account, Email Services, and other third-party services are not included unless explicitly mentioned in the estimation.'],
    ['8. Third-Party Service Responsibility', 'The client shall bear all charges related to third-party services. If any third-party service is specifically mentioned as included in the estimation, the company shall be responsible only for the services explicitly stated therein.'],
    ['9. Client Review & Approval', 'The client must review, test, and provide approval or feedback within 7 days of project delivery or demo submission.'],
    ['10. Post-Approval Changes', 'Any major modifications, redesigns, feature additions, workflow changes, or enhancements requested after approval shall be charged separately.'],
    ['11. Free Support Period', 'The company will provide 30 days of free bug-fixing support from the date of final project delivery.'],
    ['12. Support Limitations', 'Free support covers only bug fixes related to the originally delivered functionality. New features, enhancements, change requests, third-party issues, or client-requested modifications are not included.'],
    ['13. Source Code Ownership', 'Source code shall be provided only if explicitly mentioned in the agreement, proposal, or estimation document.'],
    ['14. SaaS & Licensed Products', 'For SaaS-based, subscription-based, licensed, or proprietary products, source code ownership and transfer rights may not be included.'],
    ['15. Refund Policy', 'Advance payments are strictly non-refundable under any circumstances.'],
    ['16. Project Cancellation', 'In the event of project cancellation by the client, payment shall be due for all work completed, resources utilized, and expenses incurred up to the date of cancellation.'],
    ['17. Payment Delays', 'The company reserves the right to place the project on hold if any scheduled payment is delayed beyond the agreed due date.'],
    ['18. Service Suspension', 'Services, support, hosting access, or project deployment may be suspended if payment remains overdue for more than 15 days.'],
    ['19. Confidentiality', 'All client information, business data, project details, documents, credentials, and related information shall be treated as confidential.'],
    ['20. Non-Disclosure', 'Both parties agree not to disclose, share, or distribute any confidential information to third parties without prior written consent.'],
    ['21. Warranty Coverage', 'The warranty covers only software bugs, defects, or issues directly related to the functionality delivered as per the approved project scope.'],
    ['22. Warranty Exclusions', 'The warranty does not cover issues arising from third-party services, server configurations, hosting environments, operating system updates, API changes, unauthorized modifications, or external integrations.'],
    ['23. Legal Compliance', 'The client is solely responsible for ensuring that the application, business model, content, and operations comply with all applicable local, state, national, and international laws, regulations, and licensing requirements.'],
    ['24. Limitation of Liability', 'The development company shall not be responsible for any legal disputes, penalties, violations, losses, or damages arising from the client\'s business operations, content, services, or regulatory non-compliance.'],
    ['25. Acceptance of Terms', 'Payment of the advance amount shall constitute full acceptance of all terms and conditions stated in this estimation, proposal, and related project documents.']
]

export const renderTerms = (): string => {
    const termsHtml = TERMS.map(([title, content]) => `
        <div class="term">
            <div class="title">${title}</div>
            <div class="content">${content}</div>
        </div>
    `).join('')

    return `
    <div class="flow-container">

        <div class="header">
            <div class="header-left">
                <span class="page-num">03</span>
                <h2>TERMS &amp; CONDITIONS</h2>
            </div>
            <div class="header-right">
                <div class="brand">DUNGA</div>
                <div class="sub">TECHNOLOGIES</div>
            </div>
        </div>

        <div class="terms-list">
            ${termsHtml}
        </div>

    </div>
    `
}