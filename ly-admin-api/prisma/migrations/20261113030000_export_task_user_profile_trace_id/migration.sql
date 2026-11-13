-- AlterTable
ALTER TABLE `sys_operation_log` ADD COLUMN `trace_id` VARCHAR(64) NULL;

-- AlterTable
ALTER TABLE `sys_http_log` ADD COLUMN `trace_id` VARCHAR(64) NULL;

-- CreateTable
CREATE TABLE `sys_export_task` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `username` VARCHAR(50) NOT NULL,
    `module` VARCHAR(30) NOT NULL,
    `query` JSON NULL,
    `timezone_offset` INTEGER NULL,
    `status` TINYINT NOT NULL DEFAULT 0,
    `file_name` VARCHAR(255) NULL,
    `file_path` VARCHAR(500) NULL,
    `total` INTEGER NOT NULL DEFAULT 0,
    `size` BIGINT NOT NULL DEFAULT 0,
    `message` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finished_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NULL,

    INDEX `sys_export_task_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `sys_export_task_status_idx`(`status`),
    INDEX `sys_export_task_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_user_profile` (
    `user_id` BIGINT NOT NULL,
    `signature` VARCHAR(200) NULL,
    `birthday` DATE NULL,
    `company` VARCHAR(100) NULL,
    `position` VARCHAR(50) NULL,
    `address` VARCHAR(200) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

