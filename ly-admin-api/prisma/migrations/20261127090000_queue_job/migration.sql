-- CreateTable: 通用任务队列表
CREATE TABLE `sys_queue_job` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `type` VARCHAR(50) NOT NULL COMMENT '任务类型（如 data.import / report.generate）',
    `title` VARCHAR(100) NOT NULL COMMENT '任务标题（展示用）',
    `payload` TEXT NOT NULL COMMENT '任务负载（JSON）',
    `idem_key` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '幂等键（唯一：同键重复入队直接返回已有任务，0 = 不启用）',
    `max_attempts` INT NOT NULL DEFAULT 3 COMMENT '最大尝试次数（含首次）',
    `attempts` INT NOT NULL DEFAULT 0 COMMENT '已尝试次数',
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT '状态：pending 待执行 / running 执行中 / done 成功 / dead 多次失败放弃',
    `avail_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '下次可执行时间（指数退避：availAt = now + base * 2^(attempts-1)）',
    `last_error` VARCHAR(500) NULL COMMENT '最近一次错误（截断）',
    `started_at` DATETIME(3) NULL COMMENT '最近一次开始执行时间（兜底回收僵尸 running 用）',
    `finished_at` DATETIME(3) NULL COMMENT '完成时间',
    `created_by` BIGINT NOT NULL DEFAULT 0 COMMENT '创建人（0 = 系统）',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    `updated_at` DATETIME(3) NOT NULL COMMENT '更新时间',

    UNIQUE INDEX `sys_queue_job_idem_key_key`(`idem_key`),
    INDEX `sys_queue_job_status_avail_at_idx`(`status`, `avail_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;