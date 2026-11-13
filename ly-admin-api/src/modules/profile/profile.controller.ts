/**
 * 个人中心控制器。
 * 模块职责：解析个人中心请求、调用服务、组装统一响应。
 *
 * ⚠️ 权限说明：三个接口操作的是**用户自己的**资料/密码/头像，仅登录即可访问，
 * 有意只挂全局 AuthGuard 而不加 @RequirePermissions 权限码（角色菜单本就按查看类授权），
 * 但只读访客（演示账号 / viewer 角色）的自助修改会被 ProfileService 一律拒绝（409），
 * 需要变更时由超级管理员在「用户管理 → 重置密码 / 编辑用户」中处理。
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/auth/auth.guard.js';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import type { AuthUserContext } from '../../common/types.js';
import type { ResponseEnvelope } from '../../common/http/response.interceptor.js';
import { UPLOAD_MULTER_OPTIONS } from '../../common/file/upload.config.js';
import { ProfileService, type ProfileDetail } from './profile.service.js';
import { ChangePasswordDto, UpdateProfileDto, UpdateProfileExtraDto } from './dto/profile.dto.js';
import { IsUUID } from 'class-validator';

/** 会话 sid 路径参数（与监控模块同规格：36 位 uuid）。 */
export class SidParamDto {
  @IsUUID('4', { message: '会话 id 格式不正确' })
  id!: string;
}

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  /**
   * 个人中心详情：账户 + 扩展资料 + 会话画像。
   * 「本机」标记的 sid 来自守卫写入的 req.tokenSid（当前请求令牌的会话）。
   */
  @Get()
  async getProfileDetail(
    @CurrentUser() user: AuthUserContext,
    @Req() req: { tokenSid?: string },
  ): Promise<ResponseEnvelope<ProfileDetail>> {
    const detail = await this.profileService.getProfileDetail(user.userId, req.tokenSid);
    return { __raw: true, data: detail, message: 'success' };
  }

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

  /** 更新扩展资料（简介 / 生日 / 公司 / 职位 / 所在地）。 */
  @Put('extra')
  @OperationLog('个人中心', '修改扩展资料')
  async updateProfileExtra(
    @Body() dto: UpdateProfileExtraDto,
    @CurrentUser() user: AuthUserContext,
  ): Promise<ResponseEnvelope<ProfileDetail>> {
    const data = await this.profileService.updateProfileExtended(user.userId, dto, user.roles);
    return { __raw: true, data, message: '资料更新成功' };
  }

  /**
   * 下线自己的某个会话（「踢掉其他设备」）。
   * sid 归属校验在 service 内完成；当前会话不允许踢自己下线之外的设备没有限制——
   * 想踢当前设备也可以（多标签页场景有用），届时另一个标签页下次请求即失效。
   */
  @Delete('sessions/:id')
  @OperationLog('个人中心', '下线我的设备')
  async removeOwnSession(
    @Param() params: SidParamDto,
    @CurrentUser() user: AuthUserContext,
  ): Promise<ResponseEnvelope<null>> {
    await this.profileService.removeOwnSession(user.userId, params.id);
    return { __raw: true, data: null, message: '已下线该设备' };
  }
}
