const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Get user profile
router.get('/', requireAuth, (req, res) => {
    try {
        const user = db.prepare(`
            SELECT id, email, full_name, phone, date_of_birth, gender, 
                   address, city, state, pincode, aadhar_number, profile_photo,
                   is_verified, verification_status, created_at
            FROM users WHERE id = ?
        `).get(req.session.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch profile'
        });
    }
});

// Update user profile
router.put('/', requireAuth, upload.single('profilePhoto'), (req, res) => {
    try {
        const { fullName, phone, dateOfBirth, gender, address, city, state, pincode, aadharNumber } = req.body;

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

module.exports = router;