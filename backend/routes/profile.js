const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Get user profile
router.put('/', requireAuth, (req, res) => {
    try {
        const { fullName, phone, dateOfBirth, gender, address, city, state, pincode, aadharNumber } = req.body;

        const updateFields = [];
        const values = [];

        if (fullName) {
            updateFields.push('full_name = ?');
            values.push(fullName);
        }
        if (phone) {
            updateFields.push('phone = ?');
            values.push(phone);
        }
        if (dateOfBirth) {
            updateFields.push('date_of_birth = ?');
            values.push(dateOfBirth);
        }
        if (gender) {
            updateFields.push('gender = ?');
            values.push(gender);
        }
        if (address) {
            updateFields.push('address = ?');
            values.push(address);
        }
        if (city) {
            updateFields.push('city = ?');
            values.push(city);
        }
        if (state) {
            updateFields.push('state = ?');
            values.push(state);
        }
        if (pincode) {
            updateFields.push('pincode = ?');
            values.push(pincode);
        }
        if (aadharNumber) {
            updateFields.push('aadhar_number = ?');
            values.push(aadharNumber);
        }

        values.push(req.session.userId);

        if (updateFields.length > 0) {
            const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
            db.prepare(query).run(...values);
        }

        // Get updated user data
        const updatedUser = db.prepare(`
            SELECT id, email, full_name, phone, date_of_birth, gender, 
                   address, city, state, pincode, aadhar_number,
                   is_verified, verification_status, created_at
            FROM users WHERE id = ?
        `).get(req.session.userId);

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: updatedUser
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile'
        });
    }
});

// Update user profile
router.put('/', requireAuth, upload.single('profilePhoto'), (req, res) => {
    try {
        const { 
            fullName, phone, dateOfBirth, gender, address, city, state, pincode, aadharNumber,
            emergencyContact1Name, emergencyContact1Phone, emergencyContact1Relation,
            emergencyContact2Name, emergencyContact2Phone, emergencyContact2Relation,
            emergencyContact3Name, emergencyContact3Phone, emergencyContact3Relation
        } = req.body;

        let profilePhoto = null;
        if (req.file) {
            profilePhoto = req.file.filename;
        }

        const updateFields = [];
        const values = [];

        if (fullName) {
            updateFields.push('full_name = ?');
            values.push(fullName);
        }
        if (phone) {
            updateFields.push('phone = ?');
            values.push(phone);
        }
        if (dateOfBirth) {
            updateFields.push('date_of_birth = ?');
            values.push(dateOfBirth);
        }
        if (gender) {
            updateFields.push('gender = ?');
            values.push(gender);
        }
        if (address) {
            updateFields.push('address = ?');
            values.push(address);
        }
        if (city) {
            updateFields.push('city = ?');
            values.push(city);
        }
        if (state) {
            updateFields.push('state = ?');
            values.push(state);
        }
        if (pincode) {
            updateFields.push('pincode = ?');
            values.push(pincode);
        }
        if (aadharNumber) {
            updateFields.push('aadhar_number = ?');
            values.push(aadharNumber);
            // Request verification when Aadhar is added
            updateFields.push('verification_status = ?');
            values.push('pending');
        }
        if (profilePhoto) {
            updateFields.push('profile_photo = ?');
            values.push(profilePhoto);
        }

        // Emergency Contact 1
        if (emergencyContact1Name !== undefined) {
            updateFields.push('emergency_contact_1_name = ?');
            values.push(emergencyContact1Name || null);
        }
        if (emergencyContact1Phone !== undefined) {
            updateFields.push('emergency_contact_1_phone = ?');
            values.push(emergencyContact1Phone || null);
        }
        if (emergencyContact1Relation !== undefined) {
            updateFields.push('emergency_contact_1_relation = ?');
            values.push(emergencyContact1Relation || null);
        }

        // Emergency Contact 2
        if (emergencyContact2Name !== undefined) {
            updateFields.push('emergency_contact_2_name = ?');
            values.push(emergencyContact2Name || null);
        }
        if (emergencyContact2Phone !== undefined) {
            updateFields.push('emergency_contact_2_phone = ?');
            values.push(emergencyContact2Phone || null);
        }
        if (emergencyContact2Relation !== undefined) {
            updateFields.push('emergency_contact_2_relation = ?');
            values.push(emergencyContact2Relation || null);
        }

        // Emergency Contact 3
        if (emergencyContact3Name !== undefined) {
            updateFields.push('emergency_contact_3_name = ?');
            values.push(emergencyContact3Name || null);
        }
        if (emergencyContact3Phone !== undefined) {
            updateFields.push('emergency_contact_3_phone = ?');
            values.push(emergencyContact3Phone || null);
        }
        if (emergencyContact3Relation !== undefined) {
            updateFields.push('emergency_contact_3_relation = ?');
            values.push(emergencyContact3Relation || null);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        values.push(req.session.userId);

        const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
        db.prepare(query).run(...values);

        res.json({
            success: true,
            message: 'Profile updated successfully'
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile'
        });
    }
});

router.get('/', requireAuth, (req, res) => {
    try {

        const user = db.prepare(`
            SELECT id, email, full_name, phone, date_of_birth, gender,
                   address, city, state, pincode, aadhar_number,
                   is_verified, verification_status, created_at
            FROM users
            WHERE id = ?
        `).get(req.session.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            user: user
        });

    } catch (error) {
        console.error("Get profile error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch profile"
        });
    }
});

module.exports = router;