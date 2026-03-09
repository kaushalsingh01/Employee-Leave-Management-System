const { Router } = require("express");
const authenticate = require("../../middlewares/authmiddleware");
const { authorize, isDirectManager, isOwnerOrManager } = require("../../middlewares/rbac");
const validate = require("../../middlewares/validationMiddleware");
const leaveController = require("./leaveController");
const LeaveRequest = require("../../models/leaveRequestModel");
const BaseAppError = require("../../errors/baseAppError"); 

const router = Router();

router.use(authenticate);

router.post("/",
    authorize("employee"),
    validate.leaveRequest,
    leaveController.submitRequest
);

router.get("/calendar",
    authorize("manager"),
    validate.dateRange,
    leaveController.getCalendarData
);

router.get("/my-requests",
    authorize("employee", "manager"),
    leaveController.getMyRequests
);

router.get("/my-balance",
    authorize("employee", "manager"),
    leaveController.getMyBalance
);

router.get("/pending",
    authorize("manager"),
    leaveController.getPendingRequests
);

router.get("/team",
    authorize("manager"),
    leaveController.getTeamRequests
);

router.get("/team/:employeeId/balance",
    authorize("manager"),
    validate.idParam, 
    leaveController.getEmployeeBalance
);

router.put("/:id/approve",
    authorize("manager"),
    validate.idParam,
    validate.approveReject,
    async (req, res, next) => {
        try {
            const leaveRequest = await LeaveRequest.findById(req.params.id);
            if (!leaveRequest) {
                throw new BaseAppError({
                    statusCode: 404,
                    message: "Leave request not found"
                });
            }
            req.employeeId = leaveRequest.user_id;
            next();
        } catch (error) {
            next(error);
        }
    },
    isDirectManager((req) => req.employeeId),
    leaveController.processRequest
);

router.get("/:id",
    authorize("employee", "manager"),
    validate.idParam,
    async (req, res, next) => {
        try {
            const leaveRequest = await LeaveRequest.findById(req.params.id);
            if (!leaveRequest) {
                throw new BaseAppError({
                    statusCode: 404,
                    message: "Leave request not found"
                });
            }
            req.resourceOwnerId = leaveRequest.user_id;
            next();
        } catch (error) {
            next(error);
        }
    },
    isOwnerOrManager((req) => req.resourceOwnerId),
    leaveController.getRequestById
);

router.post("/:id/cancel",
    authorize("employee"),
    validate.idParam,
    async (req, res, next) => {
        try {
            const leaveRequest = await LeaveRequest.findById(req.params.id);
            if (!leaveRequest) {
                throw new BaseAppError({
                    statusCode: 404,
                    message: "Leave request not found"
                });
            }

            if (leaveRequest.status !== "pending") {
                throw new BaseAppError({
                    statusCode: 400,
                    message: "Can only cancel pending requests"
                });
            }

            req.resourceOwnerId = leaveRequest.user_id;
            next();
        } catch (error) {
            next(error);
        }
    },
    isOwnerOrManager((req) => req.resourceOwnerId),
    leaveController.cancelRequest
);

module.exports = router;