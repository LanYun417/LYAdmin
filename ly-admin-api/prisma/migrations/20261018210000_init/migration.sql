-- CreateTable
CREATE TABLE `sys_config` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `config_name` VARCHAR(100) NOT NULL,
    `config_key` VARCHAR(100) NOT NULL,
    `config_value` VARCHAR(500) NOT NULL DEFAULT '',
    `system_flag` TINYINT NOT NULL DEFAULT 0,
    `remark` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sys_config_config_key_key`(`config_key` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_dept` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `parent_id` BIGINT NOT NULL DEFAULT 0,
    `dept_name` VARCHAR(50) NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` TINYINT NOT NULL DEFAULT 1,
    `leader` VARCHAR(20) NULL,
    `phone` VARCHAR(20) NULL,
    `email` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `dept_type` TINYINT NOT NULL DEFAULT 1,

    INDEX `sys_dept_parent_id_idx`(`parent_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_dict_item` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `dict_type` VARCHAR(100) NOT NULL,
    `dict_label` VARCHAR(100) NOT NULL,
    `dict_value` VARCHAR(100) NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` TINYINT NOT NULL DEFAULT 1,
    `remark` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sys_dict_item_dict_type_idx`(`dict_type` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_dict_type` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `dict_name` VARCHAR(100) NOT NULL,
    `dict_type` VARCHAR(100) NOT NULL,
    `status` TINYINT NOT NULL DEFAULT 1,
    `remark` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sys_dict_type_dict_type_key`(`dict_type` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_file` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `origin_name` VARCHAR(255) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_path` VARCHAR(500) NOT NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `size` INTEGER NOT NULL DEFAULT 0,
    `hash` VARCHAR(64) NULL,
    `uploader_id` BIGINT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sys_file_hash_idx`(`hash` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_http_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `time` DATETIME(3) NOT NULL,
    `method` VARCHAR(10) NOT NULL,
    `url` VARCHAR(1024) NOT NULL,
    `status_code` SMALLINT NOT NULL,
    `duration` INTEGER NOT NULL DEFAULT 0,
    `ip` VARCHAR(64) NULL,
    `user_agent` VARCHAR(500) NULL,
    `user_id` BIGINT NOT NULL DEFAULT 0,
    `username` VARCHAR(50) NULL,
    `dept_id` BIGINT NOT NULL DEFAULT 0,
    `dept_name` VARCHAR(50) NULL,
    `query` JSON NULL,
    `req_body` TEXT NULL,
    `res_body` TEXT NULL,
    `location` VARCHAR(100) NULL,

    INDEX `sys_http_log_dept_id_idx`(`dept_id` ASC),
    INDEX `sys_http_log_method_idx`(`method` ASC),
    INDEX `sys_http_log_method_time_idx`(`method` ASC, `time` ASC),
    INDEX `sys_http_log_status_code_idx`(`status_code` ASC),
    INDEX `sys_http_log_time_idx`(`time` ASC),
    INDEX `sys_http_log_user_id_idx`(`user_id` ASC),
    INDEX `sys_http_log_username_idx`(`username` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_login_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(50) NOT NULL,
    `ip` VARCHAR(50) NULL,
    `user_agent` VARCHAR(500) NULL,
    `status` TINYINT NOT NULL,
    `message` VARCHAR(255) NULL,
    `login_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `location` VARCHAR(100) NULL,

    INDEX `sys_login_log_login_at_idx`(`login_at` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_menu` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `parent_id` BIGINT NOT NULL DEFAULT 0,
    `menu_name` VARCHAR(50) NOT NULL,
    `menu_type` CHAR(1) NOT NULL,
    `path` VARCHAR(200) NULL,
    `component` VARCHAR(255) NULL,
    `icon` VARCHAR(100) NULL,
    `permission` VARCHAR(100) NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `visible` TINYINT NOT NULL DEFAULT 1,
    `status` TINYINT NOT NULL DEFAULT 1,
    `redirect` VARCHAR(255) NULL,
    `keep_alive` TINYINT NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sys_menu_parent_id_idx`(`parent_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_operation_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NULL,
    `username` VARCHAR(50) NULL,
    `module` VARCHAR(50) NOT NULL,
    `action` VARCHAR(50) NOT NULL,
    `method` VARCHAR(10) NOT NULL,
    `url` VARCHAR(255) NOT NULL,
    `params` TEXT NULL,
    `duration` INTEGER NOT NULL DEFAULT 0,
    `result` TINYINT NOT NULL,
    `error_message` VARCHAR(500) NULL,
    `ip` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `location` VARCHAR(100) NULL,

    INDEX `sys_operation_log_created_at_idx`(`created_at` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_role` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `role_name` VARCHAR(50) NOT NULL,
    `role_code` VARCHAR(50) NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` TINYINT NOT NULL DEFAULT 1,
    `data_scope` TINYINT NOT NULL DEFAULT 1,
    `remark` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sys_role_role_code_key`(`role_code` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_role_dept` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `role_id` BIGINT NOT NULL,
    `dept_id` BIGINT NOT NULL,

    INDEX `sys_role_dept_dept_id_idx`(`dept_id` ASC),
    UNIQUE INDEX `sys_role_dept_role_id_dept_id`(`role_id` ASC, `dept_id` ASC),
    UNIQUE INDEX `sys_role_dept_role_id_dept_id_key`(`role_id` ASC, `dept_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_role_menu` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `role_id` BIGINT NOT NULL,
    `menu_id` BIGINT NOT NULL,

    INDEX `sys_role_menu_menu_id_idx`(`menu_id` ASC),
    UNIQUE INDEX `sys_role_menu_role_id_menu_id`(`role_id` ASC, `menu_id` ASC),
    UNIQUE INDEX `sys_role_menu_role_id_menu_id_key`(`role_id` ASC, `menu_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_user` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(50) NOT NULL,
    `password` VARCHAR(100) NOT NULL,
    `nickname` VARCHAR(50) NOT NULL DEFAULT '',
    `avatar` VARCHAR(255) NULL,
    `email` VARCHAR(100) NULL,
    `phone` VARCHAR(20) NULL,
    `gender` VARCHAR(20) NULL,
    `status` TINYINT NOT NULL DEFAULT 1,
    `last_login_at` DATETIME(3) NULL,
    `password_changed_at` DATETIME(3) NULL,
    `remark` VARCHAR(255) NULL,
    `dept_id` BIGINT NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sys_user_dept_id_idx`(`dept_id` ASC),
    UNIQUE INDEX `sys_user_username_key`(`username` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_user_role` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `role_id` BIGINT NOT NULL,

    INDEX `sys_user_role_role_id_idx`(`role_id` ASC),
    UNIQUE INDEX `sys_user_role_user_id_role_id`(`user_id` ASC, `role_id` ASC),
    UNIQUE INDEX `sys_user_role_user_id_role_id_key`(`user_id` ASC, `role_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sys_dict_item` ADD CONSTRAINT `sys_dict_item_dict_type_fkey` FOREIGN KEY (`dict_type`) REFERENCES `sys_dict_type`(`dict_type`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sys_role_dept` ADD CONSTRAINT `sys_role_dept_dept_id_fkey` FOREIGN KEY (`dept_id`) REFERENCES `sys_dept`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sys_role_dept` ADD CONSTRAINT `sys_role_dept_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `sys_role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sys_role_menu` ADD CONSTRAINT `sys_role_menu_menu_id_fkey` FOREIGN KEY (`menu_id`) REFERENCES `sys_menu`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sys_role_menu` ADD CONSTRAINT `sys_role_menu_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `sys_role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sys_user_role` ADD CONSTRAINT `sys_user_role_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `sys_role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sys_user_role` ADD CONSTRAINT `sys_user_role_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `sys_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

