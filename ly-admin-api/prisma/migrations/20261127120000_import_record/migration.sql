-- CreateTable: 导入记录表
CREATE TABLE `sys_import_record` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `job_id` BIGINT NOT NULL COMMENT '队列任务 id（sys_queue_job）',
    `type` VARCHAR(50) NOT NULL COMMENT '导入类型（如 users）',
    `title` VARCHAR(100) NOT NULL COMMENT '标题（队列任务标题快照）',
    `file_name` VARCHAR(255) NOT NULL COMMENT '原始文件名',
    `total` INT NOT NULL DEFAULT 0 COMMENT '总行数',
    `created` INT NOT NULL DEFAULT 0 COMMENT '成功行数',
    `failed` TEXT NOT NULL COMMENT '逐行失败报告（JSON：[{ row, message }]）',
    `status` VARCHAR(20) NOT NULL DEFAULT 'ok' COMMENT 'ok 全部成功 / partial 部分失败 / failed 全部失败',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',

    INDEX `sys_import_record_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;