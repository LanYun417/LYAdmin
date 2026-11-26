/**
 * 代码生成器增强回归：i18n 片段与 service 冒烟测试骨架。
 * 只锁「生成物包含这些文件且内容可读」——模板细节由既有契约测试与人工评审把关。
 */
process.env.JWT_ACCESS_SECRET = 'gen-test-access-secret-not-for-production-01';
process.env.JWT_REFRESH_SECRET = 'gen-test-refresh-secret-not-for-production-2';

const { generateFiles } = await import('../src/modules/gen/gen.templates.js');
import type { GenColumn, GenConfig } from '../src/modules/gen/gen.service.js';

describe('generateFiles 增强产物', () => {
  const config: GenConfig = {
    tableName: 'sys_article',
    moduleName: 'content',
    businessName: 'article',
    author: 'tester',
    columnOptions: [
      { columnName: 'title', htmlType: 'input' },
      { columnName: 'status', htmlType: 'select', dictType: 'sys_article_status' },
    ],
  };
  const columns = [
    {
      columnName: 'id',
      fieldName: 'id',
      columnType: 'bigint',
      dataType: 'bigint',
      tsType: 'number',
      columnComment: '主键',
      isPk: true,
      isNullable: false,
      htmlType: 'input',
      dictType: '',
    },
    {
      columnName: 'title',
      fieldName: 'title',
      columnType: 'varchar(100)',
      dataType: 'varchar',
      tsType: 'string',
      columnComment: '标题',
      isPk: false,
      isNullable: false,
      htmlType: 'input',
      dictType: '',
    },
    {
      columnName: 'status',
      fieldName: 'status',
      columnType: 'tinyint',
      dataType: 'tinyint',
      tsType: 'number',
      columnComment: '状态',
      isPk: false,
      isNullable: false,
      htmlType: 'select',
      dictType: 'sys_article_status',
    },
  ] as unknown as GenColumn[];

  it('附带 i18n 片段（key 含 title 与各可编辑字段）', () => {
    const files = generateFiles(config, columns, '文章表');
    const snippet = files.find((file) => file.path === 'frontend/i18n/locale.snippet.ts');
    expect(snippet).toBeTruthy();
    expect(snippet?.content).toContain('文章表');
    expect(snippet?.content).toContain("title: '文章表'");
    expect(snippet?.content).toContain("field1: '标题'");
    expect(snippet?.content).toContain('guard:locale');
  });

  it('附带 service 冒烟测试骨架（三条默认断言 + 占位）', () => {
    const files = generateFiles(config, columns, '文章表');
    const spec = files.find((file) => file.path === 'backend/modules/article/article.service.spec.ts');
    expect(spec).toBeTruthy();
    expect(spec?.content).toContain('ArticleService');
    expect(spec?.content).toContain('分页结构');
    expect(spec?.content).toContain('404');
  });

  it('原有产物仍在（module/controller/service/dto/前端页面）', () => {
    const files = generateFiles(config, columns, '文章表');
    const paths = files.map((file) => file.path);
    expect(paths).toContain('backend/modules/article/article.module.ts');
    expect(paths).toContain('frontend/views/content/article/index.vue');
    expect(paths).toContain('README.md');
  });
});
