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
      "url": "http://localhost:3000",
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
      "name": "部门/岗位管理"
    }
  ],
  "paths": {
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
    "/api/profile": {
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
