/**
 * AI-Powered Crime Report Verification
 * Calculates trust score based on multiple factors
 */
async function verifyReport(reportData) {
    const {
        description,
        category,
        crimeLocationAddress,
        userLocationAddress,
        dateTime,
        evidenceFiles,
        anonymous
    } = reportData;

    let trustScore = 50; // Start at 50%
    const scores = {
        description: 0,
        location: 0,
        timestamp: 0,
        evidence: 0
    };

    let aiAnalysis = '';
    let verificationStatus = 'pending';

    try {
        // 1. Description Quality (0-30 points)
        const descriptionLength = description.trim().length;
        if (descriptionLength < 20) {
            scores.description = 5;
            aiAnalysis += 'Brief description. ';
        } else if (descriptionLength < 50) {
            scores.description = 15;
            aiAnalysis += 'Moderate detail. ';
        } else if (descriptionLength < 100) {
            scores.description = 20;
            aiAnalysis += 'Good detail. ';
        } else {
            scores.description = 30;
            aiAnalysis += 'Comprehensive description. ';
        }

        // 2. Location Verification (0-25 points)
        if (crimeLocationAddress && crimeLocationAddress !== 'Unknown location') {
            scores.location = 15;
            aiAnalysis += 'Crime location provided. ';
            
            // Extra points if user location also provided
            if (userLocationAddress && userLocationAddress !== crimeLocationAddress) {
                scores.location = 25;
                aiAnalysis += 'Separate reporter location verified. ';
            }
        } else {
            aiAnalysis += 'Location incomplete. ';
        }

        // 3. Timestamp Verification (0-20 points)
        const reportDate = new Date(dateTime);
        const now = new Date();
        const hoursDiff = Math.abs(now - reportDate) / 36e5;

        if (hoursDiff < 24) {
            scores.timestamp = 20;
            aiAnalysis += 'Recent incident. ';
        } else if (hoursDiff < 72) {
            scores.timestamp = 15;
        } else if (hoursDiff < 168) {
            scores.timestamp = 10;
        } else {
            scores.timestamp = 5;
            aiAnalysis += 'Delayed reporting. ';
        }

        // 4. Evidence Verification (0-25 points)
        if (evidenceFiles && evidenceFiles.length > 0) {
            if (evidenceFiles.length === 1) {
                scores.evidence = 10;
            } else if (evidenceFiles.length === 2) {
                scores.evidence = 18;
            } else {
                scores.evidence = 25;
            }
            aiAnalysis += `${evidenceFiles.length} evidence file(s) attached. `;
        } else {
            aiAnalysis += 'No evidence provided. ';
        }

        // Calculate total trust score
        trustScore = scores.description + scores.location + scores.timestamp + scores.evidence;

        // Penalty for anonymous reports (-5 points)
        if (anonymous) {
            trustScore = Math.max(0, trustScore - 5);
            aiAnalysis += 'Anonymous submission. ';
        }

        // Determine verification status based on trust score
        if (trustScore >= 75) {
            verificationStatus = 'verified';
        } else if (trustScore >= 50) {
            verificationStatus = 'pending';
        } else if (trustScore >= 30) {
            verificationStatus = 'suspicious';
        } else {
            verificationStatus = 'flagged';
        }

    } catch (error) {
        console.error('Verification error:', error);
        aiAnalysis += 'Automated verification encountered errors. ';
        trustScore = 50; // Default to 50 if error
    }

    return {
        trustScore: Math.min(100, Math.round(trustScore)),
        verificationStatus,
        aiAnalysis: aiAnalysis.trim(),
        locationVerified: scores.location >= 15,
        timestampVerified: scores.timestamp >= 10,
        evidenceVerified: scores.evidence > 0
    };
}

module.exports = {
    verifyReport
};