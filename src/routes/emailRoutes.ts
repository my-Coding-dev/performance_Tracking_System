import { Router } from 'express';
import * as emailController from '../controllers/emailController';

const router = Router();

/**
 * @route POST /api/v1/email/alert
 * @description Send a system alert email
 * @access Private
 */
router.post('/alert', emailController.sendAlertEmail);

/**
 * @route POST /api/v1/email/report
 * @description Send a performance report email
 * @access Private
 */
router.post('/report', emailController.sendPerformanceReport);

export default router; 