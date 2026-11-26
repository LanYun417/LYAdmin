-- CreateTable: 服务账号 / API Key 表
CREATE TABLE `sys_api_key` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `name` VARCHAR(50) NOT NULL COMMENT '密钥名称（备注用途，如「CI 部署」「数据分析同步」）',
    `prefix` VARCHAR(20) NOT NULL COMMENT '密钥前缀（展示用，如 lyak_a1b2c3d4）',
    `key_hash` VARCHAR(64) NOT NULL COMMENT '密钥 SHA-256 哈希（校验时比对）',
    `user_id` BIGINT NOT NULL COMMENT '绑定的用户 id（Key 以该用户身份调用接口，权限同该用户）',
    `scopes` TEXT NOT NULL COMMENT '权限范围：空 = 与所属用户完全一致；否则仅限列出的权限码',
    `allow_ips` TEXT NOT NULL COMMENT '允许的调用 IP / CIDR（JSON 数组；空 = 不限制）',
    `expires_at` DATETIME(3) NULL COMMENT '过期时间（NULL = 永久）',
    `last_used_at` DATETIME(3) NULL COMMENT '最后使用时间',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '1 启用 / 0 停用',
    `remark` VARCHAR(255) NULL COMMENT '备注',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    `updated_at` DATETIME(3) NOT NULL COMMENT '更新时间',

    INDEX `sys_api_key_user_id_status_idx`(`user_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: Webhook 订阅表
CREATE TABLE `sys_webhook` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `name` VARCHAR(50) NOT NULL COMMENT '订阅名称',
    `url` VARCHAR(500) NOT NULL COMMENT '目标 URL',
    `events` TEXT NOT NULL COMMENT '订阅事件（JSON 数组，如 ["user.created","export.finished"]；空数组 = 全部）',
    `secret` VARCHAR(500) NOT NULL COMMENT '签名密钥（信封加密；HMAC-SHA256 签名放在 X-LY-Signature 头）',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '1 启用 / 0 停用',
    `last_status` VARCHAR(20) NULL COMMENT '最近一次投递状态（pending / ok / failed，仅展示）',
    `last_push_at` DATETIME(3) NULL COMMENT '最近一次投递时间',
    `remark` VARCHAR(255) NULL COMMENT '备注',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    `updated_at` DATETIME(3) NOT NULL COMMENT '更新时间',

    INDEX `sys_webhook_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: Webhook 投递记录表
CREATE TABLE `sys_webhook_delivery` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `webhook_id` BIGINT NOT NULL COMMENT '订阅 id',
    `event` VARCHAR(50) NOT NULL COMMENT '事件名',
    `payload` TEXT NOT NULL COMMENT '事件负载（JSON）',
    `status_code` INT NOT NULL DEFAULT 0 COMMENT '响应状态码（0 = 未到达）',
    `status` VARCHAR(20) NOT NULL COMMENT '投递结果：ok / failed',
    `error` VARCHAR(500) NULL COMMENT '错误信息（截断）',
    `duration` INT NOT NULL DEFAULT 0 COMMENT '耗时（ms）',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',

    INDEX `sys_webhook_delivery_webhook_id_created_at_idx`(`webhook_id`, `created_at`),
    INDEX `sys_webhook_delivery_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;