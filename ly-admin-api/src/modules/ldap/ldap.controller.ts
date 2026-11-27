/**
 * LDAP 配置控制器（管理面，需权限）。
 * 模块职责：单例配置的读取 / 保存 / 清空 / 连接测试。
 *
 * 权限口径（与种子菜单的按钮权限一致）：
 * - 读（GET /config、各类 test）→ `system:ldap:query`；
 * - 写（PUT/DELETE）→ `system:ldap:edit`。
 */
import { Body, Controller, Delete, Get, Post, Put } from '@nestjs/common';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import { LdapService } from './ldap.service.js';
import { SaveLdapConfigDto, TestLdapConfigDto } from './dto/ldap.dto.js';

@Controller('ldap')
export class LdapController {
  constructor(private readonly ldap: LdapService) {}

  /** 配置视图（bindPassword 只回「是否已设置」）。 */
  @Get('config')
  @RequirePermissions('system:ldap:query')
  getConfig(): Promise<unknown> {
    return this.ldap.getConfig();
  }

  /** 保存配置（停用时允许留空，见服务的校验口径）。 */
  @Put('config')
  @OperationLog('LDAP', '保存配置')
  @RequirePermissions('system:ldap:edit')
  saveConfig(@Body() dto: SaveLdapConfigDto): Promise<unknown> {
    return this.ldap.saveConfig(dto);
  }

  /** 清空配置（整行删除，回到「未配置 + 停用」初始态；含口令一并抹除）。 */
  @Delete('config')
  @OperationLog('LDAP', '清空配置')
  @RequirePermissions('system:ldap:edit')
  async clearConfig(): Promise<unknown> {
    await this.ldap.clearConfig();
    return this.ldap.getConfig();
  }

  /** 用已保存配置测试连接（只读：不落库）。 */
  @Post('test')
  @OperationLog('LDAP', '测试连接')
  @RequirePermissions('system:ldap:query')
  testSaved(): Promise<unknown> {
    return this.ldap.testConnection();
  }

  /** 用表单里的参数测试连接（保存前校验，不落库）。 */
  @Post('test-preview')
  @OperationLog('LDAP', '测试连接')
  @RequirePermissions('system:ldap:query')
  testPreview(@Body() dto: TestLdapConfigDto): Promise<unknown> {
    return this.ldap.testConnection(dto);
  }
}
