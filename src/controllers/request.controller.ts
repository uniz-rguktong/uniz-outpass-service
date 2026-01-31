import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { ErrorCode } from '../shared/error-codes';
import { OutpassRequestSchema, OutingRequestSchema, ApprovalLogEntrySchema, ApprovalLogEntry } from '../shared/outpass.schema';
import { UserRole } from '../shared/roles.enum';

const prisma = new PrismaClient();

// Helper to append log
const appendLog = (currentLogs: any, entry: ApprovalLogEntry) => {
    const logs = Array.isArray(currentLogs) ? currentLogs : [];
    return [...logs, entry];
};

import axios from 'axios';

// Helper: Check if student is in campus
async function checkStudentInCampus(token: string) {
    try {
        const GATEWAY = process.env.GATEWAY_URL || 'https://uniz-production-gateway.vercel.app/api/v1';
        const res = await axios.get(`${GATEWAY}/profile/student/me`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return res.data.student.is_in_campus;
    } catch (e) {
        console.error("Profile check failed:", e);
        // Fail safe: If we can't verify, we should probably default to True (allow) or False (block).
        // For security, usually Block, but unavailability might block everyone.
        // Let's assume True if service down to avoid lockout, but log error.
        return true; 
    }
}

export const createOutpass = async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user;
    if (!user) return res.status(401).json({ code: ErrorCode.AUTH_UNAUTHORIZED });

    // Validate Input
    const parse = OutpassRequestSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ code: ErrorCode.VALIDATION_ERROR, errors: parse.error.errors });
    }
    const { reason, fromDay, toDay } = parse.data;

    try {
        // 1. Check if student is IN CAMPUS
        const isInCampus = await checkStudentInCampus(req.headers.authorization?.split(' ')[1] || '');
        if (!isInCampus) {
             return res.status(403).json({ code: ErrorCode.AUTH_FORBIDDEN, message: 'You are already marked as OUT of campus.' });
        }

        // 2. Check for existing pending Outpass AND Outing
        const [existingOutpass, existingOuting] = await Promise.all([
            prisma.outpass.findFirst({
                where: { studentId: user.id || user.username, isApproved: false, isRejected: false, isExpired: false }
            }),
            prisma.outing.findFirst({
                where: { studentId: user.id || user.username, isApproved: false, isRejected: false, isExpired: false }
            })
        ]);

        if (existingOutpass || existingOuting) {
            return res.status(409).json({ 
                code: ErrorCode.RESOURCE_ALREADY_EXISTS, 
                message: 'You already have a pending request (Outpass or Outing).' 
            });
        }

        const outpass = await prisma.outpass.create({
            data: {
                studentId: user.id || user.username, 
                studentGender: req.body.studentGender || 'M',
                reason,
                fromDay: new Date(fromDay),
                toDay: new Date(toDay),
                approvalLogs: [],
                currentLevel: 'caretaker'
            }
        });
        return res.json({ success: true, data: outpass });
    } catch (e) {
        return res.status(500).json({ code: ErrorCode.INTERNAL_SERVER_ERROR, message: 'Creation failed' });
    }
};

export const createOuting = async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user;
    if (!user) return res.status(401).json({ code: ErrorCode.AUTH_UNAUTHORIZED });

    const parse = OutingRequestSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ code: ErrorCode.VALIDATION_ERROR, errors: parse.error.errors });
    }
    const { reason, fromTime, toTime } = parse.data;

    try {
        // 1. Check if student is IN CAMPUS
        const isInCampus = await checkStudentInCampus(req.headers.authorization?.split(' ')[1] || '');
        if (!isInCampus) {
             return res.status(403).json({ code: ErrorCode.AUTH_FORBIDDEN, message: 'You are already marked as OUT of campus.' });
        }

        // 2. Check for existing pending Outpass AND Outing
        const [existingOutpass, existingOuting] = await Promise.all([
            prisma.outpass.findFirst({
                where: { studentId: user.id || user.username, isApproved: false, isRejected: false, isExpired: false }
            }),
            prisma.outing.findFirst({
                where: { studentId: user.id || user.username, isApproved: false, isRejected: false, isExpired: false }
            })
        ]);

        if (existingOutpass || existingOuting) {
            return res.status(409).json({ 
                code: ErrorCode.RESOURCE_ALREADY_EXISTS, 
                message: 'You already have a pending request (Outpass or Outing).' 
            });
        }

        const outing = await prisma.outing.create({
            data: {
                studentId: user.id || user.username,
                studentGender: req.body.studentGender || 'M',
                reason,
                fromTime: new Date(fromTime),
                toTime: new Date(toTime),
                approvalLogs: []
            }
        });
        return res.json({ success: true, data: outing });
    } catch (e) {
        return res.status(500).json({ code: ErrorCode.INTERNAL_SERVER_ERROR, message: 'Creation failed' });
    }
};

export const getHistory = async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user;
    if (!user) return res.status(401).json({ code: ErrorCode.AUTH_UNAUTHORIZED });

    const targetId = req.params.id || user.id || user.username;
    const { page = 1, limit = 10 } = req.query;

    try {
        const skip = (Number(page) - 1) * Number(limit);
        
        // Fetch both and combine. In a real system you might want a unified view/table if scale is huge.
        const [outpasses, outings, totalOutpasses, totalOutings] = await Promise.all([
            prisma.outpass.findMany({ 
                where: { studentId: targetId }, 
                orderBy: { requestedTime: 'desc' },
                take: Number(limit)
            }),
            prisma.outing.findMany({ 
                where: { studentId: targetId }, 
                orderBy: { requestedTime: 'desc' },
                take: Number(limit)
            }),
            prisma.outpass.count({ where: { studentId: targetId } }),
            prisma.outing.count({ where: { studentId: targetId } })
        ]);

        // Merge and sort
        const combined = [
            ...outpasses.map(o => ({ ...o, type: 'outpass' })),
            ...outings.map(o => ({ ...o, type: 'outing' }))
        ].sort((a, b) => new Date(b.requestedTime).getTime() - new Date(a.requestedTime).getTime())
         .slice(0, Number(limit));

        // Format keys for frontend compatibility
        const history = combined.map(item => ({
            _id: item.id,
            ...item,
            is_approved: item.isApproved,
            is_rejected: item.isRejected,
            is_expired: item.isExpired,
            requested_time: item.requestedTime,
            from_time: (item as any).fromTime,
            to_time: (item as any).toTime,
            from_day: (item as any).fromDay,
            to_day: (item as any).toDay
        }));

        return res.json({ 
            success: true, 
            history,
            pagination: {
                page: Number(page),
                totalPages: Math.ceil((totalOutpasses + totalOutings) / Number(limit)),
                total: totalOutpasses + totalOutings
            }
        });
    } catch (e) {
        return res.status(500).json({ code: ErrorCode.INTERNAL_SERVER_ERROR });
    }
};

// Helper to determine request type and fetch
const fetchRequest = async (id: string, prisma: any) => {
    const outpass = await prisma.outpass.findUnique({ where: { id } });
    if (outpass) return { type: 'outpass', data: outpass };
    
    const outing = await prisma.outing.findUnique({ where: { id } });
    if (outing) return { type: 'outing', data: outing };

    return null;
};

export const approveOutpass = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const user = req.user;
    if (!user) return res.status(401).json({ code: ErrorCode.AUTH_UNAUTHORIZED });

    const superRoles = [UserRole.DIRECTOR, UserRole.WEBMASTER, UserRole.SWO, UserRole.DEAN];
    const isSuper = superRoles.includes(user.role as UserRole);

    try {
        const found = await fetchRequest(id, prisma);
        if (!found) return res.status(404).json({ code: ErrorCode.RESOURCE_NOT_FOUND });
        
        const { type, data: existing } = found;

        if (existing.isApproved || existing.isRejected || existing.isExpired) {
            return res.status(409).json({ code: ErrorCode.OUTPASS_ALREADY_APPROVED, message: 'Request already finalized' });
        }

        // Gender restriction check
        if (!isSuper) {
          if ((user.role === UserRole.CARETAKER_FEMALE || user.role === UserRole.WARDEN_FEMALE) && existing.studentGender !== 'F') {
              return res.status(403).json({ code: ErrorCode.AUTH_FORBIDDEN, message: 'Female staff can only approve female requests' });
          }
          if ((user.role === UserRole.CARETAKER_MALE || user.role === UserRole.WARDEN_MALE) && existing.studentGender !== 'M') {
              return res.status(403).json({ code: ErrorCode.AUTH_FORBIDDEN, message: 'Male staff can only approve male requests' });
          }
        }

        const currentRole = user.role as string;
        let nextLevel = existing.currentLevel;
        let finalApproval = false;

        // Multi-level flow logic
        if (currentRole === UserRole.CARETAKER_MALE || currentRole === UserRole.CARETAKER_FEMALE) {
            // Outings might be auto-approved by Caretaker or just 1 level
            if (type === 'outing') {
                finalApproval = true; // Caretakers can approve outings directly? Usually yes or Warden. 
                // Let's assume caretaker approves outing.
            } else {
                nextLevel = 'warden';
            }
        } else if (currentRole === UserRole.WARDEN_MALE || currentRole === UserRole.WARDEN_FEMALE) {
            if (type === 'outing') {
                finalApproval = true;
            } else {
                nextLevel = 'swo';
            }
        } else if (superRoles.includes(user.role as UserRole)) {
            finalApproval = true;
        }

        const logEntry: ApprovalLogEntry = {
            level: currentRole,
            approverId: user.id || user.username,
            status: 'approved',
            timestamp: new Date().toISOString(),
            comment: req.body.comment
        };

        const updateData: any = {
            currentLevel: nextLevel,
            approvalLogs: appendLog(existing.approvalLogs, logEntry)
        };

        if (finalApproval) {
            updateData.isApproved = true;
            updateData.issuedBy = user.username;
            updateData.issuedTime = new Date();
        }

        let updated;
        if (type === 'outpass') {
            updated = await prisma.outpass.update({ where: { id }, data: updateData });
        } else {
            updated = await prisma.outing.update({ where: { id }, data: updateData });
        }
        
        return res.json({ success: true, data: updated });
    } catch (e) {
        return res.status(500).json({ code: ErrorCode.INTERNAL_SERVER_ERROR });
    }
};


export const rejectOutpass = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const user = req.user;
    if (!user || user.role === UserRole.STUDENT) return res.status(403).json({ code: ErrorCode.AUTH_FORBIDDEN });

    try {
        const found = await fetchRequest(id, prisma);
        if (!found) return res.status(404).json({ code: ErrorCode.RESOURCE_NOT_FOUND });
        
        const { type, data: existing } = found;

        if (existing.isApproved || existing.isRejected) {
             return res.status(409).json({ code: ErrorCode.OUTPASS_ALREADY_APPROVED });
        }

        const logEntry: ApprovalLogEntry = {
            level: (user.role as string),
            approverId: user.id || user.username,
            status: 'rejected',
            timestamp: new Date().toISOString(),
            comment: req.body.comment
        };

        const updateData = {
            isRejected: true,
            rejectedBy: user.username,
            rejectedTime: new Date(),
            approvalLogs: appendLog(existing.approvalLogs, logEntry)
        };

        let updated;
        if (type === 'outpass') {
             updated = await prisma.outpass.update({ where: { id, isRejected: false }, data: updateData });
        } else {
             updated = await prisma.outing.update({ where: { id, isRejected: false }, data: updateData });
        }

         return res.json({ success: true, data: updated });
    } catch (e) {
        return res.status(500).json({ code: ErrorCode.INTERNAL_SERVER_ERROR });
    }
};

export const getAllOutings = async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user;
    if (!user) return res.status(401).json({ code: ErrorCode.AUTH_UNAUTHORIZED });

    const superRoles = [UserRole.DIRECTOR, UserRole.WEBMASTER, UserRole.SWO, UserRole.DEAN];
    const isSuper = superRoles.includes(user.role as UserRole);

    let where: any = {};
    
    // 1. Role-based status filtering for Security
    if (user.role === UserRole.SECURITY) {
        where.isApproved = true;
        where.isExpired = false;
        where.isRejected = false;
    }

    // 2. Gender-based filtering for Hostel Staff
    if (!isSuper && user.role !== UserRole.SECURITY) {
        if (user.role === UserRole.CARETAKER_FEMALE || user.role === UserRole.WARDEN_FEMALE) {
            where.studentGender = 'F';
        } else if (user.role === UserRole.CARETAKER_MALE || user.role === UserRole.WARDEN_MALE) {
            where.studentGender = 'M';
        }
    }

    try {
        const outings = await prisma.outing.findMany({ 
            where,
            orderBy: { requestedTime: 'desc' } 
        });
        const mapped = outings.map(o => ({
            _id: o.id,
            ...o,
            username: o.studentId, // frontend expects username/studentId
            is_approved: o.isApproved,
            is_rejected: o.isRejected,
            is_expired: o.isExpired,
            requested_time: o.requestedTime,
            from_time: o.fromTime,
            to_time: o.toTime
        }));
        return res.json({ success: true, outings: mapped });
    } catch (e) {
        return res.status(500).json({ code: ErrorCode.INTERNAL_SERVER_ERROR });
    }
};

export const getAllOutpasses = async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user;
    if (!user) return res.status(401).json({ code: ErrorCode.AUTH_UNAUTHORIZED });

    const superRoles = [UserRole.DIRECTOR, UserRole.WEBMASTER, UserRole.SWO, UserRole.DEAN];
    const isSuper = superRoles.includes(user.role as UserRole);

    let where: any = {};

    // 1. Role-based status filtering for Security
    if (user.role === UserRole.SECURITY) {
        where.isApproved = true;
        where.isExpired = false;
        where.isRejected = false;
    }

    // 2. Gender-based filtering for Hostel Staff
    if (!isSuper && user.role !== UserRole.SECURITY) {
        if (user.role === UserRole.CARETAKER_FEMALE || user.role === UserRole.WARDEN_FEMALE) {
            where.studentGender = 'F';
        } else if (user.role === UserRole.CARETAKER_MALE || user.role === UserRole.WARDEN_MALE) {
            where.studentGender = 'M';
        }
    }

    try {
        const outpasses = await prisma.outpass.findMany({ 
            where,
            orderBy: { requestedTime: 'desc' } 
        });
        const mapped = outpasses.map(o => ({
            _id: o.id,
            ...o,
            username: o.studentId,
            is_approved: o.isApproved,
            is_rejected: o.isRejected,
            is_expired: o.isExpired,
            requested_time: o.requestedTime,
            from_day: o.fromDay,
            to_day: o.toDay
        }));
        return res.json({ success: true, outpasses: mapped });
    } catch (e) {
        return res.status(500).json({ code: ErrorCode.INTERNAL_SERVER_ERROR });
    }
};
