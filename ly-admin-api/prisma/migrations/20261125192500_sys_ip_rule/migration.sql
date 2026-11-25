-- CreateTable: IP 访问控制规则（黑名单 / 白名单）
CREATE TABLE `sys_ip_rule` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `ip` VARCHAR(100) NOT NULL,
    `rule_type` TINYINT NOT NULL,
    `remark` VARCHAR(255) NULL,
    `status` TINYINT NOT NULL DEFAULT 1,
    `expires_at` DATETIME(3) NULL,
    `hit_count` INT NOT NULL DEFAULT 0,
    `created_by` BIGINT NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sys_ip_rule_ip_key`(`ip`),
    INDEX `sys_ip_rule_rule_type_status_idx`(`rule_type`, `status`),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
