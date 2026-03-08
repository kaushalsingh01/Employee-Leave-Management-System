const BaseAppError = require("../../errors/baseAppError");
const LeaveRequest = require("../../models/leaveRequestModel");
const LeaveBalance = require("../../models/leaveBalanceModel");
const User = require("../../models/userModel");
const LeaveType = require("../../models/leaveTypeModel");

// Helper function to calculate calendar days
const calculateCalendarDays = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const diffTime = end - start;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    return diffDays;
};

// Helper function to calculate business days (excluding weekends)
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

// Helper function to validate dates
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

// Helper function to check for overlapping requests
const checkOverlappingRequests = async (userId, startDate, endDate, excludeRequestId = null) => {
    const overlapping = await LeaveRequest.checkOverlapping(
        userId,
        startDate,
        endDate,
        excludeRequestId
    );
    return overlapping.length > 0;
};

// Helper function to check if user is manager of employee
const isManagerOf = async (managerId, employeeId) => {
    const employee = await User.findById(employeeId);
    return employee && employee.manager_id === managerId;
};

// ==================== EMPLOYEE ROUTES ====================

/**
 * POST / - Submit a new leave request
 * Access: Employee only
 */
const submitRequest = async (req, res, next) => {
    try {
        const { leave_type_id, start_date, end_date, reason } = req.body;
        const user_id = req.user.id;

        // Get leave type details
        const leaveType = await LeaveType.findById(leave_type_id);
        if (!leaveType) {
            throw new BaseAppError({
                message: "Leave type not found",
                errorCode: "LEAVE_TYPE_NOT_FOUND",
                statusCode: 404,
                type: "BUSINESS_ERROR",
            });
        }

        // Validate dates and calculate days
        const days = validateDates(start_date, end_date, leaveType);

        // Check for overlapping requests
        const hasOverlap = await checkOverlappingRequests(user_id, start_date, end_date);
        if (hasOverlap) {
            throw new BaseAppError({
                message: "You already have a pending or approved request for this period",
                errorCode: "OVERLAPPING_REQUEST",
                statusCode: 400,
                type: "BUSINESS_ERROR",
            });
        }

        // Check leave balance
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

        // Create leave request
        const leaveRequest = await LeaveRequest.createLeaveRequest({
            user_id,
            leave_type_id,
            start_date,
            end_date,
            reason,
        });

        // Add calculated days to response
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

/**
 * GET /my-requests - Get current user's leave requests
 * Access: Employee or Manager
 */
const getMyRequests = async (req, res, next) => {
    try {
        const requests = await LeaveRequest.getByUser(req.user.id);

        // Enhance requests with leave type names and calculated days
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

/**
 * GET /my-balance - Get current user's leave balances
 * Access: Employee or Manager
 */
const getMyBalance = async (req, res, next) => {
    try {
        const balances = await LeaveBalance.getByUser(req.user.id);

        // Enhance with leave type names
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

// ==================== MANAGER ROUTES ====================

/**
 * GET /pending - Get pending requests for manager's team
 * Access: Manager only
 */
const getPendingRequests = async (req, res, next) => {
    try {
        const requests = await LeaveRequest.getPendingForManager(req.user.id);

        // Enhance requests with additional info
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

/**
 * GET /team - Get all requests from manager's team
 * Access: Manager only
 */
const getTeamRequests = async (req, res, next) => {
    try {
        // Get all employees under this manager
        const employees = await User.findEmployeesByManager(req.user.id);
        const employeeIds = employees.map(emp => emp.id);

        // Get all requests for these employees
        const allRequests = [];
        for (const employeeId of employeeIds) {
            const requests = await LeaveRequest.getByUser(employeeId);
            allRequests.push(...requests);
        }

        // Sort by submitted_at descending
        allRequests.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

        // Enhance with employee and leave type info
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

/**
 * GET /team/:employeeId/balance - Get specific employee's leave balance
 * Access: Manager only
 */
const getEmployeeBalance = async (req, res, next) => {
    try {
        const { employeeId } = req.params;

        // Verify employee exists and belongs to this manager
        const employee = await User.findById(employeeId);
        if (!employee) {
            throw new BaseAppError({
                message: "Employee not found",
                errorCode: "EMPLOYEE_NOT_FOUND",
                statusCode: 404,
                type: "BUSINESS_ERROR",
            });
        }

        // This check is already done by isDirectManager middleware, but double-check
        if (employee.manager_id !== req.user.id) {
            throw new BaseAppError({
                message: "This employee does not report to you",
                errorCode: "UNAUTHORIZED",
                statusCode: 403,
                type: "AUTHORIZATION_ERROR",
            });
        }

        const balances = await LeaveBalance.getByUser(employeeId);

        // Enhance with leave type names
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

/**
 * PUT /:id/approve - Approve or reject a leave request
 * Access: Manager only (with isDirectManager check)
 */
const processRequest = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, comments } = req.body;

        // The employeeId is set by the middleware from the leave request
        const employeeId = req.employeeId;

        // Validate status
        if (!['approved', 'rejected'].includes(status)) {
            throw new BaseAppError({
                message: "Status must be either 'approved' or 'rejected'",
                errorCode: "INVALID_STATUS",
                statusCode: 400,
                type: "VALIDATION_ERROR",
            });
        }

        // Get the request details
        const leaveRequest = await LeaveRequest.findById(id);
        if (!leaveRequest) {
            throw new BaseAppError({
                message: "Leave request not found",
                errorCode: "REQUEST_NOT_FOUND",
                statusCode: 404,
                type: "BUSINESS_ERROR",
            });
        }

        // Check if request is already processed
        if (leaveRequest.status !== 'pending') {
            throw new BaseAppError({
                message: `This request has already been ${leaveRequest.status}`,
                errorCode: "REQUEST_ALREADY_PROCESSED",
                statusCode: 400,
                type: "BUSINESS_ERROR",
            });
        }

        // Get leave type for days calculation
        const leaveType = await LeaveType.findById(leaveRequest.leave_type_id);

        // Calculate days for balance deduction
        const days = leaveType?.name?.toLowerCase().includes('business')
            ? calculateBusinessDays(leaveRequest.start_date, leaveRequest.end_date)
            : calculateCalendarDays(leaveRequest.start_date, leaveRequest.end_date);

        // If approving, check balance again
        if (status === "approved") {
            const balance = await LeaveBalance.getBalance(employeeId, leaveRequest.leave_type_id);

            if (!balance || balance.balance < days) {
                // Auto-reject if insufficient balance
                const updatedRequest = await LeaveRequest.updateStatus(
                    id,
                    'rejected',
                    req.user.id,
                    comments || `Auto-rejected: Insufficient balance. Available: ${balance?.balance || 0}, Required: ${days}`
                );

                return res.json({
                    message: "Request auto-rejected due to insufficient balance",
                    leaveRequest: updatedRequest,
                });
            }

            // Deduct from balance
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

        // Update the request status
        const updatedRequest = await LeaveRequest.updateStatus(
            id,
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

// ==================== SHARED/OWNERSHIP ROUTES ====================

/**
 * GET /:id - Get specific leave request by ID
 * Access: Employee (own requests) or Manager (team requests)
 */
const getRequestById = async (req, res, next) => {
    try {
        const { id } = req.params;

        // The request is already fetched by middleware and attached to req
        // But we'll fetch it again to ensure we have latest data
        const leaveRequest = await LeaveRequest.findById(id);

        if (!leaveRequest) {
            throw new BaseAppError({
                message: "Leave request not found",
                errorCode: "REQUEST_NOT_FOUND",
                statusCode: 404,
                type: "BUSINESS_ERROR",
            });
        }

        // Get additional info
        const leaveType = await LeaveType.findById(leaveRequest.leave_type_id);
        const employee = await User.findById(leaveRequest.user_id);
        const reviewer = leaveRequest.reviewed_by ? await User.findById(leaveRequest.reviewed_by) : null;

        // Calculate days
        const calendarDays = calculateCalendarDays(leaveRequest.start_date, leaveRequest.end_date);
        const businessDays = leaveType?.name?.toLowerCase().includes('business')
            ? calculateBusinessDays(leaveRequest.start_date, leaveRequest.end_date)
            : null;

        // Get current balance for this leave type
        const currentBalance = await LeaveBalance.getBalance(leaveRequest.user_id, leaveRequest.leave_type_id);

        // Enhance response
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
            current_balance: currentBalance?.balance || 0,
            can_cancel: leaveRequest.status === 'pending' && leaveRequest.user_id === req.user.id
        };

        res.json(enhancedRequest);
    } catch (error) {
        next(error);
    }
};

/**
 * POST /:id/cancel - Cancel a pending leave request (optional additional route)
 * You may want to add this route if not already defined
 */
const cancelRequest = async (req, res, next) => {
    try {
        const { id } = req.params;

        const leaveRequest = await LeaveRequest.findById(id);
        if (!leaveRequest) {
            throw new BaseAppError({
                message: "Leave request not found",
                errorCode: "REQUEST_NOT_FOUND",
                statusCode: 404,
                type: "BUSINESS_ERROR",
            });
        }

        // Only the employee can cancel their own pending requests
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

        // Update status to rejected (or you could add a 'cancelled' status to your enum)
        const cancelledRequest = await LeaveRequest.updateStatus(
            id,
            'rejected',
            req.user.id,
            'Request cancelled by employee'
        );

        res.json({
            message: "Leave request cancelled successfully",
            leaveRequest: cancelledRequest,
        });
    } catch (error) {
        next(error);
    }
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
};