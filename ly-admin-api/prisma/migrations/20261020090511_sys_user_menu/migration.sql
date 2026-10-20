-- CreateTable
CREATE TABLE `sys_user_menu` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `menu_id` BIGINT NOT NULL,
    `type` TINYINT NOT NULL,

    INDEX `sys_user_menu_menu_id_idx`(`menu_id`),
    UNIQUE INDEX `sys_user_menu_user_id_menu_id_key`(`user_id`, `menu_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sys_user_menu` ADD CONSTRAINT `sys_user_menu_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `sys_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sys_user_menu` ADD CONSTRAINT `sys_user_menu_menu_id_fkey` FOREIGN KEY (`menu_id`) REFERENCES `sys_menu`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
