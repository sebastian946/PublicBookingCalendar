import { Response } from 'express';
import { authService } from './auth.service.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/error.middleware.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import type { RegisterInput, LoginInput, RefreshTokenInput, ChangePasswordInput } from './auth.schema.js';

export const register = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const input = req.body as RegisterInput;
  const result = await authService.register(input);
  sendCreated(res, result);
});

export const login = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const input = req.body as LoginInput;
  const tenantId = req.tenant?.id;
  const result = await authService.login(input, tenantId);
  sendSuccess(res, result);
});

export const refreshToken = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { refreshToken } = req.body as RefreshTokenInput;
  const tokens = await authService.refreshTokens(refreshToken);
  sendSuccess(res, tokens);
});

export const getProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const profile = await authService.getProfile(userId);
  sendSuccess(res, profile);
});

export const changePassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { currentPassword, newPassword } = req.body as ChangePasswordInput;
  const result = await authService.changePassword(userId, currentPassword, newPassword);
  sendSuccess(res, result);
});
