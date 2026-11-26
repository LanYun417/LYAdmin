-- CreateTable: 二次验证（TOTP）状态表
CREATE TABLE `sys_user_mfa` (
    `id` BIGINT NOT NULL COMMENT '用户 id（即主键，一对一）',
    `secret` VARCHAR(500) NOT NULL COMMENT '加密信封格式的 TOTP 种子（v1:iv:ct:tag）',
    `enabled` TINYINT NOT NULL DEFAULT 0 COMMENT '1 启用 / 0 未启用',
    `recovery` TEXT NULL COMMENT '恢复码（JSON 数组，元素为 bcrypt 哈希；一次性使用）',
    `enabled_at` DATETIME(3) NULL COMMENT '启用时间',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    `updated_at` DATETIME(3) NOT NULL COMMENT '更新时间',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: SSO 提供方配置表
CREATE TABLE `sys_sso_provider` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `name` VARCHAR(50) NOT NULL COMMENT '提供方名称（登录页按钮文案）',
    `protocol` VARCHAR(20) NOT NULL DEFAULT 'oidc' COMMENT '协议类型：oidc',
    `issuer` VARCHAR(255) NOT NULL COMMENT 'OIDC issuer（用于发现或校验）',
    `authorization_url` VARCHAR(500) NOT NULL COMMENT '授权端点',
    `token_url` VARCHAR(500) NOT NULL COMMENT '令牌端点',
    `user_info_url` VARCHAR(500) NOT NULL COMMENT '用户信息端点',
    `jwks_url` VARCHAR(500) NULL COMMENT 'JWKS 端点（校验 id_token；为空则跳过签名校验，仅用于内网自建提供方）',
    `client_id` VARCHAR(255) NOT NULL COMMENT '客户端 id',
    `client_secret` VARCHAR(500) NOT NULL COMMENT '客户端密钥（信封加密）',
    `scopes` VARCHAR(255) NOT NULL DEFAULT 'openid profile email' COMMENT '授权请求 scope（空格分隔）',
    `redirect_uri` VARCHAR(500) NOT NULL COMMENT '回调地址（后端接收 code 的完整 URL）',
    `field_mapping` TEXT NULL COMMENT '用户字段映射配置（JSON：username/email/nickname/avatar 的 claim 名）',
    `link_by_email` TINYINT NOT NULL DEFAULT 1 COMMENT '是否按邮箱自动绑定已有账号（1 是 / 0 否）',
    `default_role_codes` VARCHAR(255) NULL COMMENT '首次登录自动建号时授予的角色编码（逗号分隔）',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '1 启用 / 0 停用',
    `sort` INT NOT NULL DEFAULT 0 COMMENT '排序',
    `remark` VARCHAR(255) NULL COMMENT '备注',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    `updated_at` DATETIME(3) NOT NULL COMMENT '更新时间',

    INDEX `sys_sso_provider_status_sort_idx`(`status`, `sort`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: 用户与 SSO 提供方的绑定关系
CREATE TABLE `sys_user_sso` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `user_id` BIGINT NOT NULL COMMENT '本地用户 id',
    `provider_id` BIGINT NOT NULL COMMENT '提供方 id',
    `subject` VARCHAR(255) NOT NULL COMMENT '提供方体系内的用户标识（sub claim）',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '绑定时间',

    UNIQUE INDEX `sys_user_sso_provider_id_subject_key`(`provider_id`, `subject`),
    INDEX `sys_user_sso_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;