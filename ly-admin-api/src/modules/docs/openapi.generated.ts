/**
 * OpenAPI 3.0 文档（自动生成，请勿手工编辑）。
 *
 * 由 `scripts/gen-api-docs.mjs` 在构建期从同一份控制器/DTO 扫描数据重映射生成；
 * 运行时由 `docs.controller` 的 `GET /api/docs/openapi.json` 注入响应示例后返回。
 * 可用于 Swagger UI / Redoc / Postman 导入 / 客户端代码生成。
 */
export const OPENAPI_DOC: Record<string, unknown> = {
  "openapi": "3.0.3",
  "info": {
    "title": "LY Admin API",
    "version": "1.0.0",
    "description": "LY Admin 后台接口（OpenAPI 3.0 导出）。所有成功响应统一包装为 { code, message, data }。"
  },
  "servers": [
    {
      "url": "http://localhost:3100",
      "description": "本地开发环境"
    }
  ],
  "tags": [
    {
      "name": "仪表盘"
    },
    {
      "name": "认证"
    },
    {
      "name": "用户管理"
    },
    {
      "name": "角色管理"
    },
    {
      "name": "菜单管理"
    },
    {
      "name": "字典管理"
    },
    {
      "name": "参数管理"
    },
    {
      "name": "定时任务"
    },
    {
      "name": "日志管理"
    },
    {
      "name": "文件管理"
    },
    {
      "name": "代码生成"
    },
    {
      "name": "个人中心"
    },
    {
      "name": "接口文档"
    },
    {
      "name": "在线用户"
    },
    {
      "name": "系统监控"
    },
    {
      "name": "通知中心"
    },
    {
      "name": "系统"
    },
    {
      "name": "SSO 配置"
    },
    {
      "name": "IP 访问控制"
    },
    {
      "name": "Sse"
    },
    {
      "name": "下载中心"
    },
    {
      "name": "告警中心"
    },
    {
      "name": "安全中心"
    },
    {
      "name": "开放 API"
    },
    {
      "name": "部门/岗位管理"
    }
  ],
  "paths": {
    "/api/dashboard/active-user-trend": {
      "get": {
        "tags": [
          "仪表盘"
        ],
        "summary": "活跃用户趋势",
        "operationId": "get__api_dashboard_active_user_trend",
        "parameters": [
          {
            "name": "days",
            "in": "query",
            "required": false,
            "schema": {
              "type": "number",
              "example": 7
            }
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/dashboard/login-trend": {
      "get": {
        "tags": [
          "仪表盘"
        ],
        "summary": "登录趋势",
        "operationId": "get__api_dashboard_login_trend",
        "parameters": [
          {
            "name": "days",
            "in": "query",
            "required": false,
            "schema": {
              "type": "number",
              "example": 7
            }
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/dashboard/operation-distribution": {
      "get": {
        "tags": [
          "仪表盘"
        ],
        "summary": "操作类型分布",
        "operationId": "get__api_dashboard_operation_distribution",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/dashboard/request-trend": {
      "get": {
        "tags": [
          "仪表盘"
        ],
        "summary": "请求量 / 错误数趋势",
        "operationId": "get__api_dashboard_request_trend",
        "parameters": [
          {
            "name": "days",
            "in": "query",
            "required": false,
            "schema": {
              "type": "number",
              "example": 7
            }
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/dashboard/role-user-count": {
      "get": {
        "tags": [
          "仪表盘"
        ],
        "summary": "各角色用户数",
        "operationId": "get__api_dashboard_role_user_count",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/dashboard/stats": {
      "get": {
        "tags": [
          "仪表盘"
        ],
        "summary": "统计卡片",
        "operationId": "get__api_dashboard_stats",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/auth/captcha": {
      "get": {
        "tags": [
          "认证"
        ],
        "summary": "图形验证码：公开接口（登录前获取）",
        "operationId": "get__api_auth_captcha",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/auth/menus": {
      "get": {
        "tags": [
          "认证"
        ],
        "summary": "当前用户菜单树（仅目录/菜单节点，按角色 + 用户级额外权限覆盖过滤）",
        "operationId": "get__api_auth_menus",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/auth/permissions": {
      "get": {
        "tags": [
          "认证"
        ],
        "summary": "当前用户权限码列表",
        "operationId": "get__api_auth_permissions",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/auth/profile": {
      "get": {
        "tags": [
          "认证"
        ],
        "summary": "当前用户信息",
        "operationId": "get__api_auth_profile",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/auth/login": {
      "post": {
        "tags": [
          "认证"
        ],
        "summary": "登录。 挂载频率限制：连续失败 5 次 / 5 分钟 → 锁定 15 分钟（返回 429）",
        "operationId": "post__api_auth_login",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/LoginDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/LoginDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/auth/logout": {
      "post": {
        "tags": [
          "认证"
        ],
        "summary": "登出",
        "operationId": "post__api_auth_logout",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/auth/mfa/verify": {
      "post": {
        "tags": [
          "认证"
        ],
        "summary": "二次验证（MFA）登录。 登录接口返回 `mfaRequired: true` 时，前端引导用户输入 authenticator 动态码 / 恢复码，连同 `mfaToken` 一起提交到这里换取正式双 Token",
        "operationId": "post__api_auth_mfa_verify",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/MfaVerifyLoginDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/MfaVerifyLoginDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/auth/refresh": {
      "post": {
        "tags": [
          "认证"
        ],
        "summary": "刷新 Token",
        "operationId": "post__api_auth_refresh",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/RefreshDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/RefreshDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/users": {
      "get": {
        "tags": [
          "用户管理"
        ],
        "summary": "分页列表（含数据权限过滤）",
        "operationId": "get__api_users",
        "parameters": [
          {
            "name": "username",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "status",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "deptId",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "用户管理"
        ],
        "summary": "新增用户",
        "operationId": "post__api_users",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateUserDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/CreateUserDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "用户管理"
        ],
        "summary": "批量删除用户。 复用单条删除的权限码（这是同一个能力，不该再拆一个权限出来）； 返回明细而非「全成功/全失败」：批量里被超管保护或自身账号挡下的条目要能说清原因",
        "operationId": "delete__api_users",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/IdsBodyDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/users/{id}": {
      "get": {
        "tags": [
          "用户管理"
        ],
        "summary": "用户详情",
        "operationId": "get__api_users__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "put": {
        "tags": [
          "用户管理"
        ],
        "summary": "编辑用户",
        "operationId": "put__api_users__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateUserDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/UpdateUserDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "用户管理"
        ],
        "summary": "删除用户",
        "operationId": "delete__api_users__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/users/{id}/menus": {
      "get": {
        "tags": [
          "用户管理"
        ],
        "summary": "用户的菜单权限概况：角色自带 / 额外授予 / 额外撤销 / 最终有效。 用于「额外权限」抽屉回填：最终有效用于勾选，角色自带用于标注来源",
        "operationId": "get__api_users__id_menus",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "put": {
        "tags": [
          "用户管理"
        ],
        "summary": "保存用户的额外菜单权限。 入参为「期望的最终有效菜单集合」，服务端与角色自带集合求差得出额外授予 / 额外撤销",
        "operationId": "put__api_users__id_menus",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/AssignUserMenuDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/AssignUserMenuDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/users/import/template": {
      "get": {
        "tags": [
          "用户管理"
        ],
        "summary": "下载 CSV 导入模板。 必须声明在 `@Get(':id')` **之前**：Nest 按声明顺序匹配，否则 `import/template` 会被 `:id` 吃掉",
        "operationId": "get__api_users_import_template",
        "responses": {
          "200": {
            "description": "文件流（CSV / ZIP / 附件），响应体为二进制，无 JSON 信封",
            "content": {
              "application/octet-stream": {
                "schema": {
                  "type": "string",
                  "format": "binary"
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/users/search": {
      "get": {
        "tags": [
          "用户管理"
        ],
        "summary": "用户搜索（公告「指定用户」选择器）。 仅登录即可访问（全局鉴权守卫保证），按用户名 / 昵称 / id 模糊匹配，返回最小化字段。 必须声明在 `@Get(':id')` **之前**，否则 `search` 会被 `:id` 吃掉",
        "operationId": "get__api_users_search",
        "parameters": [
          {
            "name": "trim",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/users/import": {
      "post": {
        "tags": [
          "用户管理"
        ],
        "summary": "批量导入用户（CSV，全成功或全不写）。 行级校验失败返回 200 + 逐行报告（`data.failed`），请求级问题（空文件/缺列/超行数）才是 400",
        "operationId": "post__api_users_import",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/users/{id}/password": {
      "put": {
        "tags": [
          "用户管理"
        ],
        "summary": "重置密码",
        "operationId": "put__api_users__id_password",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ResetPasswordDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/ResetPasswordDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/users/{id}/roles": {
      "put": {
        "tags": [
          "用户管理"
        ],
        "summary": "分配角色",
        "operationId": "put__api_users__id_roles",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/AssignRoleDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/AssignRoleDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/users/{id}/status": {
      "put": {
        "tags": [
          "用户管理"
        ],
        "summary": "启用/禁用",
        "operationId": "put__api_users__id_status",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/StatusDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/StatusDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/roles": {
      "get": {
        "tags": [
          "角色管理"
        ],
        "summary": "角色分页列表",
        "operationId": "get__api_roles",
        "parameters": [
          {
            "name": "roleName",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "status",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "角色管理"
        ],
        "summary": "新增角色",
        "operationId": "post__api_roles",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateRoleDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/CreateRoleDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "角色管理"
        ],
        "summary": "批量删除角色（复用单条删除的权限码；逐条执行并返回被跳过明细）",
        "operationId": "delete__api_roles",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/IdsBodyDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/roles/{id}/menus": {
      "get": {
        "tags": [
          "角色管理"
        ],
        "summary": "角色已授权菜单 id",
        "operationId": "get__api_roles__id_menus",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "put": {
        "tags": [
          "角色管理"
        ],
        "summary": "授权角色菜单",
        "operationId": "put__api_roles__id_menus",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/AssignMenuDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/AssignMenuDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/roles/all": {
      "get": {
        "tags": [
          "角色管理"
        ],
        "summary": "全部角色下拉。 使用独立权限码 system:role:all，而非复用只读的 system:role:list： admin 角色刻意不授予 system:role:list，而本接口是给持 system:user:assignRole 的角色 拉取「分配角色」下拉框用的；复用 system:role:list 会把该能力收死，故新开独立码",
        "operationId": "get__api_roles_all",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/roles/reset-menus": {
      "post": {
        "tags": [
          "角色管理"
        ],
        "summary": "按种子定义恢复角色的默认菜单授权（「恢复默认授权」）。 为什么需要它：启动种子只负责**首次创建**角色并写授权，不再每次重启都覆盖 （那会把运维调好的授权静默回滚）；所以\"想回到种子默认\"必须由运维显式触发。 权限码复用 `system:role:assignMenu`：这与「授权菜单」是同一种能力（写角色菜单授权）， 只是数据来源换成种子定义；按项目「同一能力不拆权限码」的约定不新增码",
        "operationId": "post__api_roles_reset_menus",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ResetRoleMenusDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/ResetRoleMenusDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/roles/{id}": {
      "put": {
        "tags": [
          "角色管理"
        ],
        "summary": "编辑角色",
        "operationId": "put__api_roles__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateRoleDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/UpdateRoleDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "角色管理"
        ],
        "summary": "删除角色",
        "operationId": "delete__api_roles__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/menus": {
      "get": {
        "tags": [
          "菜单管理"
        ],
        "summary": "菜单列表（tree=1 返回树）",
        "operationId": "get__api_menus",
        "parameters": [
          {
            "name": "menuName",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "status",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "tree",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "菜单管理"
        ],
        "summary": "创建菜单",
        "operationId": "post__api_menus",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/MenuUpsertDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/MenuUpsertDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/menus/{id}": {
      "get": {
        "tags": [
          "菜单管理"
        ],
        "summary": "菜单详情",
        "operationId": "get__api_menus__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "put": {
        "tags": [
          "菜单管理"
        ],
        "summary": "更新菜单",
        "operationId": "put__api_menus__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/MenuUpsertDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/MenuUpsertDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "菜单管理"
        ],
        "summary": "删除菜单",
        "operationId": "delete__api_menus__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/menus/tree": {
      "get": {
        "tags": [
          "菜单管理"
        ],
        "summary": "全量菜单树（含按钮，供角色授权）",
        "operationId": "get__api_menus_tree",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/dict/data/{dictType}": {
      "get": {
        "tags": [
          "字典管理"
        ],
        "summary": "按类型编码取启用中的字典项（标签 + 值）。 仅需登录、不设权限码（与 /api/profile 的「自有资源豁免」同类处理）",
        "operationId": "get__api_dict_data__dictType",
        "parameters": [
          {
            "name": "dictType",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 dictType"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/dict/items": {
      "get": {
        "tags": [
          "字典管理"
        ],
        "summary": "字典项分页列表（按 dictType 过滤）",
        "operationId": "get__api_dict_items",
        "parameters": [
          {
            "name": "dictType",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "dictLabel",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "status",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "字典管理"
        ],
        "summary": "新增字典项",
        "operationId": "post__api_dict_items",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateDictItemDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/CreateDictItemDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "字典管理"
        ],
        "summary": "批量删除字典项（逐条执行并返回被跳过明细）",
        "operationId": "delete__api_dict_items",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/IdsBodyDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/dict/types": {
      "get": {
        "tags": [
          "字典管理"
        ],
        "summary": "字典类型分页列表",
        "operationId": "get__api_dict_types",
        "parameters": [
          {
            "name": "dictName",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "dictType",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "status",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "字典管理"
        ],
        "summary": "新增字典类型",
        "operationId": "post__api_dict_types",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateDictTypeDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/CreateDictTypeDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "字典管理"
        ],
        "summary": "批量删除字典类型（连带删除各自字典项；逐条执行并返回被跳过明细）",
        "operationId": "delete__api_dict_types",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/IdsBodyDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/dict/items/{id}": {
      "put": {
        "tags": [
          "字典管理"
        ],
        "summary": "编辑字典项",
        "operationId": "put__api_dict_items__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateDictItemDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/UpdateDictItemDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "字典管理"
        ],
        "summary": "删除字典项",
        "operationId": "delete__api_dict_items__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/dict/items/{id}/status": {
      "put": {
        "tags": [
          "字典管理"
        ],
        "summary": "启用 / 禁用字典项（写操作，复用 system:dict:edit）",
        "operationId": "put__api_dict_items__id_status",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/SetStatusDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/SetStatusDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/dict/types/{id}": {
      "put": {
        "tags": [
          "字典管理"
        ],
        "summary": "编辑字典类型",
        "operationId": "put__api_dict_types__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateDictTypeDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/UpdateDictTypeDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "字典管理"
        ],
        "summary": "删除字典类型（连带删除其下字典项）",
        "operationId": "delete__api_dict_types__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/dict/types/{id}/status": {
      "put": {
        "tags": [
          "字典管理"
        ],
        "summary": "启用 / 禁用字典类型（写操作，复用 system:dict:edit）",
        "operationId": "put__api_dict_types__id_status",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/SetStatusDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/SetStatusDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/configs": {
      "get": {
        "tags": [
          "参数管理"
        ],
        "summary": "参数分页列表",
        "operationId": "get__api_configs",
        "parameters": [
          {
            "name": "configName",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "configKey",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "参数管理"
        ],
        "summary": "新增参数",
        "operationId": "post__api_configs",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateConfigDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/CreateConfigDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/configs/{id}": {
      "get": {
        "tags": [
          "参数管理"
        ],
        "summary": "参数详情",
        "operationId": "get__api_configs__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "put": {
        "tags": [
          "参数管理"
        ],
        "summary": "编辑参数（键名不可改）",
        "operationId": "put__api_configs__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateConfigDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/UpdateConfigDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "参数管理"
        ],
        "summary": "删除参数（内置参数不可删除）",
        "operationId": "delete__api_configs__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/configs/data/{configKey}": {
      "get": {
        "tags": [
          "参数管理"
        ],
        "summary": "按键取参数值（业务取数，仅需登录、不设权限码）",
        "operationId": "get__api_configs_data__configKey",
        "parameters": [
          {
            "name": "configKey",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 configKey"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/tasks": {
      "get": {
        "tags": [
          "定时任务"
        ],
        "summary": "定时任务列表（含调度状态与上次执行摘要）",
        "operationId": "get__api_tasks",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/tasks/{name}/logs": {
      "get": {
        "tags": [
          "定时任务"
        ],
        "summary": "某任务的执行记录（分页）。 查询参数用 `Record<string, unknown>` 而非 DTO：全局 ValidationPipe 开了 whitelist， DTO 里未声明的字段（page / pageSize）会被剥掉，导致分页参数丢失。 故与日志模块保持一致，筛选条件的解析放在 service 层",
        "operationId": "get__api_tasks__name_logs",
        "parameters": [
          {
            "name": "name",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 name"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/tasks/{name}/run": {
      "post": {
        "tags": [
          "定时任务"
        ],
        "summary": "手动触发任务（同步等待执行结果）",
        "operationId": "post__api_tasks__name_run",
        "parameters": [
          {
            "name": "name",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 name"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/logs/http": {
      "get": {
        "tags": [
          "日志管理"
        ],
        "summary": "HTTP 访问日志列表",
        "operationId": "get__api_logs_http",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "日志管理"
        ],
        "summary": "清空所有 HTTP 访问日志（高危操作，独立权限码 log:http:clear）",
        "operationId": "delete__api_logs_http",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/logs/http/detail/{id}": {
      "get": {
        "tags": [
          "日志管理"
        ],
        "summary": "HTTP 日志详情（请求 / 响应体按需加载）",
        "operationId": "get__api_logs_http_detail__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/logs/http/export": {
      "get": {
        "tags": [
          "日志管理"
        ],
        "summary": "导出 HTTP 访问日志 CSV（流式）",
        "operationId": "get__api_logs_http_export",
        "responses": {
          "200": {
            "description": "文件流（CSV / ZIP / 附件），响应体为二进制，无 JSON 信封",
            "content": {
              "application/octet-stream": {
                "schema": {
                  "type": "string",
                  "format": "binary"
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/logs/login": {
      "get": {
        "tags": [
          "日志管理"
        ],
        "summary": "登录日志列表",
        "operationId": "get__api_logs_login",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/logs/login/export": {
      "get": {
        "tags": [
          "日志管理"
        ],
        "summary": "导出登录日志 CSV（流式：分批查、逐批写，内存不随行数增长）",
        "operationId": "get__api_logs_login_export",
        "responses": {
          "200": {
            "description": "文件流（CSV / ZIP / 附件），响应体为二进制，无 JSON 信封",
            "content": {
              "application/octet-stream": {
                "schema": {
                  "type": "string",
                  "format": "binary"
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/logs/operation": {
      "get": {
        "tags": [
          "日志管理"
        ],
        "summary": "操作日志列表",
        "operationId": "get__api_logs_operation",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/logs/operation/export": {
      "get": {
        "tags": [
          "日志管理"
        ],
        "summary": "导出操作日志 CSV（流式）",
        "operationId": "get__api_logs_operation_export",
        "responses": {
          "200": {
            "description": "文件流（CSV / ZIP / 附件），响应体为二进制，无 JSON 信封",
            "content": {
              "application/octet-stream": {
                "schema": {
                  "type": "string",
                  "format": "binary"
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/logs/http/{id}": {
      "delete": {
        "tags": [
          "日志管理"
        ],
        "summary": "删除单条 HTTP 访问日志",
        "operationId": "delete__api_logs_http__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/logs/http/batch": {
      "delete": {
        "tags": [
          "日志管理"
        ],
        "summary": "批量删除 HTTP 访问日志（多选）",
        "operationId": "delete__api_logs_http_batch",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/IdsBodyDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/logs/login/{id}": {
      "delete": {
        "tags": [
          "日志管理"
        ],
        "summary": "删除单条登录日志",
        "operationId": "delete__api_logs_login__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/logs/login/batch": {
      "delete": {
        "tags": [
          "日志管理"
        ],
        "summary": "批量删除登录日志（多选）",
        "operationId": "delete__api_logs_login_batch",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/IdsBodyDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/logs/operation/{id}": {
      "delete": {
        "tags": [
          "日志管理"
        ],
        "summary": "删除单条操作日志",
        "operationId": "delete__api_logs_operation__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/logs/operation/batch": {
      "delete": {
        "tags": [
          "日志管理"
        ],
        "summary": "批量删除操作日志（多选）",
        "operationId": "delete__api_logs_operation_batch",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/IdsBodyDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/files": {
      "get": {
        "tags": [
          "文件管理"
        ],
        "summary": "文件列表",
        "operationId": "get__api_files",
        "parameters": [
          {
            "name": "originName",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "mimeType",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "uploaderId",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "bizType",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "bizId",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "startTime",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "endTime",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "minSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "maxSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/files/{id}/download": {
      "get": {
        "tags": [
          "文件管理"
        ],
        "summary": "下载文件：强制附件语义（Content-Disposition: attachment）。 中文文件名由 Express 自动编码；CR/LF/引号已去除避免响应头注入",
        "operationId": "get__api_files__id_download",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "文件流（CSV / ZIP / 附件），响应体为二进制，无 JSON 信封",
            "content": {
              "application/octet-stream": {
                "schema": {
                  "type": "string",
                  "format": "binary"
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/files/check": {
      "get": {
        "tags": [
          "文件管理"
        ],
        "summary": "秒传预检：按内容哈希查询库内是否已存在相同文件",
        "operationId": "get__api_files_check",
        "parameters": [
          {
            "name": "hash",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string",
              "example": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/files/chunk/status": {
      "get": {
        "tags": [
          "文件管理"
        ],
        "summary": "分片状态：已上传的序号列表（断点续传的依据）",
        "operationId": "get__api_files_chunk_status",
        "parameters": [
          {
            "name": "identifier",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string",
              "example": "示例值"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/files/quota": {
      "get": {
        "tags": [
          "文件管理"
        ],
        "summary": "当前用户的上传配额使用情况（供前端展示「已用 / 上限」）",
        "operationId": "get__api_files_quota",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/files/types": {
      "get": {
        "tags": [
          "文件管理"
        ],
        "summary": "文件类型选项（对库内已有文件去重，供筛选下拉使用）",
        "operationId": "get__api_files_types",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/files/uploaders": {
      "get": {
        "tags": [
          "文件管理"
        ],
        "summary": "上传人选项（对库内已有上传人去重并关联用户表）",
        "operationId": "get__api_files_uploaders",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/files/chunk": {
      "post": {
        "tags": [
          "文件管理"
        ],
        "summary": "分片上传（单片）。 前端把大文件切成 chunkSize 的片后逐片提交（字段名 `file`）， 中断后凭 identifier 查 chunk/status 续传，全部到齐后调 chunk/merge",
        "operationId": "post__api_files_chunk",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ChunkUploadDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/ChunkUploadDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "文件管理"
        ],
        "summary": "取消上传：清理该标识的全部分片（幂等）",
        "operationId": "delete__api_files_chunk",
        "parameters": [
          {
            "name": "identifier",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string",
              "example": "示例值"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/files/chunk/merge": {
      "post": {
        "tags": [
          "文件管理"
        ],
        "summary": "合并分片：拼合 → 大小核对 → 流式哈希 → 秒传去重 → 落库",
        "operationId": "post__api_files_chunk_merge",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/MergeChunkDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/MergeChunkDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/files/upload": {
      "post": {
        "tags": [
          "文件管理"
        ],
        "summary": "上传（单/多文件，兼容任意字段名）",
        "operationId": "post__api_files_upload",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UploadBizDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/UploadBizDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/files/{id}": {
      "delete": {
        "tags": [
          "文件管理"
        ],
        "summary": "删除文件",
        "operationId": "delete__api_files__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/gen/tables": {
      "get": {
        "tags": [
          "代码生成"
        ],
        "summary": "列出全部业务表（读 information_schema.TABLES）",
        "operationId": "get__api_gen_tables",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/gen/tables/{tableName}": {
      "get": {
        "tags": [
          "代码生成"
        ],
        "summary": "指定表的字段结构详情",
        "operationId": "get__api_gen_tables__tableName",
        "parameters": [
          {
            "name": "tableName",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 tableName"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/gen/create": {
      "post": {
        "tags": [
          "代码生成"
        ],
        "summary": "生成代码并直接写入项目目录（含自动接线）",
        "operationId": "post__api_gen_create",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/GenCreateDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/GenCreateDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/gen/download": {
      "post": {
        "tags": [
          "代码生成"
        ],
        "summary": "生成并下载代码（ZIP 二进制流）",
        "operationId": "post__api_gen_download",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/GenConfigDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "文件流（CSV / ZIP / 附件），响应体为二进制，无 JSON 信封",
            "content": {
              "application/octet-stream": {
                "schema": {
                  "type": "string",
                  "format": "binary"
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/gen/preview": {
      "post": {
        "tags": [
          "代码生成"
        ],
        "summary": "在线预览生成的代码（返回文件列表）",
        "operationId": "post__api_gen_preview",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/GenConfigDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/GenConfigDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/profile": {
      "get": {
        "tags": [
          "个人中心"
        ],
        "summary": "个人中心详情：账户 + 扩展资料 + 会话画像。 「本机」标记的 sid 来自守卫写入的 req.tokenSid（当前请求令牌的会话）",
        "operationId": "get__api_profile",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "put": {
        "tags": [
          "个人中心"
        ],
        "summary": "修改资料",
        "operationId": "put__api_profile",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateProfileDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/UpdateProfileDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/profile/avatar": {
      "post": {
        "tags": [
          "个人中心"
        ],
        "summary": "更换头像",
        "operationId": "post__api_profile_avatar",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/profile/extra": {
      "put": {
        "tags": [
          "个人中心"
        ],
        "summary": "更新扩展资料（简介 / 生日 / 公司 / 职位 / 所在地）",
        "operationId": "put__api_profile_extra",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateProfileExtraDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/UpdateProfileExtraDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/profile/password": {
      "put": {
        "tags": [
          "个人中心"
        ],
        "summary": "修改密码",
        "operationId": "put__api_profile_password",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ChangePasswordDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/ChangePasswordDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/profile/sessions/{id}": {
      "delete": {
        "tags": [
          "个人中心"
        ],
        "summary": "下线自己的某个会话（「踢掉其他设备」）。 sid 归属校验在 service 内完成；当前会话不允许踢自己下线之外的设备没有限制—— 想踢当前设备也可以（多标签页场景有用），届时另一个标签页下次请求即失效",
        "operationId": "delete__api_profile_sessions__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/docs": {
      "get": {
        "tags": [
          "接口文档"
        ],
        "summary": "全部接口清单（按业务模块分组）",
        "operationId": "get__api_docs",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/docs/openapi.json": {
      "get": {
        "tags": [
          "接口文档"
        ],
        "summary": "OpenAPI 3.0 文档（注入响应示例，server 指向当前运行实例，可直接被 Swagger UI 消费）",
        "operationId": "get__api_docs_openapi_json",
        "responses": {
          "200": {
            "description": "文件流（CSV / ZIP / 附件），响应体为二进制，无 JSON 信封",
            "content": {
              "application/octet-stream": {
                "schema": {
                  "type": "string",
                  "format": "binary"
                }
              }
            }
          }
        }
      }
    },
    "/api/monitor/online": {
      "get": {
        "tags": [
          "在线用户"
        ],
        "summary": "在线会话列表",
        "operationId": "get__api_monitor_online",
        "parameters": [
          {
            "name": "username",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "ip",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/monitor/online/{sid}": {
      "delete": {
        "tags": [
          "在线用户"
        ],
        "summary": "强制下线单个会话",
        "operationId": "delete__api_monitor_online__sid",
        "parameters": [
          {
            "name": "sid",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 sid"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/monitor/online/user/{userId}": {
      "delete": {
        "tags": [
          "在线用户"
        ],
        "summary": "强制下线某用户的全部会话",
        "operationId": "delete__api_monitor_online_user__userId",
        "parameters": [
          {
            "name": "userId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 userId"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/monitor/server": {
      "get": {
        "tags": [
          "系统监控"
        ],
        "summary": "系统资源快照。 刻意**不记操作日志**：页面每几秒轮询一次，记日志只会把 sys_operation_log 灌满噪音， 而\"读指标\"本身没有审计价值（真正需要留痕的是强退这类写操作）",
        "operationId": "get__api_monitor_server",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/notices": {
      "get": {
        "tags": [
          "通知中心"
        ],
        "summary": "我的收件箱（未读优先 + 时间倒序）",
        "operationId": "get__api_notices",
        "parameters": [
          {
            "name": "isRead",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "noticeType",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "title",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "通知中心"
        ],
        "summary": "发布通知（指定人或全员）",
        "operationId": "post__api_notices",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "通知中心"
        ],
        "summary": "清空我的通知",
        "operationId": "delete__api_notices",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/notices/unread-count": {
      "get": {
        "tags": [
          "通知中心"
        ],
        "summary": "未读数（顶栏红点）",
        "operationId": "get__api_notices_unread_count",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/notices/{id}/read": {
      "put": {
        "tags": [
          "通知中心"
        ],
        "summary": "标记已读",
        "operationId": "put__api_notices__id_read",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/notices/read-all": {
      "put": {
        "tags": [
          "通知中心"
        ],
        "summary": "全部标记已读",
        "operationId": "put__api_notices_read_all",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/notices/{id}": {
      "delete": {
        "tags": [
          "通知中心"
        ],
        "summary": "删除一条通知",
        "operationId": "delete__api_notices__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api": {
      "get": {
        "tags": [
          "系统"
        ],
        "summary": "健康检查：返回服务名称、状态与服务器时间",
        "operationId": "get__api",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/health/live": {
      "get": {
        "tags": [
          "系统"
        ],
        "summary": "存活探针：仅证明进程可响应，不探测任何依赖（供 livenessProbe）",
        "operationId": "get__api_health_live",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/health/ready": {
      "get": {
        "tags": [
          "系统"
        ],
        "summary": "就绪探针：探测 MySQL 与 Redis；MySQL 不可用返回 503，Redis 不可用标记 degraded（仍 200）",
        "operationId": "get__api_health_ready",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/sso/{id}/authorize": {
      "get": {
        "tags": [
          "SSO 配置"
        ],
        "summary": "取授权跳转地址（公开：前端拿到 URL 后自行 302）",
        "operationId": "get__api_sso__id_authorize",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/sso/admin/providers": {
      "get": {
        "tags": [
          "SSO 配置"
        ],
        "summary": "管理面：提供方列表（含完整配置，clientSecret 永不出库）",
        "operationId": "get__api_sso_admin_providers",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "SSO 配置"
        ],
        "summary": "管理面：新增提供方",
        "operationId": "post__api_sso_admin_providers",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/SsoProviderDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/SsoProviderDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/sso/admin/providers/{id}": {
      "get": {
        "tags": [
          "SSO 配置"
        ],
        "summary": "管理面：提供方详情",
        "operationId": "get__api_sso_admin_providers__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "put": {
        "tags": [
          "SSO 配置"
        ],
        "summary": "管理面：更新提供方（clientSecret 留空表示不修改）",
        "operationId": "put__api_sso_admin_providers__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/SsoProviderDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/SsoProviderDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "SSO 配置"
        ],
        "summary": "管理面：删除提供方（绑定关系一并清理）",
        "operationId": "delete__api_sso_admin_providers__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/sso/callback": {
      "get": {
        "tags": [
          "SSO 配置"
        ],
        "summary": "OIDC 回调（公开）。 换取一次性 ticket 后 302 到前端回调页；URL 上不出现正式令牌",
        "operationId": "get__api_sso_callback",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/sso/providers": {
      "get": {
        "tags": [
          "SSO 配置"
        ],
        "summary": "登录页可见的启用中提供方（公开）",
        "operationId": "get__api_sso_providers",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/sso/redeem": {
      "post": {
        "tags": [
          "SSO 配置"
        ],
        "summary": "前端用 ticket 换本站双 Token（公开）",
        "operationId": "post__api_sso_redeem",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/SsoRedeemDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/SsoRedeemDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/ip-rules": {
      "get": {
        "tags": [
          "IP 访问控制"
        ],
        "summary": "规则分页列表",
        "operationId": "get__api_ip_rules",
        "parameters": [
          {
            "name": "ip",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "ruleType",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "status",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "IP 访问控制"
        ],
        "summary": "新增规则",
        "operationId": "post__api_ip_rules",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateIpRuleDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/CreateIpRuleDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/ip-rules/{id}": {
      "get": {
        "tags": [
          "IP 访问控制"
        ],
        "summary": "规则详情",
        "operationId": "get__api_ip_rules__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "put": {
        "tags": [
          "IP 访问控制"
        ],
        "summary": "编辑规则（IP 不可改）",
        "operationId": "put__api_ip_rules__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateIpRuleDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/UpdateIpRuleDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "IP 访问控制"
        ],
        "summary": "删除规则",
        "operationId": "delete__api_ip_rules__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/ip-rules/{id}/hit-reset": {
      "put": {
        "tags": [
          "IP 访问控制"
        ],
        "summary": "清空命中计数",
        "operationId": "put__api_ip_rules__id_hit_reset",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/ip-rules/{id}/status": {
      "put": {
        "tags": [
          "IP 访问控制"
        ],
        "summary": "启停规则",
        "operationId": "put__api_ip_rules__id_status",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/sse/online-count": {
      "get": {
        "tags": [
          "Sse"
        ],
        "summary": "当前在线连接数（健康检查用：前端可对比判断 SSE 是否已断）",
        "operationId": "get__api_sse_online_count",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/sse/stream": {
      "get": {
        "tags": [
          "Sse"
        ],
        "summary": "SSE 连接入口：`GET /sse/stream?token=<accessToken>`。 前端 `new EventSource(url)` 即可；断线由浏览器自动重连（onerror 里兜底退避）",
        "operationId": "get__api_sse_stream",
        "responses": {
          "200": {
            "description": "文件流（CSV / ZIP / 附件），响应体为二进制，无 JSON 信封",
            "content": {
              "application/octet-stream": {
                "schema": {
                  "type": "string",
                  "format": "binary"
                }
              }
            }
          }
        }
      }
    },
    "/api/sse/topics": {
      "post": {
        "tags": [
          "Sse"
        ],
        "summary": "订阅 / 退订主题（当前仅 metrics；前端监控页挂载/卸载时调用）",
        "operationId": "post__api_sse_topics",
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/export-tasks": {
      "get": {
        "tags": [
          "下载中心"
        ],
        "summary": "我的导出任务（分页）",
        "operationId": "get__api_export_tasks",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "number",
              "example": 1
            }
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "number",
              "example": 1
            }
          },
          {
            "name": "module",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string",
              "example": "示例值"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "下载中心"
        ],
        "summary": "创建导出任务（秒回；生成与通知在后台进行）",
        "operationId": "post__api_export_tasks",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateExportTaskDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/CreateExportTaskDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/export-tasks/{id}/download": {
      "get": {
        "tags": [
          "下载中心"
        ],
        "summary": "下载导出文件（res.download 底层 send 库，Range 断点续传天然支持）",
        "operationId": "get__api_export_tasks__id_download",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "文件流（CSV / ZIP / 附件），响应体为二进制，无 JSON 信封",
            "content": {
              "application/octet-stream": {
                "schema": {
                  "type": "string",
                  "format": "binary"
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/export-tasks/{id}": {
      "delete": {
        "tags": [
          "下载中心"
        ],
        "summary": "删除任务（记录与文件一并删除）",
        "operationId": "delete__api_export_tasks__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/alert/channels": {
      "get": {
        "tags": [
          "告警中心"
        ],
        "summary": "渠道列表（敏感字段脱敏）",
        "operationId": "get__api_alert_channels",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "告警中心"
        ],
        "summary": "新增渠道",
        "operationId": "post__api_alert_channels",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/AlertChannelDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/AlertChannelDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/alert/channels/{id}": {
      "get": {
        "tags": [
          "告警中心"
        ],
        "summary": "渠道详情（编辑回显；敏感字段脱敏）",
        "operationId": "get__api_alert_channels__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "put": {
        "tags": [
          "告警中心"
        ],
        "summary": "更新渠道（未提供的敏感字段保留原值）",
        "operationId": "put__api_alert_channels__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/AlertChannelDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/AlertChannelDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "告警中心"
        ],
        "summary": "删除渠道",
        "operationId": "delete__api_alert_channels__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/alert/records": {
      "get": {
        "tags": [
          "告警中心"
        ],
        "summary": "投递记录分页列表",
        "operationId": "get__api_alert_records",
        "parameters": [
          {
            "name": "status",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string",
              "example": "示例值"
            }
          },
          {
            "name": "eventType",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string",
              "example": "示例值"
            }
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "number",
              "example": 1
            }
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "number",
              "example": 1
            }
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/alert/rules": {
      "get": {
        "tags": [
          "告警中心"
        ],
        "summary": "规则列表",
        "operationId": "get__api_alert_rules",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "告警中心"
        ],
        "summary": "新增规则",
        "operationId": "post__api_alert_rules",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/AlertRuleDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/AlertRuleDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/alert/channels/{id}/test": {
      "post": {
        "tags": [
          "告警中心"
        ],
        "summary": "测试发送（立即向该渠道投一条测试告警并落库）",
        "operationId": "post__api_alert_channels__id_test",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/alert/records/{id}/retry": {
      "post": {
        "tags": [
          "告警中心"
        ],
        "summary": "重投一条失败记录（原渠道集合）",
        "operationId": "post__api_alert_records__id_retry",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/alert/rules/{id}": {
      "put": {
        "tags": [
          "告警中心"
        ],
        "summary": "更新规则",
        "operationId": "put__api_alert_rules__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/AlertRuleDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/AlertRuleDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "告警中心"
        ],
        "summary": "删除规则",
        "operationId": "delete__api_alert_rules__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/mfa/status": {
      "get": {
        "tags": [
          "安全中心"
        ],
        "summary": "当前 MFA 状态",
        "operationId": "get__api_mfa_status",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/mfa/disable": {
      "post": {
        "tags": [
          "安全中心"
        ],
        "summary": "解绑（需登录口令）",
        "operationId": "post__api_mfa_disable",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/MfaDisableDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/MfaDisableDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/mfa/enable": {
      "post": {
        "tags": [
          "安全中心"
        ],
        "summary": "确认绑定：校验动态码后启用，返回一次性恢复码",
        "operationId": "post__api_mfa_enable",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/MfaEnableDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/MfaEnableDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/mfa/setup": {
      "post": {
        "tags": [
          "安全中心"
        ],
        "summary": "开始绑定：返回种子与 otpauth URL（需登录口令）",
        "operationId": "post__api_mfa_setup",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/MfaSetupDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/MfaSetupDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/mfa/recovery": {
      "put": {
        "tags": [
          "安全中心"
        ],
        "summary": "重新签发恢复码（需一次动态码校验，旧码作废）",
        "operationId": "put__api_mfa_recovery",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/MfaEnableDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/MfaEnableDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/open/keys": {
      "get": {
        "tags": [
          "开放 API"
        ],
        "summary": "密钥列表（含所属用户；密钥本体永不下发）",
        "operationId": "get__api_open_keys",
        "parameters": [
          {
            "name": "name",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string",
              "example": "log-archive"
            }
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "number",
              "example": 1
            }
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "number",
              "example": 1
            }
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "开放 API"
        ],
        "summary": "签发密钥（明文仅此一次返回，请妥善保存）",
        "operationId": "post__api_open_keys",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateApiKeyDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/CreateApiKeyDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/open/keys/{id}": {
      "get": {
        "tags": [
          "开放 API"
        ],
        "summary": "密钥详情",
        "operationId": "get__api_open_keys__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "put": {
        "tags": [
          "开放 API"
        ],
        "summary": "更新密钥配置（密钥本体不可改，轮换请删旧建新）",
        "operationId": "put__api_open_keys__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateApiKeyDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/UpdateApiKeyDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "开放 API"
        ],
        "summary": "删除密钥（立即失效）",
        "operationId": "delete__api_open_keys__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/open/webhook-deliveries": {
      "get": {
        "tags": [
          "开放 API"
        ],
        "summary": "投递记录分页",
        "operationId": "get__api_open_webhook_deliveries",
        "parameters": [
          {
            "name": "status",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string",
              "example": "示例值"
            }
          },
          {
            "name": "event",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string",
              "example": "示例值"
            }
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "number",
              "example": 1
            }
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "number",
              "example": 1
            }
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/open/webhooks": {
      "get": {
        "tags": [
          "开放 API"
        ],
        "summary": "订阅列表",
        "operationId": "get__api_open_webhooks",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "开放 API"
        ],
        "summary": "新增订阅",
        "operationId": "post__api_open_webhooks",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/WebhookDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/WebhookDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/open/webhooks/{id}": {
      "get": {
        "tags": [
          "开放 API"
        ],
        "summary": "订阅详情",
        "operationId": "get__api_open_webhooks__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "put": {
        "tags": [
          "开放 API"
        ],
        "summary": "更新订阅（secret 留空 = 不修改）",
        "operationId": "put__api_open_webhooks__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/WebhookDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/WebhookDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "开放 API"
        ],
        "summary": "删除订阅",
        "operationId": "delete__api_open_webhooks__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/open/webhooks/{id}/test": {
      "post": {
        "tags": [
          "开放 API"
        ],
        "summary": "手动测试推送",
        "operationId": "post__api_open_webhooks__id_test",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/open/keys/{id}/status": {
      "put": {
        "tags": [
          "开放 API"
        ],
        "summary": "启停密钥",
        "operationId": "put__api_open_keys__id_status",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/depts": {
      "get": {
        "tags": [
          "部门/岗位管理"
        ],
        "summary": "部门列表（tree=1 时返回树）",
        "operationId": "get__api_depts",
        "parameters": [
          {
            "name": "deptName",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "status",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "tree",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "动态查询条件（运行时从 query 对象读取，类型依实现）"
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "部门/岗位管理"
        ],
        "summary": "新增部门",
        "operationId": "post__api_depts",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/DeptUpsertDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/DeptUpsertDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/depts/{id}": {
      "get": {
        "tags": [
          "部门/岗位管理"
        ],
        "summary": "部门详情",
        "operationId": "get__api_depts__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "put": {
        "tags": [
          "部门/岗位管理"
        ],
        "summary": "编辑部门",
        "operationId": "put__api_depts__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/DeptUpsertDto"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "$ref": "#/components/schemas/DeptUpsertDto"
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "部门/岗位管理"
        ],
        "summary": "删除部门",
        "operationId": "delete__api_depts__id",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "路径参数 id"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {}
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/depts/tree": {
      "get": {
        "tags": [
          "部门/岗位管理"
        ],
        "summary": "完整部门树（上级选择）",
        "operationId": "get__api_depts_tree",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 1
            },
            "description": "页码"
          },
          {
            "name": "pageSize",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 10
            },
            "description": "每页条数"
          }
        ],
        "responses": {
          "200": {
            "description": "成功（统一信封 { code, message, data }）",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "code": {
                      "type": "integer",
                      "example": 0,
                      "description": "业务码，0 表示成功"
                    },
                    "message": {
                      "type": "string",
                      "example": "success"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "list": {
                          "type": "array",
                          "items": {}
                        },
                        "total": {
                          "type": "integer",
                          "example": 0
                        },
                        "page": {
                          "type": "integer",
                          "example": 1
                        },
                        "pageSize": {
                          "type": "integer",
                          "example": 10
                        }
                      }
                    }
                  },
                  "required": [
                    "code",
                    "message",
                    "data"
                  ]
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    }
  },
  "components": {
    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT"
      }
    },
    "schemas": {
      "LoginDto": {
        "type": "object",
        "properties": {
          "username": {
            "type": "string",
            "description": "登录账号",
            "example": "admin"
          },
          "password": {
            "type": "string",
            "description": "明文密码",
            "example": "123456"
          },
          "captchaId": {
            "type": "string",
            "description": "验证码 id（验证码启用时必填，由前端从 /auth/captcha 获取）",
            "example": "b7f3c1a2-0000-4a1b-9c3d-8e6f5a4b3c2d"
          },
          "captchaCode": {
            "type": "string",
            "description": "用户输入的验证码",
            "example": "A1B2"
          }
        },
        "required": [
          "username",
          "password"
        ]
      },
      "MfaVerifyLoginDto": {
        "type": "object",
        "properties": {
          "mfaToken": {
            "type": "string",
            "description": "登录流程下发的挑战令牌（mfaToken）",
            "example": "示例值"
          },
          "code": {
            "type": "string",
            "description": "动态码或恢复码（恢复码含连字符，放宽字符集）",
            "example": "示例值"
          },
          "timezoneOffset": {
            "type": "number",
            "description": "可选：客户端时区偏移（与登录请求保持一致口径，暂无业务用途，预留）",
            "example": 1
          }
        },
        "required": [
          "mfaToken",
          "code"
        ]
      },
      "RefreshDto": {
        "type": "object",
        "properties": {
          "refreshToken": {
            "type": "string",
            "description": "刷新令牌（refreshToken）",
            "example": "<登录返回的 refreshToken>"
          }
        },
        "required": [
          "refreshToken"
        ]
      },
      "CreateUserDto": {
        "type": "object",
        "properties": {
          "username": {
            "type": "string",
            "description": "登录账号：3~20 位字母/数字/下划线",
            "example": "admin"
          },
          "password": {
            "type": "string",
            "description": "明文密码：长度与复杂度统一由 common/auth/password-policy.ts 决定",
            "example": "123456"
          },
          "nickname": {
            "type": "string",
            "description": "昵称",
            "example": "示例用户"
          },
          "email": {
            "type": "string",
            "description": "邮箱（可空）",
            "example": "demo@example.com"
          },
          "phone": {
            "type": "string",
            "description": "手机号（可空）",
            "example": "13800138000"
          },
          "gender": {
            "type": "string",
            "description": "性别（字典 sys_user_sex 的值，可空）",
            "example": "1"
          },
          "status": {
            "type": "number",
            "description": "状态：1 启用 / 0 禁用，默认 1",
            "example": 1
          },
          "roleIds": {
            "type": "array",
            "items": {
              "type": "number"
            },
            "description": "角色 id 列表，默认空",
            "example": [
              1
            ]
          },
          "deptId": {
            "type": "number",
            "description": "部门 id（0 表示未分配），默认 0",
            "example": 1
          },
          "remark": {
            "type": "string",
            "description": "备注（可空）",
            "example": "示例备注"
          },
          "maxDevices": {
            "type": "string",
            "description": "单用户登录设备数上限：留空/null = 走全局 sys.login.maxDevices，0 = 不限制",
            "example": "示例值"
          }
        },
        "required": [
          "username",
          "password",
          "nickname"
        ]
      },
      "UpdateUserDto": {
        "type": "object",
        "properties": {
          "nickname": {
            "type": "string",
            "description": "昵称",
            "example": "示例用户"
          },
          "email": {
            "type": "string",
            "description": "邮箱（可空）",
            "example": "demo@example.com"
          },
          "phone": {
            "type": "string",
            "description": "手机号（可空）",
            "example": "13800138000"
          },
          "gender": {
            "type": "string",
            "description": "性别（可空）",
            "example": "1"
          },
          "status": {
            "type": "number",
            "description": "状态：1 启用 / 0 禁用，默认 1",
            "example": 1
          },
          "roleIds": {
            "type": "array",
            "items": {
              "type": "number"
            },
            "description": "角色 id 列表，默认空",
            "example": [
              1
            ]
          },
          "deptId": {
            "type": "number",
            "description": "部门 id（0 表示未分配），默认 0",
            "example": 1
          },
          "remark": {
            "type": "string",
            "description": "备注（可空）",
            "example": "示例备注"
          },
          "maxDevices": {
            "type": "string",
            "description": "单用户登录设备数上限：留空/null = 走全局 sys.login.maxDevices，0 = 不限制",
            "example": "示例值"
          }
        },
        "required": [
          "nickname"
        ]
      },
      "AssignUserMenuDto": {
        "type": "object",
        "properties": {
          "menuIds": {
            "type": "array",
            "items": {
              "type": "number"
            },
            "example": [
              1
            ]
          }
        }
      },
      "ResetPasswordDto": {
        "type": "object",
        "properties": {
          "password": {
            "type": "string",
            "example": "123456"
          }
        },
        "required": [
          "password"
        ]
      },
      "AssignRoleDto": {
        "type": "object",
        "properties": {
          "roleIds": {
            "type": "array",
            "items": {
              "type": "number"
            },
            "example": [
              1
            ]
          }
        }
      },
      "StatusDto": {
        "type": "object",
        "properties": {
          "status": {
            "type": "number",
            "example": 1
          }
        },
        "required": [
          "status"
        ]
      },
      "IdsBodyDto": {
        "type": "object",
        "properties": {
          "ids": {
            "type": "array",
            "items": {
              "type": "number"
            },
            "example": []
          }
        },
        "required": [
          "ids"
        ]
      },
      "CreateRoleDto": {
        "type": "object",
        "properties": {
          "roleName": {
            "type": "string",
            "example": "示例角色"
          },
          "roleCode": {
            "type": "string",
            "example": "demo_role"
          },
          "sort": {
            "type": "number",
            "example": 1
          },
          "status": {
            "type": "number",
            "example": 1
          },
          "dataScope": {
            "type": "number",
            "description": "数据权限范围：1 全部 / 2 自定义部门 / 3 本部门及以下 / 4 仅本人",
            "example": 1
          },
          "deptIds": {
            "type": "array",
            "items": {
              "type": "number"
            },
            "description": "自定义部门 id 列表（dataScope=2 时生效）",
            "example": [
              1
            ]
          },
          "remark": {
            "type": "string",
            "example": "示例备注"
          },
          "maxDevices": {
            "type": "string",
            "description": "角色级登录设备数上限：留空/null = 未设置（走全局），0 = 不限制",
            "example": "示例值"
          }
        },
        "required": [
          "roleName",
          "roleCode"
        ]
      },
      "ResetRoleMenusDto": {
        "type": "object",
        "properties": {
          "roleIds": {
            "type": "array",
            "items": {
              "type": "number"
            },
            "description": "目标角色 id；不传 / 传空数组 = 全部种子角色",
            "example": [
              1
            ]
          }
        }
      },
      "UpdateRoleDto": {
        "type": "object",
        "properties": {
          "roleName": {
            "type": "string",
            "example": "示例角色"
          },
          "sort": {
            "type": "number",
            "example": 1
          },
          "status": {
            "type": "number",
            "example": 1
          },
          "dataScope": {
            "type": "number",
            "description": "数据权限范围：1 全部 / 2 自定义部门 / 3 本部门及以下 / 4 仅本人",
            "example": 1
          },
          "deptIds": {
            "type": "array",
            "items": {
              "type": "number"
            },
            "description": "自定义部门 id 列表（dataScope=2 时生效）",
            "example": [
              1
            ]
          },
          "remark": {
            "type": "string",
            "example": "示例备注"
          },
          "maxDevices": {
            "type": "string",
            "description": "角色级登录设备数上限：留空/null = 未设置（走全局），0 = 不限制",
            "example": "示例值"
          }
        },
        "required": [
          "roleName"
        ]
      },
      "AssignMenuDto": {
        "type": "object",
        "properties": {
          "menuIds": {
            "type": "array",
            "items": {
              "type": "number"
            },
            "example": [
              1
            ]
          }
        }
      },
      "MenuUpsertDto": {
        "type": "object",
        "properties": {
          "parentId": {
            "type": "number",
            "example": 1
          },
          "menuName": {
            "type": "string",
            "example": "示例菜单"
          },
          "menuNameEn": {
            "type": "string",
            "example": "示例值"
          },
          "menuType": {
            "type": "string",
            "example": "C"
          },
          "path": {
            "type": "string",
            "example": "示例值"
          },
          "component": {
            "type": "string",
            "example": "示例值"
          },
          "icon": {
            "type": "string",
            "example": "示例值"
          },
          "permission": {
            "type": "string",
            "example": "示例值"
          },
          "sort": {
            "type": "number",
            "example": 1
          },
          "visible": {
            "type": "number",
            "example": 1
          },
          "status": {
            "type": "number",
            "example": 1
          },
          "redirect": {
            "type": "string",
            "example": "示例值"
          },
          "keepAlive": {
            "type": "number",
            "example": 1
          }
        },
        "required": [
          "menuName",
          "menuType"
        ]
      },
      "CreateDictItemDto": {
        "type": "object",
        "properties": {
          "dictType": {
            "type": "string",
            "description": "所属字典类型编码",
            "example": "sys_demo"
          },
          "dictLabel": {
            "type": "string",
            "description": "字典标签（展示文案）",
            "example": "示例标签"
          },
          "dictValue": {
            "type": "string",
            "description": "字典值（业务存储值）",
            "example": "1"
          },
          "sort": {
            "type": "number",
            "description": "排序",
            "example": 1
          },
          "status": {
            "type": "number",
            "description": "状态：1 启用 / 0 禁用",
            "example": 1
          },
          "remark": {
            "type": "string",
            "description": "备注",
            "example": "示例备注"
          }
        },
        "required": [
          "dictType",
          "dictLabel",
          "dictValue"
        ]
      },
      "CreateDictTypeDto": {
        "type": "object",
        "properties": {
          "dictName": {
            "type": "string",
            "description": "字典名称",
            "example": "示例字典"
          },
          "dictType": {
            "type": "string",
            "description": "字典类型编码（业务引用键，创建后不可修改）",
            "example": "sys_demo"
          },
          "status": {
            "type": "number",
            "description": "状态：1 启用 / 0 禁用",
            "example": 1
          },
          "remark": {
            "type": "string",
            "description": "备注",
            "example": "示例备注"
          }
        },
        "required": [
          "dictName",
          "dictType"
        ]
      },
      "UpdateDictItemDto": {
        "type": "object",
        "properties": {
          "dictLabel": {
            "type": "string",
            "description": "字典标签（展示文案）",
            "example": "示例标签"
          },
          "dictValue": {
            "type": "string",
            "description": "字典值（业务存储值）",
            "example": "1"
          },
          "sort": {
            "type": "number",
            "description": "排序",
            "example": 1
          },
          "status": {
            "type": "number",
            "description": "状态：1 启用 / 0 禁用",
            "example": 1
          },
          "remark": {
            "type": "string",
            "description": "备注",
            "example": "示例备注"
          }
        },
        "required": [
          "dictLabel",
          "dictValue"
        ]
      },
      "SetStatusDto": {
        "type": "object",
        "properties": {
          "status": {
            "type": "number",
            "description": "目标状态：1 启用 / 0 禁用",
            "example": 1
          }
        },
        "required": [
          "status"
        ]
      },
      "UpdateDictTypeDto": {
        "type": "object",
        "properties": {
          "dictName": {
            "type": "string",
            "description": "字典名称",
            "example": "示例字典"
          },
          "status": {
            "type": "number",
            "description": "状态：1 启用 / 0 禁用",
            "example": 1
          },
          "remark": {
            "type": "string",
            "description": "备注",
            "example": "示例备注"
          }
        },
        "required": [
          "dictName"
        ]
      },
      "CreateConfigDto": {
        "type": "object",
        "properties": {
          "configName": {
            "type": "string",
            "description": "参数名称",
            "example": "示例参数"
          },
          "configKey": {
            "type": "string",
            "description": "参数键名（业务引用键，创建后不可修改）",
            "example": "sys.demo.key"
          },
          "configValue": {
            "type": "string",
            "description": "参数值",
            "example": "示例值"
          },
          "remark": {
            "type": "string",
            "description": "备注",
            "example": "示例备注"
          }
        },
        "required": [
          "configName",
          "configKey"
        ]
      },
      "UpdateConfigDto": {
        "type": "object",
        "properties": {
          "configName": {
            "type": "string",
            "description": "参数名称",
            "example": "示例参数"
          },
          "configValue": {
            "type": "string",
            "description": "参数值",
            "example": "示例值"
          },
          "remark": {
            "type": "string",
            "description": "备注",
            "example": "示例备注"
          }
        },
        "required": [
          "configName"
        ]
      },
      "ChunkUploadDto": {
        "type": "object",
        "properties": {
          "identifier": {
            "type": "string",
            "description": "上传标识：同一文件的各分片必须一致（建议用文件内容的采样哈希）",
            "example": "示例值"
          },
          "chunkIndex": {
            "type": "number",
            "description": "分片序号（从 0 开始）",
            "example": 1
          },
          "totalChunks": {
            "type": "number",
            "description": "分片总数（1-10000）",
            "example": 1
          },
          "filename": {
            "type": "string",
            "description": "原始文件名（决定落盘扩展名分组与对外名称，按扩展名白名单校验）",
            "example": "示例值"
          },
          "totalSize": {
            "type": "number",
            "description": "文件总大小（字节）：合并时逐字节核对，防止缺片/错片",
            "example": 1
          }
        },
        "required": [
          "identifier",
          "chunkIndex",
          "totalChunks",
          "filename",
          "totalSize"
        ]
      },
      "MergeChunkDto": {
        "type": "object",
        "properties": {
          "identifier": {
            "type": "string",
            "example": "示例值"
          },
          "totalChunks": {
            "type": "number",
            "example": 1
          },
          "filename": {
            "type": "string",
            "example": "示例值"
          },
          "totalSize": {
            "type": "number",
            "example": 1
          },
          "mimeType": {
            "type": "string",
            "description": "文件 MIME（决定白名单校验；浏览器 `file.type`，为空串时按不允许处理，与直传同口径）",
            "example": "示例值"
          },
          "bizType": {
            "type": "string",
            "description": "业务类型：同直传的 UploadBizDto",
            "example": "示例值"
          },
          "bizId": {
            "type": "number",
            "description": "业务主键",
            "example": 1
          }
        },
        "required": [
          "identifier",
          "totalChunks",
          "filename",
          "totalSize"
        ]
      },
      "UploadBizDto": {
        "type": "object",
        "properties": {
          "bizType": {
            "type": "string",
            "description": "业务类型：模块标识，只允许字母/数字/下划线/连字符（避免塞入任意文本污染筛选）",
            "example": "示例值"
          },
          "bizId": {
            "type": "number",
            "description": "业务主键：表单里是字符串，需显式转数字后校验",
            "example": 1
          }
        }
      },
      "GenCreateDto": {
        "type": "object",
        "properties": {
          "overwrite": {
            "type": "boolean",
            "description": "同名文件已存在时是否覆盖（默认 false → 409 冲突）",
            "example": false
          }
        }
      },
      "GenConfigDto": {
        "type": "object",
        "properties": {
          "tableName": {
            "type": "string",
            "description": "数据库表名（必须真实存在）",
            "example": "sys_config"
          },
          "moduleName": {
            "type": "string",
            "description": "模块名（如 system）：字母开头，仅字母数字",
            "example": "demo"
          },
          "businessName": {
            "type": "string",
            "description": "业务名（如 user）：字母开头，仅字母数字，会拼进生成物路径",
            "example": "demo"
          },
          "author": {
            "type": "string",
            "description": "作者（写入文件头注释）",
            "example": "作者"
          },
          "isTree": {
            "type": "boolean",
            "description": "是否树形表：列表返回整棵树、不生成分页",
            "example": false
          },
          "treeParentField": {
            "type": "string",
            "description": "树形表父级字段名（默认 parentId）",
            "example": "示例值"
          },
          "columnOptions": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/GenColumnOptionDto"
            },
            "description": "各字段的控件类型 / 字典绑定（按 columnName 合并）",
            "example": []
          }
        },
        "required": [
          "tableName",
          "moduleName",
          "businessName"
        ]
      },
      "GenColumnOptionDto": {
        "type": "object",
        "properties": {
          "columnName": {
            "type": "string",
            "description": "列名（下划线形式，与表结构探测结果对应）",
            "example": "示例值"
          },
          "htmlType": {
            "type": "string",
            "description": "控件类型：普通输入框 / 字典下拉 / 树形父级选择",
            "example": "示例值"
          },
          "dictType": {
            "type": "string",
            "description": "绑定的字典类型编码（htmlType=select 时必填，由服务校验）",
            "example": "sys_demo"
          }
        },
        "required": [
          "columnName",
          "htmlType"
        ]
      },
      "UpdateProfileDto": {
        "type": "object",
        "properties": {
          "nickname": {
            "type": "string",
            "example": "示例用户"
          },
          "email": {
            "type": "string",
            "description": "邮箱：空串或合法邮箱（空串表示清空）。",
            "example": "demo@example.com"
          },
          "phone": {
            "type": "string",
            "description": "手机号：空串或合法手机号。",
            "example": "13800138000"
          },
          "gender": {
            "type": "string",
            "description": "性别：空串或最多 20 字符。",
            "example": "1"
          },
          "avatar": {
            "type": "string",
            "description": "头像地址：最多 255 字符。",
            "example": "/static/2026/avatar.png"
          }
        },
        "required": [
          "nickname"
        ]
      },
      "UpdateProfileExtraDto": {
        "type": "object",
        "properties": {
          "signature": {
            "type": "string",
            "description": "个人简介（签名）：空串表示清空。",
            "example": "示例值"
          },
          "birthday": {
            "type": "string",
            "description": "生日：`YYYY-MM-DD`；空串 / 不传表示保留或清空（null 清空）。",
            "example": "示例值"
          },
          "company": {
            "type": "string",
            "description": "公司 / 组织：空串表示清空。",
            "example": "示例值"
          },
          "position": {
            "type": "string",
            "description": "职位 / 岗位：空串表示清空。",
            "example": "示例值"
          },
          "address": {
            "type": "string",
            "description": "所在地：空串表示清空。",
            "example": "示例值"
          }
        }
      },
      "ChangePasswordDto": {
        "type": "object",
        "properties": {
          "oldPassword": {
            "type": "string",
            "example": "123456"
          },
          "newPassword": {
            "type": "string",
            "example": "123456"
          }
        },
        "required": [
          "oldPassword",
          "newPassword"
        ]
      },
      "SsoProviderDto": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "example": "log-archive"
          },
          "issuer": {
            "type": "string",
            "description": "OIDC issuer（校验 id_token 的 iss）",
            "example": "示例值"
          },
          "authorizationUrl": {
            "type": "string",
            "example": "示例值"
          },
          "tokenUrl": {
            "type": "string",
            "example": "示例值"
          },
          "userInfoUrl": {
            "type": "string",
            "example": "示例值"
          },
          "jwksUrl": {
            "type": "string",
            "description": "JWKS 端点；留空 = 不验签（仅内网自建提供方建议）",
            "example": "示例值"
          },
          "clientId": {
            "type": "string",
            "example": "示例值"
          },
          "clientSecret": {
            "type": "string",
            "description": "新增必填；更新可留空（不修改）",
            "example": "示例值"
          },
          "scopes": {
            "type": "string",
            "example": "示例值"
          },
          "redirectUri": {
            "type": "string",
            "description": "后端接收 code 的完整回调地址",
            "example": "示例值"
          },
          "fieldMapping": {
            "type": "string",
            "description": "字段映射 JSON（username/email/nickname/avatar 的 claim 名）",
            "example": "示例值"
          },
          "linkByEmail": {
            "type": "boolean",
            "example": true
          },
          "defaultRoleCodes": {
            "type": "string",
            "description": "自动建号时授予的角色编码（逗号分隔）",
            "example": "示例值"
          },
          "status": {
            "type": "number",
            "example": 1
          },
          "sort": {
            "type": "number",
            "example": 1
          },
          "remark": {
            "type": "string",
            "example": "示例备注"
          }
        },
        "required": [
          "name",
          "issuer",
          "authorizationUrl",
          "tokenUrl",
          "userInfoUrl",
          "clientId",
          "redirectUri"
        ]
      },
      "SsoRedeemDto": {
        "type": "object",
        "properties": {
          "ticket": {
            "type": "string",
            "example": "示例值"
          }
        },
        "required": [
          "ticket"
        ]
      },
      "CreateIpRuleDto": {
        "type": "object",
        "properties": {
          "ip": {
            "type": "string",
            "description": "IP 或 CIDR 段",
            "example": "示例值"
          },
          "ruleType": {
            "type": "number",
            "description": "规则类型：1 黑名单 / 2 白名单",
            "example": 1
          },
          "remark": {
            "type": "string",
            "description": "备注（封禁原因等）",
            "example": "示例备注"
          },
          "expiresAt": {
            "type": "string",
            "description": "过期时间（ISO 字符串；不传表示永久）",
            "example": "示例值"
          }
        },
        "required": [
          "ip",
          "ruleType"
        ]
      },
      "UpdateIpRuleDto": {
        "type": "object",
        "properties": {
          "ruleType": {
            "type": "number",
            "description": "规则类型",
            "example": 1
          },
          "remark": {
            "type": "string",
            "description": "备注",
            "example": "示例备注"
          },
          "expiresAt": {
            "type": "string",
            "description": "过期时间",
            "example": "示例值"
          }
        },
        "required": [
          "ruleType"
        ]
      },
      "CreateExportTaskDto": {
        "type": "object",
        "properties": {
          "module": {
            "type": "string",
            "description": "导出模块（决定用哪类日志的查询与表头）。",
            "example": "示例值"
          },
          "query": {
            "type": "string",
            "description": "筛选条件快照：前端把列表页当前的查询原样传来，后台按同一套 where 导出。 限深限长：只接受「键字符集合法 + 值为原始类型」的浅层对象， 拒绝嵌套对象/数组（导出条件不需要复杂结构，拒绝可防意外与滥用）。",
            "example": "示例值"
          },
          "timezoneOffset": {
            "type": "number",
            "description": "时区偏移（分钟）：CSV 时间列按此时区格式化，与请求头同一口径。",
            "example": 1
          }
        },
        "required": [
          "module"
        ]
      },
      "AlertChannelDto": {
        "type": "object",
        "properties": {
          "type": {
            "type": "string",
            "example": "示例值"
          },
          "name": {
            "type": "string",
            "example": "log-archive"
          },
          "config": {
            "type": "string",
            "description": "渠道配置 JSON（邮件 host/port/secure/user/pass/from/to；Webhook 类 webhook/url/secret）",
            "example": "示例值"
          },
          "status": {
            "type": "number",
            "example": 1
          },
          "sort": {
            "type": "number",
            "example": 1
          },
          "remark": {
            "type": "string",
            "example": "示例备注"
          }
        },
        "required": [
          "type",
          "name",
          "config"
        ]
      },
      "AlertRuleDto": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "example": "log-archive"
          },
          "eventType": {
            "type": "string",
            "description": "事件类型（如 export.failed / login.bruteForce / monitor.disk）",
            "example": "示例值"
          },
          "level": {
            "type": "string",
            "example": "示例值"
          },
          "channelIds": {
            "type": "array",
            "items": {
              "type": "number"
            },
            "description": "渠道 id 列表",
            "example": []
          },
          "cooldownSeconds": {
            "type": "number",
            "description": "冷却秒数（0 = 不冷却）",
            "example": 1
          },
          "status": {
            "type": "number",
            "example": 1
          },
          "remark": {
            "type": "string",
            "example": "示例备注"
          }
        },
        "required": [
          "name",
          "eventType",
          "level",
          "channelIds"
        ]
      },
      "MfaDisableDto": {
        "type": "object",
        "properties": {
          "password": {
            "type": "string",
            "example": "123456"
          }
        },
        "required": [
          "password"
        ]
      },
      "MfaEnableDto": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string",
            "example": "示例值"
          }
        },
        "required": [
          "code"
        ]
      },
      "MfaSetupDto": {
        "type": "object",
        "properties": {
          "password": {
            "type": "string",
            "example": "123456"
          }
        },
        "required": [
          "password"
        ]
      },
      "CreateApiKeyDto": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "example": "log-archive"
          },
          "userId": {
            "type": "number",
            "description": "所属用户 id：Key 以该用户身份调用接口",
            "example": 1
          },
          "scopes": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "权限范围：空 = 与所属用户一致；否则在其权限内取交集",
            "example": []
          },
          "allowIps": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "允许的调用 IP / CIDR；空 = 不限制",
            "example": []
          },
          "expiresAt": {
            "type": "string",
            "description": "过期时间 ISO 串；缺省 = 永久",
            "example": "示例值"
          },
          "remark": {
            "type": "string",
            "example": "示例备注"
          }
        },
        "required": [
          "name",
          "userId"
        ]
      },
      "WebhookDto": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "example": "log-archive"
          },
          "url": {
            "type": "string",
            "example": "https://example.com"
          },
          "events": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "订阅事件名列表；空 = 全部事件",
            "example": []
          },
          "secret": {
            "type": "string",
            "description": "签名密钥（更新时留空 = 不修改）",
            "example": "示例值"
          },
          "status": {
            "type": "number",
            "example": 1
          },
          "remark": {
            "type": "string",
            "example": "示例备注"
          }
        },
        "required": [
          "name",
          "url"
        ]
      },
      "UpdateApiKeyDto": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "example": "log-archive"
          },
          "scopes": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "example": []
          },
          "allowIps": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "example": []
          },
          "expiresAt": {
            "type": "string",
            "example": "示例值"
          },
          "remark": {
            "type": "string",
            "example": "示例备注"
          }
        }
      },
      "DeptUpsertDto": {
        "type": "object",
        "properties": {
          "parentId": {
            "type": "number",
            "example": 1
          },
          "deptType": {
            "type": "number",
            "description": "类型：1 部门 / 2 岗位（岗位为叶子节点，不能再挂下级）",
            "example": 1
          },
          "deptName": {
            "type": "string",
            "example": "示例部门"
          },
          "leader": {
            "type": "string",
            "example": "张三"
          },
          "phone": {
            "type": "string",
            "example": "13800138000"
          },
          "email": {
            "type": "string",
            "example": "demo@example.com"
          },
          "sort": {
            "type": "number",
            "example": 1
          },
          "status": {
            "type": "number",
            "example": 1
          }
        },
        "required": [
          "deptType",
          "deptName"
        ]
      }
    }
  }
};
