/**
 * LDAP 配置控制器（管理面，需系统配置权限）。
 */
import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { LdapService } from './ldap.service.js';
import { SaveLdapConfigDto, TestLdapConfigDto } from './dto/ldap.dto.js';

@Controller('ldap')
export class LdapController {
  constructor(private readonly ldap: LdapService) {}

  /** 配置视图（bindPassword 只回「是否已设置」）。 */
  @Get('config')
  getConfig(): Promise<unknown> {
    return this.ldap.getConfig();
  }

  /** 保存配置。 */
  @Put('config')
  @OperationLog('LDAP', '保存配置')
  saveConfig(@Body() dto: SaveLdapConfigDto): Promise<unknown> {
    return this.ldap.saveConfig(dto);
  }

  /** 用已保存配置测试连接。 */
  @Post('test')
  @OperationLog('LDAP', '测试连接')
  testSaved(): Promise<unknown> {
    return this.ldap.testConnection();
  }

  /** 用表单里的参数测试连接（保存前校验，不落库）。 */
  @Post('test-preview')
  @OperationLog('LDAP', '测试连接')
  testPreview(@Body() dto: TestLdapConfigDto): Promise<unknown> {
    return this.ldap.testConnection(dto);
  }
}
