/**
 * 个人中心控制器。
 * 模块职责：解析个人中心请求、调用服务、组装统一响应。
 *
 * ⚠️ 权限说明：三个接口操作的是**用户自己的**资料/密码/头像，仅登录即可访问，
 * 有意只挂全局 AuthGuard 而不加 @RequirePermissions 权限码（角色菜单本就按查看类授权），
 * 但只读访客（演示账号 / viewer 角色）的自助修改会被 ProfileService 一律拒绝（409），
 * 需要变更时由超级管理员在「用户管理 → 重置密码 / 编辑用户」中处理。
 */
import { BadRequestException, Body, Controller, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/auth/auth.guard.js';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import type { AuthUserContext } from '../../common/types.js';
import type { ResponseEnvelope } from '../../common/http/response.interceptor.js';
import { UPLOAD_MULTER_OPTIONS } from '../../common/file/upload.config.js';
import { ProfileService } from './profile.service.js';
import { ChangePasswordDto, UpdateProfileDto } from './dto/profile.dto.js';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  /** 修改资料。 */
  @Put()
  @OperationLog('个人中心', '修改资料')
  async updateProfile(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: AuthUserContext,
  ): Promise<ResponseEnvelope<unknown>> {
    const data = await this.profileService.updateProfile(user.userId, dto, user.roles);
    return { __raw: true, data, message: '资料更新成功' };
  }

  /** 修改密码。 */
  @Put('password')
  @OperationLog('个人中心', '修改密码')
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: AuthUserContext,
  ): Promise<ResponseEnvelope<null>> {
    await this.profileService.changePassword(user.userId, dto, user.roles);
    return { __raw: true, data: null, message: '密码修改成功，请重新登录' };
  }

  /** 更换头像。 */
  @Post('avatar')
  @OperationLog('个人中心', '更换头像')
  @UseInterceptors(FileInterceptor('file', UPLOAD_MULTER_OPTIONS))
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUserContext,
  ): Promise<ResponseEnvelope<{ avatar: string }>> {
    if (!file) {
      throw new BadRequestException('未接收到头像文件');
    }
    const data = await this.profileService.updateAvatar(user.userId, file, user.roles);
    return { __raw: true, data, message: '头像更新成功' };
  }
}
