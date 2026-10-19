-- AlterTable
ALTER TABLE `sys_file` ADD COLUMN `biz_id` BIGINT NULL,
    ADD COLUMN `biz_type` VARCHAR(50) NULL;

-- CreateIndex
CREATE INDEX `sys_file_uploader_id_idx` ON `sys_file`(`uploader_id`);

-- CreateIndex
CREATE INDEX `sys_file_biz_type_biz_id_idx` ON `sys_file`(`biz_type`, `biz_id`);
