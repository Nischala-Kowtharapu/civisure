const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { verifyReport } = require('../config/aiVerification');

router.post('/', requireAuth, upload.array('evidence', 5), async (req, res) => {
    try {
        const { 
            category, 
            description, 
            crimeLocationLat, 
            crimeLocationLng, 
            crimeLocationAddress,
            userLocationLat,
            userLocationLng,
            userLocationAddress,
            dateTime, 
            anonymous 
        } = req.body;

        if (!category || !description || !crimeLocationLat || !crimeLocationLng || !dateTime) {
            return res.status(400).json({
                success: false,
                message: 'All required fields must be provided'
            });
        }

        let evidenceFiles = null;
        let evidenceFilenames = [];
        if (req.files && req.files.length > 0) {
            evidenceFilenames = req.files.map(file => file.filename);
            evidenceFiles = JSON.stringify(evidenceFilenames);
        }

        // AI VERIFICATION - Calculate trust score
        console.log('🤖 Running AI verification...');
        const verification = await verifyReport({
            description,
            category,
            crimeLocationAddress,
            userLocationAddress,
            dateTime,
            evidenceFiles: evidenceFilenames,
            anonymous: anonymous === 'true'
        });

        console.log('✅ Trust Score:', verification.trustScore + '%');

        const userId = anonymous === 'true' ? null : req.session.userId;

        const stmt = db.prepare(`
            INSERT INTO crime_reports 
            (user_id, category, description, crime_location_lat, crime_location_lng, crime_location_address,
             user_location_lat, user_location_lng, user_location_address,
             date_time, evidence_files, anonymous,
             trust_score, ai_verification_status, ai_analysis, 
             location_verified, timestamp_verified, evidence_verified)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            userId,
            category,
            description,
            parseFloat(crimeLocationLat),
            parseFloat(crimeLocationLng),
            crimeLocationAddress || null,
            userLocationLat ? parseFloat(userLocationLat) : null,
            userLocationLng ? parseFloat(userLocationLng) : null,
            userLocationAddress || null,
            dateTime,
            evidenceFiles,
            anonymous === 'true' ? 1 : 0,
            verification.trustScore,
            verification.verificationStatus,
            verification.aiAnalysis,
            verification.locationVerified ? 1 : 0,
            verification.timestampVerified ? 1 : 0,
            verification.evidenceVerified ? 1 : 0
        );

        res.status(201).json({
            success: true,
            message: 'Crime report submitted successfully',
            reportId: result.lastInsertRowid,
            trustScore: verification.trustScore,
            verificationStatus: verification.verificationStatus
        });

    } catch (error) {
        console.error('Report submission error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit report'
        });
    }
});

router.get('/', requireAdmin, (req, res) => {
    try {
        const { status, category, limit = 100, offset = 0 } = req.query;

        let query = `
            SELECT 
                r.id,
                r.user_id,
                r.category,
                r.description,
                r.crime_location_lat,
                r.crime_location_lng,
                r.crime_location_address,
                r.user_location_lat,
                r.user_location_lng,
                r.user_location_address,
                r.date_time,
                r.evidence_files,
                r.status,
                r.anonymous,
                r.created_at,
                r.updated_at,
                u.email as reporter_email,
                u.full_name as reporter_name,
                u.phone as reporter_phone
            FROM crime_reports r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            query += ' AND r.status = ?';
            params.push(status);
        }

        if (category) {
            query += ' AND r.category = ?';
            params.push(category);
        }

        query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        console.log('Fetching reports with query:', query);
        console.log('Parameters:', params);

        const reports = db.prepare(query).all(...params);

        console.log(`Found ${reports.length} reports`);

        // Get total count without filters for pagination
        let countQuery = 'SELECT COUNT(*) as total FROM crime_reports WHERE 1=1';
        const countParams = [];
        
        if (status) {
            countQuery += ' AND status = ?';
            countParams.push(status);
        }
        
        if (category) {
            countQuery += ' AND category = ?';
            countParams.push(category);
        }

        const totalCount = db.prepare(countQuery).get(...countParams);

        reports.forEach(report => {
            if (report.evidence_files) {
                try {
                    report.evidence_files = JSON.parse(report.evidence_files);
                } catch (e) {
                    report.evidence_files = [];
                }
            }
            // Only hide reporter info if anonymous
            if (report.anonymous) {
                report.reporter_email = null;
                report.reporter_name = null;
                report.reporter_phone = null;
            }
            // Use crime location for display
            report.location_address = report.crime_location_address;
        });

        res.json({
            success: true,
            reports,
            total: totalCount.total
        });

    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch reports: ' + error.message
        });
    }
});

router.get('/map', (req, res) => {
    try {
        const { category, days = 30 } = req.query;

        let query = `
            SELECT 
                id,
                category,
                crime_location_lat as location_lat,
                crime_location_lng as location_lng,
                crime_location_address as location_address,
                date_time,
                status
            FROM crime_reports
            WHERE created_at >= datetime('now', '-' || ? || ' days')
        `;
        const params = [parseInt(days)];

        if (category) {
            query += ' AND category = ?';
            params.push(category);
        }

        query += ' ORDER BY created_at DESC';

        const reports = db.prepare(query).all(...params);

        res.json({
            success: true,
            reports
        });

    } catch (error) {
        console.error('Get map reports error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch map data'
        });
    }
});

// GET single report by ID — used by the "View" button in review-reports.html
router.get('/:id', requireAdmin, (req, res) => {
    try {
        const report = db.prepare(`
            SELECT 
                r.*,
                u.email as reporter_email,
                u.full_name as reporter_name,
                u.phone as reporter_phone
            FROM crime_reports r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE r.id = ?
        `).get(req.params.id);

        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }

        // Parse evidence files JSON string into array
        if (report.evidence_files) {
            try {
                report.evidence_files = JSON.parse(report.evidence_files);
            } catch (e) {
                report.evidence_files = [];
            }
        } else {
            report.evidence_files = [];
        }

        // Hide reporter identity if anonymous
        if (report.anonymous) {
            report.reporter_email = null;
            report.reporter_name = null;
            report.reporter_phone = null;
        }

        res.json({
            success: true,
            report
        });

    } catch (error) {
        console.error('Get single report error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch report: ' + error.message
        });
    }
});

router.put('/:id', requireAdmin, (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['pending', 'investigating', 'resolved', 'rejected'];

        console.log('📝 Status update request:', { reportId: req.params.id, newStatus: status });

        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be: pending, investigating, resolved, or rejected'
            });
        }

        // Check if report exists
        const report = db.prepare('SELECT id FROM crime_reports WHERE id = ?').get(req.params.id);
        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }

        // Update status
        const stmt = db.prepare(`
            UPDATE crime_reports 
            SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        const result = stmt.run(status, req.params.id);

        console.log('✅ Status updated:', result.changes, 'rows affected');

        if (result.changes === 0) {
            return res.status(500).json({
                success: false,
                message: 'Update failed - no rows changed'
            });
        }

        res.json({
            success: true,
            message: 'Report status updated successfully'
        });

    } catch (error) {
        console.error('❌ Update report error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update report: ' + error.message
        });
    }
});

router.get('/stats/summary', requireAdmin, (req, res) => {
    try {
        const totalReports = db.prepare('SELECT COUNT(*) as count FROM crime_reports').get();
        const pendingReports = db.prepare("SELECT COUNT(*) as count FROM crime_reports WHERE status = 'pending'").get();
        const resolvedReports = db.prepare("SELECT COUNT(*) as count FROM crime_reports WHERE status = 'resolved'").get();
        
        const byCategory = db.prepare(`
            SELECT category, COUNT(*) as count 
            FROM crime_reports 
            GROUP BY category 
            ORDER BY count DESC
        `).all();

        const byStatus = db.prepare(`
            SELECT status, COUNT(*) as count 
            FROM crime_reports 
            GROUP BY status
        `).all();

        res.json({
            success: true,
            stats: {
                total: totalReports.count,
                pending: pendingReports.count,
                resolved: resolvedReports.count,
                byCategory,
                byStatus
            }
        });

    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics'
        });
    }
});

module.exports = router;