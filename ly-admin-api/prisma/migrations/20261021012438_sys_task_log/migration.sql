-- CreateTable
CREATE TABLE `sys_task_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `task_name` VARCHAR(64) NOT NULL,
    `task_title` VARCHAR(100) NOT NULL,
    `trigger_type` TINYINT NOT NULL,
    `status` TINYINT NOT NULL,
    `started_at` DATETIME(3) NOT NULL,
    `finished_at` DATETIME(3) NULL,
    `duration` INTEGER NOT NULL DEFAULT 0,
    `error_message` VARCHAR(1000) NULL,
    `operator` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sys_task_log_task_name_started_at_idx`(`task_name`, `started_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
