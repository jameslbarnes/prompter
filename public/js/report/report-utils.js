// Report Utilities
export function verifyInitialization() {
    const requiredElements = {
        'reportDetailNav': document.getElementById('reportDetailNav'),
        'reportContent': document.getElementById('reportContent'),
        'transcriptContentArea': document.getElementById('transcriptContentArea'),
        'reportContentWrapper': document.getElementById('reportContentWrapper')
    };

    let allPresent = true;
    for (const [name, element] of Object.entries(requiredElements)) {
        if (!element) {
            console.error(`[Initialization] Missing required element: ${name}`);
            allPresent = false;
        } else {
            console.log(`[Initialization] Found element: ${name}`);
        }
    }

    if (allPresent) {
        console.log('[Initialization] All required elements found');
    } else {
        console.error('[Initialization] Some required elements are missing');
    }

    return allPresent;
}

// Escape XML function
export function escapeXml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&#39;';
            case '"': return '&quot;';
        }
    });
}

// Function to update header with user's name
export async function updateHeaderWithUserName(reportId, interviewId, existingTitle = null) {
    try {
        let userName = null;
        let interviewTitle = existingTitle;
        
        // Try to get user name from report data first
        if (reportId) {
            const reportResponse = await fetch(`/api/reports/${reportId}`);
            if (reportResponse.ok) {
                const reportData = await reportResponse.json();
                userName = reportData.user_name || reportData.userName;
                // Also try to get the report title if not provided
                if (!interviewTitle) {
                    interviewTitle = reportData.report_title || reportData.reportTitle;
                }
            }
        }
        
        // If no name from report, try to get from interview responses
        if (!userName && reportId) {
            const responsesResponse = await fetch(`/api/reports/${reportId}/responses`);
            if (responsesResponse.ok) {
                const responsesData = await responsesResponse.json();
                // Get user name from the first response if available
                if (responsesData.responses && responsesData.responses.length > 0) {
                    userName = responsesData.user_name || responsesData.userName;
                }
            }
        }
        
        // Update header with user name and interview title
        const headerTitleText = document.getElementById('headerTitleText');
        if (headerTitleText) {
            let newHeaderText;
            
            // Use interview title as the primary display title
            if (interviewTitle && interviewTitle !== 'Individual Summary' && interviewTitle !== 'Personal AI Readiness Report') {
                // Use the actual report title
                newHeaderText = interviewTitle;
            } else if (userName) {
                // If we only have user name, show "Prepared for [name]"
                newHeaderText = `Prepared for ${userName}`;
            } else {
                // Fallback to default
                newHeaderText = 'Individual Summary';
            }
            
            headerTitleText.textContent = newHeaderText;
            console.log(`Header updated: "${newHeaderText}"`);
        } else {
            console.log('Header element not found');
        }
    } catch (error) {
        console.error('Error fetching user name for header:', error);
    }
}

// Initialize interview data from URL or API
export async function initializeWithInterviewData(interviewId) {
    let customInterviewData = null;

    if (interviewId) {
        try {
            console.log("Interview ID detected for custom setup:", interviewId);
            if (typeof db !== 'undefined') {
                const interviewDoc = await db.collection('interviews').doc(interviewId).get();
                if (interviewDoc.exists) {
                    const data = interviewDoc.data();
                    console.log("Interview data loaded from Firestore for custom setup:", data.title);
                    customInterviewData = data;
                    document.title = data.reportHeader || data.title || "Personal AI Readiness Report";
                    const headerTitle = document.querySelector('#headerTitle span');
                    if (headerTitle) {
                        headerTitle.textContent = data.reportHeader || "Personal AI Readiness Report";
                    }
                } else {
                    await fetchFromServerAPI(interviewId);
                }
            } else {
                await fetchFromServerAPI(interviewId);
            }
        } catch (error) {
            console.error("Error fetching interview data for custom setup:", error);
            await fetchFromServerAPI(interviewId);
        }
    }
    
    return customInterviewData;
}

async function fetchFromServerAPI(interviewId) {
    try {
        const response = await fetch(`/api/interview/${interviewId}`);
        if (response.ok) {
            const data = await response.json();
            console.log("Interview data loaded from server API for custom setup:", data.title);
            document.title = data.reportHeader || data.title || "Individual Summary";
            const headerTitle = document.querySelector('#headerTitle span');
            if (headerTitle) {
                headerTitle.textContent = data.reportHeader || "Individual Summary";
            }
            return data;
        } else {
            console.warn("Failed to fetch interview data from server for custom setup:", await response.text());
        }
    } catch (error) {
        console.error("Error fetching interview data from server for custom setup:", error);
    }
    return null;
}