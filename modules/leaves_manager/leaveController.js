const BaseAppError = require("../../errors/baseAppError");
const LeaveRequest = require("../../models/leaveRequestModel");
const LeaveBalance = require("../../models/leaveBalanceModel");
const User = require("../../models/userModel");
const LeaveType = require("../../models/leaveTypeModel");
const pool = require("../../config/db");

const calculateCalendarDays = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const diffTime = end - start;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    return diffDays;
};

const calculateBusinessDays = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    let count = 0;
    const current = new Date(start);

    while (current <= end) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }

    return count;
};

const validateDates = (startDate, endDate, leaveType = null) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new BaseAppError({
            message: "Invalid date format",
            errorCode: "INVALID_DATE_FORMAT",
            statusCode: 400,
            type: "VALIDATION_ERROR",
        });
    }

    if (start < today) {
        throw new BaseAppError({
            message: "Start date cannot be in the past",
            errorCode: "PAST_DATE",
            statusCode: 400,
            type: "VALIDATION_ERROR",
        });
    }

    if (end < start) {
        throw new BaseAppError({
            message: "End date cannot be before start date",
            errorCode: "INVALID_DATE_RANGE",
            statusCode: 400,
            type: "VALIDATION_ERROR",
        });
    }

    const days = leaveType?.name?.toLowerCase().includes('business')
        ? calculateBusinessDays(startDate, endDate)
        : calculateCalendarDays(startDate, endDate);

    if (days <= 0) {
        throw new BaseAppError({
            message: "Invalid date range",
            errorCode: "INVALID_DATE_RANGE",
            statusCode: 400,
            type: "VALIDATION_ERROR",
        });
    }

    return days;
};

const checkOverlappingRequests = async (userId, startDate, endDate, excludeRequestId = null) => {
    const overlapping = await LeaveRequest.findOverlapping(
        userId,
        startDate,
        endDate,
        excludeRequestId
    );
    return overlapping.length > 0;
};

const isManagerOf = async (managerId, employeeId) => {
    const employee = await User.findById(employeeId);
    return employee && employee.manager_id === managerId;
};

const submitRequest = async (req, res, next) => {
    try {
        const { leave_type_id, start_date, end_date, reason } = req.body;
        const user_id = req.user.id;

        const leaveType = await LeaveType.findById(leave_type_id);
        if (!leaveType) {
            throw new BaseAppError({
                message: "Leave type not found",
                errorCode: "LEAVE_TYPE_NOT_FOUND",
                statusCode: 404,
                type: "BUSINESS_ERROR",
            });
        }

        const days = validateDates(start_date, end_date, leaveType);

        const hasOverlap = await checkOverlappingRequests(user_id, start_date, end_date);
        if (hasOverlap) {
            throw new BaseAppError({
                message: "You already have a pending or approved request for this period",
                errorCode: "OVERLAPPING_REQUEST",
                statusCode: 400,
                type: "BUSINESS_ERROR",
            });
        }

        const balances = await LeaveBalance.getByUser(user_id);
        const leaveTypeBalance = balances.find(b => b.leave_type_id === parseInt(leave_type_id));

        if (!leaveTypeBalance) {
            throw new BaseAppError({
                message: "No balance found for this leave type",
                errorCode: "BALANCE_NOT_FOUND",
                statusCode: 400,
                type: "BUSINESS_ERROR",
            });
        }

        if (leaveTypeBalance.balance < days) {
            throw new BaseAppError({
                message: `Insufficient leave balance. Available: ${leaveTypeBalance.balance}, Requested: ${days}`,
                errorCode: "INSUFFICIENT_BALANCE",
                statusCode: 400,
                type: "BUSINESS_ERROR",
                details: {
                    available: leaveTypeBalance.balance,
                    requested: days,
                    leaveType: leaveType.name
                }
            });
        }

        const leaveRequest = await LeaveRequest.createLeaveRequest({
            user_id,
            leave_type_id,
            start_date,
            end_date,
            reason,
        });

        const responseRequest = {
            ...leaveRequest,
            calculated_days: days,
            leave_type_name: leaveType.name
        };

        res.status(201).json({
            message: "Leave request submitted successfully",
            leaveRequest: responseRequest,
        });
    } catch (error) {
        next(error);
    }
};

const getMyRequests = async (req, res, next) => {
    try {
        const requests = await LeaveRequest.getByUser(req.user.id);
        const enhancedRequests = await Promise.all(requests.map(async (request) => {
            const leaveType = await LeaveType.findById(request.leave_type_id);
            const reviewer = request.reviewed_by ? await User.findById(request.reviewed_by) : null;

            return {
                ...request,
                leave_type_name: leaveType?.name || 'Unknown',
                reviewer_name: reviewer?.name || null,
                duration_days: calculateCalendarDays(request.start_date, request.end_date),
                business_days: leaveType?.name?.toLowerCase().includes('business')
                    ? calculateBusinessDays(request.start_date, request.end_date)
                    : null
            };
        }));

        res.json(enhancedRequests);
    } catch (error) {
        next(error);
    }
};

const getMyBalance = async (req, res, next) => {
    try {
        const balances = await LeaveBalance.getByUser(req.user.id);
        const enhancedBalances = await Promise.all(balances.map(async (balance) => {
            const leaveType = await LeaveType.findById(balance.leave_type_id);
            return {
                ...balance,
                leave_type_name: leaveType?.name || 'Unknown',
                leave_type_description: leaveType?.description || null
            };
        }));

        res.json(enhancedBalances);
    } catch (error) {
        next(error);
    }
};

const getPendingRequests = async (req, res, next) => {
    try {
        const requests = await LeaveRequest.getPendingForManager(req.user.id);

        const enhancedRequests = await Promise.all(requests.map(async (request) => {
            const leaveType = await LeaveType.findById(request.leave_type_id);
            const employee = await User.findById(request.user_id);

            return {
                ...request,
                leave_type_name: leaveType?.name || 'Unknown',
                employee_name: employee?.name,
                employee_email: employee?.email,
                duration_days: calculateCalendarDays(request.start_date, request.end_date)
            };
        }));

        res.json(enhancedRequests);
    } catch (error) {
        next(error);
    }
};

const getTeamRequests = async (req, res, next) => {
    try {
        const employees = await User.findEmployeesByManager(req.user.id);
        const employeeIds = employees.map(emp => emp.id);

        const allRequests = [];
        for (const employeeId of employeeIds) {
            const requests = await LeaveRequest.getByUser(employeeId);
            allRequests.push(...requests);
        }

        allRequests.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

        const enhancedRequests = await Promise.all(allRequests.map(async (request) => {
            const leaveType = await LeaveType.findById(request.leave_type_id);
            const employee = employees.find(emp => emp.id === request.user_id);
            const reviewer = request.reviewed_by ? await User.findById(request.reviewed_by) : null;

            return {
                ...request,
                leave_type_name: leaveType?.name || 'Unknown',
                employee_name: employee?.name,
                employee_email: employee?.email,
                reviewer_name: reviewer?.name || null,
                duration_days: calculateCalendarDays(request.start_date, request.end_date)
            };
        }));

        res.json(enhancedRequests);
    } catch (error) {
        next(error);
    }
};

const getEmployeeBalance = async (req, res, next) => {
    try {
        const { employeeId } = req.params;
        const parsedEmployeeId = parseInt(employeeId);

        const employee = await User.findById(parsedEmployeeId);
        if (!employee) {
            throw new BaseAppError({
                message: "Employee not found",
                errorCode: "EMPLOYEE_NOT_FOUND",
                statusCode: 404,
                type: "BUSINESS_ERROR",
            });
        }

        if (employee.manager_id !== req.user.id) {
            throw new BaseAppError({
                message: "This employee does not report to you",
                errorCode: "UNAUTHORIZED",
                statusCode: 403,
                type: "AUTHORIZATION_ERROR",
            });
        }

        const balances = await LeaveBalance.getByUser(parsedEmployeeId);

        const enhancedBalances = await Promise.all(balances.map(async (balance) => {
            const leaveType = await LeaveType.findById(balance.leave_type_id);
            return {
                ...balance,
                leave_type_name: leaveType?.name || 'Unknown',
                employee_name: employee.name,
                employee_email: employee.email
            };
        }));

        res.json(enhancedBalances);
    } catch (error) {
        next(error);
    }
};

const processRequest = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, comments } = req.body;
        const parsedId = parseInt(id);

        // Get the leave request first to find the employee
        const leaveRequest = await LeaveRequest.findById(parsedId);
        if (!leaveRequest) {
            throw new BaseAppError({
                message: "Leave request not found",
                errorCode: "REQUEST_NOT_FOUND",
                statusCode: 404,
                type: "BUSINESS_ERROR",
            });
        }

        const employeeId = leaveRequest.user_id;

        if (!['approved', 'rejected'].includes(status)) {
            throw new BaseAppError({
                message: "Status must be either 'approved' or 'rejected'",
                errorCode: "INVALID_STATUS",
                statusCode: 400,
                type: "VALIDATION_ERROR",
            });
        }

        if (leaveRequest.status !== 'pending') {
            throw new BaseAppError({
                message: `This request has already been ${leaveRequest.status}`,
                errorCode: "REQUEST_ALREADY_PROCESSED",
                statusCode: 400,
                type: "BUSINESS_ERROR",
            });
        }

        const leaveType = await LeaveType.findById(leaveRequest.leave_type_id);
        const days = leaveType?.name?.toLowerCase().includes('business')
            ? calculateBusinessDays(leaveRequest.start_date, leaveRequest.end_date)
            : calculateCalendarDays(leaveRequest.start_date, leaveRequest.end_date);

        if (status === "approved") {
            const balance = await LeaveBalance.getByUserAndType(employeeId, leaveRequest.leave_type_id);

            if (!balance || balance.balance < days) {
                // Auto-reject if insufficient balance
                const updatedRequest = await LeaveRequest.updateStatus(
                    parsedId,
                    'rejected',
                    req.user.id,
                    comments || `Auto-rejected: Insufficient balance. Available: ${balance?.balance || 0}, Required: ${days}`
                );

                return res.json({
                    message: "Request auto-rejected due to insufficient balance",
                    leaveRequest: updatedRequest,
                });
            }

            // Deduct the balance
            const deducted = await LeaveBalance.deductBalance(
                employeeId,
                leaveRequest.leave_type_id,
                days
            );

            if (!deducted) {
                throw new BaseAppError({
                    message: "Failed to deduct leave balance",
                    errorCode: "BALANCE_DEDUCTION_FAILED",
                    statusCode: 500,
                    type: "SYSTEM_ERROR",
                });
            }
        }

        // Update request status
        const updatedRequest = await LeaveRequest.updateStatus(
            parsedId,
            status,
            req.user.id,
            comments
        );

        res.json({
            message: `Leave request ${status} successfully`,
            leaveRequest: {
                ...updatedRequest,
                deducted_days: status === 'approved' ? days : 0,
                leave_type_name: leaveType?.name
            },
        });

    } catch (error) {
        next(error);
    }
};

const getRequestById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const parsedId = parseInt(id);

        const leaveRequest = await LeaveRequest.findById(parsedId);

        if (!leaveRequest) {
            throw new BaseAppError({
                message: "Leave request not found",
                errorCode: "REQUEST_NOT_FOUND",
                statusCode: 404,
                type: "BUSINESS_ERROR",
            });
        }

        const leaveType = await LeaveType.findById(leaveRequest.leave_type_id);
        const employee = await User.findById(leaveRequest.user_id);
        const reviewer = leaveRequest.reviewed_by ? await User.findById(leaveRequest.reviewed_by) : null;

        const calendarDays = calculateCalendarDays(leaveRequest.start_date, leaveRequest.end_date);
        const businessDays = leaveType?.name?.toLowerCase().includes('business')
            ? calculateBusinessDays(leaveRequest.start_date, leaveRequest.end_date)
            : null;

        const balance = await LeaveBalance.getByUserAndType(leaveRequest.user_id, leaveRequest.leave_type_id);

        const enhancedRequest = {
            ...leaveRequest,
            leave_type_name: leaveType?.name || 'Unknown',
            leave_type_description: leaveType?.description,
            employee_name: employee?.name,
            employee_email: employee?.email,
            reviewer_name: reviewer?.name,
            reviewer_role: reviewer?.role,
            duration: {
                calendar_days: calendarDays,
                business_days: businessDays,
                start_date: leaveRequest.start_date,
                end_date: leaveRequest.end_date
            },
            current_balance: balance?.balance || 0,
            can_cancel: leaveRequest.status === 'pending' && leaveRequest.user_id === req.user.id
        };

        res.json(enhancedRequest);
    } catch (error) {
        next(error);
    }
};

const cancelRequest = async (req, res, next) => {
    try {
        const { id } = req.params;
        const parsedId = parseInt(id);

        const leaveRequest = await LeaveRequest.findById(parsedId);
        if (!leaveRequest) {
            throw new BaseAppError({
                message: "Leave request not found",
                errorCode: "REQUEST_NOT_FOUND",
                statusCode: 404,
                type: "BUSINESS_ERROR",
            });
        }

        if (leaveRequest.user_id !== req.user.id) {
            throw new BaseAppError({
                message: "You can only cancel your own requests",
                errorCode: "UNAUTHORIZED",
                statusCode: 403,
                type: "AUTHORIZATION_ERROR",
            });
        }

        if (leaveRequest.status !== 'pending') {
            throw new BaseAppError({
                message: `Cannot cancel a request that is already ${leaveRequest.status}`,
                errorCode: "INVALID_OPERATION",
                statusCode: 400,
                type: "BUSINESS_ERROR",
            });
        }

        const cancelledRequest = await LeaveRequest.updateStatus(
            parsedId,
            'cancelled', // Use 'cancelled' instead of 'rejected' for employee cancellations
            req.user.id,
            req.body.reason || 'Request cancelled by employee'
        );

        res.json({
            message: "Leave request cancelled successfully",
            leaveRequest: cancelledRequest,
        });
    } catch (error) {
        next(error);
    }
};

// controllers/leaveController.js

// Get calendar data for manager
const getCalendarData = async (req, res, next) => {
    try {
        const { month, year } = req.query;
        const managerId = req.user.id;

        // Default to current month if not provided
        const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
        const targetYear = year ? parseInt(year) : new Date().getFullYear();

        // Calculate first and last day of month
        const firstDay = new Date(targetYear, targetMonth - 1, 1);
        const lastDay = new Date(targetYear, targetMonth, 0);

        // Get all approved leaves for the manager's team in the specified month
        const query = `
            SELECT 
                lr.id,
                lr.start_date,
                lr.end_date,
                lr.reason,
                u.id as user_id,
                u.name as employee_name,
                lt.name as leave_type,
                lt.id as leave_type_id
            FROM leave_requests lr
            JOIN users u ON lr.user_id = u.id
            JOIN leave_types lt ON lr.leave_type_id = lt.id
            WHERE u.manager_id = $1 
                AND lr.status = 'approved'
                AND (
                    (lr.start_date BETWEEN $2 AND $3)
                    OR (lr.end_date BETWEEN $2 AND $3)
                    OR ($2 BETWEEN lr.start_date AND lr.end_date)
                )
            ORDER BY lr.start_date
        `;

        const values = [managerId, firstDay, lastDay];
        const result = await pool.query(query, values);

        // Format dates for frontend
        const leaves = result.rows.map(row => ({
            ...row,
            start_date: row.start_date.toISOString().split('T')[0],
            end_date: row.end_date.toISOString().split('T')[0]
        }));

        // Get team members for filtering
        const teamQuery = `
            SELECT id, name 
            FROM users 
            WHERE manager_id = $1
            ORDER BY name
        `;
        const teamResult = await pool.query(teamQuery, [managerId]);

        res.json({
            month: targetMonth,
            year: targetYear,
            leaves: leaves,
            teamMembers: teamResult.rows,
            calendar: generateCalendarGrid(targetYear, targetMonth, leaves)
        });

    } catch (error) {
        next(error);
    }
};

// Helper function to generate calendar grid
const generateCalendarGrid = (year, month, leaves) => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    const startDay = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const totalDays = lastDay.getDate();

    const weeks = [];
    let currentWeek = new Array(7).fill(null);

    // Fill in the days
    for (let i = 0; i < startDay; i++) {
        currentWeek[i] = { day: null, leaves: [] };
    }

    for (let day = 1; day <= totalDays; day++) {
        const currentDate = new Date(year, month - 1, day);
        const dateString = currentDate.toISOString().split('T')[0];

        // Find leaves for this day
        const dayLeaves = leaves.filter(leave => {
            const start = new Date(leave.start_date);
            const end = new Date(leave.end_date);
            const current = new Date(dateString);
            return current >= start && current <= end;
        });

        const weekIndex = Math.floor((day + startDay - 1) / 7);
        const dayIndex = (day + startDay - 1) % 7;

        if (!weeks[weekIndex]) {
            weeks[weekIndex] = new Array(7).fill(null);
        }

        weeks[weekIndex][dayIndex] = {
            day,
            date: dateString,
            leaves: dayLeaves,
            isToday: currentDate.toDateString() === new Date().toDateString()
        };
    }

    return weeks;
};


module.exports = {
    submitRequest,
    getMyRequests,
    getMyBalance,
    getPendingRequests,
    getTeamRequests,
    getEmployeeBalance,
    processRequest,
    getRequestById,
    cancelRequest,
    getCalendarData
};