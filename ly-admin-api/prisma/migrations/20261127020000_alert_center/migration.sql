-- CreateTable: 告警渠道配置表
CREATE TABLE `sys_alert_channel` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `type` VARCHAR(20) NOT NULL COMMENT '渠道类型：email / webhook / dingtalk / wecom / feishu',
    `name` VARCHAR(50) NOT NULL COMMENT '渠道名称（如「运维邮件」「安全 Webhook」）',
    `config` TEXT NOT NULL COMMENT '渠道配置（JSON；敏感字段为信封密文）',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '1 启用 / 0 停用',
    `sort` INT NOT NULL DEFAULT 0 COMMENT '排序',
    `remark` VARCHAR(255) NULL COMMENT '备注',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    `updated_at` DATETIME(3) NOT NULL COMMENT '更新时间',

    INDEX `sys_alert_channel_status_sort_idx`(`status`, `sort`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: 告警规则表
CREATE TABLE `sys_alert_rule` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `name` VARCHAR(50) NOT NULL COMMENT '规则名称',
    `event_type` VARCHAR(50) NOT NULL COMMENT '触发事件类型（如 export.failed / login.bruteForce / monitor.disk）',
    `level` VARCHAR(20) NOT NULL DEFAULT 'warning' COMMENT '告警级别：info / warning / critical',
    `channel_ids` TEXT NOT NULL COMMENT '渠道 id 列表（JSON 数组；只投递给启用中的渠道）',
    `cooldown_seconds` INT NOT NULL DEFAULT 300 COMMENT '静默间隔（秒）：同一规则的同一去重键在该窗口内只告警一次',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '1 启用 / 0 停用',
    `remark` VARCHAR(255) NULL COMMENT '备注',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    `updated_at` DATETIME(3) NOT NULL COMMENT '更新时间',

    INDEX `sys_alert_rule_status_idx`(`status`),
    INDEX `sys_alert_rule_event_type_idx`(`event_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: 告警投递记录表
CREATE TABLE `sys_alert_record` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `rule_id` BIGINT NOT NULL DEFAULT 0 COMMENT '触发规则 id（手动测试发送时为 0）',
    `rule_name` VARCHAR(50) NOT NULL COMMENT '规则名称快照',
    `event_type` VARCHAR(50) NOT NULL COMMENT '事件类型',
    `level` VARCHAR(20) NOT NULL COMMENT '告警级别',
    `title` VARCHAR(255) NOT NULL COMMENT '告警标题',
    `message` TEXT NOT NULL COMMENT '告警内容',
    `payload` TEXT NULL COMMENT '事件负载（JSON，便于排查）',
    `channel_ids` TEXT NOT NULL COMMENT '目标渠道 id 列表（JSON 数组）',
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT '投递状态：pending 待投递 / sent 已投递 / failed 全部渠道失败',
    `results` TEXT NULL COMMENT '各渠道投递结果（JSON：{ channelId: { ok, error } }）',
    `retries` INT NOT NULL DEFAULT 0 COMMENT '重试次数',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    `sent_at` DATETIME(3) NULL COMMENT '投递完成时间',

    INDEX `sys_alert_record_created_at_idx`(`created_at`),
    INDEX `sys_alert_record_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;