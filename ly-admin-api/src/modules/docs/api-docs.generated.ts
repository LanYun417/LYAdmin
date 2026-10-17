/**
 * 接口文档数据（自动生成，请勿手工编辑）。
 *
 * 由 `scripts/gen-api-docs.mjs` 在构建期扫描控制器产出；修改接口后请重新执行
 * `npm run docs:gen`（`npm run build` 的 prebuild 已自动接入）。
 */
import type { ApiDocGroup } from './docs.types.js';

export const API_DOCS: ApiDocGroup[] = [
  {
    "group": "仪表盘",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/dashboard/login-trend",
        "summary": "登录趋势",
        "permission": [],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "GET",
        "path": "/api/dashboard/operation-distribution",
        "summary": "操作类型分布",
        "permission": [],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "GET",
        "path": "/api/dashboard/role-user-count",
        "summary": "各角色用户数",
        "permission": [],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "GET",
        "path": "/api/dashboard/stats",
        "summary": "统计卡片",
        "permission": [],
        "isPublic": false,
        "action": ""
      }
    ]
  },
  {
    "group": "认证",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/auth/captcha",
        "summary": "图形验证码：公开接口（登录前获取）",
        "permission": [],
        "isPublic": true,
        "action": ""
      },
      {
        "method": "GET",
        "path": "/api/auth/menus",
        "summary": "当前用户菜单树（仅目录/菜单节点，按角色过滤）",
        "permission": [],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "GET",
        "path": "/api/auth/permissions",
        "summary": "当前用户权限码列表",
        "permission": [],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "GET",
        "path": "/api/auth/profile",
        "summary": "当前用户信息",
        "permission": [],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "POST",
        "path": "/api/auth/login",
        "summary": "登录。 挂载频率限制：连续失败 5 次 / 5 分钟 → 锁定 15 分钟（返回 429）",
        "permission": [],
        "isPublic": true,
        "action": "认证 · 登录"
      },
      {
        "method": "POST",
        "path": "/api/auth/logout",
        "summary": "登出",
        "permission": [],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "POST",
        "path": "/api/auth/refresh",
        "summary": "刷新 Token",
        "permission": [],
        "isPublic": true,
        "action": ""
      }
    ]
  },
  {
    "group": "用户管理",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/users",
        "summary": "分页列表（含数据权限过滤）",
        "permission": [
          "system:user:list"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "GET",
        "path": "/api/users/:id",
        "summary": "用户详情",
        "permission": [
          "system:user:query"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "POST",
        "path": "/api/users",
        "summary": "新增用户",
        "permission": [
          "system:user:add"
        ],
        "isPublic": false,
        "action": "用户管理 · 新增"
      },
      {
        "method": "PUT",
        "path": "/api/users/:id",
        "summary": "编辑用户",
        "permission": [
          "system:user:edit"
        ],
        "isPublic": false,
        "action": "用户管理 · 编辑"
      },
      {
        "method": "PUT",
        "path": "/api/users/:id/password",
        "summary": "重置密码",
        "permission": [
          "system:user:resetPwd"
        ],
        "isPublic": false,
        "action": "用户管理 · 重置密码"
      },
      {
        "method": "PUT",
        "path": "/api/users/:id/roles",
        "summary": "分配角色",
        "permission": [
          "system:user:assignRole"
        ],
        "isPublic": false,
        "action": "用户管理 · 分配角色"
      },
      {
        "method": "PUT",
        "path": "/api/users/:id/status",
        "summary": "启用/禁用",
        "permission": [
          "system:user:edit"
        ],
        "isPublic": false,
        "action": "用户管理 · 状态变更"
      },
      {
        "method": "DELETE",
        "path": "/api/users/:id",
        "summary": "删除用户",
        "permission": [
          "system:user:remove"
        ],
        "isPublic": false,
        "action": "用户管理 · 删除"
      }
    ]
  },
  {
    "group": "角色管理",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/roles",
        "summary": "角色分页列表",
        "permission": [
          "system:role:list"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "GET",
        "path": "/api/roles/:id/menus",
        "summary": "角色已授权菜单 id",
        "permission": [
          "system:role:query"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "GET",
        "path": "/api/roles/all",
        "summary": "全部角色下拉。 使用独立权限码 system:role:all，而非复用只读的 system:role:list： admin 角色刻意不授予 system:role:list，而本接口是给持 system:user:assignRole 的角色 拉取「分配角色」下拉框用的；复用 system:role:list 会把该能力收死，故新开独立码",
        "permission": [
          "system:role:all"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "POST",
        "path": "/api/roles",
        "summary": "新增角色",
        "permission": [
          "system:role:add"
        ],
        "isPublic": false,
        "action": "角色管理 · 新增"
      },
      {
        "method": "PUT",
        "path": "/api/roles/:id",
        "summary": "编辑角色",
        "permission": [
          "system:role:edit"
        ],
        "isPublic": false,
        "action": "角色管理 · 编辑"
      },
      {
        "method": "PUT",
        "path": "/api/roles/:id/menus",
        "summary": "授权角色菜单",
        "permission": [
          "system:role:assignMenu"
        ],
        "isPublic": false,
        "action": "角色管理 · 授权菜单"
      },
      {
        "method": "DELETE",
        "path": "/api/roles/:id",
        "summary": "删除角色",
        "permission": [
          "system:role:remove"
        ],
        "isPublic": false,
        "action": "角色管理 · 删除"
      }
    ]
  },
  {
    "group": "菜单管理",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/menus",
        "summary": "菜单列表（tree=1 返回树）",
        "permission": [
          "system:menu:list"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "GET",
        "path": "/api/menus/:id",
        "summary": "菜单详情",
        "permission": [
          "system:menu:query"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "GET",
        "path": "/api/menus/tree",
        "summary": "全量菜单树（含按钮，供角色授权）",
        "permission": [
          "system:menu:list",
          "system:role:list"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "POST",
        "path": "/api/menus",
        "summary": "创建菜单",
        "permission": [
          "system:menu:add"
        ],
        "isPublic": false,
        "action": "菜单管理 · 新增"
      },
      {
        "method": "PUT",
        "path": "/api/menus/:id",
        "summary": "更新菜单",
        "permission": [
          "system:menu:edit"
        ],
        "isPublic": false,
        "action": "菜单管理 · 编辑"
      },
      {
        "method": "DELETE",
        "path": "/api/menus/:id",
        "summary": "删除菜单",
        "permission": [
          "system:menu:remove"
        ],
        "isPublic": false,
        "action": "菜单管理 · 删除"
      }
    ]
  },
  {
    "group": "部门管理",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/depts",
        "summary": "部门列表（tree=1 时返回树）",
        "permission": [
          "system:dept:list"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "GET",
        "path": "/api/depts/:id",
        "summary": "部门详情",
        "permission": [
          "system:dept:query"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "GET",
        "path": "/api/depts/tree",
        "summary": "完整部门树（上级选择）",
        "permission": [
          "system:dept:list"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "POST",
        "path": "/api/depts",
        "summary": "新增部门",
        "permission": [
          "system:dept:add"
        ],
        "isPublic": false,
        "action": "部门管理 · 新增"
      },
      {
        "method": "PUT",
        "path": "/api/depts/:id",
        "summary": "编辑部门",
        "permission": [
          "system:dept:edit"
        ],
        "isPublic": false,
        "action": "部门管理 · 编辑"
      },
      {
        "method": "DELETE",
        "path": "/api/depts/:id",
        "summary": "删除部门",
        "permission": [
          "system:dept:remove"
        ],
        "isPublic": false,
        "action": "部门管理 · 删除"
      }
    ]
  },
  {
    "group": "字典管理",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/dict/data/:dictType",
        "summary": "按类型编码取启用中的字典项（标签 + 值）。 仅需登录、不设权限码（与 /api/profile 的「自有资源豁免」同类处理）",
        "permission": [],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "GET",
        "path": "/api/dict/items",
        "summary": "字典项分页列表（按 dictType 过滤）",
        "permission": [
          "system:dict:list"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "GET",
        "path": "/api/dict/types",
        "summary": "字典类型分页列表",
        "permission": [
          "system:dict:list"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "POST",
        "path": "/api/dict/items",
        "summary": "新增字典项",
        "permission": [
          "system:dict:add"
        ],
        "isPublic": false,
        "action": "字典管理 · 新增"
      },
      {
        "method": "POST",
        "path": "/api/dict/types",
        "summary": "新增字典类型",
        "permission": [
          "system:dict:add"
        ],
        "isPublic": false,
        "action": "字典管理 · 新增"
      },
      {
        "method": "PUT",
        "path": "/api/dict/items/:id",
        "summary": "编辑字典项",
        "permission": [
          "system:dict:edit"
        ],
        "isPublic": false,
        "action": "字典管理 · 编辑"
      },
      {
        "method": "PUT",
        "path": "/api/dict/items/:id/status",
        "summary": "启用 / 禁用字典项（写操作，复用 system:dict:edit）",
        "permission": [
          "system:dict:edit"
        ],
        "isPublic": false,
        "action": "字典管理 · 编辑"
      },
      {
        "method": "PUT",
        "path": "/api/dict/types/:id",
        "summary": "编辑字典类型",
        "permission": [
          "system:dict:edit"
        ],
        "isPublic": false,
        "action": "字典管理 · 编辑"
      },
      {
        "method": "PUT",
        "path": "/api/dict/types/:id/status",
        "summary": "启用 / 禁用字典类型（写操作，复用 system:dict:edit）",
        "permission": [
          "system:dict:edit"
        ],
        "isPublic": false,
        "action": "字典管理 · 编辑"
      },
      {
        "method": "DELETE",
        "path": "/api/dict/items/:id",
        "summary": "删除字典项",
        "permission": [
          "system:dict:remove"
        ],
        "isPublic": false,
        "action": "字典管理 · 删除"
      },
      {
        "method": "DELETE",
        "path": "/api/dict/types/:id",
        "summary": "删除字典类型（连带删除其下字典项）",
        "permission": [
          "system:dict:remove"
        ],
        "isPublic": false,
        "action": "字典管理 · 删除"
      }
    ]
  },
  {
    "group": "参数管理",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/configs",
        "summary": "参数分页列表",
        "permission": [
          "system:config:list"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "GET",
        "path": "/api/configs/:id",
        "summary": "参数详情",
        "permission": [
          "system:config:query"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "GET",
        "path": "/api/configs/data/:configKey",
        "summary": "按键取参数值（业务取数，仅需登录、不设权限码）",
        "permission": [],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "POST",
        "path": "/api/configs",
        "summary": "新增参数",
        "permission": [
          "system:config:add"
        ],
        "isPublic": false,
        "action": "参数管理 · 新增"
      },
      {
        "method": "PUT",
        "path": "/api/configs/:id",
        "summary": "编辑参数（键名不可改）",
        "permission": [
          "system:config:edit"
        ],
        "isPublic": false,
        "action": "参数管理 · 编辑"
      },
      {
        "method": "DELETE",
        "path": "/api/configs/:id",
        "summary": "删除参数（内置参数不可删除）",
        "permission": [
          "system:config:remove"
        ],
        "isPublic": false,
        "action": "参数管理 · 删除"
      }
    ]
  },
  {
    "group": "日志管理",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/logs/http",
        "summary": "HTTP 访问日志列表",
        "permission": [
          "log:http:list"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "GET",
        "path": "/api/logs/http/detail/:id",
        "summary": "HTTP 日志详情（请求 / 响应体按需加载）",
        "permission": [
          "log:http:list"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "GET",
        "path": "/api/logs/http/export",
        "summary": "导出 HTTP 访问日志 CSV",
        "permission": [
          "log:http:export"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "GET",
        "path": "/api/logs/login",
        "summary": "登录日志列表",
        "permission": [
          "log:login:list"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "GET",
        "path": "/api/logs/login/export",
        "summary": "导出登录日志 CSV",
        "permission": [
          "log:login:export"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "GET",
        "path": "/api/logs/operation",
        "summary": "操作日志列表",
        "permission": [
          "log:operation:list"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "GET",
        "path": "/api/logs/operation/export",
        "summary": "导出操作日志 CSV",
        "permission": [
          "log:operation:export"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "DELETE",
        "path": "/api/logs/http",
        "summary": "清空所有 HTTP 访问日志（高危操作，独立权限码 log:http:clear）",
        "permission": [
          "log:http:clear"
        ],
        "isPublic": false,
        "action": "日志管理 · 清空 HTTP 日志"
      }
    ]
  },
  {
    "group": "文件管理",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/files",
        "summary": "文件列表",
        "permission": [
          "file:list"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "GET",
        "path": "/api/files/:id/download",
        "summary": "下载文件：强制附件语义（Content-Disposition: attachment）。 中文文件名由 Express 自动编码；CR/LF/引号已去除避免响应头注入",
        "permission": [
          "file:download"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "GET",
        "path": "/api/files/check",
        "summary": "秒传预检：按内容哈希查询库内是否已存在相同文件",
        "permission": [
          "file:upload"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "GET",
        "path": "/api/files/types",
        "summary": "文件类型选项（对库内已有文件去重，供筛选下拉使用）",
        "permission": [
          "file:list"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "GET",
        "path": "/api/files/uploaders",
        "summary": "上传人选项（对库内已有上传人去重并关联用户表）",
        "permission": [
          "file:list"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "POST",
        "path": "/api/files/upload",
        "summary": "上传（单/多文件，兼容任意字段名）",
        "permission": [
          "file:upload"
        ],
        "isPublic": false,
        "action": "文件管理 · 上传"
      },
      {
        "method": "DELETE",
        "path": "/api/files/:id",
        "summary": "删除文件",
        "permission": [
          "file:remove"
        ],
        "isPublic": false,
        "action": "文件管理 · 删除"
      }
    ]
  },
  {
    "group": "代码生成",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/gen/tables",
        "summary": "列出全部业务表（读 information_schema.TABLES）",
        "permission": [
          "tool:gen:list"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "GET",
        "path": "/api/gen/tables/:tableName",
        "summary": "指定表的字段结构详情",
        "permission": [
          "tool:gen:list"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "POST",
        "path": "/api/gen/create",
        "summary": "生成代码并直接写入项目目录（含自动接线）",
        "permission": [
          "tool:gen:create"
        ],
        "isPublic": false,
        "action": "代码生成 · 写入项目"
      },
      {
        "method": "POST",
        "path": "/api/gen/download",
        "summary": "生成并下载代码（ZIP 二进制流）",
        "permission": [
          "tool:gen:download"
        ],
        "isPublic": false,
        "action": ""
      },
      {
        "method": "POST",
        "path": "/api/gen/preview",
        "summary": "在线预览生成的代码（返回文件列表）",
        "permission": [
          "tool:gen:preview"
        ],
        "isPublic": false,
        "action": ""
      }
    ]
  },
  {
    "group": "个人中心",
    "endpoints": [
      {
        "method": "POST",
        "path": "/api/profile/avatar",
        "summary": "更换头像",
        "permission": [],
        "isPublic": false,
        "action": "个人中心 · 更换头像"
      },
      {
        "method": "PUT",
        "path": "/api/profile",
        "summary": "修改资料",
        "permission": [],
        "isPublic": false,
        "action": "个人中心 · 修改资料"
      },
      {
        "method": "PUT",
        "path": "/api/profile/password",
        "summary": "修改密码",
        "permission": [],
        "isPublic": false,
        "action": "个人中心 · 修改密码"
      }
    ]
  },
  {
    "group": "接口文档",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/docs",
        "summary": "全部接口清单（按业务模块分组）",
        "permission": [],
        "isPublic": true,
        "action": ""
      }
    ]
  },
  {
    "group": "系统",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api",
        "summary": "健康检查：返回服务名称、状态与服务器时间",
        "permission": [],
        "isPublic": true,
        "action": ""
      }
    ]
  }
];
