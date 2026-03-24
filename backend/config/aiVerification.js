const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || ''
});

/**
 * AI-Powered Crime Report Verification
 * Analyzes report for authenticity and calculates trust score
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

    // Calculate base scores
    let trustScore = 50; // Start at 50%
    const scores = {
        description: 0,
        location: 0,
        timestamp: 0,
        evidence: 0,
        aiAnalysis: 0
    };

    let aiAnalysis = '';
    let verificationStatus = 'pending';

    try {
        // 1. Description Quality Check (0-25 points)
        const descriptionLength = description.trim().length;
        if (descriptionLength < 20) {
            scores.description = 0;
            aiAnalysis += 'Very brief description. ';
        } else if (descriptionLength < 50) {
            scores.description = 10;
        } else if (descriptionLength < 100) {
            scores.description = 15;
        } else {
            scores.description = 25;
        }

        // 2. Location Verification (0-20 points)
        if (crimeLocationAddress && crimeLocationAddress !== 'Unknown location') {
            scores.location = 15;
            
            // Extra points if user location also provided
            if (userLocationAddress && userLocationAddress !== crimeLocationAddress) {
                scores.location = 20;
                aiAnalysis += 'Separate crime and reporter locations provided. ';
            }
        } else {
            aiAnalysis += 'Location details incomplete. ';
        }

        // 3. Timestamp Verification (0-15 points)
        const reportDate = new Date(dateTime);
        const now = new Date();
        const hoursDiff = Math.abs(now - reportDate) / 36e5;

        if (hoursDiff < 24) {
            scores.timestamp = 15; // Recent incident
        } else if (hoursDiff < 72) {
            scores.timestamp = 10;
        } else if (hoursDiff < 168) {
            scores.timestamp = 5;
        } else {
            aiAnalysis += 'Incident reported after significant delay. ';
        }

        // 4. Evidence Verification (0-15 points)
        if (evidenceFiles && evidenceFiles.length > 0) {
            scores.evidence = 5 + (Math.min(evidenceFiles.length, 3) * 5);
            aiAnalysis += `${evidenceFiles.length} evidence file(s) attached. `;
        } else {
            aiAnalysis += 'No evidence provided. ';
        }

        // 5. AI Content Analysis (0-25 points)
        if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your-anthropic-api-key-here') {
            const aiResult = await analyzeWithAI(description, category);
            scores.aiAnalysis = aiResult.score;
            aiAnalysis += aiResult.analysis;
        } else {
            // Fallback: Basic keyword analysis
            const suspiciousKeywords = ['test', 'fake', 'sample', 'demo', 'trying'];
            const hasSuspicious = suspiciousKeywords.some(keyword => 
                description.toLowerCase().includes(keyword)
            );
            
            if (hasSuspicious) {
                scores.aiAnalysis = 5;
                aiAnalysis += 'Contains test/sample keywords. ';
            } else {
                scores.aiAnalysis = 15;
            }
        }

        // Calculate total trust score
        trustScore = Math.min(100, 
            scores.description + 
            scores.location + 
            scores.timestamp + 
            scores.evidence + 
            scores.aiAnalysis
        );

        // Determine verification status
        if (trustScore >= 75) {
            verificationStatus = 'verified';
        } else if (trustScore >= 50) {
            verificationStatus = 'pending';
        } else if (trustScore >= 30) {
            verificationStatus = 'suspicious';
        } else {
            verificationStatus = 'flagged';
        }

        // Penalty for anonymous reports
        if (anonymous) {
            aiAnalysis += 'Anonymous report. ';
            trustScore = Math.max(0, trustScore - 5);
        }

    } catch (error) {
        console.error('Verification error:', error);
        aiAnalysis += 'Automated verification encountered errors. ';
    }

    return {
        trustScore: Math.round(trustScore),
        verificationStatus,
        aiAnalysis: aiAnalysis.trim(),
        locationVerified: scores.location >= 15,
        timestampVerified: scores.timestamp >= 10,
        evidenceVerified: scores.evidence > 0,
        breakdown: scores
    };
}

/**
 * Advanced AI Analysis using Claude API
 */
async function analyzeWithAI(description, category) {
    try {
        const prompt = `Analyze this crime report for authenticity and credibility:

Category: ${category}
Description: "${description}"

Evaluate:
1. Does it sound like a genuine crime report?
2. Are there specific details that indicate authenticity?
3. Any red flags or suspicious elements?
4. Language quality and coherence?

Respond with:
- Score: 0-25 (25 = highly credible, 0 = likely fake)
- Brief analysis (max 50 words)

Format: SCORE: [number] | ANALYSIS: [text]`;

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 200,
            messages: [{ role: 'user', content: prompt }]
        });

        const result = response.content[0].text;
        const scoreMatch = result.match(/SCORE:\s*(\d+)/);
        const analysisMatch = result.match(/ANALYSIS:\s*(.+)/);

        const score = scoreMatch ? Math.min(25, parseInt(scoreMatch[1])) : 15;
        const analysis = analysisMatch ? analysisMatch[1].trim() : 'AI analysis completed.';

        return { score, analysis };

    } catch (error) {
        console.error('AI analysis error:', error);
        return { 
            score: 15, 
            analysis: 'AI analysis unavailable. Default scoring applied.' 
        };
    }
}

module.exports = {
    verifyReport
};